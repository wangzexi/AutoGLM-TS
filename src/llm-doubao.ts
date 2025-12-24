/**
 * 豆包大模型客户端 - 支持流式工具调用
 */

import { z } from "zod";

// 工具定义类型
export type ToolDefinition = {
  type: 'function'
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

// 大模型消息类型
export type Message = {
  role: 'user' | 'assistant' | 'system'
  content: Array<{
    type: 'input_image' | 'input_text' | 'output_text'
    image_url?: string
    text?: string
  }>
}

// 大模型请求配置
export type LLMRequest = {
  model: string
  input: Message[]
  tools?: ToolDefinition[]
  tool_choice?: 'auto' | 'none'
  stream?: boolean
}

// 输出块类型
type ReasoningBlock = {
  type: 'reasoning'
  summary: Array<{ type: 'summary_text'; text: string }>
}

export type FunctionCallBlock = {
  type: 'function_call'
  name: string
  call_id: string
  status: string
  arguments: string | Record<string, any>
}

type MessageBlock = {
  type: 'message'
  content: Array<{ type: 'output_text'; text: string }>
}

type OutputBlock = ReasoningBlock | FunctionCallBlock | MessageBlock

// 大模型响应类型
export type LLMResponse = {
  model: string
  status: string
  output?: OutputBlock[]
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
    input_tokens_details?: { cached_tokens?: number }
    output_tokens_details?: { reasoning_tokens?: number }
  }
  error?: {
    message: string
  }
}

type LLMClientConfig = {
  apiKey: string
  baseUrl?: string
  model?: string
}

// 流式响应 chunk 类型
export type LLMStreamChunk =
  | {
      type: 'response.created'
      response: {
        id: string
        model: string
      }
    }
  | {
      type: 'response.in_progress'
      response: {
        id: string
        model: string
      }
    }
  | {
      type: 'response.output_item.added'
      output_index: number
      item: {
        id: string
        type: 'reasoning' | 'message' | 'function_call'
        status: string
        name?: string  // 新增：工具名称
      }
    }
  | {
      type: 'response.reasoning_summary_part.added'
      item_id: string
      output_index: number
      summary_index: number
      part: {
        type: 'summary_text'
      }
    }
  | {
      type: 'response.reasoning_summary_text.delta'
      item_id: string
      output_index: number
      summary_index: number
      delta: string
    }
  | {
      type: 'response.output_text.delta'
      item_id: string
      output_index: number
      delta: string
    }
  | {
      type: 'response.function_call_arguments.delta'
      item_id: string
      output_index: number
      call_id: string
      delta: string
    }
  | {
      type: 'response.completed'
      response: {
        id: string
        status: string
        output?: Array<{
          type: 'function_call'
          id: string
          name: string
          arguments: any
        }>
      }
    }

export function createDoubaoClient(config: LLMClientConfig) {
  const apiKey = config.apiKey
  const baseUrl = config.baseUrl ?? 'https://ark.cn-beijing.volces.com/api/v3/responses'
  const defaultModel = config.model ?? 'doubao-seed-1-6-vision-250815'

  return async function chat(request: Omit<LLMRequest, 'model'> & { model?: string; stream?: boolean }): Promise<LLMResponse | AsyncIterable<LLMStreamChunk>> {
    const stream = request.stream ?? false
    const requestBody: LLMRequest = {
      model: request.model ?? defaultModel,
      input: request.input,
      tools: request.tools,
      tool_choice: request.tool_choice,
      stream: stream
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`)
    }

    if (!stream) {
      const data = await response.json() as LLMResponse

      if (data.error) {
        throw new Error(data.error.message || '未知错误')
      }

      return data
    }

    // 流式响应处理
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('无法读取响应流')
    }

    return {
      async *[Symbol.asyncIterator]() {
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk

          // 按行解析 SSE 格式
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine || trimmedLine.startsWith(':')) continue

            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6)

              if (data === '[DONE]') {
                return
              }

              try {
                const parsed = JSON.parse(data) as LLMStreamChunk
                yield parsed
              } catch (err) {
                console.warn('解析流式 chunk 失败:', err, '原始数据:', data)
              }
            }
          }
        }

        // 处理剩余的 buffer
        if (buffer.trim()) {
          const trimmedLine = buffer.trim()
          if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
            const data = trimmedLine.slice(6)
            try {
              const parsed = JSON.parse(data) as LLMStreamChunk
              yield parsed
            } catch (err) {
              console.warn('解析流式 chunk 失败:', err, '原始数据:', buffer)
            }
          }
        }
      }
    }
  }
}

// 从 zod schema 生成 JSON Schema 用于工具定义
export function zodToJsonSchema(schema: any, description: string): any {
  const jsonSchema = schema.toJSONSchema()

  // 添加描述
  if (description) {
    jsonSchema.description = description
  }

  return jsonSchema
}
