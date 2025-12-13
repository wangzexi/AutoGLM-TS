/**
 * Screenshot utilities for capturing Android device screen.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { randomUUID } from "crypto";

export interface Screenshot {
  base64Data: string;
  width: number;
  height: number;
  isSensitive: boolean;
}

function getAdbPrefix(deviceId?: string): string[] {
  if (deviceId) {
    return ["adb", "-s", deviceId];
  }
  return ["adb"];
}

export async function getScreenshot(
  deviceId?: string,
  timeout: number = 10
): Promise<Screenshot> {
  const tempDir = "/tmp";
  const tempPath = path.join(tempDir, `screenshot_${randomUUID()}.png`);
  const adbPrefix = getAdbPrefix(deviceId);

  try {
    // Execute screenshot command
    const screencapCmd = adbPrefix
      .concat(["shell", "screencap", "-p", "/sdcard/tmp.png"])
      .join(" ");

    const result = execSync(screencapCmd, {
      encoding: "utf-8",
      timeout: timeout * 1000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Check for screenshot failure
    if (result.includes("Status: -1") || result.includes("Failed")) {
      return createFallbackScreenshot(true);
    }

    // Pull screenshot to local temp path
    const pullCmd = adbPrefix
      .concat(["pull", "/sdcard/tmp.png", tempPath])
      .join(" ");

    execSync(pullCmd, {
      timeout: 5000,
      stdio: "ignore",
    });

    if (!fs.existsSync(tempPath)) {
      return createFallbackScreenshot(false);
    }

    // Read and encode image
    const imageBuffer = fs.readFileSync(tempPath);
    const metadata = await sharp(imageBuffer).metadata();

    const base64Data = imageBuffer.toString("base64");

    // Cleanup
    fs.unlinkSync(tempPath);

    return {
      base64Data,
      width: metadata.width || 1080,
      height: metadata.height || 2400,
      isSensitive: false,
    };
  } catch (error) {
    console.error(`Screenshot error: ${error}`);
    return createFallbackScreenshot(false);
  }
}

async function createFallbackScreenshot(isSensitive: boolean): Promise<Screenshot> {
  const defaultWidth = 1080;
  const defaultHeight = 2400;

  const blackImage = await sharp({
    create: {
      width: defaultWidth,
      height: defaultHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();

  const base64Data = blackImage.toString("base64");

  return {
    base64Data,
    width: defaultWidth,
    height: defaultHeight,
    isSensitive,
  };
}
