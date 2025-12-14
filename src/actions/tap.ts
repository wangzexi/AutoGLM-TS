/**
 * Tap - 点击操作
 */

import { Action, delay, toAbsolute } from "./types.ts";
import * as adb from "./adb.ts";

export const tap: Action = {
	name: "Tap",
	description: "Tap是点击操作，点击屏幕上的特定点。可用此操作点击按钮、选择项目、从主屏幕打开应用程序，或与任何可点击的用户界面元素进行交互。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的截图。",
	usage: 'do(action="Tap", element=[x,y])',

	handler: async (params, ctx) => {
		const element = params.element as number[];
		if (!element) {
			return { success: false, message: "未指定坐标" };
		}

		// 敏感操作检查
		if (params.message) {
			if (!ctx.onConfirm(params.message as string)) {
				return { success: false, finished: true, message: "用户取消敏感操作" };
			}
		}

		const [x, y] = toAbsolute(element, ctx.screenWidth, ctx.screenHeight);
		await adb.tap(x, y, ctx.deviceId);
		await delay(1000);
		return { success: true };
	},
};

// 敏感点击的额外说明
export const tapSensitive: Action = {
	name: "Tap（敏感）",
	description: "基本功能同Tap，点击涉及财产、支付、隐私等敏感按钮时触发。",
	usage: 'do(action="Tap", element=[x,y], message="重要操作")',
	handler: tap.handler,
};
