/**
 * Device control utilities for Android automation.
 */

import { execSync } from "child_process";
import { APP_PACKAGES } from "../config/apps.ts";

function getAdbPrefix(deviceId?: string): string[] {
  if (deviceId) {
    return ["adb", "-s", deviceId];
  }
  return ["adb"];
}

export function getCurrentApp(deviceId?: string): string {
  const adbPrefix = getAdbPrefix(deviceId);
  const cmd = adbPrefix.concat(["shell", "dumpsys", "window"]).join(" ");

  try {
    const output = execSync(cmd, { encoding: "utf-8" });

    for (const line of output.split("\n")) {
      if (line.includes("mCurrentFocus") || line.includes("mFocusedApp")) {
        for (const [appName, packageName] of Object.entries(APP_PACKAGES)) {
          if (line.includes(packageName)) {
            return appName;
          }
        }
      }
    }

    return "System Home";
  } catch {
    return "System Home";
  }
}

export function tap(
  x: number,
  y: number,
  deviceId?: string,
  delay: number = 1
): void {
  const adbPrefix = getAdbPrefix(deviceId);
  const cmd = adbPrefix
    .concat(["shell", "input", "tap", String(x), String(y)])
    .join(" ");

  try {
    execSync(cmd, { stdio: "ignore" });
    if (delay > 0) {
      new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch {
    // Silently ignore errors
  }
}

export function doubleTap(
  x: number,
  y: number,
  deviceId?: string,
  delay: number = 1
): void {
  const adbPrefix = getAdbPrefix(deviceId);
  const cmd = adbPrefix
    .concat(["shell", "input", "tap", String(x), String(y)])
    .join(" ");

  try {
    execSync(cmd, { stdio: "ignore" });
    new Promise((resolve) => setTimeout(resolve, 100));
    execSync(cmd, { stdio: "ignore" });
    if (delay > 0) {
      new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch {
    // Silently ignore errors
  }
}

export function longPress(
  x: number,
  y: number,
  durationMs: number = 3000,
  deviceId?: string,
  delay: number = 1
): void {
  const adbPrefix = getAdbPrefix(deviceId);
  const cmd = adbPrefix
    .concat([
      "shell",
      "input",
      "swipe",
      String(x),
      String(y),
      String(x),
      String(y),
      String(durationMs),
    ])
    .join(" ");

  try {
    execSync(cmd, { stdio: "ignore" });
    if (delay > 0) {
      new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch {
    // Silently ignore errors
  }
}

export function swipe(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  durationMs?: number,
  deviceId?: string,
  delay: number = 1
): void {
  const adbPrefix = getAdbPrefix(deviceId);

  let duration = durationMs;
  if (duration === undefined) {
    const distSq = Math.pow(startX - endX, 2) + Math.pow(startY - endY, 2);
    duration = Math.floor(distSq / 1000);
    duration = Math.max(1000, Math.min(duration, 2000));
  }

  const cmd = adbPrefix
    .concat([
      "shell",
      "input",
      "swipe",
      String(startX),
      String(startY),
      String(endX),
      String(endY),
      String(duration),
    ])
    .join(" ");

  try {
    execSync(cmd, { stdio: "ignore" });
    if (delay > 0) {
      new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch {
    // Silently ignore errors
  }
}

export function back(deviceId?: string, delay: number = 1): void {
  const adbPrefix = getAdbPrefix(deviceId);
  const cmd = adbPrefix
    .concat(["shell", "input", "keyevent", "4"])
    .join(" ");

  try {
    execSync(cmd, { stdio: "ignore" });
    if (delay > 0) {
      new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch {
    // Silently ignore errors
  }
}

export function home(deviceId?: string, delay: number = 1): void {
  const adbPrefix = getAdbPrefix(deviceId);
  const cmd = adbPrefix
    .concat(["shell", "input", "keyevent", "KEYCODE_HOME"])
    .join(" ");

  try {
    execSync(cmd, { stdio: "ignore" });
    if (delay > 0) {
      new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch {
    // Silently ignore errors
  }
}

export function launchApp(
  appName: string,
  deviceId?: string,
  delay: number = 1
): boolean {
  if (!(appName in APP_PACKAGES)) {
    return false;
  }

  const adbPrefix = getAdbPrefix(deviceId);
  const packageName =
    APP_PACKAGES[appName as keyof typeof APP_PACKAGES];

  const cmd = adbPrefix
    .concat([
      "shell",
      "monkey",
      "-p",
      packageName,
      "-c",
      "android.intent.category.LAUNCHER",
      "1",
    ])
    .join(" ");

  try {
    execSync(cmd, { stdio: "ignore" });
    if (delay > 0) {
      new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
    return true;
  } catch {
    return false;
  }
}
