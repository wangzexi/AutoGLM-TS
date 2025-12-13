/**
 * Action handler for processing AI model outputs.
 */

import {
  back,
  clearText,
  detectAndSetAdbKeyboard,
  doubleTap,
  home,
  launchApp,
  longPress,
  restoreKeyboard,
  swipe,
  tap,
  typeText,
} from "../adb/index.ts";

export interface ActionResult {
  success: boolean;
  shouldFinish: boolean;
  message?: string;
  requiresConfirmation?: boolean;
}

type ConfirmationCallback = (message: string) => boolean;
type TakeoverCallback = (message: string) => void;

export class ActionHandler {
  private deviceId?: string;
  private confirmationCallback: ConfirmationCallback;
  private takeoverCallback: TakeoverCallback;

  constructor(
    deviceId?: string,
    confirmationCallback?: ConfirmationCallback,
    takeoverCallback?: TakeoverCallback
  ) {
    this.deviceId = deviceId;
    this.confirmationCallback = confirmationCallback || this.defaultConfirmation;
    this.takeoverCallback = takeoverCallback || this.defaultTakeover;
  }

  execute(
    action: Record<string, unknown>,
    screenWidth: number,
    screenHeight: number
  ): ActionResult {
    const actionType = action["_metadata"];

    if (actionType === "finish") {
      return {
        success: true,
        shouldFinish: true,
        message: action["message"] as string | undefined,
      };
    }

    if (actionType !== "do") {
      return {
        success: false,
        shouldFinish: true,
        message: `Unknown action type: ${actionType}`,
      };
    }

    const actionName = action["action"] as string | undefined;
    const handler = this.getHandler(actionName);

    if (!handler) {
      return {
        success: false,
        shouldFinish: false,
        message: `Unknown action: ${actionName}`,
      };
    }

    try {
      return handler.call(this, action, screenWidth, screenHeight);
    } catch (error) {
      return {
        success: false,
        shouldFinish: false,
        message: `Action failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private getHandler(
    actionName?: string
  ): ((action: Record<string, unknown>, width: number, height: number) => ActionResult) | null {
    const handlers: Record<
      string,
      (action: Record<string, unknown>, width: number, height: number) => ActionResult
    > = {
      Launch: this.handleLaunch.bind(this),
      Tap: this.handleTap.bind(this),
      Type: this.handleType.bind(this),
      Type_Name: this.handleType.bind(this),
      Swipe: this.handleSwipe.bind(this),
      Back: this.handleBack.bind(this),
      Home: this.handleHome.bind(this),
      "Double Tap": this.handleDoubleTap.bind(this),
      "Long Press": this.handleLongPress.bind(this),
      Wait: this.handleWait.bind(this),
      Take_over: this.handleTakeover.bind(this),
      Note: this.handleNote.bind(this),
      Call_API: this.handleCallApi.bind(this),
      Interact: this.handleInteract.bind(this),
    };

    return handlers[actionName || ""] || null;
  }

  private convertRelativeToAbsolute(
    element: number[],
    screenWidth: number,
    screenHeight: number
  ): [number, number] {
    const x = Math.floor((element[0] / 1000) * screenWidth);
    const y = Math.floor((element[1] / 1000) * screenHeight);
    return [x, y];
  }

  private handleLaunch(
    action: Record<string, unknown>,
    _width: number,
    _height: number
  ): ActionResult {
    const appName = action["app"] as string | undefined;
    if (!appName) {
      return { success: false, shouldFinish: false, message: "No app name specified" };
    }

    const success = launchApp(appName, this.deviceId);
    if (success) {
      return { success: true, shouldFinish: false };
    }
    return { success: false, shouldFinish: false, message: `App not found: ${appName}` };
  }

  private handleTap(
    action: Record<string, unknown>,
    width: number,
    height: number
  ): ActionResult {
    const element = action["element"] as number[] | undefined;
    if (!element) {
      return { success: false, shouldFinish: false, message: "No element coordinates" };
    }

    const [x, y] = this.convertRelativeToAbsolute(element, width, height);

    // Check for sensitive operation
    if ("message" in action) {
      if (!this.confirmationCallback(action["message"] as string)) {
        return {
          success: false,
          shouldFinish: true,
          message: "User cancelled sensitive operation",
        };
      }
    }

    tap(x, y, this.deviceId);
    return { success: true, shouldFinish: false };
  }

  private handleType(
    action: Record<string, unknown>,
    _width: number,
    _height: number
  ): ActionResult {
    const text = (action["text"] ?? "") as string;

    // Switch to ADB keyboard
    const originalIme = detectAndSetAdbKeyboard(this.deviceId);
    new Promise((resolve) => setTimeout(resolve, 1000));

    // Clear existing text and type new text
    clearText(this.deviceId);
    new Promise((resolve) => setTimeout(resolve, 1000));

    typeText(text, this.deviceId);
    new Promise((resolve) => setTimeout(resolve, 1000));

    // Restore original keyboard
    restoreKeyboard(originalIme, this.deviceId);
    new Promise((resolve) => setTimeout(resolve, 1000));

    return { success: true, shouldFinish: false };
  }

  private handleSwipe(
    action: Record<string, unknown>,
    width: number,
    height: number
  ): ActionResult {
    const start = action["start"] as number[] | undefined;
    const end = action["end"] as number[] | undefined;

    if (!start || !end) {
      return { success: false, shouldFinish: false, message: "Missing swipe coordinates" };
    }

    const [startX, startY] = this.convertRelativeToAbsolute(start, width, height);
    const [endX, endY] = this.convertRelativeToAbsolute(end, width, height);

    swipe(startX, startY, endX, endY, undefined, this.deviceId);
    return { success: true, shouldFinish: false };
  }

  private handleBack(
    _action: Record<string, unknown>,
    _width: number,
    _height: number
  ): ActionResult {
    back(this.deviceId);
    return { success: true, shouldFinish: false };
  }

  private handleHome(
    _action: Record<string, unknown>,
    _width: number,
    _height: number
  ): ActionResult {
    home(this.deviceId);
    return { success: true, shouldFinish: false };
  }

  private handleDoubleTap(
    action: Record<string, unknown>,
    width: number,
    height: number
  ): ActionResult {
    const element = action["element"] as number[] | undefined;
    if (!element) {
      return { success: false, shouldFinish: false, message: "No element coordinates" };
    }

    const [x, y] = this.convertRelativeToAbsolute(element, width, height);
    doubleTap(x, y, this.deviceId);
    return { success: true, shouldFinish: false };
  }

  private handleLongPress(
    action: Record<string, unknown>,
    width: number,
    height: number
  ): ActionResult {
    const element = action["element"] as number[] | undefined;
    if (!element) {
      return { success: false, shouldFinish: false, message: "No element coordinates" };
    }

    const [x, y] = this.convertRelativeToAbsolute(element, width, height);
    longPress(x, y, 3000, this.deviceId);
    return { success: true, shouldFinish: false };
  }

  private handleWait(
    action: Record<string, unknown>,
    _width: number,
    _height: number
  ): ActionResult {
    const durationStr = (action["duration"] ?? "1 seconds") as string;
    let duration = 1;

    try {
      duration = parseFloat(durationStr.replace("seconds", "").trim());
    } catch {
      duration = 1;
    }

    new Promise((resolve) => setTimeout(resolve, duration * 1000));
    return { success: true, shouldFinish: false };
  }

  private handleTakeover(
    action: Record<string, unknown>,
    _width: number,
    _height: number
  ): ActionResult {
    const message = (action["message"] ?? "User intervention required") as string;
    this.takeoverCallback(message);
    return { success: true, shouldFinish: false };
  }

  private handleNote(
    _action: Record<string, unknown>,
    _width: number,
    _height: number
  ): ActionResult {
    // This action is typically used for recording page content
    return { success: true, shouldFinish: false };
  }

  private handleCallApi(
    _action: Record<string, unknown>,
    _width: number,
    _height: number
  ): ActionResult {
    // This action is typically used for content summarization
    return { success: true, shouldFinish: false };
  }

  private handleInteract(
    _action: Record<string, unknown>,
    _width: number,
    _height: number
  ): ActionResult {
    return { success: true, shouldFinish: false, message: "User interaction required" };
  }

  private defaultConfirmation = (message: string): boolean => {
    console.log(`Sensitive operation: ${message}`);
    console.log("Auto-confirmed (no interactive confirmation available)");
    return true;
  };

  private defaultTakeover = (message: string): void => {
    console.log(`Manual operation required: ${message}`);
    console.log("Continuing automatically...");
  };
}

export function parseAction(response: string): Record<string, unknown> {
  try {
    response = response.trim();

    if (response.startsWith("do(")) {
      // Parse do(...) action
      const match = response.match(/^do\((.*)\)$/);
      if (!match) {
        throw new Error("Invalid do() format");
      }

      const argsStr = match[1];
      const action: Record<string, unknown> = { "_metadata": "do" };

      // Simple regex-based key=value parsing
      const keyValuePattern = /(\w+)=(\[[\d,\s]+\]|"[^"]*"|'[^']*'|[\w.-]+)/g;
      let keyValue;

      while ((keyValue = keyValuePattern.exec(argsStr))) {
        const key = keyValue[1];
        let value: unknown = keyValue[2];

        // Parse value
        if (value === "True") value = true;
        else if (value === "False") value = false;
        else if (value === "None") value = null;
        else if (typeof value === "string" && value.startsWith("[")) {
          value = JSON.parse(value);
        } else if (typeof value === "string" && (value.startsWith('"') || value.startsWith("'"))) {
          value = value.slice(1, -1);
        } else if (typeof value === "string" && !isNaN(Number(value))) {
          value = Number(value);
        }

        action[key] = value;
      }

      return action;
    } else if (response.startsWith("finish(")) {
      // Parse finish(...) action
      const match = response.match(/^finish\(message=(.+)\)$/);
      if (!match) {
        throw new Error("Invalid finish() format");
      }

      let message = match[1];
      // Remove quotes if present
      if (message.startsWith('"') || message.startsWith("'")) {
        message = message.slice(1, -1);
      }

      return {
        "_metadata": "finish",
        "message": message,
      };
    } else {
      throw new Error(`Failed to parse action: ${response}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to parse action: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function doAction(...args: unknown[]): Record<string, unknown> {
  const action: Record<string, unknown> = { "_metadata": "do" };
  // This is a helper for manual action creation
  return action;
}

export function finish(message?: string): Record<string, unknown> {
  return {
    "_metadata": "finish",
    "message": message,
  };
}

export { ActionHandler as default };
