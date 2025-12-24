# 豆包架构设计文档

## 整体架构

### 数据流

```
用户任务
    ↓
创建 Agent (createAgent)
    ↓
step() 函数执行
    ↓
获取截图 (adb.getScreenshot)
    ↓
构建消息 (convertMessage)
    ↓
豆包 API 调用 (streamWithTools)
    ↓
流式处理 (推理 + 工具调用)
    ↓
转换工具调用 (convertToolCallToAction)
    ↓
执行动作 (executeAction)
    ↓
返回结果
```

## 核心组件

### 1. 豆包客户端 (`llm-doubao.ts`)

职责：
- 管理豆包 API 连接
- 处理流式响应
- 提供工具调用能力

关键函数：
```typescript
createDoubaoClient(config) -> chat(request)
chat() -> AsyncIterable<LLMStreamChunk>
zodToJsonSchema(schema) -> JSON Schema
```

### 2. 工具定义 (`actions/doubao-tools.ts`)

职责：
- 定义所有豆包工具
- 提供工具名称映射

关键导出：
```typescript
DOUBAO_TOOLS: ToolDefinition[]  // 15个工具定义
TOOL_TO_ACTION_NAME: Record<string, string>  // 工具名->动作名映射
```

### 3. LLM 接口 (`llm.ts`)

职责：
- 保持与现有 agent.ts 的接口兼容
- 转换消息格式
- 处理流式事件

关键函数：
```typescript
chat(messages, signal) -> AsyncGenerator<string>
streamWithTools(messages, signal) -> AsyncGenerator<StreamParseEvent>
parseResponse(content, toolCall) -> ParseResult
```

### 4. Agent 执行 (`agent.ts`)

职责：
- 协调整个执行流程
- 处理工具调用
- 管理状态和历史

关键函数：
```typescript
createAgent(config) -> { run, runTask, step, ... }
step(task) -> AsyncGenerator<StepEvent>
convertToolCallToAction(toolCall) -> Record<string, unknown>
```

## 事件流

### StepEvent 事件
```typescript
{ type: "screenshot", screenshot: string }
{ type: "thinking", thinking: string }
{ type: "action", action: Record<string, unknown> }
{ type: "done", result: StepResult }
```

### StreamParseEvent 事件
```typescript
{ type: "thinking", thinking: string }
{ type: "tool_call", toolName: string, arguments: any }
{ type: "done", content: string }
```

## 工具调用流程

### 1. 工具定义阶段
```typescript
// 在 doubao-tools.ts 中定义
const tapScreenTool: ToolDefinition = {
  type: 'function',
  name: 'tap_screen',
  description: '点击屏幕指定位置',
  parameters: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'x坐标' },
      y: { type: 'number', description: 'y坐标' }
    },
    required: ['x', 'y']
  }
}
```

### 2. 工具调用阶段
```typescript
// 豆包返回的工具调用
{
  type: 'tool_call',
  toolName: 'tap_screen',
  arguments: { x: 600, y: 600 }
}
```

### 3. 转换阶段
```typescript
// 转换为 Action 对象
{
  action: 'Tap',
  element: [600, 600]
}
```

### 4. 执行阶段
```typescript
// 调用现有的 executeAction
const result = await executeAction(actionObj, ctx)
```

## 消息格式转换

### OpenAI 兼容格式 → 豆包格式

```typescript
// 原始格式 (src/agent.ts)
{
  role: "user",
  content: [
    { type: "image_url", image_url: { url: "data:image/png;base64,..." } },
    { type: "text", text: "当前应用: com.android.launcher" }
  ]
}

// 豆包格式
{
  role: "user",
  content: [
    { type: "input_image", image_url: "data:image/png;base64,..." },
    { type: "input_text", text: "当前应用: com.android.launcher" }
  ]
}
```

## 错误处理

### 1. API 错误
```typescript
try {
  const stream = await doubaoClient({ ... })
} catch (e) {
  yield { type: "done", result: { success: false, message: `模型错误: ${e}` } }
}
```

### 2. 工具调用错误
```typescript
const actionObj = convertToolCallToAction(toolCall)
if (!actionObj) {
  yield {
    type: "done",
    result: {
      success: false,
      message: `无法处理工具调用: ${toolCall.toolName}`
    }
  }
}
```

### 3. 动作执行错误
```typescript
const execResult = await executeAction(actionObj, ctx)
if (!execResult.success) {
  // 重试逻辑或错误反馈
}
```

## 性能优化

### 1. Token 节省
```typescript
// 移除历史图片
const prevUserMsg = messages.at(-2)
if (prevUserMsg && Array.isArray(prevUserMsg.content)) {
  prevUserMsg.content = prevUserMsg.content.filter((c) => c.type === "text")
}
```

### 2. 缓存机制
- 豆包自动缓存部分输入
- 减少重复请求

### 3. 流式处理
- 实时显示推理过程
- 及时反馈工具调用

## 扩展性

### 添加新动作
1. 在 `actions/` 中定义动作和 schema
2. 在 `doubao-tools.ts` 中添加工具定义
3. 在 `agent.ts` 中添加工具调用转换逻辑

### 示例
```typescript
// 1. 定义动作 (actions/new-action.ts)
const NewActionSchema = z.object({ action: z.literal("NewAction"), ... })
export const newAction: ActionDef<typeof NewActionSchema> = { ... }

// 2. 添加工具 (actions/doubao-tools.ts)
{
  type: 'function',
  name: 'new_action',
  description: '...',
  parameters: zodToJsonSchema(NewActionSchema, '...')
}

// 3. 添加转换 (agent.ts)
case "new_action":
  return { action: "NewAction", ... }
```

## 监控和调试

### 日志输出
```typescript
console.log(`📝 记录: ${params.content}`)  // Note 动作
console.log(`🔗 API 调用: ${params.instruction}`)  // Call_API 动作
console.warn(`未知工具: ${toolName}`)  // 未知工具调用
```

### 事件追踪
```typescript
// 每个 StepEvent 都可以被前端捕获
for await (const event of step()) {
  if (event.type === "thinking") {
    // 更新 UI
  } else if (event.type === "action") {
    // 显示即将执行的动作
  } else if (event.type === "done") {
    // 显示结果
  }
}
```

## 总结

豆包架构的核心优势：
1. **类型安全**：工具调用参数经过 schema 验证
2. **结构化**：直接使用结构化数据，无需文本解析
3. **可扩展**：易于添加新动作和新工具
4. **高性能**：流式处理，实时反馈
5. **可监控**：完整的事件流和日志记录
