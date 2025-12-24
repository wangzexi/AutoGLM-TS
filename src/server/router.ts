/**
 * oRPC Server Router - API 定义
 */

import { os } from "@orpc/server";
import { z } from "zod";
import * as adb from "../adb.ts";
import { type TaskEvent, createAgent } from "../agent.ts";
import { chat } from "../llm.ts";
import {
  appendAssistantMessage,
  appendUserMessage,
  closeSession,
  createSession,
  getHistoryMessages,
  getSession,
} from "../session.ts";

// ============ Session ============

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
  if (!session) return null;

  // 检查设备是否仍然连接
  const devices = await adb.listDevices();
  if (!devices.some((d) => d.deviceId === session.deviceId)) {
    closeSession();
    return null;
  }

  return {
    id: session.id,
    deviceId: session.deviceId,
    messages: session.messages,
  };
});

// ============ Device ============

export const listDevices = os.handler(async () => {
  const devices = await adb.listDevices();
  return Promise.all(
    devices.map(async (d) => {
      try {
        const screenshot = await adb.getScreenshot(d.deviceId);
        return { ...d, screenshot: screenshot.base64 };
      } catch {
        return { ...d, screenshot: undefined };
      }
    }),
  );
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
    z.object({ deviceId: z.string().optional(), x: z.number(), y: z.number() }),
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

// ============ Task ============

// 事件类型（router 输出）
type RouterEvent =
  | { type: "error"; error: string }
  | { type: "started" }
  | { type: "thinking"; stepIndex: number; screenshot: string }
  | {
      type: "inference";
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
  | { type: "step"; step: Record<string, unknown> }
  | { type: "completed"; result: string }
  | { type: "cancelled" }
  | { type: "failed"; error: string };

export const startTask = os
  .input(z.object({ task: z.string().min(1) }))
  .handler(async function* ({ input }): AsyncGenerator<RouterEvent> {
    const session = getSession();
    if (!session) {
      yield { type: "error", error: "请先创建会话" };
      return;
    }

    appendUserMessage(input.task);

    const agent = createAgent({
      deviceId: session.deviceId,
      signal: session.abortController.signal,
      historyMessages: getHistoryMessages().slice(0, -1),
    });

    let lastResult = "";
    let lastScreenshot = "";

    try {
      for await (const event of agent.runTask(input.task)) {
        // 转换事件格式
        if (event.type === "started") {
          yield { type: "started" };
        } else if (event.type === "screenshot") {
          lastScreenshot = event.screenshot;
          yield {
            type: "thinking",
            stepIndex: event.stepIndex,
            screenshot: event.screenshot,
          };
        } else if (event.type === "thinking") {
          lastScreenshot = event.screenshot;
          yield {
            type: "inference",
            stepIndex: event.stepIndex,
            thinking: event.thinking,
            screenshot: event.screenshot,
          };
        } else if (event.type === "action") {
          lastScreenshot = event.screenshot;
          yield {
            type: "action",
            stepIndex: event.stepIndex,
            action: event.action,
            screenshot: event.screenshot,
          };
        } else if (event.type === "step") {
          yield { type: "step", step: event.step };
        } else if (event.type === "completed") {
          lastResult = event.result;
          appendAssistantMessage(event.result, lastScreenshot);
          yield { type: "completed", result: event.result };
        } else if (event.type === "cancelled") {
          yield { type: "cancelled" };
        } else if (event.type === "failed") {
          if (!event.error.includes("abort")) {
            appendAssistantMessage(`执行出错: ${event.error}`, lastScreenshot);
          }
          yield { type: "failed", error: event.error };
        }
      }
    } catch (e) {
      const error = String(e);
      if (!error.includes("abort")) {
        appendAssistantMessage(`执行出错: ${error}`, lastScreenshot);
      }
      yield { type: "failed", error };
    }
  });

export const cancelTask = os.handler(async () => {
  const session = getSession();
  if (session) {
    session.abortController.abort();
    session.abortController = new AbortController();
  }
  return { success: true };
});

// ============ Config ============

export const configGet = os.handler(async () => ({
  model: process.env.DOUBAO_MODEL || "doubao-seed-1-6-vision-250815",
}));

// ============ Skill ============

export const generateSkill = os.handler(async () => {
  const messages = getHistoryMessages();
  if (messages.length === 0) {
    return { error: "没有会话历史" };
  }

  // 构建总结用的消息
  const summaryMessages = [
    {
      role: "system" as const,
      content: `你是一个任务总结助手。用户会给你一段手机自动化操作的对话历史，请总结出一个可复用的任务模板。

输出格式（严格遵守）：
<title>简短的任务名称，不超过10个字</title>
<content>详细的任务描述，描述这个任务要做什么，以便下次直接使用</content>

注意：
1. 标题要简洁明了，如"点瑞幸咖啡"、"搜索美食攻略"
2. 内容要具体但通用，不要包含特定的时间、地点等细节
3. 只输出 title 和 content 标签，不要有其他内容`,
    },
    {
      role: "user" as const,
      content: `请总结以下对话历史：\n\n${messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n\n")}`,
    },
  ];

  // 调用豆包模型生成总结
  let result = "";
  for await (const chunk of chat(summaryMessages)) {
    result += chunk;
  }

  // 解析结果
  const titleMatch = result.match(/<title>([\s\S]*?)<\/title>/);
  const contentMatch = result.match(/<content>([\s\S]*?)<\/content>/);

  if (!titleMatch || !contentMatch) {
    return { error: "解析失败", raw: result };
  }

  return {
    title: titleMatch[1].trim(),
    content: contentMatch[1].trim(),
  };
});

// ============ Router ============

export const router = {
  session: { create: sessionCreate, close: sessionClose, get: sessionGet },
  device: {
    list: listDevices,
    home: deviceHome,
    recent: deviceRecent,
    screenshot: deviceScreenshot,
    tap: deviceTap,
    swipe: deviceSwipe,
  },
  task: { start: startTask, cancel: cancelTask },
  config: { get: configGet },
  skill: { generate: generateSkill },
};

export type Router = typeof router;
