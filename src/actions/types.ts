/**
 * 动作类型定义
 */

import { z } from "zod";

// 动作执行上下文
export type ActionContext = {
	deviceId?: string;
	screenWidth: number;
	screenHeight: number;
};

// 动作执行结果
export type ActionResult = {
	success: boolean;
	finished?: boolean;
	message?: string;
};

// 坐标：[0-999, 0-999] 的相对坐标
export const Coordinate = z.tuple([z.number().min(0).max(999), z.number().min(0).max(999)]);

// 动作定义（泛型，保持类型约束）
export type ActionDef<T extends z.ZodObject<z.ZodRawShape>> = {
	name: string;
	description: string;
	schema: T;
	handler: (params: z.infer<T>, ctx: ActionContext) => Promise<ActionResult>;
};

// 坐标转换：相对坐标(0-999) -> 绝对坐标
export const toAbsolute = (rel: number[], w: number, h: number): [number, number] => [
	Math.floor((rel[0] / 1000) * w),
	Math.floor((rel[1] / 1000) * h),
];

// 延时
export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 从 schema 生成 do() 格式示例
export const schemaToUsage = (schema: z.ZodObject<z.ZodRawShape>): string => {
	const shape = schema.shape;
	const parts: string[] = [];

	for (const [key, value] of Object.entries(shape)) {
		const example = zodToExample(value as z.ZodTypeAny);
		if (key === "action") {
			parts.unshift(`action="${example}"`);
		} else {
			// 数组用 [] 表示，字符串用 "xxx" 表示
			const formatted = Array.isArray(example) ? JSON.stringify(example) : `"${example}"`;
			parts.push(`${key}=${formatted}`);
		}
	}

	return `do(${parts.join(", ")})`;
};

// zod 类型转示例值（zod v4 版本）
const zodToExample = (schema: z.ZodTypeAny): unknown => {
	// zod v4 使用 _zod.def.type 而不是 typeName
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const s = schema as any;
	const type = s._zod?.def?.type || s.type;

	switch (type) {
		case "optional":
			return zodToExample(s.unwrap());
		case "literal":
			// zod v4: s.value 或 s._zod.def.values[0]
			return s.value ?? s._zod?.def?.values?.[0];
		case "string":
			return "...";
		case "number":
			return 0;
		case "tuple":
			// zod v4: s._zod.def.items
			return s._zod?.def?.items?.map((item: z.ZodTypeAny) => zodToExample(item)) ?? [];
		default:
			return "?";
	}
};
