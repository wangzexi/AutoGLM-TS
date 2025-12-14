/**
 * Swipe - 滑动操作
 */

import { Action, delay, toAbsolute } from "./types.ts";
import * as adb from "./adb.ts";

export const swipe: Action = {
	name: "Swipe",
	description: "Swipe是滑动操作，通过从起始坐标拖动到结束坐标来执行滑动手势。可用于滚动内容、在屏幕之间导航、下拉通知栏以及项目栏或进行基于手势的导航。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。滑动持续时间会自动调整以实现自然的移动。此操作完成后，您将自动收到结果状态的截图。",
	usage: 'do(action="Swipe", start=[x1,y1], end=[x2,y2])',

	handler: async (params, ctx) => {
		const start = params.start as number[];
		const end = params.end as number[];

		if (!start || !end) {
			return { success: false, message: "未指定滑动坐标" };
		}

		const [sx, sy] = toAbsolute(start, ctx.screenWidth, ctx.screenHeight);
		const [ex, ey] = toAbsolute(end, ctx.screenWidth, ctx.screenHeight);

		await adb.swipe(sx, sy, ex, ey, 300, ctx.deviceId);
		await delay(1000);

		return { success: true };
	},
};
