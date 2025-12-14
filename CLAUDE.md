# AutoGLM-TS 开发指南

AI 驱动的 Android 手机自动化代理。使用 @yume-chan/adb 库与设备交互，oRPC 通信框架。

## 快速导航

| 模块 | 路径 | 用途 |
|------|------|------|
| **入口** | `src/main.ts` | CLI 参数解析、Web/CLI 模式路由 |
| **代理** | `src/agent.ts` | 任务执行循环、流式 API 调用 |
| **会话** | `src/session.ts` | 全局单例会话、消息历史 |
| **操作** | `src/actions/` | 所有设备操作（tap/swipe/type 等） |
| **配置** | `src/config.ts` | 应用列表、系统提示词 |
| **ADB** | `src/actions/adb.ts` | 底层设备命令 |
| **Web 服务** | `src/server/` | HTTP 服务、oRPC 路由 |
| **Web UI** | `web/src/` | React 前端（组件化架构） |

## 架构简述

```
Web UI → HTTP Server → Session Manager → Agent → Actions → ADB → Device
```

核心流程：
1. **初始化**: 选择设备 → 创建 Session
2. **循环**: 获取截图 → 调用模型（流式）→ 解析并执行操作 → 反馈结果
3. **终止**: 模型返回 `finish()` 或 超过最大步数

## 设计原则

- **单一职责**: 每个模块一个功能
- **函数式**: 优先函数，避免 class
- **流式处理**: 实时处理流式响应，不等待完整输出
- **全局单例**: session.ts 管理全局会话状态

## 常见修改点

### 添加新操作

在 `src/actions/` 新建 `{action}.ts`，导出对象：

```typescript
export const myAction = {
  name: "myAction",
  description: "描述",
  schema: z.object({ /* ... */ }),
  handler: async (params, ctx) => {
    // 实现逻辑
    return { success: true, message: "..." }
  }
}
```

在 `src/actions/index.ts` 添加到 `allActions` 数组。

### 修改系统提示词

编辑 `src/config.ts` 中的 `buildSystemPrompt()`。

### 支持新应用

在 `src/config.ts` 的 `APP_PACKAGES` 中添加。

## 核心概念

- **坐标**: 模型输出 [0-1000, 0-1000] 相对坐标，自动转换为实际分辨率
- **会话**: 全局单例，自动保存消息历史，支持多轮对话
- **流式**: `agent.executeStep()` 返回 AsyncGenerator，产生 thinking/action/done 事件
- **操作**: Zod Schema 定义，自动生成模型提示词
