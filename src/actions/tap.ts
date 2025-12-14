/**
 * Tap - 点击操作
 */

import { z } from "zod";
import { ActionDef, Coordinate, delay, toAbsolute } from "./types.ts";
import * as adb from "./adb.ts";

const TapSchema = z.object({ action: z.literal("Tap"), element: Coordinate, message: z.string().optional() });

export const tap: ActionDef<typeof TapSchema> = {
	name: "Tap",
	description:
		"Tap是点击操作，点击屏幕上的特定点。可用此操作点击按钮、选择项目、从主屏幕打开应用程序，或与任何可点击的用户界面元素进行交互。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的截图。",
	schema: TapSchema,
	handler: async (params, ctx) => {
		if (params.message && !ctx.onConfirm(params.message)) {
			return { success: false, finished: true, message: "用户取消敏感操作" };
		}
		const [x, y] = toAbsolute(params.element, ctx.screenWidth, ctx.screenHeight);
		await adb.tap(x, y, ctx.deviceId);
		await delay(1000);
		return { success: true };
	},
};

const TapSensitiveSchema = z.object({ action: z.literal("Tap"), element: Coordinate, message: z.string() });

export const tapSensitive: ActionDef<typeof TapSensitiveSchema> = {
	name: "Tap（敏感）",
	description: "基本功能同Tap，点击涉及财产、支付、隐私等敏感按钮时触发。",
	schema: TapSensitiveSchema,
	handler: tap.handler as ActionDef<typeof TapSensitiveSchema>["handler"],
};
