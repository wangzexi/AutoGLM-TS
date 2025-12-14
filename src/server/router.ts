/**
 * oRPC Server Router - API 定义
 */

import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { createAgent, StepResult } from "../agent.ts";
import * as adb from "../actions/adb.ts";

// Schema 定义
const StepSchema = z.object({
	index: z.number(),
	thinking: z.string(),
	action: z.record(z.string(), z.unknown()).optional(),
	screenshot: z.string(), // base64
	success: z.boolean(),
	finished: z.boolean(),
	message: z.string().optional(),
});

type TaskStatus = "running" | "completed" | "failed" | "cancelled";

type TaskData = {
	task: string;
	status: TaskStatus;
	steps: z.infer<typeof StepSchema>[];
	result?: string;
	agent?: ReturnType<typeof createAgent>;
	abortController?: AbortController;
};

// 任务存储（内存）
const tasks = new Map<string, TaskData>();

// 生成任务 ID
const genId = () => Math.random().toString(36).slice(2, 10);

// 设备相关
export const listDevices = os.handler(async () => {
	const devices = await adb.listDevices();
	// 并行获取所有设备截图
	const devicesWithScreenshot = await Promise.all(
		devices.map(async (d) => {
			try {
				const screenshot = await adb.getScreenshot(d.deviceId);
				return { ...d, screenshot: screenshot.base64 };
			} catch {
				return { ...d, screenshot: undefined };
			}
		})
	);
	return devicesWithScreenshot;
});

// 任务相关
export const startTask = os
	.input(z.object({
		task: z.string().min(1),
		deviceId: z.string().optional(),
	}))
	.handler(async function* ({ input }) {
		const id = genId();
		const agent = createAgent({ deviceId: input.deviceId });
		const abortController = new AbortController();

		const taskData: TaskData = {
			task: input.task,
			status: "running",
			steps: [],
			agent,
			abortController,
		};
		tasks.set(id, taskData);

		// 返回任务 ID
		yield { type: "started" as const, id };

		try {
			agent.reset();
			let stepIndex = 0;
			let result: StepResult;
			let isFirst = true;

			do {
				if (abortController.signal.aborted) {
					taskData.status = "cancelled";
					yield { type: "cancelled" as const };
					return;
				}

				// 获取截图
				const screenshot = await adb.getScreenshot(input.deviceId);

				// 执行一步
				result = await agent.step(isFirst ? input.task : undefined);
				isFirst = false;

				const step: z.infer<typeof StepSchema> = {
					index: stepIndex++,
					thinking: result.thinking,
					action: result.action,
					screenshot: screenshot.base64,
					success: result.success,
					finished: result.finished,
					message: result.message,
				};

				taskData.steps.push(step);
				yield { type: "step" as const, step };

			} while (!result.finished && stepIndex < 100);

			taskData.status = "completed";
			taskData.result = result.message || "完成";
			yield { type: "completed" as const, result: taskData.result };

		} catch (e) {
			taskData.status = "failed";
			taskData.result = String(e);
			yield { type: "failed" as const, error: String(e) };
		}
	});

export const getTask = os
	.input(z.object({ id: z.string() }))
	.handler(async ({ input }) => {
		const task = tasks.get(input.id);
		if (!task) {
			throw new ORPCError("NOT_FOUND", { message: "任务不存在" });
		}
		return {
			id: input.id,
			task: task.task,
			status: task.status,
			steps: task.steps,
			result: task.result,
		};
	});

export const cancelTask = os
	.input(z.object({ id: z.string() }))
	.handler(async ({ input }) => {
		const task = tasks.get(input.id);
		if (!task) {
			throw new ORPCError("NOT_FOUND", { message: "任务不存在" });
		}
		task.abortController?.abort();
		task.status = "cancelled";
		return { success: true };
	});

export const listTasks = os.handler(async () => {
	return Array.from(tasks.entries()).map(([id, task]) => ({
		id,
		task: task.task,
		status: task.status,
		stepCount: task.steps.length,
	}));
});

// 路由
export const router = {
	device: {
		list: listDevices,
	},
	task: {
		start: startTask,
		get: getTask,
		cancel: cancelTask,
		list: listTasks,
	},
};

export type Router = typeof router;
