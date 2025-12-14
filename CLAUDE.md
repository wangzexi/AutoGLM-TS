# AutoGLM-TS 开发指南

AI 驱动的 Android 手机自动化代理。使用 @yume-chan/adb 库与设备交互，oRPC 通信框架。

## 快速导航

| 模块 | 路径 | 用途 |
|------|------|------|
| **核心代理** | `src/agent.ts` | 任务执行循环、模型调用、步骤反馈 |
| **操作系统** | `src/actions/` | 所有设备操作实现 |
| **配置** | `src/config.ts` | 应用列表、系统提示词、规则 |
| **ADB 接口** | `src/actions/adb.ts` | 设备命令执行（截图、点击等） |
| **Web 服务** | `src/server/index.ts` | Hono 服务器、oRPC 路由 |
| **Web UI** | `web/src/App.tsx` | React 前端组件 |
| **CLI 入口** | `src/main.ts` | 参数解析、模式路由 |

## 架构设计

### 分层架构

```
┌─────────────────────────────────────────────┐
│  Web UI (React) / CLI 命令行               │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│  HTTP Server (Hono + oRPC)                 │
│  └─ /rpc/device/* (设备操作)               │
│  └─ /rpc/task/*   (任务管理)               │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│  PhoneAgent (agent.ts)                     │
│  ├─ executeStep() - 单步执行               │
│  ├─ ModelClient - 流式调用                 │
│  └─ ActionHandler - 操作执行               │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│  Actions (actions/)                        │
│  ├─ tap, swipe, press, type ...            │
│  └─ launch, navigate, special ...          │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│  ADB Interface (actions/adb.ts)            │
│  └─ @yume-chan/adb - 设备通信             │
└─────────────────────────────────────────────┘
```

### 设计原则

- **单一职责**: 每个模块只做一件事（tap 只处理点击，swipe 只处理滑动）
- **函数式**: 优先使用导出函数，避免类的复杂性
- **流式处理**: ModelClient 实时处理流式响应，不等待完整输出
- **缓存复用**: ADB 实例和设备连接缓存，避免重复初始化

## 关键流程

### 1. 任务执行流程（agent.ts）

```typescript
// 入口
agent.run(task: string) → Promise<string>

// 步骤 1: 初始化上下文
- messages = [system prompt, first user message]
- stepCount = 0

// 步骤 2: 执行循环 executeStep(step)
// 2a. 获取屏幕截图
screenshot = await getScreenshot(deviceId)

// 2b. 调用模型（流式）
ModelClient.request(messages, screenshot)
→ 实时接收 token
→ 解析 action（JSON）

// 2c. 执行操作
ActionHandler.execute(action, context)
→ 坐标转换（1000x1000 → 实际分辨率）
→ 执行 ADB 命令

// 2d. 反馈结果
messages.push({
  role: "assistant",
  content: "操作结果反馈"
})

// 步骤 3: 退出条件
- action.type === "finish" → 任务完成
- stepCount >= maxSteps → 超出步数限制
```

### 2. Web API 处理流程（server/router.ts）

```typescript
// 设备列表查询
POST /rpc/device/list
→ adb.listDevices()
→ 并行获取每个设备的截图
→ 返回 { deviceId, status, screenshot }

// 任务执行（后台）
POST /rpc/task/execute
→ createAgent(config)
→ 将 agent 存储在 tasks map
→ 异步执行 agent.run(task)
→ 返回 taskId

// 获取任务状态
POST /rpc/task/status/{taskId}
→ 从 tasks map 查询
→ 返回 { status, steps, result }
```

### 3. 操作解析流程（actions/index.ts）

每个操作由以下部分组成：

```typescript
// 1. Schema 定义（Zod）
const tapSchema = z.object({
  action: z.literal("tap"),
  x: z.number(), // 0-1000
  y: z.number(),
})

// 2. Handler 函数
const handler = async (params, ctx) => {
  // 坐标转换
  const { x, y } = convertRelativeToAbsolute(
    params,
    ctx.screenWidth,
    ctx.screenHeight
  )
  // 执行 ADB 命令
  return await adb.tap(ctx.deviceId, x, y)
}

// 3. 注册在 allActions 数组
// 4. 自动生成提示词示例
generateActionsPrompt() // 从 schema 生成 JSON 示例
```

## 代码约定

### 模块结构

**src/actions/ 目录结构**:
- `index.ts` - 操作注册表和提示词生成
- `types.ts` - 公共类型定义（ActionContext, ActionResult 等）
- `adb.ts` - ADB 命令函数（无默认导出，全部命名导出）
- `*.ts` - 各个操作实现（tap.ts, swipe.ts 等）

### 导出约定

```typescript
// adb.ts - 全部命名导出
export async function tap(deviceId, x, y) { }
export async function getScreenshot(deviceId) { }

// tap.ts - 导出操作对象和 handler
export const tap = {
  name: "tap",
  description: "点击屏幕",
  schema: z.object({ ... }),
  handler: async (params, ctx) => { ... }
}
```

### 错误处理

```typescript
// ADB 操作：catch 错误，仅 console.error，继续执行
try {
  await adb.tap(...)
} catch (e) {
  console.error("tap failed:", e)
  return { success: false, message: "..." }
}

// 模型调用：抛出异常让上层处理
if (!response) throw new Error("No response from model")

// 操作执行：返回 ActionResult，success=false
return { success: false, message: "设备未连接" }
```

### 坐标系统

- **模型输出**: [0-1000, 0-1000] 相对坐标
- **转换函数**: `convertRelativeToAbsolute(point, screenWidth, screenHeight)`
- **示例**:
  ```typescript
  // 模型输出：{x: 500, y: 500}（屏幕中心）
  // 设备分辨率：1080x2400
  const x = (500 / 1000) * 1080 // = 540
  const y = (500 / 1000) * 2400 // = 1200
  ```

### IME 输入法切换

在 `type.ts` 中：
1. 保存原 IME：`getDefaultInputMethod()`
2. 切换到 ADB 输入法：`setInputMethod(ADB_IME)`
3. 执行输入：`execShell(shell:input text '...')`
4. 恢复原 IME：`setInputMethod(originalIme)`

## 常见修改点

### 添加新操作

1. 在 `src/actions/` 中新建 `myaction.ts`:

```typescript
import { z } from "zod";
import { ActionContext, ActionResult } from "./types.ts";
import * as adb from "./adb.ts";

const myActionSchema = z.object({
  action: z.literal("myAction"),
  param: z.string(),
});

export const myAction = {
  name: "myAction",
  description: "做某件事的描述",
  schema: myActionSchema,
  handler: async (params: z.infer<typeof myActionSchema>, ctx: ActionContext) => {
    // 实现逻辑
    return { success: true, message: "完成了" };
  },
};
```

2. 在 `actions/index.ts` 中导入并添加到 `allActions`:

```typescript
import { myAction } from "./myaction.ts";

const allActions = [
  // ...existing
  myAction,
];
```

### 修改模型提示词

在 `src/config.ts` 中：

```typescript
const generateSystemPrompt = () => {
  const rules = [
    "你的规则 1",
    "你的规则 2",
  ]
  const actions = generateActionsPrompt() // 自动生成
  return `系统提示词模板\n${rules}\n${actions}`
}
```

### 支持新应用

在 `src/config.ts` 中添加到 `APP_PACKAGES`:

```typescript
export const APP_PACKAGES = {
  // ...existing
  "我的应用": "com.example.app",
}
```

### 修改 ADB 命令

在 `src/actions/adb.ts` 中添加或修改函数：

```typescript
export async function newCommand(deviceId: string, param: string) {
  const adb = getAdbInstance(deviceId)
  const socket = await adb.createSocket("shell:command here")
  // 处理响应
  socket.close()
}
```

## 测试和调试

### 环境设置

```bash
# 使用 .env 配置
PHONE_AGENT_BASE_URL=http://localhost:8000/v1
PHONE_AGENT_MODEL=your-model
PHONE_AGENT_API_KEY=your-key
```

### 开发模式

```bash
npm run dev
# 启用后端热重载 (tsx --watch)
# 启用 Web 前端热更新 (Vite)
```

### 单个任务执行

```bash
npm start -- "任务描述"
# 直接执行，无 UI，完整日志输出
```

### 调试技巧

1. **查看实时截图**:
   - 启动 Web UI: `npm start`
   - 打开 http://localhost:3000
   - 设备截图实时刷新（500ms）

2. **检查 ADB 连接**:
   ```bash
   adb devices  # 查看设备列表
   adb shell dumpsys window windows  # 查看当前窗口
   ```

3. **模型响应调试**:
   在 `agent.ts` 的 `ModelClient.request()` 中添加日志
   ```typescript
   console.log("Model response:", response)
   console.log("Parsed action:", action)
   ```

4. **操作执行调试**:
   在 `ActionHandler.execute()` 中查看转换后的坐标
   ```typescript
   console.log("Convert coords:", { before: action, after: converted })
   ```

### 常见问题排查

| 问题 | 排查步骤 |
|------|---------|
| 设备未响应 | 检查 `adb devices`、USB 连接 |
| 点击坐标错误 | 检查屏幕分辨率获取 (`getScreenshot`) |
| 输入文本失败 | 检查 ADB Keyboard 安装、IME 切换逻辑 |
| 模型输出解析失败 | 添加日志检查 `parseResponse()` 的正则匹配 |
| 操作未反馈结果 | 检查错误处理是否捕获异常 |
