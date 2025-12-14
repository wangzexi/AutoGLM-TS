/**
 * 导航操作：Back, Home, Wait
 */

import { z } from "zod";
import * as adb from "../adb.ts";
import { type ActionDef, delay } from "./types.ts";

const BackSchema = z.object({ action: z.literal("Back") });

export const back: ActionDef<typeof BackSchema> = {
  name: "Back",
  description:
    "导航返回到上一个屏幕或关闭当前对话框。相当于按下 Android 的返回按钮。使用此操作可以从更深的屏幕返回、关闭弹出窗口或退出当前上下文。此操作完成后，您将自动收到结果状态的截图。",
  schema: BackSchema,
  handler: async (_params, ctx) => {
    await adb.back(ctx.deviceId);
    await delay(1000);
    return { success: true };
  },
};

const HomeSchema = z.object({ action: z.literal("Home") });

export const home: ActionDef<typeof HomeSchema> = {
  name: "Home",
  description:
    "Home是回到系统桌面的操作，相当于按下 Android 主屏幕按钮。使用此操作可退出当前应用并返回启动器，或从已知状态启动新任务。此操作完成后，您将自动收到结果状态的截图。",
  schema: HomeSchema,
  handler: async (_params, ctx) => {
    await adb.home(ctx.deviceId);
    await delay(1000);
    return { success: true };
  },
};

const WaitSchema = z.object({
  action: z.literal("Wait"),
  duration: z.number().min(1).max(30),
});

export const wait: ActionDef<typeof WaitSchema> = {
  name: "Wait",
  description: "等待页面加载，duration为需要等待多少秒。",
  schema: WaitSchema,
  handler: async (params, _ctx) => {
    await delay(params.duration * 1000);
    return { success: true };
  },
};
