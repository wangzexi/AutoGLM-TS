/**
 * AutoGLM-TS 入口
 */

import { createAgent } from "./agent.ts";
import { listDevices } from "./actions/adb.ts";
import { createWebServer } from "./server/index.ts";

// CLI 参数解析
const parseArgs = () => {
	const argv = process.argv.slice(2);
	const args: Record<string, unknown> = {};

	for (let i = 0; i < argv.length; i++) {
		const [key, val] = [argv[i], argv[i + 1]];
		switch (key) {
			case "--base-url": args.baseUrl = val; i++; break;
			case "--model": args.model = val; i++; break;
			case "--apikey": args.apiKey = val; i++; break;
			case "--max-steps": args.maxSteps = parseInt(val); i++; break;
			case "-d": case "--device": args.deviceId = val; i++; break;
			case "--list-devices": args.listDevices = true; break;
			case "--port": args.port = parseInt(val); i++; break;
			default: if (!key.startsWith("-")) args.task = key;
		}
	}

	return {
		baseUrl: args.baseUrl as string | undefined,
		model: args.model as string | undefined,
		apiKey: args.apiKey as string | undefined,
		maxSteps: args.maxSteps as number | undefined,
		deviceId: args.deviceId as string | undefined,
		task: args.task as string | undefined,
		listDevices: args.listDevices as boolean | undefined,
		port: (args.port as number) || 3000,
	};
};

// 主入口
const main = async () => {
	const args = parseArgs();

	// 列出设备
	if (args.listDevices) {
		const devices = await listDevices();
		console.log("连接的设备:");
		devices.forEach((d) => console.log(`  - ${d.deviceId} (${d.status})`));
		return;
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

main();
