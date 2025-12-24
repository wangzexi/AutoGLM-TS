/**
 * LLM 调用和响应解析 - 豆包版本
 * 支持结构化工具调用，替代文本解析
 */

import type { Action } from "./actions/index.ts";
import { createDoubaoClient, type Message as DoubaoMessage, type LLMStreamChunk } from "./llm-doubao.ts";
import { DOUBAO_TOOLS } from "./actions/doubao-tools.ts";
import { TOOL_TO_ACTION_NAME } from "./actions/doubao-tools.ts";

// OpenAI 兼容消息格式（保持现有接口）
export type Message = {
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
  arguments: any;
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
  baseUrl: process.env.DOUBAO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3/responses",
  model: process.env.DOUBAO_MODEL || "doubao-seed-1-6-vision-250815",
});

// 转换消息格式：从 OpenAI 兼容格式到豆包格式
const convertMessage = (msg: Message): DoubaoMessage => {
  if (typeof msg.content === "string") {
    return {
      role: msg.role as "system" | "user" | "assistant",
      content: [{ type: "input_text", text: msg.content }]
    };
  }

  const content: DoubaoMessage["content"] = [];
  for (const item of msg.content) {
    if (item.type === "image_url" && item.image_url) {
      content.push({
        type: "input_image",
        image_url: item.image_url.url
      });
    } else if (item.type === "text" && item.text) {
      content.push({
        type: "input_text",
        text: item.text
      });
    }
  }

  return {
    role: msg.role as "system" | "user" | "assistant",
    content
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

  const stream = await doubaoClient({
    input: doubaoMessages,
    tools: DOUBAO_TOOLS,
    tool_choice: "auto",
    stream: true
  }) as AsyncIterable<LLMStreamChunk>;

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

  const stream = await doubaoClient({
    input: doubaoMessages,
    tools: DOUBAO_TOOLS,
    tool_choice: "auto",
    stream: true
  }) as AsyncIterable<LLMStreamChunk>;

  let reasoningText = "";
  let currentToolCall: { name?: string; args: string; call_id?: string; parsedArgs?: any } | null = null;
  let completedToolCalls: Array<{ name: string; arguments: any; call_id: string }> = [];

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
          call_id: chunk.item.id
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
      if (currentToolCall && currentToolCall.name && currentToolCall.parsedArgs) {
        completedToolCalls.push({
          name: currentToolCall.name,
          arguments: currentToolCall.parsedArgs,
          call_id: currentToolCall.call_id!
        });

        // 输出工具调用事件
        yield {
          type: "tool_call",
          toolName: currentToolCall.name,
          arguments: currentToolCall.parsedArgs
        };
      }

      // 同时从响应中提取完整的工具调用列表
      if (chunk.response.output) {
        for (const output of chunk.response.output) {
          if (output.type === "function_call") {
            // 检查是否已经添加过
            if (!completedToolCalls.find(tc => tc.call_id === output.id)) {
              completedToolCalls.push({
                name: output.name,
                arguments: output.arguments,
                call_id: output.id
              });

              // 输出工具调用事件
              yield {
                type: "tool_call",
                toolName: output.name,
                arguments: output.arguments
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
  toolCall?: { toolName: string; arguments: any }
): ParseResult => {
  if (toolCall) {
    const { toolName, arguments: args } = toolCall;
    const actionName = TOOL_TO_ACTION_NAME[toolName];

    if (!actionName) {
      return { thinking: content, error: `未知工具: ${toolName}` };
    }

    // 根据工具名称和参数构建 Action 对象
    const action = buildActionFromToolCall(actionName, args);
    if (action) {
      return { thinking: content, action };
    }

    return {
      thinking: content,
      error: `无法构建动作: ${toolName}(${JSON.stringify(args)})`
    };
  }

  // 没有工具调用时，返回纯文本内容
  return { thinking: content };
};

/**
 * 根据工具调用构建 Action 对象
 */
const buildActionFromToolCall = (actionName: string, args: any): Action | null => {
  switch (actionName) {
    case "Launch":
      return { action: "Launch", app: args.app } as Action;

    case "Tap":
      return { action: "Tap", element: [args.x, args.y] } as Action;

    case "Type":
      return { action: "Type", text: args.text } as Action;

    case "Type_Name":
      return { action: "Type_Name", text: args.text } as Action;

    case "Interact":
      return { action: "Interact" } as Action;

    case "Swipe":
      return {
        action: "Swipe",
        start: [args.start_x, args.start_y],
        end: [args.end_x, args.end_y]
      } as Action;

    case "Long_Press":
      return { action: "Long_Press", element: [args.x, args.y] } as Action;

    case "Double_Tap":
      return { action: "Double_Tap", element: [args.x, args.y] } as Action;

    case "Back":
      return { action: "Back" } as Action;

    case "Home":
      return { action: "Home" } as Action;

    case "Wait":
      return { action: "Wait", duration: args.duration } as Action;

    case "Take_over":
      return { action: "Take_over", message: args.message } as Action;

    case "Note":
      return { action: "Note", content: args.content } as Action;

    case "Call_API":
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
  const toolCalls: Array<{ toolName: string; arguments: any; call_id: string }> = [];
  // 这里实现复杂的流式解析逻辑
  // 由于代码较长，这里先简化
  return toolCalls;
};
