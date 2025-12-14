/**
 * oRPC Server Router - API 定义
 */

import { os } from "@orpc/server";
import { z } from "zod";
import * as adb from "../actions/adb.ts";
import { type StepResult, createAgent } from "../agent.ts";
import {
  appendAssistantMessage,
  appendUserMessage,
  closeSession,
  createSession,
  getHistoryMessages,
  getSession,
} from "../session.ts";

// Schema 定义
const StepSchema = z.object({
  index: z.number(),
  thinking: z.string(),
  action: z.record(z.string(), z.unknown()).optional(),
  screenshot: z.string(), // base64
  success: z.boolean(),
  finished: z.boolean(),
  message: z.string().optional(),
});

// ============ Session 相关 ============

export const sessionCreate = os
  .input(z.object({ deviceId: z.string() }))
  .handler(async ({ input }) => {
    const session = createSession(input.deviceId);
    return {
      id: session.id,
      deviceId: session.deviceId,
      messages: session.messages,
    };
  });

export const sessionClose = os.handler(async () => {
  closeSession();
  return { success: true };
});

export const sessionGet = os.handler(async () => {
  const session = getSession();
  if (!session) {
    return null;
  }

  // 检查设备是否仍然连接
  const devices = await adb.listDevices();
  const deviceConnected = devices.some((d) => d.deviceId === session.deviceId);
  if (!deviceConnected) {
    // 设备断开，销毁 session
    closeSession();
    return null;
  }

  return {
    id: session.id,
    deviceId: session.deviceId,
    messages: session.messages,
  };
});

// ============ 设备相关 ============

export const listDevices = os.handler(async () => {
  const devices = await adb.listDevices();
  // 并行获取所有设备截图
  const devicesWithScreenshot = await Promise.all(
    devices.map(async (d) => {
      try {
        const screenshot = await adb.getScreenshot(d.deviceId);
        return { ...d, screenshot: screenshot.base64 };
      } catch {
        return { ...d, screenshot: undefined };
      }
    }),
  );
  return devicesWithScreenshot;
});

export const deviceHome = os
  .input(z.object({ deviceId: z.string().optional() }))
  .handler(async ({ input }) => {
    await adb.home(input.deviceId);
    return { success: true };
  });

export const deviceRecent = os
  .input(z.object({ deviceId: z.string().optional() }))
  .handler(async ({ input }) => {
    await adb.recent(input.deviceId);
    return { success: true };
  });

export const deviceScreenshot = os
  .input(z.object({ deviceId: z.string().optional() }))
  .handler(async ({ input }) => {
    const screenshot = await adb.getScreenshot(input.deviceId);
    return { screenshot: screenshot.base64 };
  });

export const deviceTap = os
  .input(
    z.object({
      deviceId: z.string().optional(),
      x: z.number(),
      y: z.number(),
    }),
  )
  .handler(async ({ input }) => {
    await adb.tap(input.x, input.y, input.deviceId);
    return { success: true };
  });

export const deviceSwipe = os
  .input(
    z.object({
      deviceId: z.string().optional(),
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
      duration: z.number().optional(),
    }),
  )
  .handler(async ({ input }) => {
    await adb.swipe(
      input.x1,
      input.y1,
      input.x2,
      input.y2,
      input.duration ?? 300,
      input.deviceId,
    );
    return { success: true };
  });

// ============ 任务相关 ============

export const startTask = os
  .input(z.object({ task: z.string().min(1) }))
  .handler(async function* ({ input }) {
    const session = getSession();
    if (!session) {
      yield { type: "error" as const, error: "请先创建会话" };
      return;
    }

    // 追加用户消息到 session
    appendUserMessage(input.task);

    // 创建 agent，传入历史上下文和 signal
    const agent = createAgent({
      deviceId: session.deviceId,
      signal: session.abortController.signal,
      historyMessages: getHistoryMessages().slice(0, -1), // 排除刚添加的当前任务
    });

    yield { type: "started" as const };

    try {
      agent.reset();
      let stepIndex = 0;
      let result: StepResult | undefined;
      let lastThinking = "";

      do {
        // 检查是否被取消
        if (session.abortController.signal.aborted) {
          yield { type: "cancelled" as const };
          return;
        }

        // 获取截图
        const screenshot = await adb.getScreenshot(session.deviceId);

        // 先发送截图，让前端显示"思考中"
        yield { type: "thinking" as const, screenshot: screenshot.base64 };

        // 执行一步（generator）- 使用 for await...of 处理所有事件
        let currentThinking = "";
        let currentAction: Record<string, unknown> | undefined;

        for await (const event of agent.step(
          stepIndex === 0 ? input.task : undefined,
        )) {
          if (event.type === "thinking") {
            currentThinking = event.thinking;
            // 立即发送 thinking
            yield {
              type: "inference" as const,
              thinking: currentThinking,
              screenshot: screenshot.base64,
            };
          } else if (event.type === "action") {
            currentAction = event.action;
            // 立即发送 action（执行前）
            yield {
              type: "action" as const,
              action: currentAction,
              screenshot: screenshot.base64,
            };
          } else if (event.type === "done") {
            result = event.result;
            lastThinking = result.thinking || currentThinking;
          }
        }

        // 发送执行结果
        if (!result) {
          yield { type: "failed" as const, error: "步骤未返回结果" };
          return;
        }

        const step: z.infer<typeof StepSchema> = {
          index: stepIndex++,
          thinking: result.thinking,
          action: result.action,
          screenshot: screenshot.base64,
          success: result.success,
          finished: result.finished,
          message: result.message,
        };

        yield { type: "step" as const, step };
      } while (!result?.finished && stepIndex < 100);

      // 追加助手消息到 session（包含最终结果）
      const assistantMessage = result?.message || lastThinking || "完成";
      appendAssistantMessage(assistantMessage);

      yield { type: "completed" as const, result: assistantMessage };
    } catch (e) {
      const errorMsg = String(e);
      // 如果是 abort 错误，不追加消息
      if (!errorMsg.includes("abort")) {
        appendAssistantMessage(`执行出错: ${errorMsg}`);
      }
      yield { type: "failed" as const, error: errorMsg };
    }
  });

export const cancelTask = os.handler(async () => {
  const session = getSession();
  if (session) {
    session.abortController.abort();
    // 重新创建 abortController 以便下次任务可以继续
    session.abortController = new AbortController();
  }
  return { success: true };
});

// ============ 配置 ============

export const configGet = os.handler(async () => {
  return {
    model: process.env.AUTOGLM_MODEL || "unknown",
  };
});

// ============ 路由 ============

export const router = {
  session: {
    create: sessionCreate,
    close: sessionClose,
    get: sessionGet,
  },
  device: {
    list: listDevices,
    home: deviceHome,
    recent: deviceRecent,
    screenshot: deviceScreenshot,
    tap: deviceTap,
    swipe: deviceSwipe,
  },
  task: {
    start: startTask,
    cancel: cancelTask,
  },
  config: {
    get: configGet,
  },
};

export type Router = typeof router;
