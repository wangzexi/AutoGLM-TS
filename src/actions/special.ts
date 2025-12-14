/**
 * 特殊操作：Take_over, Note, Call_API, Interact
 */

import { z } from "zod";
import type { ActionDef } from "./types.ts";

const TakeOverSchema = z.object({
  action: z.literal("Take_over"),
  message: z.string(),
});

export const takeOver: ActionDef<typeof TakeOverSchema> = {
  name: "Take_over",
  description: "Take_over是接管操作，表示在登录和验证阶段需要用户协助。",
  schema: TakeOverSchema,
  handler: async (params, _ctx) => {
    // 接管时任务结束，前端显示接管提示
    return { success: true, finished: true, message: params.message };
  },
};

const NoteSchema = z.object({ action: z.literal("Note"), content: z.string() });

export const note: ActionDef<typeof NoteSchema> = {
  name: "Note",
  description: "记录当前页面内容以便后续总结。",
  schema: NoteSchema,
  handler: async (params, _ctx) => {
    console.log(`📝 记录: ${params.content}`);
    return { success: true };
  },
};

const CallApiSchema = z.object({
  action: z.literal("Call_API"),
  instruction: z.string(),
});

export const callApi: ActionDef<typeof CallApiSchema> = {
  name: "Call_API",
  description: "总结或评论当前页面或已记录的内容。",
  schema: CallApiSchema,
  handler: async (params, _ctx) => {
    console.log(`🔗 API 调用: ${params.instruction}`);
    return { success: true };
  },
};

const InteractSchema = z.object({ action: z.literal("Interact") });

export const interact: ActionDef<typeof InteractSchema> = {
  name: "Interact",
  description:
    "Interact是当有多个满足条件的选项时而触发的交互操作，询问用户如何选择。",
  schema: InteractSchema,
  handler: async (_params, _ctx) => {
    return { success: true, message: "需要用户选择" };
  },
};
