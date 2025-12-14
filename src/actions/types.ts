/**
 * 动作类型定义
 */

// 动作执行上下文
export type ActionContext = {
	deviceId?: string;
	screenWidth: number;
	screenHeight: number;
	onConfirm: (message: string) => boolean;
	onTakeover: (message: string) => void;
};

// 动作执行结果
export type ActionResult = {
	success: boolean;
	finished?: boolean;
	message?: string;
};

// 动作定义
export type Action = {
	name: string;
	description: string;
	usage: string;
	handler: (params: Record<string, unknown>, ctx: ActionContext) => Promise<ActionResult>;
};

// 坐标转换：相对坐标(0-999) -> 绝对坐标
export const toAbsolute = (rel: number[], w: number, h: number): [number, number] => [
	Math.floor((rel[0] / 1000) * w),
	Math.floor((rel[1] / 1000) * h),
];

// 延时
export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
