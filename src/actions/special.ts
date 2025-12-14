/**
 * 特殊操作：Take_over, Note, Call_API, Interact
 */

import { Action } from "./types.ts";

export const takeOver: Action = {
	name: "Take_over",
	description: "Take_over是接管操作，表示在登录和验证阶段需要用户协助。",
	usage: 'do(action="Take_over", message="xxx")',

	handler: async (params, ctx) => {
		const message = (params.message as string) || "需要用户手动操作";
		ctx.onTakeover(message);
		return { success: true };
	},
};

export const note: Action = {
	name: "Note",
	description: "记录当前页面内容以便后续总结。",
	usage: 'do(action="Note", message="True")',

	handler: async (params, _ctx) => {
		console.log(`📝 记录: ${params.content}`);
		return { success: true };
	},
};

export const callApi: Action = {
	name: "Call_API",
	description: "总结或评论当前页面或已记录的内容。",
	usage: 'do(action="Call_API", instruction="xxx")',

	handler: async (params, _ctx) => {
		console.log(`🔗 API 调用: ${params.instruction}`);
		return { success: true };
	},
};

export const interact: Action = {
	name: "Interact",
	description: "Interact是当有多个满足条件的选项时而触发的交互操作，询问用户如何选择。",
	usage: 'do(action="Interact")',

	handler: async (_params, _ctx) => {
		return { success: true, message: "需要用户选择" };
	},
};
