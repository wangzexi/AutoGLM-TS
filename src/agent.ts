/**
 * PhoneAgent - 手机自动化代理
 */

import * as adb from "./adb.ts";
import { type ActionContext, executeAction } from "./actions/index.ts";
import { buildSystemPrompt } from "./config.ts";
import { type Message, chat, parseResponse, streamParse } from "./llm.ts";

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
  | { type: "thinking"; stepIndex: number; thinking: string; screenshot: string }
  | { type: "action"; stepIndex: number; action: Record<string, unknown>; screenshot: string }
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

    // 调用模型（流式）
    let rawContent = "";

    try {
      const chunks = chat(messages, signal);

      for await (const event of streamParse(chunks)) {
        if (event.type === "thinking") {
          yield { type: "thinking", thinking: event.thinking };
        } else if (event.type === "done") {
          rawContent = event.content;
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
    const { thinking, action, error } = parseResponse(rawContent);

    // yield 完整 thinking
    if (thinking) {
      yield { type: "thinking", thinking };
    }

    // 记录 assistant 响应
    messages.push({ role: "assistant", content: rawContent });

    // 解析失败 -> 反馈给模型重试
    if (error) {
      messages.push({
        role: "user",
        content: `Action 格式错误: ${error}\n请修正后重新输出。`,
      });
      stepCount--;
      yield* step();
      return;
    }

    // 无 action -> 当作完成
    if (!action) {
      yield {
        type: "done",
        result: { success: true, finished: true, thinking, message: thinking },
      };
      return;
    }

    // yield action（执行前）
    const actionObj = action as Record<string, unknown>;
    yield { type: "action", action: actionObj };

    // 移除历史图片（节省 token）
    const prevUserMsg = messages.at(-2);
    if (prevUserMsg && Array.isArray(prevUserMsg.content)) {
      prevUserMsg.content = prevUserMsg.content.filter((c) => c.type === "text");
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
        thinking,
        action: actionObj,
        message:
          execResult.message ||
          (isFinish ? (actionObj.message as string) : undefined),
      },
    };
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
            yield { type: "screenshot", stepIndex, screenshot: event.screenshot };
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

      yield { type: "completed", result: result?.message || lastThinking || "完成" };
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
