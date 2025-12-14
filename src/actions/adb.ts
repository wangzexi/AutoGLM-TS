/**
 * ADB 操作：设备交互
 */

import { AdbServerClient, Adb } from "@yume-chan/adb";
import { AdbServerNodeTcpConnector } from "@yume-chan/adb-server-node-tcp";
import sharp from "sharp";
import { APP_PACKAGES } from "../config.ts";

// 单例
let client: AdbServerClient | undefined;
const adbCache = new Map<string, Adb>();

function getClient(): AdbServerClient {
	if (!client) {
		client = new AdbServerClient(
			new AdbServerNodeTcpConnector({ host: "localhost", port: 5037 })
		);
	}
	return client;
}

async function getAdb(deviceId?: string): Promise<Adb> {
	const key = deviceId || "default";
	if (adbCache.has(key)) return adbCache.get(key)!;

	const devices = await getClient().getDevices();
	const target = deviceId
		? devices.find((d) => d.serial === deviceId)
		: devices[0];

	if (!target) throw new Error("设备未找到");

	const adb = await getClient().createAdb({ serial: target.serial });
	adbCache.set(key, adb);
	return adb;
}

async function shell(cmd: string, deviceId?: string): Promise<string> {
	const adb = await getAdb(deviceId);
	const socket = await adb.createSocket(`shell:${cmd}`);
	const chunks: Uint8Array[] = [];
	for await (const chunk of socket.readable) chunks.push(chunk);
	socket.close();
	return Buffer.concat(chunks).toString("utf-8");
}

// 设备操作
export async function listDevices() {
	const devices = await getClient().getDevices();
	return devices.map((d) => ({
		deviceId: d.serial,
		status: d.state,
		model: d.model,
	}));
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

// 输入操作
export async function tap(x: number, y: number, deviceId?: string) {
	await shell(`input tap ${x} ${y}`, deviceId);
}

export async function swipe(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	duration = 300,
	deviceId?: string
) {
	await shell(`input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`, deviceId);
}

export async function longPress(x: number, y: number, deviceId?: string) {
	await shell(`input swipe ${x} ${y} ${x} ${y} 2000`, deviceId);
}

export async function back(deviceId?: string) {
	await shell("input keyevent 4", deviceId);
}

export async function home(deviceId?: string) {
	await shell("input keyevent 3", deviceId);
}

export async function typeText(text: string, deviceId?: string) {
	// 使用 ADB Keyboard broadcast
	const encoded = encodeURIComponent(text);
	await shell(
		`am broadcast -a ADB_INPUT_TEXT --es msg '${encoded}'`,
		deviceId
	);
}

export async function clearText(deviceId?: string) {
	await shell("input keyevent 28", deviceId); // KEYCODE_CLEAR
	await shell("input keyevent KEYCODE_CTRL_LEFT KEYCODE_A", deviceId);
	await shell("input keyevent 67", deviceId); // DEL
}

export async function launchApp(
	appName: string,
	deviceId?: string
): Promise<boolean> {
	const pkg = APP_PACKAGES[appName];
	if (!pkg) return false;
	await shell(`monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`, deviceId);
	return true;
}

// 截图
export type Screenshot = {
	base64: string;
	width: number;
	height: number;
};

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
	} catch (e) {
		// 返回黑屏
		const black = await sharp({
			create: { width: 1080, height: 2400, channels: 3, background: "#000" },
		})
			.png()
			.toBuffer();
		return { base64: black.toString("base64"), width: 1080, height: 2400 };
	}
}
