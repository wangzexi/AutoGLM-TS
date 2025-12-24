/**
 * 测试豆包基础调用
 * 使用 cc-api-test 的截图验证 LLM 调用和工具调用
 */

import { readFile } from "fs/promises";
import { createDoubaoClient } from "./src/llm.ts";
import { DOUBAO_TOOLS } from "./src/actions/doubao-tools.ts";

// 读取图片
async function loadImageAsBase64(imagePath: string): Promise<string> {
  const buffer = await readFile(imagePath);
  return buffer.toString("base64");
}

async function main() {
  console.log("🚀 测试豆包基础调用\n");

  const imagePath = "/Users/zexi/workspace/wangzexi/cc-api-test/IMG_0138.PNG";
  const imageData = await loadImageAsBase64(imagePath);

  console.log("📷 图片信息:");
  console.log(`   路径: ${imagePath}`);
  console.log(`   大小: ${(imageData.length / 1024).toFixed(2)} KB`);
  console.log();

  // 创建豆包客户端
  const chat = createDoubaoClient({
    apiKey: "83e2429b-4598-4b1e-a9c5-46962b2afaea",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3/responses",
    model: "doubao-seed-1-6-vision-250815",
  });

  console.log("🔧 工具定义:");
  console.log(`   工具数量: ${DOUBAO_TOOLS.length}`);
  console.log(`   工具列表: ${DOUBAO_TOOLS.map(t => t.name).join(", ")}`);
  console.log();

  console.log("📡 发送请求到豆包...\n");

  // 调用豆包
  const response = await chat({
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: `data:image/png;base64,${imageData}`
          },
          {
            type: "input_text",
            text: "请分析这张图片，并告诉我应该点击哪个位置来启动微信"
          }
        ]
      }
    ],
    tools: DOUBAO_TOOLS,
    tool_choice: "auto"
  });

  console.log("✅ 响应信息:");
  console.log(`   模型: ${response.model}`);
  console.log(`   状态: ${response.status}`);
  console.log();

  // 处理响应
  if (response.output) {
    console.log("📤 响应内容:");
    for (const block of response.output) {
      if (block.type === "reasoning") {
        console.log("   💭 推理过程:");
        for (const item of block.summary) {
          if (item.type === "summary_text") {
            console.log(`      ${item.text}`);
          }
        }
      } else if (block.type === "function_call") {
        console.log("   🔧 工具调用:");
        console.log(`      工具名: ${block.name}`);
        console.log(`      参数: ${JSON.stringify(block.arguments, null, 2)}`);
      } else if (block.type === "message") {
        console.log("   💬 消息:");
        for (const item of block.content) {
          if (item.type === "output_text") {
            console.log(`      ${item.text}`);
          }
        }
      }
    }
  }

  // Token 使用情况
  if (response.usage) {
    console.log("\n💰 Token 使用情况:");
    console.log(`   输入: ${response.usage.input_tokens} tokens`);
    console.log(`   输出: ${response.usage.output_tokens} tokens`);
    console.log(`   总计: ${response.usage.total_tokens} tokens`);
  }

  console.log("\n🎉 测试完成!");
}

main().catch(err => {
  console.error("❌ 测试失败:", err.message);
  process.exit(1);
});
