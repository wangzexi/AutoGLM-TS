/**
 * Internationalization configuration (Chinese only).
 */

const MESSAGES = {
  task_completed: "任务完成",
  done: "已完成",
  checking_system: "🔍 正在检查系统要求...",
  checking_api: "🔍 正在检查模型API...",
  all_checks_passed: "✅ 所有系统检查通过！",
  api_check_passed: "✅ 模型API检查通过！",
  checking_adb: "1. 检查ADB安装...",
  checking_devices: "2. 检查连接的设备...",
  checking_keyboard: "3. 检查ADB键盘...",
  adb_ok: "✅ OK",
  adb_failed: "❌ FAILED",
  devices_ok: "✅ OK",
  no_devices: "❌ 没有连接设备",
  keyboard_ok: "✅ OK",
  keyboard_failed: "❌ FAILED",
};

export function getMessage(key: string): string {
  return MESSAGES[key as keyof typeof MESSAGES] || key;
}
