/**
 * Launch - 启动应用
 */

import { Action, delay } from "./types.ts";
import * as adb from "./adb.ts";

export const launch: Action = {
	name: "Launch",
	description: "Launch是启动目标app的操作，这比通过主屏幕导航更快。此操作完成后，您将自动收到结果状态的截图。",
	usage: 'do(action="Launch", app="xxx")',

	handler: async (params, ctx) => {
		const app = params.app as string;
		if (!app) {
			return { success: false, message: "未指定应用名" };
		}

		const ok = await adb.launchApp(app, ctx.deviceId);
		if (!ok) {
			return { success: false, message: `应用不存在: ${app}` };
		}

		await delay(2000);
		return { success: true };
	},
};
