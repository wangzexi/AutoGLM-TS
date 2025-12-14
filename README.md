# AutoGLM-TS

AI 驱动的 Android 手机自动化代理。使用 GLM 视觉语言模型推理，通过 ADB 与 Android 设备交互。

## 特性

- 🤖 **AI 驱动**: 基于 GLM 视觉语言模型的智能推理
- 📱 **完整控制**: 点击、滑动、长按、文字输入等丰富操作
- 🔌 **多设备支持**: USB、TCP/IP 连接，支持多设备管理
- ⚡ **高效架构**: Node.js 24 原生支持、流式模型响应处理
- 💬 **交互模式**: 支持 CLI 命令行和现代 Ink React 终端 UI

## 系统要求

- **Node.js**: >= 24.x
- **Android 设备**: 支持 ADB 调试（Android 5.0+）
- **ADB 工具**: Android SDK Platform Tools
- **ADB Keyboard**: 需要在设备上安装并启用
- **权限**: USB 调试权限

## 快速开始

### 1. 安装

```bash
git clone <repo>
cd autoglm-ts
npm install
```

### 2. 配置

创建 `.env` 文件配置 API：

```env
PHONE_AGENT_BASE_URL=https://open.bigmodel.cn/api/paas/v4
PHONE_AGENT_MODEL=autoglm-phone
PHONE_AGENT_API_KEY=your-api-key
PHONE_AGENT_MAX_STEPS=100
```

### 3. 运行

```bash
npm start                      # 启动（自动检测 UI/CLI 模式）
```

然后输入任务，例如：
- `打开微信`
- `打开淘宝搜索iPhone`
- `打开美团点外卖`

## 命令行使用

### 基本命令

```bash
npm start                                  # 交互模式
npm start -- "打开微信"                   # 单次任务
npm run dev                               # 开发模式（文件监视）
```

### 设备管理

```bash
npm start -- --list-devices               # 列出所有设备
npm start -- --connect 192.168.1.100:5555  # TCP/IP 连接
npm start -- --disconnect [address]       # 断开连接
npm start -- --enable-tcpip 5555          # 启用 TCP/IP
```

### 模型配置

```bash
npm start -- --model autoglm-phone --base-url http://localhost:8000/v1 --apikey sk-xxx
npm start -- --max-steps 50               # 设置最大步数
npm start -- --device-id device-serial    # 指定设备
```

### 其他选项

```bash
npm start -- --list-apps                  # 列出支持的应用
npm start -- --quiet "任务"               # 静默模式（无日志）
```

### 完整示例

```bash
# 在指定设备上执行任务
npm start -- -d emulator-5554 "打开支付宝扫一扫"

# 使用自定义 API
npm start -- --model custom-model --base-url http://localhost:8000/v1 "打开微信"

# 远程设备：先启用 TCP/IP
npm start -- -d emulator-5554 --enable-tcpip 5555
adb connect 192.168.1.100:5555
npm start -- --connect 192.168.1.100:5555 "打开微信"
```

## 支持的应用

支持 50+ 常用应用，包括：

| 类型 | 应用 |
|------|------|
| 社交 | 微信、QQ、钉钉、飞书 |
| 电商 | 淘宝、京东、拼多多、天猫 |
| 视频 | 抖音、快手、B站、腾讯视频 |
| 外卖 | 美团、饿了么、大众点评 |
| 出行 | 滴滴、高德地图、美团地图 |
| 支付 | 支付宝、微信支付 |
| 其他 | 微博、小红书、网易云音乐 |

完整列表：
```bash
npm start -- --list-apps
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PHONE_AGENT_BASE_URL` | API 地址 | `http://localhost:8000/v1` |
| `PHONE_AGENT_MODEL` | 模型名称 | `autoglm-phone-9b` |
| `PHONE_AGENT_API_KEY` | API 密钥 | `EMPTY` |
| `PHONE_AGENT_MAX_STEPS` | 最大步数 | `100` |
| `PHONE_AGENT_DEVICE_ID` | 设备 ID | - |

## 编程 API

```typescript
import { PhoneAgent } from "./phone-agent/agent.ts";

const agent = new PhoneAgent(
  {
    baseUrl: "http://localhost:8000/v1",
    modelName: "autoglm-phone",
    apiKey: "your-api-key",
  },
  {
    maxSteps: 100,
    deviceId: "emulator-5554",
    verbose: true,
  }
);

// 运行任务
const result = await agent.run("打开微信");
console.log(result);

// 重置状态
agent.reset();
```

## 开发

### 项目结构

```
src/
├── main.ts                 # Node.js CLI 入口
├── main.tsx                # Ink React UI 入口
├── utils/args.ts           # 参数解析
├── ui/                     # Ink 组件
│   ├── App.tsx
│   ├── DeviceList.tsx
│   └── Interactive.tsx
└── phone-agent/
    ├── agent.ts            # 主代理类
    ├── adb.ts              # ADB 统一接口
    ├── actions.ts          # 操作处理
    ├── model.ts            # 模型通信
    ├── index.ts
    └── config/
        ├── apps.ts
        ├── prompts.ts
        └── index.ts
```

### 开发模式

```bash
npm run dev                  # 启用文件监视
```

## 常见问题

### Q: 设备未检测到？

1. 启用 USB 调试：设置 → 开发者选项 → USB 调试
2. 授权设备连接
3. 验证 ADB：`adb devices`

### Q: ADB Keyboard 错误？

1. 下载：https://github.com/senzhk/ADBKeyBoard/blob/master/ADBKeyboard.apk
2. 安装：`adb install ADBKeyboard.apk`
3. 启用：设置 → 语言与输入法 → 虚拟键盘

### Q: API 连接失败？

1. 检查 API 地址和密钥
2. 验证网络连接
3. 确保 API 服务正在运行

### Q: 模型输出不执行？

1. 检查设备屏幕状态
2. 增加 `--max-steps` 限制
3. 尝试重新启动 ADB

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
