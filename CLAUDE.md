# AutoGLM-TS 开发指南

AI 驱动的 Android 手机自动化代理。使用 @yume-chan/adb 库与设备交互，oRPC 通信框架。

## 快速导航

- **src/main.ts** - CLI 入口，参数解析、Web/CLI 模式路由
- **src/agent.ts** - 核心代理，任务执行循环、流式 API 调用
- **src/session.ts** - 会话管理，全局单例、消息历史、中止控制
- **src/actions/** - 所有设备操作（tap/swipe/type/launch 等）
  - actions/index.ts - 操作注册、提示词生成
  - actions/adb.ts - ADB 底层命令
  - actions/*.ts - 各个操作实现
- **src/config.ts** - 应用列表、系统提示词、规则
- **src/server/** - HTTP 服务、oRPC 路由
- **web/src/** - React 前端（App.tsx、组件化）

## 架构流程

任务执行的整体流程：

1. **初始化**: Web UI 选择设备 → 调用 /rpc/session/create → 后端创建 Session 单例
2. **循环执行**:
   - 获取设备截图
   - 调用 LLM（流式）拉取推理结果
   - 解析模型输出（thinking + action）
   - 执行 action（坐标转换、ADB 命令调用）
   - 保存结果到 Session 消息历史
3. **终止**: 模型返回 finish() 或超过 maxSteps

关键概念：
- **坐标系**: 模型输出 [0-1000, 0-1000] 相对坐标，自动转换为实际分辨率
- **会话**: 全局单例，保存消息历史用于多轮对话上下文
- **流式事件**: agent.executeStep() 产生 thinking → action → done 事件
- **操作定义**: Zod Schema → 自动生成模型提示词样本

## 设计原则

- 单一职责：每个模块一个功能（tap 只点击，swipe 只滑动）
- 函数式：优先函数导出，避免类
- 流式处理：实时处理响应，不等待完整输出
- 全局单例：session 管理全局状态

## 常见修改

**添加新操作**: src/actions/{action}.ts
```typescript
export const myAction = {
  name: "myAction",
  description: "操作描述",
  schema: z.object({ /* ... */ }),
  handler: async (params, ctx) => {
    // 实现逻辑
    return { success: true, message: "..." }
  }
}
```
然后在 src/actions/index.ts 的 allActions 数组中添加。

**修改系统提示词**: 编辑 src/config.ts 中的 buildSystemPrompt()

**支持新应用**: 在 src/config.ts 的 APP_PACKAGES 中添加

**操作流程详情**: 参考 src/agent.ts 的 executeStep() 和 src/actions/index.ts 的 executeAction()
