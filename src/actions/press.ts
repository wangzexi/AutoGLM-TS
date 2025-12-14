/**
 * 点击类操作：Double_Tap, Long_Press
 */

import { z } from "zod";
import { ActionDef, Coordinate, delay, toAbsolute } from "./types.ts";
import * as adb from "./adb.ts";

const DoubleTapSchema = z.object({ action: z.literal("Double_Tap"), element: Coordinate });

export const doubleTap: ActionDef<typeof DoubleTapSchema> = {
	name: "Double_Tap",
	description:
		"Double_Tap在屏幕上的特定点快速连续点按两次。使用此操作可以激活双击交互，如缩放、选择文本或打开项目。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的截图。",
	schema: DoubleTapSchema,
	handler: async (params, ctx) => {
		const [x, y] = toAbsolute(params.element, ctx.screenWidth, ctx.screenHeight);
		await adb.tap(x, y, ctx.deviceId);
		await delay(100);
		await adb.tap(x, y, ctx.deviceId);
		await delay(1000);
		return { success: true };
	},
};

const LongPressSchema = z.object({ action: z.literal("Long_Press"), element: Coordinate });

export const longPress: ActionDef<typeof LongPressSchema> = {
	name: "Long_Press",
	description:
		"Long_Press是长按操作，在屏幕上的特定点长按指定时间。可用于触发上下文菜单、选择文本或激活长按交互。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的屏幕截图。",
	schema: LongPressSchema,
	handler: async (params, ctx) => {
		const [x, y] = toAbsolute(params.element, ctx.screenWidth, ctx.screenHeight);
		await adb.longPress(x, y, ctx.deviceId);
		await delay(1000);
		return { success: true };
	},
};
