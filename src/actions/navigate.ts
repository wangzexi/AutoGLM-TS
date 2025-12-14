/**
 * 导航操作：Back, Home, Wait
 */

import { Action, delay } from "./types.ts";
import * as adb from "./adb.ts";

export const back: Action = {
	name: "Back",
	description: "导航返回到上一个屏幕或关闭当前对话框。相当于按下 Android 的返回按钮。使用此操作可以从更深的屏幕返回、关闭弹出窗口或退出当前上下文。此操作完成后，您将自动收到结果状态的截图。",
	usage: 'do(action="Back")',

	handler: async (_params, ctx) => {
		await adb.back(ctx.deviceId);
		await delay(1000);
		return { success: true };
	},
};

export const home: Action = {
	name: "Home",
	description: "Home是回到系统桌面的操作，相当于按下 Android 主屏幕按钮。使用此操作可退出当前应用并返回启动器，或从已知状态启动新任务。此操作完成后，您将自动收到结果状态的截图。",
	usage: 'do(action="Home")',

	handler: async (_params, ctx) => {
		await adb.home(ctx.deviceId);
		await delay(1000);
		return { success: true };
	},
};

export const wait: Action = {
	name: "Wait",
	description: "等待页面加载，x为需要等待多少秒。",
	usage: 'do(action="Wait", duration="x seconds")',

	handler: async (params, _ctx) => {
		const durationStr = String(params.duration ?? "1 seconds");
		const seconds = parseFloat(durationStr.replace(/[^\d.]/g, "")) || 1;
		await delay(seconds * 1000);
		return { success: true };
	},
};
