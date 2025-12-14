/**
 * Launch - 启动应用
 */

import { z } from "zod";
import { ActionDef, delay } from "./types.ts";
import * as adb from "./adb.ts";

const LaunchSchema = z.object({ action: z.literal("Launch"), app: z.string() });

export const launch: ActionDef<typeof LaunchSchema> = {
	name: "Launch",
	description: "Launch是启动目标app的操作，这比通过主屏幕导航更快。此操作完成后，您将自动收到结果状态的截图。",
	schema: LaunchSchema,
	handler: async (params, ctx) => {
		const ok = await adb.launchApp(params.app, ctx.deviceId);
		if (!ok) return { success: false, message: `应用不存在: ${params.app}` };
		await delay(2000);
		return { success: true };
	},
};
