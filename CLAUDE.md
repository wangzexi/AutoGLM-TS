# AutoGLM-TS 开发指南

AI 驱动的 Android 手机自动化代理。使用 @yume-chan/adb 库与设备交互。

## 文件导航

**核心执行链路**
- src/main.ts - 入口，CLI 参数解析和模式选择
- src/agent.ts - 任务执行循环，调用 LLM、解析结果、执行操作
- src/session.ts - 全局会话管理，保存消息历史
- src/actions/index.ts - 操作分发和执行
- src/actions/adb.ts - ADB 底层命令
- src/config.ts - 系统提示词、应用列表

**操作定义**
- src/actions/ - 各个操作实现（tap.ts、swipe.ts、type.ts、launch.ts 等）

**Web 相关**
- src/server/index.ts - HTTP 服务启动
- src/server/router.ts - oRPC 路由（session、device、task）
- web/src/ - React 前端（采用依赖关系驱动的目录结构）

## 前端开发规范

**目录结构原则**：
1. **目录 = 组件**：每个目录代表一个组件，用 index.tsx 导出
2. **子目录放在父目录中**：如果组件 A 依赖组件 B，则 B 应该放在 A 的目录下
3. **共享状态放在最小公共祖先**：多个组件共用的上下文应该放在它们的最小公共父目录
4. **叶子组件可以是文件**：不再有子依赖的组件可以是单个 .tsx 文件
5. **导入路径反映依赖**：嵌套越深，导入路径越长，体现了依赖关系

## 核心概念

**执行流**：选择设备 → 创建 Session → 获取截图 → 调用 LLM（流式）→ 解析 thinking + action → 执行 ADB 命令 → 保存反馈 → 重复直到 finish()

**坐标**：模型输出 [0-1000, 0-1000]，自动转换为实际分辨率

**操作定义**：Zod schema + handler 函数，自动生成模型提示词

**会话**：全局单例，保存消息用于多轮对话上下文

## 修改要点

- 新操作：添加到 src/actions/，在 src/actions/index.ts 注册
- 系统提示词：src/config.ts 的 buildSystemPrompt()
- 应用列表：src/config.ts 的 APP_PACKAGES
- Web 路由：src/server/router.ts
