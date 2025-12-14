/**
 * LLM 调用和响应解析
 */

import type { Action } from "./actions/index.ts";
import { parseAction } from "./actions/index.ts";

// OpenAI 兼容消息格式
export type Message = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

// 解析结果
export type ParseResult = {
  thinking: string;
  action?: Action;
  error?: string;
};

// 流式事件
export type StreamEvent =
  | { type: "thinking"; thinking: string }
  | { type: "action_start" }
  | { type: "done"; content: string };

// 移除 XML 标签
const stripTags = (text: string) => text.replace(/<\/?[a-z_]+>/gi, "").trim();

// action markers
const ACTION_MARKERS = ["do(", "finish("];

/**
 * 流式调用 OpenAI 兼容 API
 */
export async function* chat(
  messages: Message[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const model = process.env.AUTOGLM_MODEL || "autoglm-phone";
  yield* chatWithModel(messages, model, signal);
}

/**
 * 使用指定模型调用 API
 */
export async function* chatWithModel(
  messages: Message[],
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const baseUrl =
    process.env.AUTOGLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
  const apiKey = process.env.AUTOGLM_API_KEY || "";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 3000,
      temperature: 0,
      top_p: 0.85,
      frequency_penalty: 0.2,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) throw new Error(`API 错误: ${res.status}`);
  if (!res.body) throw new Error("无响应体");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;

      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {}
    }
  }
}

/**
 * 流式解析 - 检测 thinking 和 action 边界
 * 返回流式事件，让调用者决定如何处理（显示、记录等）
 */
export async function* streamParse(
  chunks: AsyncGenerator<string>,
): AsyncGenerator<StreamEvent> {
  let buffer = "";
  let lastThinking = "";
  let inAction = false;

  for await (const chunk of chunks) {
    buffer += chunk;
    if (inAction) continue;

    // 检测 action 开始
    for (const marker of ACTION_MARKERS) {
      const idx = buffer.indexOf(marker);
      if (idx !== -1) {
        // yield 最终 thinking
        const thinking = stripTags(buffer.slice(0, idx));
        if (thinking !== lastThinking) {
          yield { type: "thinking", thinking };
        }
        yield { type: "action_start" };
        inAction = true;
        break;
      }
    }

    if (inAction) continue;

    // 检测潜在 marker（避免截断，如 "do" 可能是 "do(" 的前缀）
    let isPotential = false;
    for (const marker of ACTION_MARKERS) {
      for (let i = 1; i < marker.length; i++) {
        if (buffer.endsWith(marker.slice(0, i))) {
          isPotential = true;
          break;
        }
      }
      if (isPotential) break;
    }

    // 安全输出 thinking
    if (!isPotential) {
      const thinking = stripTags(buffer);
      if (thinking && thinking !== lastThinking) {
        yield { type: "thinking", thinking };
        lastThinking = thinking;
      }
    }
  }

  yield { type: "done", content: buffer };
}

/**
 * 解析完整响应 - 提取 thinking 和 action
 */
export const parseResponse = (content: string): ParseResult => {
  for (const marker of ACTION_MARKERS) {
    const idx = content.indexOf(marker);
    if (idx === -1) continue;

    // 找闭合括号
    let depth = 0;
    let end = -1;
    for (let i = idx; i < content.length; i++) {
      if (content[i] === "(") depth++;
      else if (content[i] === ")") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    if (end === -1) continue;

    const thinking = stripTags(content.slice(0, idx));
    const actionStr = content.slice(idx, end);

    const result = parseAction(actionStr);
    if (result.success) {
      return { thinking, action: result.data };
    }
    return { thinking, error: (result as { error: string }).error };
  }

  return { thinking: stripTags(content) };
};
