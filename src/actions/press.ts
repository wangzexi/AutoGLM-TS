/**
 * 点击类操作：Double Tap, Long Press
 */

import { Action, delay, toAbsolute } from "./types.ts";
import * as adb from "./adb.ts";

export const doubleTap: Action = {
	name: "Double Tap",
	description: "Double Tap在屏幕上的特定点快速连续点按两次。使用此操作可以激活双击交互，如缩放、选择文本或打开项目。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的截图。",
	usage: 'do(action="Double Tap", element=[x,y])',

	handler: async (params, ctx) => {
		const element = params.element as number[];
		if (!element) {
			return { success: false, message: "未指定坐标" };
		}

		const [x, y] = toAbsolute(element, ctx.screenWidth, ctx.screenHeight);
		await adb.tap(x, y, ctx.deviceId);
		await delay(100);
		await adb.tap(x, y, ctx.deviceId);
		await delay(1000);

		return { success: true };
	},
};

export const longPress: Action = {
	name: "Long Press",
	description: "Long Press是长按操作，在屏幕上的特定点长按指定时间。可用于触发上下文菜单、选择文本或激活长按交互。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的屏幕截图。",
	usage: 'do(action="Long Press", element=[x,y])',

	handler: async (params, ctx) => {
		const element = params.element as number[];
		if (!element) {
			return { success: false, message: "未指定坐标" };
		}

		const [x, y] = toAbsolute(element, ctx.screenWidth, ctx.screenHeight);
		await adb.longPress(x, y, ctx.deviceId);
		await delay(1000);

		return { success: true };
	},
};
