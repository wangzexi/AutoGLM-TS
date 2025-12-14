# AutoGLM-TS

AI 驱动的 Android 手机自动化代理。通过 GLM 视觉语言模型推理，用 @yume-chan/adb 控制设备。

## 特性

- 🤖 **AI 驱动**: 基于 GLM 视觉语言模型的智能推理
- 📱 **完整控制**: 点击、滑动、长按、文字输入等丰富操作
- 🔌 **多设备支持**: USB、TCP/IP 连接，支持多设备管理
- ⚡ **高效架构**: Node.js 24 ES modules、流式响应处理、会话保持
- 💬 **双模式**: CLI 命令行执行 + 现代 Web UI 交互
- 💾 **会话管理**: 自动保存历史消息，刷新页面自动恢复状态
- 🎯 **实时交互**: 支持多轮对话，AI 理解上下文并持续优化策略

## 系统要求

- **Node.js**: >= 24.x
- **Android 设备**: 支持 ADB 调试（Android 5.0+）
- **ADB 工具**: Android SDK Platform Tools
- **ADB Keyboard**: 需要在设备上安装并启用（用于文字输入）
- **权限**: USB 调试权限

## 工具安装

### ADB 工具

```bash
# 下载 ADB（macOS）
curl -L -o platform-tools.zip https://dl.google.com/android/repository/platform-tools-latest-darwin.zip
unzip -j platform-tools.zip "platform-tools/adb" -d /usr/local/bin/
# Linux: 将 darwin 改为 linux
# Windows: 将 darwin 改为 windows
```

### ADB Keyboard

```bash
# 下载 APK
curl -L -o ADBKeyboard.apk https://github.com/senzhk/ADBKeyBoard/raw/master/ADBKeyboard.apk
# 或使用代理（如需要）：
# curl -x http://localhost:1080 -L -o ADBKeyboard.apk https://github.com/senzhk/ADBKeyBoard/raw/master/ADBKeyboard.apk

# 安装到设备
adb install ADBKeyboard.apk

# 启用：设置 → 语言与输入法 → 虚拟键盘 → 选择 ADB Keyboard
```

## 快速开始

### 1. 安装

```bash
git clone <repo>
cd autoglm-ts
npm install
```

### 2. 配置

创建 `.env` 文件：

```env
PHONE_AGENT_BASE_URL=https://open.bigmodel.cn/api/paas/v4
PHONE_AGENT_MODEL=autoglm-phone
PHONE_AGENT_API_KEY=your-api-key
PHONE_AGENT_MAX_STEPS=100
```

### 3. 运行

```bash
npm start                      # 启动 Web UI（http://localhost:3000）
npm start -- "打开微信"       # 直接执行任务
npm run dev                   # 开发模式（后端热重载 + Web 前端热更新）
```

## 使用方式

### Web UI 模式（交互式）

启动 Web 服务器：
```bash
npm start
# 打开 http://localhost:3000
```

**界面结构**：
- **设备选择器** (`DeviceSelector`): 首页显示所有连接的设备，点击选择
- **聊天容器** (`ChatContainer`): 左侧消息列表，右侧实时截图
- **截图预览** (`PhonePreview`): 设备当前屏幕（500ms 自动刷新）
- **消息列表** (`MessageList`): 显示思考过程、操作步骤、完成状态
- **输入框** (`InputBox`): 支持多行输入（Shift+Enter 换行，Enter 提交）

**功能**：
- **多轮对话**: 每条消息都会保存到会话，AI 理解上下文
- **会话保持**: 刷新页面自动恢复历史消息和设备状态
- **设备监控**: 自动检测设备断开连接
- **流式反馈**:
  - 显示 AI 思考过程（thinking）
  - 实时显示操作执行（action）
  - 完成后显示✅图标
- **直接操作**:
  - 点击截图直接发送点击坐标
  - 拖动截图执行滑动操作
- **输入历史**: 自动保存最近 50 条输入，上/下箭头快速调用

### CLI 命令行模式

#### 直接执行任务
```bash
npm start -- "打开微信"
npm start -- "搜索 iPhone"
```

#### 设备管理
```bash
npm start -- --list-devices               # 列出所有设备
```

#### 模型配置
```bash
npm start -- --model gpt-4o --base-url http://localhost:8000/v1 --apikey sk-xxx "任务"
npm start -- --max-steps 50 "任务"       # 设置最大步数
npm start -- --device emulator-5554 "任务"  # 指定设备
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PHONE_AGENT_BASE_URL` | API 地址 | - |
| `PHONE_AGENT_MODEL` | 模型名称 | - |
| `PHONE_AGENT_API_KEY` | API 密钥 | - |
| `PHONE_AGENT_MAX_STEPS` | 最大步数 | `100` |
| `PHONE_AGENT_DEVICE_ID` | 设备 ID | 自动选择第一个 |

## 编程 API

### 基础用法

```typescript
import { createAgent } from "./agent.ts";
import { createSession, appendUserMessage } from "./session.ts";

const agent = createAgent({
  baseUrl: "http://localhost:8000/v1",
  model: "autoglm-phone",
  apiKey: "your-api-key",
  maxSteps: 100,
  deviceId: "emulator-5554",
});

// 单次任务执行
const result = await agent.run("打开微信");
console.log(result);
```

### 会话式对话

```typescript
import { createAgent } from "./agent.ts";
import {
  createSession,
  appendUserMessage,
  appendAssistantMessage,
  getHistoryMessages,
} from "./session.ts";

// 创建会话
const session = createSession("emulator-5554");

// 添加用户消息
appendUserMessage("打开微信");

// 创建代理（自动读取会话历史）
const agent = createAgent({
  baseUrl: "...",
  deviceId: "emulator-5554",
});

// 执行步骤（支持流式事件）
for await (const event of agent.executeStep("打开微信")) {
  if (event.type === "thinking") {
    console.log("思考:", event.thinking);
  } else if (event.type === "action") {
    console.log("操作:", event.action);
  } else if (event.type === "done") {
    console.log("结果:", event.result);
    // 记录反馈
    appendAssistantMessage(event.result.message);
  }
}
```

## 支持的操作

模型可以发送以下操作命令：

```
do(tap={x: 0-1000, y: 0-1000})        # 点击
do(swipe={x1, y1, x2, y2, duration})  # 滑动
do(press={key: "HOME"|"BACK"|...})    # 按键
do(type={text: "..."})                 # 输入文本
do(launch={appId: "com.xxx"})         # 启动应用
finish(message="...")                  # 完成任务
```

坐标范围 `0-1000` 是相对坐标，会自动转换为实际屏幕尺寸。

## 项目结构

```
src/
├── main.ts                 # 入口 - CLI 参数解析、Web/CLI 模式路由
├── agent.ts                # 核心代理 - 任务执行循环、流式事件
├── session.ts              # 会话管理 - 全局单例、消息历史、中止控制
├── config.ts               # 配置 - 提示词、应用列表、规则
├── server/
│   ├── index.ts           # Hono 服务器启动
│   └── router.ts          # oRPC 路由定义（session、device、task）
└── actions/
    ├── index.ts           # 操作注册表、提示词生成
    ├── types.ts           # ActionContext、ActionResult 类型
    ├── adb.ts             # ADB 命令接口（全部命名导出）
    ├── tap.ts             # 点击操作
    ├── swipe.ts           # 滑动操作
    ├── press.ts           # 按键操作
    ├── type.ts            # 文字输入操作
    ├── launch.ts          # 应用启动
    ├── navigate.ts        # 导航操作
    └── special.ts         # 特殊操作

web/
├── src/
│   ├── App.tsx            # 顶层组件 - 设备选择、会话管理、状态协调
│   ├── contexts/
│   │   └── AppContext.tsx # 全局状态上下文
│   ├── components/
│   │   ├── DeviceSelector.tsx  # 设备选择器
│   │   ├── ChatContainer.tsx   # 聊天主容器（布局）
│   │   ├── MessageList.tsx     # 消息列表
│   │   ├── PhonePreview.tsx    # 截图预览（实时刷新）
│   │   └── InputBox.tsx        # 输入框（多行输入、历史）
│   ├── main.tsx           # React 入口
│   └── index.css          # 全局样式
└── dist/                  # Vite 构建输出
```

## 常见问题

### 设备未检测到？

1. 连接 USB 线
2. 启用 USB 调试：设置 → 开发者选项 → USB 调试
3. 授权计算机访问
4. 验证：`adb devices`

### ADB Keyboard 安装失败？

参考上面的"工具安装"部分了解详细步骤。常见问题：
- 确保已安装 ADB 工具
- 设备已连接且 USB 调试已启用
- APK 下载完整（可尝试使用代理）
- 手机进入"系统 → 语言与输入法 → 虚拟键盘"选择 ADB Keyboard

### API 认证错误？

确保 `.env` 文件配置正确：
```env
PHONE_AGENT_API_KEY=your-actual-api-key
PHONE_AGENT_BASE_URL=https://api.example.com/v1
```

### 模型响应缓慢？

- 检查网络连接
- 确保 API 服务可用
- 尝试减小 `--max-steps`

## 许可证

MIT License
