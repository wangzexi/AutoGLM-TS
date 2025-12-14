/**
 * 动作注册表 - 自动生成提示词
 */

import { z } from "zod";
import { launch } from "./launch.ts";
import { back, home, wait } from "./navigate.ts";
import { doubleTap, longPress } from "./press.ts";
import { callApi, interact, note, takeOver } from "./special.ts";
import { swipe } from "./swipe.ts";
import { tap, tapSensitive } from "./tap.ts";
import { type, typeName } from "./type.ts";
import {
  type ActionContext,
  type ActionDef,
  type ActionResult,
  schemaToUsage,
} from "./types.ts";

// 所有动作
const allActions = [
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
] as const satisfies ActionDef<z.ZodObject<z.ZodRawShape>>[];

// 动作处理器映射（action name -> handler）
const handlers = new Map<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: 动态动作处理器需要通用类型
  (params: any, ctx: ActionContext) => Promise<ActionResult>
>();
for (const action of allActions) {
  // 从 schema 中提取 action literal 值 (zod v4)
  // biome-ignore lint/suspicious/noExplicitAny: 与 zod 内部 API 交互
  const actionLiteral = action.schema.shape.action as any;
  const actionName =
    actionLiteral.value ?? actionLiteral._zod?.def?.values?.[0];
  if (actionName) {
    handlers.set(actionName as string, action.handler);
  }
}

/**
 * 生成动作提示词（do() 格式）
 */
export const generateActionsPrompt = (): string => {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const action of allActions) {
    const usage = schemaToUsage(action.schema as z.ZodObject<z.ZodRawShape>);
    if (seen.has(usage)) continue;
    seen.add(usage);

    lines.push(`- ${usage}`);
    lines.push(`  ${action.description}`);
  }

  // finish 是特殊的
  lines.push('- finish(message="xxx")');
  lines.push(
    "  finish是结束任务的操作，表示准确完整完成任务，message是终止信息。",
  );

  return lines.join("\n");
};

// 合并所有 action schemas 生成联合类型
const FinishSchema = z.object({
  action: z.literal("finish"),
  message: z.string(),
});
const allSchemas = [
  ...allActions.map((a) => a.schema as z.ZodTypeAny),
  FinishSchema,
];

export const ActionSchema = z.union(allSchemas);
export type Action = z.infer<typeof ActionSchema>;

// 解析 do() 格式字符串为对象
const parseDoString = (str: string): Record<string, unknown> | undefined => {
  // finish(message="xxx")
  if (str.startsWith("finish(")) {
    const match = str.match(/message=["']([^"']+)["']/);
    return { action: "finish", message: match?.[1] || "完成" };
  }

  // do(action="Tap", element=[x,y], ...)
  if (!str.startsWith("do(")) return undefined;

  const result: Record<string, unknown> = {};
  const kvPattern = /(\w+)=(\[[^\]]+\]|"[^"]*"|'[^']*'|[\w.-]+)/g;
  let m: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec requires assignment
  while ((m = kvPattern.exec(str))) {
    let val: unknown = m[2];
    if (val === "True") val = true;
    else if (val === "False") val = false;
    else if (val === "None") val = null;
    else if (typeof val === "string" && val.startsWith("["))
      val = JSON.parse(val);
    else if (
      typeof val === "string" &&
      (val.startsWith('"') || val.startsWith("'"))
    )
      val = val.slice(1, -1);
    else if (typeof val === "string" && !Number.isNaN(Number(val)))
      val = Number(val);
    result[m[1]] = val;
  }

  return result;
};

// 解析并验证 action（do() 格式 -> zod 验证）
export const parseAction = (
  str: string,
): { success: true; data: Action } | { success: false; error: string } => {
  const parsed = parseDoString(str);
  if (!parsed) {
    return { success: false, error: `无法解析: ${str}` };
  }

  const result = ActionSchema.safeParse(parsed);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { success: false, error: errors };
};

// 执行动作
export const executeAction = async (
  action: Record<string, unknown>,
  ctx: ActionContext,
): Promise<ActionResult> => {
  // finish 特殊处理
  if (action.action === "finish") {
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
export type { ActionContext, ActionResult };
