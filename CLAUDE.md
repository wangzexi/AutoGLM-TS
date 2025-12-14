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
- web/src/main.tsx - React 入口
- web/src/App/ - React 主应用（目录结构反映依赖关系）
  - index.tsx - App 主组件，状态管理
  - AppContext.ts - 全局应用状态（DeviceSelector 和 ChatContainer 共用）
  - DeviceSelector.tsx - 设备选择组件
  - ChatContainer/ - 聊天容器组件及其子组件
    - index.tsx - ChatContainer 主组件
    - InputBox.tsx - 输入框（独立组件）
    - MessageList.tsx - 消息列表（独立组件）
    - PhonePreview.tsx - 手机预览（独立组件）

## 前端目录结构规范

前端采用**依赖关系驱动的目录结构**，使代码组织更清晰、便于维护：

```
web/src/
├── App/                          ← 顶层应用组件目录
│   ├── index.tsx                 ← App 主组件
│   ├── AppContext.ts             ← 全局状态（放在最小公共祖先）
│   ├── DeviceSelector.tsx        ← 独立子组件
│   └── ChatContainer/            ← 子组件目录（有进一步依赖）
│       ├── index.tsx             ← ChatContainer 主组件
│       ├── InputBox.tsx          ← 叶子组件（不依赖其他组件）
│       ├── MessageList.tsx       ← 叶子组件
│       └── PhonePreview.tsx      ← 叶子组件
├── contexts/                     ← （已弃用，上下文现在在 App/ 中）
├── main.tsx                      ← 入口文件
└── index.css                     ← 全局样式
```

**规范原则**：
1. **目录 = 组件**：每个目录代表一个组件，用 index.tsx 导出（小写，支持自动导入）
2. **子目录放在父目录中**：如果 ChatContainer 依赖 InputBox，则 InputBox.tsx 放在 ChatContainer/ 中
3. **上下文放在最小公共祖先**：如果多个组件共用 AppContext，放在它们的最小公共父目录
4. **叶子组件可以是文件**：如果组件不再有子依赖，可以是单个 .tsx 文件，不必建目录
5. **导入路径反映依赖**：嵌套越深，导入路径越长，体现了依赖关系

**导入示例**：
```tsx
// web/src/App/index.tsx
import { ChatContainer } from "./ChatContainer"  // 同级目录
import { DeviceSelector } from "./DeviceSelector"
import { AppContext } from "./AppContext"

// web/src/App/ChatContainer/index.tsx
import { InputBox } from "./InputBox"           // 同级文件
import { AppContext } from "../AppContext"      // 上级目录
```

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
