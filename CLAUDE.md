# AutoGLM-TS 项目文档

## 项目简介

AutoGLM-TS 是一个基于 AI 的 Android 手机自动化代理工具，能够通过自然语言指令控制 Android 设备执行各种操作。该项目使用 GLM 视觉语言模型作为核心推理引擎，通过 ADB (Android Debug Bridge) 与 Android 设备进行交互。

## 核心特性

- 🤖 **AI 驱动**: 使用 GLM 视觉语言模型理解屏幕内容并生成操作指令
- 📱 **手机自动化**: 支持启动应用、点击、滑动、输入等操作
- 🔍 **视觉理解**: 分析屏幕截图，智能识别 UI 元素
- 🔧 **可配置**: 支持自定义模型参数、设备 ID、API 端点等
- 📊 **实时反馈**: 显示详细的操作日志和思考过程

## 技术架构

### 核心组件

1. **PhoneAgent** (`src/phone-agent/agent.ts`)
   - 主代理类，负责协调模型和设备交互
   - 管理执行上下文和步骤计数
   - 处理操作结果的反馈循环

2. **ModelClient** (`src/phone-agent/model/client.ts`)
   - OpenAI 兼容的 API 客户端
   - 处理流式响应和结果解析
   - 支持多种响应格式（do()、finish()、XML）

3. **ActionHandler** (`src/phone-agent/actions/handler.ts`)
   - 解析和执行 AI 模型生成的操作
   - 支持多种操作类型：点击、滑动、应用启动等
   - 提供确认和接管机制

4. **ADB 接口** (`src/phone-agent/adb/`)
   - 设备连接管理
   - 屏幕截图获取
   - 输入操作执行
   - 应用启动和控制

## 支持的操作

### 基础操作
- **Tap**: 点击指定坐标或元素
- **Swipe**: 滑动操作（支持方向和距离）
- **LongPress**: 长按操作
- **DoubleTap**: 双击操作
- **TypeText**: 文本输入
- **ClearText**: 清除文本

### 系统操作
- **Launch**: 启动指定应用
- **Back**: 返回上一级
- **Home**: 返回桌面

### 应用操作
支持的应用包括但不限于：
- 外卖类：美团、饿了么
- 社交类：微信、QQ、钉钉
- 购物类：淘宝、京东、拼多多
- 视频类：抖音、快手、Bilibili
- 出行类：滴滴、高德地图
- 支付类：支付宝、微信支付

## 使用方法

### 基本启动

```bash
npm start
```

### 命令行参数

```bash
# 列出支持的应用
npm start -- --list-apps

# 列出连接的设备
npm start -- --list-devices

# 指定设备
npm start -- -d <device-id>

# 指定模型和 API
npm start -- --model <model-name> --base-url <api-url>

# 执行特定任务
npm start -- "打开美团搜索瑞幸咖啡"

# 启用 TCP/IP 调试
npm start -- --enable-tcpip 5555

# 远程连接设备
npm start -- --connect 192.168.1.100:5555
```

### 环境变量配置

创建 `.env` 文件：

```env
PHONE_AGENT_BASE_URL=https://open.bigmodel.cn/api/paas/v4
PHONE_AGENT_MODEL=autoglm-phone
PHONE_AGENT_API_KEY=your-api-key
PHONE_AGENT_MAX_STEPS=100
PHONE_AGENT_DEVICE_ID=your-device-id
```

## 交互模式

启动后进入交互模式：

1. 输入自然语言任务描述
2. AI 分析屏幕状态
3. 生成并执行操作序列
4. 实时反馈执行结果
5. 输入 `quit` 或 `exit` 退出

## 技术细节

### Token 优化

项目实现了多层 Token 优化机制：

1. **上下文限制**: 保留最近 6 条消息，避免历史累积
2. **图片压缩**: 自动移除历史消息中的图片数据
3. **响应流处理**: 流式接收模型响应，实时处理

### 错误处理

- **系统检查**: 启动前验证 ADB、设备连接等
- **API 错误**: 捕获并报告模型调用错误
- **操作失败**: 记录操作执行失败信息
- **敏感操作**: 自动检测并请求用户确认

### 安全机制

- **ADB Keyboard**: 确保输入法正确配置
- **设备验证**: 检查设备状态和连接类型
- **操作确认**: 敏感操作需要用户确认
- **手动接管**: 支持人工干预复杂操作

## 开发指南

### 项目结构

```
src/
├── index.ts                    # CLI 入口
└── phone-agent/
    ├── agent.ts                # 主代理类
    ├── index.ts                # 导出文件
    ├── actions/
    │   └── handler.ts          # 操作处理器
    ├── adb/
    │   ├── connection.ts       # ADB 连接
    │   ├── device.ts           # 设备操作
    │   ├── input.ts            # 输入操作
    │   ├── screenshot.ts       # 截图功能
    │   └── index.ts            # ADB 导出
    ├── config/
    │   ├── apps.ts             # 应用配置
    │   ├── i18n.ts             # 国际化
    │   ├── prompts.ts          # 提示词
    │   └── index.ts            # 配置导出
    └── model/
        └── client.ts           # 模型客户端
```

### 配置文件

- **apps.ts**: 定义支持的应用程序列表
- **prompts.ts**: 系统提示词和操作模板
- **i18n.ts**: 国际化文本

### 添加新操作

1. 在 `ActionHandler` 中实现操作逻辑
2. 在 `handler.ts` 的 `doAction` 函数中注册
3. 更新操作解析器支持新格式
4. 添加相应的 ADB 命令

## 系统要求

- **Node.js**: >= 24.x (推荐使用 Node 24)
- **Android 设备**: 支持 ADB 调试
- **ADB 工具**: Android SDK Platform Tools
- **ADB Keyboard**: 设备上需安装并启用
- **权限**: USB 调试权限

## 常见问题

### Q: 设备未检测到
**A**: 确保已启用 USB 调试，设备已授权连接

### Q: ADB Keyboard 错误
**A**: 下载并安装 ADBKeyboard.apk，启用该输入法

### Q: 模型 API 连接失败
**A**: 检查 API 端点、API Key 和网络连接

### Q: Token 限制错误
**A**: 项目已内置上下文管理机制，如仍有问题可调整 `maxMessages` 参数

## 版本信息

- **当前版本**: v0.1.0
- **Node 兼容**: 24.x
- **TypeScript**: 5.9+

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v0.1.0
- 初始版本发布
- 支持基本手机自动化操作
- 集成 GLM 视觉语言模型
- 实现 ADB 设备交互
- 添加多应用支持
- 优化 Token 使用和上下文管理
