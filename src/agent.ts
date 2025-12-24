/**
 * PhoneAgent - 手机自动化代理（豆包版本）
 * 使用结构化工具调用替代文本解析
 */

import { type ActionContext, executeAction } from "./actions/index.ts";
import * as adb from "./adb.ts";
import { buildSystemPrompt } from "./config.ts";
import { type Message, type StreamParseEvent, streamWithTools } from "./llm.ts";

// 步骤结果
export type StepResult = {
  success: boolean;
  finished: boolean;
  thinking: string;
  action?: Record<string, unknown>;
  message?: string;
};

// 步骤事件（流式）
export type StepEvent =
  | { type: "screenshot"; screenshot: string } // 新增：截图事件
  | { type: "thinking"; thinking: string }
  | { type: "action"; action: Record<string, unknown> }
  | { type: "done"; result: StepResult };

// 任务事件（给 router 用）
export type TaskEvent =
  | { type: "started" }
  | { type: "screenshot"; stepIndex: number; screenshot: string }
  | {
      type: "thinking";
      stepIndex: number;
      thinking: string;
      screenshot: string;
    }
  | {
      type: "action";
      stepIndex: number;
      action: Record<string, unknown>;
      screenshot: string;
    }
  | { type: "step"; step: StepData }
  | { type: "completed"; result: string }
  | { type: "cancelled" }
  | { type: "failed"; error: string };

export type StepData = {
  index: number;
  thinking: string;
  action?: Record<string, unknown>;
  screenshot: string;
  success: boolean;
  finished: boolean;
  message?: string;
};

type AgentConfig = {
  deviceId?: string;
  signal?: AbortSignal;
  historyMessages?: Array<{ role: "user" | "assistant"; content: string }>;
};

/**
 * 创建 Agent
 */
export const createAgent = (config: AgentConfig = {}) => {
  const { deviceId, signal, historyMessages = [] } = config;
  const maxSteps = Number.parseInt(process.env.AUTOGLM_MAX_STEPS || "100", 10);

  // 状态
  let messages: Message[] = [];
  let currentTask = "";
  let stepCount = 0;
  let lastScreenshot = ""; // 缓存最后一张截图

  const reset = () => {
    messages = [];
    currentTask = "";
    stepCount = 0;
    lastScreenshot = "";
  };

  /**
   * 执行一步（底层 generator）
   * 使用豆包工具调用替代文本解析
   */
  const step = async function* (task?: string): AsyncGenerator<StepEvent> {
    stepCount++;

    if (task) currentTask = task;
    if (!currentTask) throw new Error("需要设置 task");

    const isFirst = messages.length === 0;

    // 获取屏幕状态
    const screenshot = await adb.getScreenshot(deviceId);
    lastScreenshot = screenshot.base64;
    const currentApp = await adb.getCurrentApp(deviceId);

    // yield 截图（让调用者知道当前屏幕）
    yield { type: "screenshot", screenshot: screenshot.base64 };

    // 构建消息
    if (isFirst) {
      messages.push({ role: "system", content: buildSystemPrompt() });
      for (const msg of historyMessages) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const screenInfo = `当前应用: ${currentApp}`;
    const text = isFirst ? `${currentTask}\n\n${screenInfo}` : screenInfo;

    messages.push({
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:image/png;base64,${screenshot.base64}` },
        },
        { type: "text", text },
      ],
    });

    // 调用模型（流式工具调用）
    let reasoningText = "";
    let toolCall: {
      toolName: string;
      arguments: Record<string, unknown>;
    } | null = null;

    try {
      const stream = streamWithTools(messages, signal);

      for await (const event of stream) {
        if (event.type === "thinking") {
          reasoningText = event.thinking;
          yield { type: "thinking", thinking: event.thinking };
        } else if (event.type === "tool_call") {
          toolCall = { toolName: event.toolName, arguments: event.arguments };
        } else if (event.type === "done") {
          // 完成
        }
      }
    } catch (e) {
      yield {
        type: "done",
        result: {
          success: false,
          finished: true,
          thinking: "",
          message: `模型错误: ${e}`,
        },
      };
      return;
    }

    // 解析响应
    // 在豆包模式下，toolCall 包含结构化参数
    // 不再需要 parseResponse 解析文本

    // 记录 assistant 响应
    messages.push({
      role: "assistant",
      content: reasoningText || "工具调用完成",
    });

    // 处理工具调用
    if (toolCall) {
      const actionObj = convertToolCallToAction(toolCall);
      if (actionObj) {
        // yield action（执行前）
        yield { type: "action", action: actionObj };

        // 移除历史图片（节省 token）
        const prevUserMsg = messages.at(-2);
        if (prevUserMsg && Array.isArray(prevUserMsg.content)) {
          prevUserMsg.content = prevUserMsg.content.filter(
            (c) => c.type === "text",
          );
        }

        // 执行动作
        const ctx: ActionContext = {
          deviceId,
          screenWidth: screenshot.width,
          screenHeight: screenshot.height,
        };

        const execResult = await executeAction(actionObj, ctx);

        const isFinish = actionObj.action === "finish";
        yield {
          type: "done",
          result: {
            success: execResult.success,
            finished: isFinish || execResult.finished || false,
            thinking: reasoningText,
            action: actionObj,
            message:
              execResult.message ||
              (isFinish ? (actionObj.message as string) : undefined),
          },
        };
      } else {
        // 工具调用失败
        yield {
          type: "done",
          result: {
            success: false,
            finished: false,
            thinking: reasoningText,
            message: `无法处理工具调用: ${toolCall.toolName}`,
          },
        };
      }
    } else {
      // 没有工具调用 -> 当作完成
      yield {
        type: "done",
        result: {
          success: true,
          finished: true,
          thinking: reasoningText,
          message: reasoningText,
        },
      };
    }
  };

  /**
   * 运行完整任务（流式，给 router 用）
   */
  const runTask = async function* (task: string): AsyncGenerator<TaskEvent> {
    reset();
    yield { type: "started" };

    let stepIndex = 0;
    let result: StepResult | undefined;
    let lastThinking = "";

    try {
      do {
        if (signal?.aborted) {
          yield { type: "cancelled" };
          return;
        }

        let currentThinking = "";
        let currentScreenshot = "";

        for await (const event of step(stepIndex === 0 ? task : undefined)) {
          if (event.type === "screenshot") {
            currentScreenshot = event.screenshot;
            yield {
              type: "screenshot",
              stepIndex,
              screenshot: event.screenshot,
            };
          } else if (event.type === "thinking") {
            currentThinking = event.thinking;
            yield {
              type: "thinking",
              stepIndex,
              thinking: event.thinking,
              screenshot: currentScreenshot,
            };
          } else if (event.type === "action") {
            yield {
              type: "action",
              stepIndex,
              action: event.action,
              screenshot: currentScreenshot,
            };
          } else if (event.type === "done") {
            result = event.result;
            lastThinking = result.thinking || currentThinking;
          }
        }

        if (!result) {
          yield { type: "failed", error: "步骤未返回结果" };
          return;
        }

        yield {
          type: "step",
          step: {
            index: stepIndex++,
            thinking: result.thinking,
            action: result.action,
            screenshot: currentScreenshot,
            success: result.success,
            finished: result.finished,
            message: result.message,
          },
        };
      } while (!result?.finished && stepIndex < maxSteps);

      yield {
        type: "completed",
        result: result?.message || lastThinking || "完成",
      };
    } catch (e) {
      yield { type: "failed", error: String(e) };
    }
  };

  /**
   * 运行完整任务（简单版，返回最终结果）
   */
  const run = async (task: string) => {
    let finalResult = "完成";
    for await (const event of runTask(task)) {
      if (event.type === "completed") finalResult = event.result;
      else if (event.type === "failed") throw new Error(event.error);
      else if (event.type === "cancelled") return "任务已取消";
    }
    return finalResult;
  };

  return { run, runTask, step, reset, getLastScreenshot: () => lastScreenshot };
};

/**
 * 将工具调用转换为 Action 对象
 */
const convertToolCallToAction = (toolCall: {
  toolName: string;
  arguments: Record<string, unknown>;
}): Record<string, unknown> | null => {
  const { toolName, arguments: args } = toolCall;

  // 验证和转换坐标的工具函数
  const validateCoordinate = (
    x: unknown,
    y: unknown,
    name: string,
  ): [number, number] | null => {
    const numX = Number(x);
    const numY = Number(y);

    if (Number.isNaN(numX) || Number.isNaN(numY)) {
      console.warn(`${name}: 坐标必须是数字`, { x, y });
      return null;
    }

    if (numX < 0 || numX > 1000 || numY < 0 || numY > 1000) {
      console.warn(`${name}: 坐标超出范围 (0-1000)`, { x: numX, y: numY });
      return null;
    }

    return [numX, numY];
  };

  switch (toolName) {
    case "launch_app":
      return { action: "Launch", app: args.app };

    case "tap_screen": {
      const coord = validateCoordinate(args.x, args.y, "tap_screen");
      if (!coord) return null;
      return { action: "Tap", element: coord };
    }

    case "type_text":
      return { action: "Type", text: args.text };

    case "type_name":
      return { action: "Type_Name", text: args.text };

    case "interact":
      return { action: "Interact" };

    case "swipe_screen": {
      const start = validateCoordinate(
        args.start_x,
        args.start_y,
        "swipe_screen start",
      );
      const end = validateCoordinate(
        args.end_x,
        args.end_y,
        "swipe_screen end",
      );
      if (!start || !end) return null;
      return {
        action: "Swipe",
        start,
        end,
      };
    }

    case "long_press": {
      const coord = validateCoordinate(args.x, args.y, "long_press");
      if (!coord) return null;
      return { action: "Long_Press", element: coord };
    }

    case "double_tap": {
      const coord = validateCoordinate(args.x, args.y, "double_tap");
      if (!coord) return null;
      return { action: "Double_Tap", element: coord };
    }

    case "back":
      return { action: "Back" };

    case "home":
      return { action: "Home" };

    case "wait":
      return { action: "Wait", duration: args.duration };

    case "take_over":
      return { action: "Take_over", message: args.message };

    case "note":
      return { action: "Note", content: args.content };

    case "call_api":
      return { action: "Call_API", instruction: args.instruction };

    case "finish":
      return { action: "finish", message: args.message };

    default:
      console.warn(`未知工具: ${toolName}`);
      return null;
  }
};
