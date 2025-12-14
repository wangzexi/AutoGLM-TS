import * as readline from "readline";
import { render } from "ink";
import React from "react";
import { App } from "./ui/App.js";
import { parseArgs } from "./utils/args.js";

const args = parseArgs();

// 检测 TTY 支持
const isInteractive = process.stdin.isTTY && process.stdout.isTTY;

if (args.listApps) {
	import("./phone-agent/config/apps.ts").then(({ listSupportedApps }) => {
		console.log("Supported apps:");
		listSupportedApps().forEach((app) => console.log(`  - ${app}`));
		process.exit(0);
	});
} else if (!isInteractive) {
	// 非交互模式 - 使用传统的 readline
	console.log("📱 AutoGLM-TS");
	console.log("AI-powered phone automation\n");

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "➜ ",
	});

	if (args.task) {
		// 直接执行任务
		console.log(`Task: ${args.task}\n`);
		rl.close();
		import("./phone-agent/agent.ts").then(({ PhoneAgent }) => {
			const agent = new PhoneAgent(
				{
					baseUrl: args.baseUrl,
					modelName: args.model,
					apiKey: args.apikey,
				},
				{
					maxSteps: args.maxSteps,
					deviceId: args.deviceId,
					verbose: !args.quiet,
				}
			);
			agent
				.run(args.task!)
				.then((result) => {
					console.log(`\n${result}`);
					process.exit(0);
				})
				.catch((error) => {
					console.error(`\nError: ${error}`);
					process.exit(1);
				});
		});
	} else {
		// 交互模式
		console.log("Interactive mode. Type 'quit' to exit.\n");

		rl.prompt();

		rl.on("line", async (line) => {
			const task = line.trim();

			if (["quit", "exit", "q"].includes(task.toLowerCase())) {
				console.log("Goodbye!");
				rl.close();
				return;
			}

			if (task) {
				console.log(`\nExecuting: ${task}\n`);

				const { PhoneAgent } = await import("./phone-agent/agent.ts");
				const agent = new PhoneAgent(
					{
						baseUrl: args.baseUrl,
						modelName: args.model,
						apiKey: args.apikey,
					},
					{
						maxSteps: args.maxSteps,
						deviceId: args.deviceId,
						verbose: !args.quiet,
					}
				);

				try {
					const result = await agent.run(task);
					console.log(`\nResult: ${result}\n`);
					agent.reset();
				} catch (error) {
					console.error(`Error: ${error}\n`);
				}
			}

			rl.prompt();
		});

		rl.on("close", () => {
			process.exit(0);
		});
	}
} else {
	// 交互模式 - 使用 ink
	render(React.createElement(App, { args }));
}
