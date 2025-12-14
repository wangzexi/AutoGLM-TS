/**
 * 动作注册表 - 自动生成提示词
 */

import { Action, ActionContext, ActionResult } from "./types.ts";
import { launch } from "./launch.ts";
import { tap, tapSensitive } from "./tap.ts";
import { type, typeName } from "./type.ts";
import { swipe } from "./swipe.ts";
import { doubleTap, longPress } from "./press.ts";
import { back, home, wait } from "./navigate.ts";
import { takeOver, note, callApi, interact } from "./special.ts";

// 所有动作（用于生成提示词）
const allActions: Action[] = [
	launch,
	tap,
	tapSensitive,
	type,
	typeName,
	interact,
	swipe,
	longPress,
	doubleTap,
	back,
	home,
	wait,
	takeOver,
	note,
	callApi,
];

// 动作处理器映射（name -> handler）
const handlers = new Map<string, Action["handler"]>();
for (const action of allActions) {
	handlers.set(action.name, action.handler);
}
// 别名
handlers.set("Type_Name", type.handler);

/**
 * 生成动作提示词
 *
 * @example 输出样例:
 * ```
 * - do(action="Launch", app="xxx")
 *   Launch是启动目标app的操作，这比通过主屏幕导航更快。
 * - do(action="Tap", element=[x,y])
 *   Tap是点击操作，点击屏幕上的特定点。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。
 * - do(action="Tap", element=[x,y], message="重要操作")
 *   基本功能同Tap，点击涉及财产、支付、隐私等敏感按钮时触发。
 * - do(action="Type", text="xxx")
 *   Type是输入操作，在当前聚焦的输入框中输入文本。输入框中现有的任何文本都会被自动清除。
 * ...
 * - finish(message="xxx")
 *   finish是结束任务的操作，表示准确完整完成任务。
 * ```
 */
export const generateActionsPrompt = (): string => {
	const seen = new Set<string>();
	const lines: string[] = [];

	for (const action of allActions) {
		// 避免重复（如 tapSensitive 和 tap 共用 handler）
		const key = action.usage;
		if (seen.has(key)) continue;
		seen.add(key);

		lines.push(`- ${action.usage}`);
		lines.push(`    ${action.description}`);
	}

	// finish 是特殊的，单独添加（与原版一致）
	lines.push(`- finish(message="xxx")`);
	lines.push(`    finish是结束任务的操作，表示准确完整完成任务，message是终止信息。`);

	return lines.join("\n");
};

// 执行动作
export const executeAction = async (
	action: Record<string, unknown>,
	ctx: ActionContext
): Promise<ActionResult> => {
	// finish 特殊处理
	if (action._type === "finish") {
		return { success: true, finished: true, message: action.message as string };
	}

	const name = action.action as string;
	const handler = handlers.get(name);

	if (!handler) {
		return { success: false, message: `未知操作: ${name}` };
	}

	try {
		return await handler(action, ctx);
	} catch (e) {
		return { success: false, message: `执行失败: ${e}` };
	}
};

// 导出类型
export type { Action, ActionContext, ActionResult };
