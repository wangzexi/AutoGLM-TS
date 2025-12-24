# 豆包版本测试指南

## 快速测试

### 1. 基础调用测试
```bash
npm run test:doubao
# 或
npx tsx test-doubao.ts
```

### 2. 测试输出示例
```
🚀 测试豆包基础调用

📷 图片信息:
   路径: /Users/zexi/workspace/wangzexi/cc-api-test/IMG_0138.PNG
   大小: 8797.84 KB

🔧 工具定义:
   工具数量: 15
   工具列表: launch_app, tap_screen, type_text, ...

📡 发送请求到豆包...

✅ 响应信息:
   模型: doubao-seed-1-6-vision-250815
   状态: completed

📤 响应内容:
   💭 推理过程: 用户现在需要启动微信...
   🔧 工具调用:
      工具名: tap_screen
      参数: {"x": "600", "y": "600"}

🎉 测试完成!
```

## 验证清单

- [ ] 基础调用测试通过
- [ ] 工具定义正确加载（15个工具）
- [ ] 豆包 API 连接正常
- [ ] 推理过程正常显示
- [ ] 工具调用参数格式正确

## 环境要求

确保 `.env` 文件包含：
```env
DOUBAO_API_KEY=83e2429b-4598-4b1e-a9c5-46962b2afaea
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3/responses
DOUBAO_MODEL=doubao-seed-1-6-vision-250815
```

## 真实设备测试

准备 Android 设备后：

```bash
# 启动应用
npm start

# 或直接运行
npx tsx src/main.ts
```

然后在 Web 界面或通过 API 发送任务。

## 常见问题

### Q: 工具调用失败？
A: 检查豆包 API Key 是否正确，网络连接是否正常。

### Q: 坐标不准确？
A: 豆包模型可能需要多次尝试优化坐标，可以通过调整提示词改进。

### Q: Token 使用过多？
A: 豆包会缓存部分内容，实际使用中成本可控。输入 0.8元/百万tokens，输出 8元/百万tokens。
