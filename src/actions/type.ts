/**
 * Type - 输入文本
 */

import { z } from "zod";
import { ActionContext, ActionDef, delay } from "./types.ts";
import * as adb from "./adb.ts";

// 公共 handler
const typeHandler = async (params: { text: string }, ctx: ActionContext) => {
	await adb.clearText(ctx.deviceId);
	await delay(500);
	await adb.typeText(params.text, ctx.deviceId);
	await delay(1000);
	return { success: true };
};

const TypeSchema = z.object({ action: z.literal("Type"), text: z.string() });

export const type: ActionDef<typeof TypeSchema> = {
	name: "Type",
	description:
		"Type是输入操作，在当前聚焦的输入框中输入文本。使用此操作前，请确保输入框已被聚焦（先点击它）。输入的文本将像使用键盘输入一样输入。重要提示：手机可能正在使用 ADB 键盘，该键盘不会像普通键盘那样占用屏幕空间。要确认键盘已激活，请查看屏幕底部是否显示 'ADB Keyboard {ON}' 类似的文本，或者检查输入框是否处于激活/高亮状态。不要仅仅依赖视觉上的键盘显示。自动清除文本：当你使用输入操作时，输入框中现有的任何文本（包括占位符文本和实际输入）都会在输入新文本前自动清除。你无需在输入前手动清除文本——直接使用输入操作输入所需文本即可。操作完成后，你将自动收到结果状态的截图。",
	schema: TypeSchema,
	handler: typeHandler,
};

const TypeNameSchema = z.object({ action: z.literal("Type_Name"), text: z.string() });

export const typeName: ActionDef<typeof TypeNameSchema> = {
	name: "Type_Name",
	description: "Type_Name是输入人名的操作，基本功能同Type。",
	schema: TypeNameSchema,
	handler: typeHandler,
};
