/**
 * ADB 操作
 */

import { type Adb, AdbServerClient } from "@yume-chan/adb";
import { AdbServerNodeTcpConnector } from "@yume-chan/adb-server-node-tcp";
import sharp from "sharp";
import { APP_PACKAGES } from "./config.ts";

// 直接导出实例（模块本身就是单例）
export const client = new AdbServerClient(
  new AdbServerNodeTcpConnector({ host: "localhost", port: 5037 }),
);

// Adb 实例缓存（按设备）
const adbCache = new Map<string, Adb>();

async function getAdb(deviceId?: string): Promise<Adb> {
  const key = deviceId || "default";
  const cached = adbCache.get(key);
  if (cached) return cached;

  const devices = await client.getDevices();
  const target = deviceId
    ? devices.find((d) => d.serial === deviceId)
    : devices[0];
  if (!target) throw new Error("设备未找到");

  const adb = await client.createAdb({ serial: target.serial });
  adbCache.set(key, adb);
  return adb;
}

// 执行 shell 命令（@yume-chan/adb 没有原生 input API，只能用 shell）
async function shell(cmd: string, deviceId?: string): Promise<string> {
  const adb = await getAdb(deviceId);
  const socket = await adb.createSocket(`shell:${cmd}`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of socket.readable) chunks.push(chunk);
  socket.close();
  return Buffer.concat(chunks).toString("utf-8");
}

// ========== 设备 ==========

export async function listDevices() {
  const devices = await client.getDevices();
  return Promise.all(
    devices.map(async (d) => {
      let brand = "";
      let marketName = "";
      let androidVersion = "";
      try {
        const adb = await client.createAdb({ serial: d.serial });
        const output = await shell(
          "getprop ro.product.brand && getprop ro.product.marketname && getprop ro.build.version.release",
          d.serial,
        );
        const lines = output.trim().split("\n");
        brand = lines[0]?.trim() || "";
        marketName = lines[1]?.trim() || "";
        androidVersion = lines[2]?.trim() || "";
      } catch {}
      return {
        deviceId: d.serial,
        status: d.state,
        model: d.model,
        brand,
        marketName,
        androidVersion,
      };
    }),
  );
}

export async function getCurrentApp(deviceId?: string): Promise<string> {
  try {
    const output = await shell("dumpsys window | grep mCurrentFocus", deviceId);
    for (const [name, pkg] of Object.entries(APP_PACKAGES)) {
      if (output.includes(pkg)) return name;
    }
  } catch {}
  return "System";
}

// ========== 输入 ==========

export const tap = (x: number, y: number, deviceId?: string) =>
  shell(`input tap ${x} ${y}`, deviceId);

export const swipe = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  duration = 300,
  deviceId?: string,
) => shell(`input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`, deviceId);

export const longPress = (x: number, y: number, deviceId?: string) =>
  shell(`input swipe ${x} ${y} ${x} ${y} 2000`, deviceId);

export const back = (deviceId?: string) => shell("input keyevent 4", deviceId);
export const home = (deviceId?: string) => shell("input keyevent 3", deviceId);
export const recent = (deviceId?: string) =>
  shell("input keyevent 187", deviceId);

export async function typeText(text: string, deviceId?: string) {
  const encoded = Buffer.from(text, "utf8").toString("base64");
  await shell(`am broadcast -a ADB_INPUT_B64 --es msg '${encoded}'`, deviceId);
}

export async function clearText(deviceId?: string) {
  await shell("input keyevent 28", deviceId);
  await shell("input keyevent KEYCODE_CTRL_LEFT KEYCODE_A", deviceId);
  await shell("input keyevent 67", deviceId);
}

export async function launchApp(
  appName: string,
  deviceId?: string,
): Promise<boolean> {
  const pkg = APP_PACKAGES[appName];
  if (!pkg) return false;
  await shell(
    `monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`,
    deviceId,
  );
  return true;
}

// ========== 截图 ==========

export type Screenshot = { base64: string; width: number; height: number };

export async function getScreenshot(deviceId?: string): Promise<Screenshot> {
  try {
    const adb = await getAdb(deviceId);
    const socket = await adb.createSocket("shell:screencap -p");
    const chunks: Uint8Array[] = [];
    for await (const chunk of socket.readable) chunks.push(chunk);
    socket.close();

    const buffer = Buffer.concat(chunks);
    const meta = await sharp(buffer).metadata();
    return {
      base64: buffer.toString("base64"),
      width: meta.width || 1080,
      height: meta.height || 2400,
    };
  } catch {
    const black = await sharp({
      create: { width: 1080, height: 2400, channels: 3, background: "#000" },
    })
      .png()
      .toBuffer();
    return { base64: black.toString("base64"), width: 1080, height: 2400 };
  }
}
