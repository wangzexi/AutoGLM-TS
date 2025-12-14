# AutoGLM-TS 项目指南

AI 驱动的 Android 手机自动化代理。通过 GLM 视觉语言模型推理，@yume-chan/adb 控制设备。

## 快速导航

| 入口 | 路径 | 用途 |
|------|------|------|
| **主代理** | `src/phone-agent/agent.ts` | 协调模型和设备交互的核心类 |
| **ADB 驱动** | `src/phone-agent/adb.ts` | 统一的设备控制接口 |
| **操作执行** | `src/phone-agent/actions.ts` | 解析和执行模型输出的 action |
| **模型通信** | `src/phone-agent/model.ts` | OpenAI 兼容 API 客户端 |
| **配置** | `src/phone-agent/config/` | 应用列表、提示词等配置 |
| **CLI 入口** | `src/main.ts` | Node.js 命令行入口 |
| **UI 入口** | `src/main.tsx` | Ink React 终端 UI 入口 |

## 架构设计原则

- **单文件模块**：adb.ts、actions.ts、model.ts 各自独立，高内聚低耦合
- **函数式优先**：大多数 ADB 操作是导出函数，而非类方法
- **流式优化**：ModelClient 实时处理流式响应，避免等待完整输出
- **缓存管理**：ADB 客户端和设备实例缓存复用

## 关键流程

### 任务执行流程（PhoneAgent.run）

```
1. 初始化上下文（清空消息、重置步数）
2. 调用 executeStep(task, isFirstStep=true) - 发送初始任务
3. 循环 executeStep(undefined, isFirstStep=false)：
   - 获取屏幕截图
   - 调用 ModelClient.request() - 流式调用模型
   - 解析返回的 action（do() 或 finish()）
   - ActionHandler.execute() - 执行操作
   - 反馈结果到上下文
4. 当 action 类型为 "finish" 或达到 maxSteps 退出
```

### 模型响应解析（ModelClient.parseResponse）

优先级从高到低：
1. `finish(message=...)` - 任务完成
2. `do(action=...)` - 执行操作
3. `<answer>...</answer>` - 遗留 XML 格式支持

输出均在返回前打印思考过程。

### 操作执行（ActionHandler.execute）

1. 检查操作类型（_metadata: "do" 或 "finish"）
2. 根据 action 字段名查找对应处理方法
3. 坐标格式：相对 1000x1000，需转换为实际屏幕坐标
4. 某些操作（Type）涉及 IME 切换：保存原 IME → 切换 ADB 输入法 → 操作 → 恢复

## 代码约定

### 模块导出

- ADB 模块：全部导出函数，无默认导出
- Actions 模块：导出 ActionHandler 类、parseAction、doAction、finish 函数
- Model 模块：导出 ModelClient 类和辅助函数

### 错误处理

- ADB 操作：catch 错误但继续，仅 console.error
- 模型调用：抛出异常让上层处理
- 操作执行：返回 ActionResult，success=false 但不抛出

### 坐标系统

- 模型输出：[0-1000, 0-1000] 的相对坐标
- 转换函数：`convertRelativeToAbsolute(element, screenWidth, screenHeight)`
- 屏幕信息：由 getScreenshot() 返回实际宽高

## 常见修改点

### 添加新操作

1. 在 `ActionHandler.getHandler()` 的 handlers 对象中添加键值对
2. 实现 `private async handle[ActionName](...): Promise<ActionResult>`
3. 可能需要在 adb.ts 中添加新的 ADB 命令函数

### 修改 ADB 行为

- 所有 ADB 操作在 `src/phone-agent/adb.ts` 中
- 使用 `getAdbInstance(deviceId)` 获取缓存的 Adb 实例
- 通过 `adb.createSocket('shell:...')` 执行命令

### 更新模型提示词

- 系统提示词：`src/phone-agent/config/prompts.ts` 中的 SYSTEM_PROMPT
- 应用列表：`src/phone-agent/config/apps.ts` 中的 APP_PACKAGES

### 处理新的响应格式

修改 `ModelClient.parseResponse()` 中的规则优先级和模式匹配。

## 测试和调试

- **环境变量**：.env 文件配置 API 和设备
- **开发模式**：`npm run dev` 启用文件监视
- **命令行调试**：`npm start -- --quiet` 执行任务无日志
- **系统检查**：src/index.ts 中的 checkSystemRequirements() 诊断环境
