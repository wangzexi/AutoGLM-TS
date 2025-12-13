# AutoGLM-TS

基于视觉语言模型的Android手机自动化AI代理工具，支持智能操作、任务执行和交互控制。

## 特性

- 🎯 **智能理解**: 基于VLM模型的视觉理解能力
- 📱 **全面控制**: 支持点击、滑动、输入、启动应用等操作
- 🔌 **多设备支持**: USB、WiFi、远程ADB连接
- 🌍 **国际化**: 支持中文和英文界面
- ⚡ **Node24原生**: 基于Node.js 24和TypeScript

## 系统要求

- Node.js >= 24.0.0
- Android设备（Android 7.0+）
- ADB工具已安装
- ADB Keyboard已安装并启用

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 检查系统要求

```bash
npm start -- --check
```

### 3. 运行应用

#### 交互模式（推荐新手）

```bash
npm start
```

然后输入你的任务描述，例如：
- "打开微信，给张三发消息：你好"
- "打开淘宝，搜索iPhone 15"
- "打开美团，点一份外卖"

#### 单次任务模式

```bash
npm start -- "打开微信，给张三发消息：你好"
```

## 支持的应用

自动支持50+常用Android应用，包括：

- **社交**: 微信、QQ、微博、小红书
- **电商**: 淘宝、京东、拼多多、天猫
- **视频**: 抖音、快手、B站、腾讯视频
- **外卖**: 美团、饿了么、大众点评
- **出行**: 滴滴出行、高德地图
- **支付**: 支付宝、微信支付
- **学习**: 钉钉、飞书、腾讯文档

完整列表请运行：
```bash
npm start -- --list-apps
```

## 配置选项

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PHONE_AGENT_BASE_URL` | 模型API地址 | `http://localhost:8000/v1` |
| `PHONE_AGENT_MODEL` | 模型名称 | `autoglm-phone-9b` |
| `PHONE_AGENT_API_KEY` | API密钥 | `EMPTY` |
| `PHONE_AGENT_MAX_STEPS` | 最大执行步骤 | `100` |
| `PHONE_AGENT_DEVICE_ID` | ADB设备ID | - |
| `PHONE_AGENT_LANG` | 界面语言 | `cn` |

### 命令行参数

```bash
# 指定模型和API
npm start -- --base-url http://localhost:8000/v1 --model autoglm-phone-9b --apikey sk-xxx

# 指定设备
npm start -- --device-id emulator-5554

# 连接远程设备
npm start -- --connect 192.168.1.100:5555

# 启用TCP/IP调试
npm start -- --enable-tcpip 5555

# 静默模式
npm start -- --quiet "打开微信"

# 设置语言
npm start -- --lang en "Open WeChat"
```

## ADB设备管理

### 连接设备

```bash
# 连接USB设备
npm start -- --enable-tcpip 5555
npm start -- --connect 192.168.1.100:5555

# 列出所有设备
npm start -- --list-devices

# 断开连接
npm start -- --disconnect 192.168.1.100:5555
npm start -- --disconnect all
```

## API使用

```typescript
import { PhoneAgent, ModelConfig, AgentConfig } from "./phone-agent/index.js";

const modelConfig: ModelConfig = {
  baseUrl: "http://localhost:8000/v1",
  modelName: "autoglm-phone-9b",
  apiKey: "your-api-key",
};

const agentConfig: AgentConfig = {
  maxSteps: 100,
  deviceId: "emulator-5554",
  lang: "cn",
  verbose: true,
};

const agent = new PhoneAgent(modelConfig, agentConfig);

// 执行任务
const result = await agent.run("打开微信，给张三发消息：你好");
console.log(result);

// 单步执行
await agent.step("打开微信");
await agent.step();
console.log(agent.getContext());
console.log(agent.getStepCount());
```

## 开发

### 项目结构

```
autoglm-ts/
├── src/
│   ├── index.ts              # CLI入口
│   └── phone-agent/
│       ├── agent.ts          # 主Agent类
│       ├── actions/          # 动作处理
│       ├── adb/              # ADB工具
│       └── config/           # 配置和国际化
├── package.json
├── tsconfig.json
└── README.md
```

### 构建

```bash
npm run build
```

构建后的文件在 `dist/` 目录中。

### 开发模式

```bash
npm run dev
```

使用Node.js的 `--watch` 模式，自动重启。

## 常见问题

### Q: ADB设备检测失败？
A:
1. 确保设备已开启USB调试
2. 检查数据线连接
3. 重新插拔数据线
4. 运行 `adb devices` 检查

### Q: ADB Keyboard未安装？
A:
1. 下载ADB Keyboard APK: [https://github.com/senzhk/ADBKeyBoard](https://github.com/senzhk/ADBKeyBoard/blob/master/ADBKeyboard.apk)
2. 安装：`adb install ADBKeyboard.apk`
3. 在设备设置中启用

### Q: 模型API连接失败？
A:
1. 检查API地址是否正确
2. 确保API服务正在运行
3. 检查网络连接
4. 验证API密钥是否有效

## 许可证

MIT

## 贡献

欢迎提交Issue和Pull Request！

## 致谢

- 原始项目: [AutoGLM](https://github.com/THUDM/AutoGLM)
- 基于视觉语言模型的Android自动化框架
