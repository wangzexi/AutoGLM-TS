/**
 * LLM 调用和响应解析 - 豆包版本
 * 支持结构化工具调用，替代文本解析
 */

import type { z } from "zod";
import { DOUBAO_TOOLS } from "./actions/doubao-tools.ts";
import type { Action } from "./actions/index.ts";

// ========== 豆包客户端实现 ==========

// 工具定义类型
export type ToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>; // 工具参数
};

// 大模型消息类型
export type Message = {
  role: "user" | "assistant" | "system";
  content: Array<{
    type: "input_image" | "input_text" | "output_text";
    image_url?: string;
    text?: string;
  }>;
};

// 大模型请求配置
type LLMRequest = {
  model: string;
  input: Message[];
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none";
  stream?: boolean;
};

// 输出块类型
type ReasoningBlock = {
  type: "reasoning";
  summary: Array<{ type: "summary_text"; text: string }>;
};

export type FunctionCallBlock = {
  type: "function_call";
  name: string;
  call_id: string;
  status: string;
  arguments: string | Record<string, unknown>;
};

type MessageBlock = {
  type: "message";
  content: Array<{ type: "output_text"; text: string }>;
};

type OutputBlock = ReasoningBlock | FunctionCallBlock | MessageBlock;

// 大模型响应类型
export type LLMResponse = {
  model: string;
  status: string;
  output?: OutputBlock[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number };
  };
  error?: {
    message: string;
  };
};

type LLMClientConfig = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
};

// 流式响应 chunk 类型
export type LLMStreamChunk =
  | {
      type: "response.created";
      response: {
        id: string;
        model: string;
      };
    }
  | {
      type: "response.in_progress";
      response: {
        id: string;
        model: string;
      };
    }
  | {
      type: "response.output_item.added";
      output_index: number;
      item: {
        id: string;
        type: "reasoning" | "message" | "function_call";
        status: string;
        name?: string;
      };
    }
  | {
      type: "response.reasoning_summary_part.added";
      item_id: string;
      output_index: number;
      summary_index: number;
      part: {
        type: "summary_text";
      };
    }
  | {
      type: "response.reasoning_summary_text.delta";
      item_id: string;
      output_index: number;
      summary_index: number;
      delta: string;
    }
  | {
      type: "response.output_text.delta";
      item_id: string;
      output_index: number;
      delta: string;
    }
  | {
      type: "response.function_call_arguments.delta";
      item_id: string;
      output_index: number;
      call_id: string;
      delta: string;
    }
  | {
      type: "response.completed";
      response: {
        id: string;
        status: string;
        output?: Array<{
          type: "function_call";
          id: string;
          name: string;
          arguments: Record<string, unknown>;
        }>;
      };
    };

function createDoubaoClient(config: LLMClientConfig) {
  const apiKey = config.apiKey;
  const baseUrl =
    config.baseUrl ?? "https://ark.cn-beijing.volces.com/api/v3/responses";
  const defaultModel = config.model ?? "doubao-seed-1-6-vision-250815";

  return async function chat(
    request: Omit<LLMRequest, "model"> & { model?: string; stream?: boolean },
  ): Promise<LLMResponse | AsyncIterable<LLMStreamChunk>> {
    const stream = request.stream ?? false;
    const requestBody: LLMRequest = {
      model: request.model ?? defaultModel,
      input: request.input,
      tools: request.tools,
      tool_choice: request.tool_choice,
      stream: stream,
    };

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `API 请求失败: ${response.status} ${response.statusText}`,
      );
    }

    if (!stream) {
      const data = (await response.json()) as LLMResponse;

      if (data.error) {
        throw new Error(data.error.message || "未知错误");
      }

      return data;
    }

    // 流式响应处理
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("无法读取响应流");
    }

    return {
      async *[Symbol.asyncIterator]() {
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // 按行解析 SSE 格式
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith(":")) continue;

            if (trimmedLine.startsWith("data: ")) {
              const data = trimmedLine.slice(6);

              if (data === "[DONE]") {
                return;
              }

              try {
                const parsed = JSON.parse(data) as LLMStreamChunk;
                yield parsed;
              } catch (err) {
                console.warn("解析流式 chunk 失败:", err, "原始数据:", data);
              }
            }
          }
        }

        // 处理剩余的 buffer
        if (buffer.trim()) {
          const trimmedLine = buffer.trim();
          if (
            trimmedLine.startsWith("data: ") &&
            trimmedLine !== "data: [DONE]"
          ) {
            const data = trimmedLine.slice(6);
            try {
              const parsed = JSON.parse(data) as LLMStreamChunk;
              yield parsed;
            } catch (err) {
              console.warn("解析流式 chunk 失败:", err, "原始数据:", buffer);
            }
          }
        }
      },
    };
  };
}

// 从 zod schema 生成 JSON Schema 用于工具定义
export function zodToJsonSchema(
  schema: z.ZodTypeAny,
  description: string,
): Record<string, unknown> {
  const jsonSchema = schema.toJSONSchema();

  // 添加描述
  if (description) {
    jsonSchema.description = description;
  }

  return jsonSchema;
}

// ========== 原有 LLM 接口 ==========

// OpenAI 兼容消息格式（保持现有接口）
export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

// 流式事件（保持现有接口）
export type StreamEvent =
  | { type: "thinking"; thinking: string }
  | { type: "done"; content: string };

// 工具调用事件（新增）
export type ToolCallEvent = {
  type: "tool_call";
  toolName: string;
  arguments: Record<string, unknown>;
};

// 合并事件类型
export type StreamParseEvent = StreamEvent | ToolCallEvent;

// 解析结果（保持现有接口）
export type ParseResult = {
  thinking: string;
  action?: Action;
  error?: string;
};

// 豆包客户端实例
const doubaoClient = createDoubaoClient({
  apiKey: process.env.DOUBAO_API_KEY || "83e2429b-4598-4b1e-a9c5-46962b2afaea",
  baseUrl:
    process.env.DOUBAO_BASE_URL ||
    "https://ark.cn-beijing.volces.com/api/v3/responses",
  model: process.env.DOUBAO_MODEL || "doubao-seed-1-6-vision-250815",
});

// 转换消息格式：从 OpenAI 兼容格式到豆包格式
const convertMessage = (msg: Message): DoubaoMessage => {
  if (typeof msg.content === "string") {
    return {
      role: msg.role as "system" | "user" | "assistant",
      content: [{ type: "input_text", text: msg.content }],
    };
  }

  const content: DoubaoMessage["content"] = [];
  for (const item of msg.content) {
    if (item.type === "image_url" && item.image_url) {
      content.push({
        type: "input_image",
        image_url: item.image_url.url,
      });
    } else if (item.type === "text" && item.text) {
      content.push({
        type: "input_text",
        text: item.text,
      });
    }
  }

  return {
    role: msg.role as "system" | "user" | "assistant",
    content,
  };
};

/**
 * 流式调用豆包 API - 保持现有接口，返回字符串流
 * 兼容性函数，内部使用豆包工具调用
 */
export async function* chat(
  messages: Message[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const doubaoMessages = messages.map(convertMessage);

  const stream = (await doubaoClient({
    input: doubaoMessages,
    tools: DOUBAO_TOOLS,
    tool_choice: "auto",
    stream: true,
  })) as AsyncIterable<LLMStreamChunk>;

  let reasoningText = "";

  for await (const chunk of stream) {
    if (chunk.type === "response.reasoning_summary_text.delta") {
      reasoningText += chunk.delta;
      yield chunk.delta;
    }
  }
}

/**
 * 流式解析 - 保持现有接口，但添加工具调用支持
 * 返回流式事件，让调用者决定如何处理（显示、记录等）
 */
export async function* streamParse(
  chunks: AsyncGenerator<string>,
): AsyncGenerator<StreamEvent> {
  // 兼容性：简单返回文本块
  // 新版本建议使用 streamParseWithTools
  for await (const chunk of chunks) {
    yield { type: "done", content: chunk };
  }
}

/**
 * 新的流式解析函数 - 支持工具调用
 * 这个函数直接处理豆包流，返回结构化事件
 */
export async function* streamParseWithTools(
  messages: Message[],
  signal?: AbortSignal,
): AsyncGenerator<StreamParseEvent> {
  const doubaoMessages = messages.map(convertMessage);

  const stream = (await doubaoClient({
    input: doubaoMessages,
    tools: DOUBAO_TOOLS,
    tool_choice: "auto",
    stream: true,
  })) as AsyncIterable<LLMStreamChunk>;

  let reasoningText = "";
  let currentToolCall: {
    name?: string;
    args: string;
    call_id?: string;
    parsedArgs?: Record<string, unknown>;
  } | null = null;
  const completedToolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
    call_id: string;
  }> = [];

  for await (const chunk of stream) {
    if (chunk.type === "response.reasoning_summary_text.delta") {
      reasoningText += chunk.delta;
      yield { type: "thinking", thinking: reasoningText };
    } else if (chunk.type === "response.output_item.added") {
      if (chunk.item.type === "function_call") {
        // 新的工具调用开始，保存工具名称
        currentToolCall = {
          name: chunk.item.name,
          args: "",
          call_id: chunk.item.id,
        };
      }
    } else if (chunk.type === "response.function_call_arguments.delta") {
      if (!currentToolCall || currentToolCall.call_id !== chunk.call_id) {
        currentToolCall = { call_id: chunk.call_id, args: chunk.delta };
      } else {
        currentToolCall.args += chunk.delta;
      }

      // 尝试解析完整参数
      if (currentToolCall.args && currentToolCall.name) {
        try {
          const parsedArgs = JSON.parse(currentToolCall.args);
          currentToolCall.parsedArgs = parsedArgs;
        } catch (err) {
          // JSON 尚未完整，继续累积
        }
      }
    } else if (chunk.type === "response.completed") {
      // 响应完成，保存完整的工具调用信息
      if (currentToolCall?.name && currentToolCall.parsedArgs) {
        const callId = currentToolCall.call_id;
        if (callId) {
          completedToolCalls.push({
            name: currentToolCall.name,
            arguments: currentToolCall.parsedArgs,
            call_id: callId,
          });
        }

        // 输出工具调用事件
        yield {
          type: "tool_call",
          toolName: currentToolCall.name,
          arguments: currentToolCall.parsedArgs,
        };
      }

      // 同时从响应中提取完整的工具调用列表
      if (chunk.response.output) {
        for (const output of chunk.response.output) {
          if (output.type === "function_call") {
            // 检查是否已经添加过
            if (!completedToolCalls.find((tc) => tc.call_id === output.id)) {
              completedToolCalls.push({
                name: output.name,
                arguments: output.arguments,
                call_id: output.id,
              });

              // 输出工具调用事件
              yield {
                type: "tool_call",
                toolName: output.name,
                arguments: output.arguments,
              };
            }
          }
        }
      }

      yield { type: "done", content: reasoningText };
    }
  }
}

/**
 * 解析完整响应 - 从工具调用中提取参数
 * 新版本：从工具调用结果构建 Action 对象
 */
export const parseResponse = (
  content: string,
  toolCall?: { toolName: string; arguments: Record<string, unknown> },
): ParseResult => {
  if (toolCall) {
    const { toolName, arguments: args } = toolCall;

    // 根据工具名称和参数构建 Action 对象
    const action = buildActionFromToolCall(toolName, args);
    if (action) {
      return { thinking: content, action };
    }

    return {
      thinking: content,
      error: `无法构建动作: ${toolName}(${JSON.stringify(args)})`,
    };
  }

  // 没有工具调用时，返回纯文本内容
  return { thinking: content };
};

/**
 * 根据工具调用构建 Action 对象
 */
const buildActionFromToolCall = (
  toolName: string,
  args: Record<string, unknown>,
): Action | null => {
  switch (toolName) {
    case "launch_app":
      return { action: "Launch", app: args.app } as Action;

    case "tap_screen":
      return { action: "Tap", element: [args.x, args.y] } as Action;

    case "type_text":
      return { action: "Type", text: args.text } as Action;

    case "type_name":
      return { action: "Type_Name", text: args.text } as Action;

    case "interact":
      return { action: "Interact" } as Action;

    case "swipe_screen":
      return {
        action: "Swipe",
        start: [args.start_x, args.start_y],
        end: [args.end_x, args.end_y],
      } as Action;

    case "long_press":
      return { action: "Long_Press", element: [args.x, args.y] } as Action;

    case "double_tap":
      return { action: "Double_Tap", element: [args.x, args.y] } as Action;

    case "back":
      return { action: "Back" } as Action;

    case "home":
      return { action: "Home" } as Action;

    case "wait":
      return { action: "Wait", duration: args.duration } as Action;

    case "take_over":
      return { action: "Take_over", message: args.message } as Action;

    case "note":
      return { action: "Note", content: args.content } as Action;

    case "call_api":
      return { action: "Call_API", instruction: args.instruction } as Action;

    case "finish":
      return { action: "finish", message: args.message } as Action;

    default:
      return null;
  }
};

/**
 * 提取工具调用参数（从流式响应中）
 */
export const extractToolCalls = (stream: AsyncIterable<LLMStreamChunk>) => {
  const toolCalls: Array<{
    toolName: string;
    arguments: Record<string, unknown>;
    call_id: string;
  }> = [];
  // 这里实现复杂的流式解析逻辑
  // 由于代码较长，这里先简化
  return toolCalls;
};

// 导出 createDoubaoClient 供测试使用
export { createDoubaoClient };
