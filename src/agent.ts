/**
 * PhoneAgent - 纯函数 + 闭包实现
 */

import { buildSystemPrompt } from "./config.ts";
import { executeAction, parseAction, ActionContext, Action } from "./actions/index.ts";
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
};

// 流式调用 OpenAI 兼容 API
async function* chat(baseUrl: string, apiKey: string, model: string, messages: Message[]) {
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
}

// 解析模型响应：提取 thinking，解析并验证 action
type ParseResult = {
	thinking: string;
	action?: Action;
	error?: string;
};

const parseResponse = (content: string): ParseResult => {
	const markers = ["finish(", "do("];

	for (const marker of markers) {
		const idx = content.indexOf(marker);
		if (idx === -1) continue;

		// 找到闭合的 )
		let depth = 0;
		let end = -1;
		for (let i = idx; i < content.length; i++) {
			if (content[i] === "(") depth++;
			else if (content[i] === ")") {
				depth--;
				if (depth === 0) {
					end = i + 1;
					break;
				}
			}
		}

		if (end === -1) continue;

		const thinking = content.slice(0, idx).replace(/<\/?think>/g, "").trim();
		const actionStr = content.slice(idx, end);

		// 解析并验证 action
		const parseResult = parseAction(actionStr);
		if (parseResult.success) {
			return { thinking, action: parseResult.data };
		}
		return { thinking, error: parseResult.error };
	}

	// 没有找到 action
	return { thinking: content.replace(/<\/?think>/g, "").trim() };
};

// 创建 Agent（闭包工厂）
export const createAgent = (config: AgentConfig = {}) => {
	const baseUrl = config.baseUrl || process.env.PHONE_AGENT_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
	const apiKey = config.apiKey || process.env.PHONE_AGENT_API_KEY || "";
	const model = config.model || process.env.PHONE_AGENT_MODEL || "autoglm-phone";
	const deviceId = config.deviceId;
	const maxSteps = config.maxSteps || 100;

	// 状态
	let context: Message[] = [];
	let currentTask = "";
	let stepCount = 0;

	const reset = () => {
		context = [];
		currentTask = "";
		stepCount = 0;
	};

	const step = async (task?: string): Promise<StepResult> => {
		stepCount++;

		// 首次调用设置任务
		if (task) currentTask = task;
		if (!currentTask) throw new Error("需要设置 task");

		const isFirst = context.length === 0;

		// 获取屏幕
		const screenshot = await adb.getScreenshot(deviceId);
		const currentApp = await adb.getCurrentApp(deviceId);

		// 构建消息
		if (isFirst) {
			context.push({ role: "system", content: buildSystemPrompt() });
		}

		const screenInfo = `当前应用: ${currentApp}`;
		const text = isFirst ? `${currentTask}\n\n${screenInfo}` : screenInfo;

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

			for await (const chunk of chat(baseUrl, apiKey, model, context)) {
				rawContent += chunk;

				if (inAction) continue;

				buffer += chunk;

				// 检测 do() 或 finish() action 开始
				const markers = ["do(", "finish("];
				for (const marker of markers) {
					const idx = buffer.indexOf(marker);
					if (idx !== -1) {
						// 输出 thinking 部分
						process.stdout.write(buffer.slice(0, idx) + "\n");
						inAction = true;
						break;
					}
				}

				if (inAction) continue;

				// 检测潜在 marker（避免截断）
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

		// 解析响应
		const { thinking, action, error } = parseResponse(rawContent);

		// 记录 assistant 响应
		context.push({ role: "assistant", content: rawContent });

		// 解析失败，反馈给模型重试
		if (error) {
			console.error(`\n❌ Action 解析失败: ${error}`);
			context.push({ role: "user", content: `Action 格式错误: ${error}\n请修正后重新输出。` });
			stepCount--;
			return step();
		}

		// 没有 action，当作完成
		if (!action) {
			return { success: true, finished: true, thinking, message: thinking };
		}

		// 移除历史图片（节省 token）
		const prevUserMsg = context.at(-2);
		if (prevUserMsg && Array.isArray(prevUserMsg.content)) {
			prevUserMsg.content = prevUserMsg.content.filter((c) => c.type === "text");
		}

		// 执行动作
		const ctx: ActionContext = {
			deviceId,
			screenWidth: screenshot.width,
			screenHeight: screenshot.height,
		};

		// 转换为 executeAction 需要的格式
		const actionForExec = action as Record<string, unknown>;
		const result = await executeAction(actionForExec, ctx);

		const isFinish = actionForExec.action === "finish";
		return {
			success: result.success,
			finished: isFinish || result.finished || false,
			thinking,
			action: actionForExec,
			message: result.message || (isFinish ? (actionForExec.message as string) : undefined),
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
