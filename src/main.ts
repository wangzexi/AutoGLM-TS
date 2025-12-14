/**
 * AutoGLM-TS 入口
 */

import { Command } from "commander";
import { z } from "zod";
import { createAgent } from "./agent.ts";
import { createWebServer } from "./server/index.ts";

// 参数 schema
const argsSchema = z.object({
  deviceId: z.string().optional(),
  task: z.string().optional(),
  port: z.number().default(3000),
});

type Args = z.infer<typeof argsSchema>;

// 参数解析
const parseArgs = (): Args => {
  const program = new Command();

  program
    .option("-d, --device <id>", "设备 ID")
    .option("--port <n>", "服务器端口", Number.parseInt)
    .argument("[task]", "执行的任务")
    .parse();

  const opts = program.opts();
  const task = program.args[0];

  return argsSchema.parse({
    deviceId: opts.device,
    task,
    port: opts.port,
  });
};

// 主入口
const main = async () => {
  const args = parseArgs();

  // 检查必要的环境变量
  const apiKey = process.env.AUTOGLM_API_KEY;
  if (!apiKey) {
    throw new Error("❌ 缺少 API_KEY 配置\n请设置环境变量 AUTOGLM_API_KEY");
  }

  // 直接执行任务（无 UI）
  if (args.task) {
    console.log("📱 AutoGLM-TS");
    console.log(`\n执行: ${args.task}\n`);

    const agent = createAgent(args);
    try {
      const result = await agent.run(args.task);
      console.log(`\n✅ ${result}`);
    } catch (e) {
      console.error(`\n❌ ${e}`);
      process.exit(1);
    }
    return;
  }

  // 交互模式：启动 Web Server
  console.log("📱 AutoGLM-TS\n");

  const server = createWebServer(args.port);
  await server.start();

  console.log("按 Ctrl+C 退出\n");

  // 处理退出
  process.on("SIGINT", async () => {
    console.log("\n👋 再见");
    await server.stop();
    process.exit(0);
  });
};

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
