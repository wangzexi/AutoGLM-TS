/**
 * PhoneAgent - 纯函数 + 闭包实现
 */

import { buildSystemPrompt } from "./config.ts";
import { executeAction, ActionContext } from "./actions/index.ts";
import * as adb from "./actions/adb.ts";

// 类型
export type StepResult = {
	success: boolean;
	finished: boolean;
	thinking: string;
	action?: Record<string, unknown>;
	message?: string;
};

type Message = {
	role: "system" | "user" | "assistant";
	content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

type AgentConfig = {
	baseUrl?: string;
	apiKey?: string;
	model?: string;
	deviceId?: string;
	maxSteps?: number;
	onConfirm?: (msg: string) => boolean;
	onTakeover?: (msg: string) => void;
};

// 简单的 OpenAI 兼容 client（用 fetch 实现）
const createClient = (baseUrl: string, apiKey: string) => {
	const chat = async function* (model: string, messages: Message[]) {
		const res = await fetch(`${baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages,
				max_tokens: 3000,
				temperature: 0,
				top_p: 0.85,
				frequency_penalty: 0.2,
				stream: true,
			}),
		});

		if (!res.ok) throw new Error(`API 错误: ${res.status}`);
		if (!res.body) throw new Error("无响应体");

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (!line.startsWith("data: ")) continue;
				const data = line.slice(6);
				if (data === "[DONE]") return;

				try {
					const json = JSON.parse(data);
					const content = json.choices?.[0]?.delta?.content;
					if (content) yield content;
				} catch {}
			}
		}
	};

	return { chat };
};

// 解析动作字符串
const parseAction = (str: string): Record<string, unknown> => {
	if (str.startsWith("finish(")) {
		const match = str.match(/message=["']?([^"')]+)/);
		return { _type: "finish", message: match?.[1] || "完成" };
	}

	if (!str.startsWith("do(")) return { _type: "finish", message: str };

	const action: Record<string, unknown> = { _type: "do" };
	const kvPattern = /(\w+)=(\[[^\]]+\]|"[^"]*"|'[^']*'|[\w.-]+)/g;
	let m;

	while ((m = kvPattern.exec(str))) {
		let val: unknown = m[2];
		if (val === "True") val = true;
		else if (val === "False") val = false;
		else if (val === "None") val = null;
		else if (typeof val === "string" && val.startsWith("[")) val = JSON.parse(val);
		else if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) val = val.slice(1, -1);
		else if (typeof val === "string" && !isNaN(Number(val))) val = Number(val);
		action[m[1]] = val;
	}

	return action;
};

// 解析模型响应
const parseResponse = (content: string) => {
	const markers = ["finish(message=", "do(action="];

	for (const marker of markers) {
		if (!content.includes(marker)) continue;
		const [thinking, rest] = content.split(marker, 2);
		return {
			thinking: thinking.replace(/<\/?think>/g, "").trim(),
			action: parseAction(marker + rest),
		};
	}

	// XML 格式兼容
	if (content.includes("<answer>")) {
		const [thinking, rest] = content.split("<answer>", 2);
		return {
			thinking: thinking.replace(/<\/?think>/g, "").trim(),
			action: parseAction(rest.replace(/<\/answer>.*/, "")),
		};
	}

	return { thinking: content, action: { _type: "finish", message: content } };
};

// 创建 Agent（闭包工厂）
export const createAgent = (config: AgentConfig = {}) => {
	const baseUrl = config.baseUrl || process.env.PHONE_AGENT_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
	const apiKey = config.apiKey || process.env.PHONE_AGENT_API_KEY || "";
	const model = config.model || process.env.PHONE_AGENT_MODEL || "autoglm-phone";
	const deviceId = config.deviceId;
	const maxSteps = config.maxSteps || 100;

	const onConfirm = config.onConfirm || ((msg) => {
		console.log(`⚠️ 敏感操作: ${msg}`);
		return true;
	});

	const onTakeover = config.onTakeover || ((msg) => {
		console.log(`🖐️ 需要手动操作: ${msg}`);
	});

	const client = createClient(baseUrl, apiKey);

	// 状态
	let context: Message[] = [];
	let stepCount = 0;

	const reset = () => {
		context = [];
		stepCount = 0;
	};

	const step = async (task?: string): Promise<StepResult> => {
		stepCount++;
		const isFirst = context.length === 0;

		if (isFirst && !task) throw new Error("首次调用需要 task");

		// 获取屏幕
		const screenshot = await adb.getScreenshot(deviceId);
		const currentApp = await adb.getCurrentApp(deviceId);

		// 构建消息
		if (isFirst) {
			context.push({ role: "system", content: buildSystemPrompt() });
		}

		const screenInfo = JSON.stringify({ current_app: currentApp });
		const text = isFirst ? `${task}\n\n** Screen Info **\n${screenInfo}` : `** Screen Info **\n${screenInfo}`;

		context.push({
			role: "user",
			content: [
				{ type: "image_url", image_url: { url: `data:image/png;base64,${screenshot.base64}` } },
				{ type: "text", text },
			],
		});

		// 调用模型
		let rawContent = "";
		try {
			let inAction = false;
			let buffer = "";

			for await (const chunk of client.chat(model, context)) {
				rawContent += chunk;

				if (inAction) continue;

				buffer += chunk;

				// 检测 action 开始
				const markers = ["finish(message=", "do(action="];
				for (const marker of markers) {
					if (!buffer.includes(marker)) continue;
					process.stdout.write(buffer.split(marker)[0] + "\n");
					inAction = true;
					break;
				}

				if (inAction) continue;

				// 检测潜在 marker
				let isPotential = false;
				for (const marker of markers) {
					for (let i = 1; i < marker.length; i++) {
						if (buffer.endsWith(marker.slice(0, i))) {
							isPotential = true;
							break;
						}
					}
					if (isPotential) break;
				}

				if (!isPotential) {
					process.stdout.write(buffer);
					buffer = "";
				}
			}
		} catch (e) {
			return { success: false, finished: true, thinking: "", message: `模型错误: ${e}` };
		}

		// 解析
		const { thinking, action } = parseResponse(rawContent);

		// 移除历史图片
		const lastMsg = context.at(-1);
		if (lastMsg && Array.isArray(lastMsg.content)) {
			lastMsg.content = lastMsg.content.filter((c) => c.type === "text");
		}

		// 执行动作
		const ctx: ActionContext = {
			deviceId,
			screenWidth: screenshot.width,
			screenHeight: screenshot.height,
			onConfirm,
			onTakeover,
		};

		const result = await executeAction(action, ctx);

		return {
			success: result.success,
			finished: action._type === "finish" || result.finished || false,
			thinking,
			action,
			message: result.message || (action.message as string),
		};
	};

	const run = async (task: string) => {
		reset();
		let result = await step(task);

		while (!result.finished && stepCount < maxSteps) {
			result = await step();
		}

		return result.message || "完成";
	};

	return { run, step, reset };
};

// 兼容旧 API
export class PhoneAgent {
	private agent: ReturnType<typeof createAgent>;

	constructor(config: AgentConfig = {}) {
		this.agent = createAgent(config);
	}

	run = (task: string) => this.agent.run(task);
	step = (task?: string) => this.agent.step(task);
	reset = () => this.agent.reset();
}
