/**
 * ADB utilities for Android device interaction.
 */

export { ADBConnection, ConnectionType, listDevices, quickConnect } from "./connection.ts";
export type { DeviceInfo } from "./connection.ts";
export {
  back,
  getCurrentApp,
  home,
  launchApp,
  doubleTap,
  longPress,
  swipe,
  tap,
} from "./device.ts";
export {
  clearText,
  detectAndSetAdbKeyboard,
  restoreKeyboard,
  typeText,
} from "./input.ts";
export { getScreenshot } from "./screenshot.ts";
