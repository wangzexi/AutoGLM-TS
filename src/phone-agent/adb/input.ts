/**
 * Input utilities for Android device text input.
 */

import { execSync } from "child_process";

function getAdbPrefix(deviceId?: string): string[] {
  if (deviceId) {
    return ["adb", "-s", deviceId];
  }
  return ["adb"];
}

export function typeText(text: string, deviceId?: string): void {
  const adbPrefix = getAdbPrefix(deviceId);
  const encodedText = Buffer.from(text, "utf-8").toString("base64");

  const cmd = adbPrefix
    .concat([
      "shell",
      "am",
      "broadcast",
      "-a",
      "ADB_INPUT_B64",
      "--es",
      "msg",
      encodedText,
    ])
    .join(" ");

  try {
    execSync(cmd, { stdio: "ignore" });
  } catch {
    // Silently ignore errors
  }
}

export function clearText(deviceId?: string): void {
  const adbPrefix = getAdbPrefix(deviceId);
  const cmd = adbPrefix
    .concat(["shell", "am", "broadcast", "-a", "ADB_CLEAR_TEXT"])
    .join(" ");

  try {
    execSync(cmd, { stdio: "ignore" });
  } catch {
    // Silently ignore errors
  }
}

export function detectAndSetAdbKeyboard(deviceId?: string): string {
  const adbPrefix = getAdbPrefix(deviceId);

  // Get current IME
  const getImeCmd = adbPrefix
    .concat(["shell", "settings", "get", "secure", "default_input_method"])
    .join(" ");

  let currentIme = "";
  try {
    currentIme = execSync(getImeCmd, { encoding: "utf-8" }).trim();
  } catch {
    currentIme = "";
  }

  // Switch to ADB Keyboard if not already set
  if (!currentIme.includes("com.android.adbkeyboard/.AdbIME")) {
    const setImeCmd = adbPrefix
      .concat(["shell", "ime", "set", "com.android.adbkeyboard/.AdbIME"])
      .join(" ");

    try {
      execSync(setImeCmd, { stdio: "ignore" });
    } catch {
      // Silently ignore errors
    }
  }

  // Warm up the keyboard
  typeText("", deviceId);

  return currentIme;
}

export function restoreKeyboard(ime: string, deviceId?: string): void {
  const adbPrefix = getAdbPrefix(deviceId);
  const cmd = adbPrefix
    .concat(["shell", "ime", "set", ime])
    .join(" ");

  try {
    execSync(cmd, { stdio: "ignore" });
  } catch {
    // Silently ignore errors
  }
}
