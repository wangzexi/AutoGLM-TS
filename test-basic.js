/**
 * 基础功能测试脚本
 */
const { isAdbServerAvailable, listDevices, isAdbKeyboardInstalled } = require('./dist/phone-agent/adb.js');

async function test() {
  console.log('=== ADB 基础功能测试 ===\n');

  // 测试 1: ADB 服务器可用性
  console.log('测试 1: 检查 ADB 服务器...');
  const adbOk = await isAdbServerAvailable();
  console.log(`ADB 服务器: ${adbOk ? '✅ 可用' : '❌ 不可用'}\n`);

  // 测试 2: 设备列表
  console.log('测试 2: 获取设备列表...');
  const devices = await listDevices();
  console.log(`找到 ${devices.length} 台设备:`);
  devices.forEach((d) => {
    console.log(`  - ${d.deviceId} (${d.status})`);
  });
  console.log();

  // 测试 3: ADB Keyboard
  if (devices.length > 0) {
    console.log('测试 3: 检查 ADB Keyboard...');
    const hasKeyboard = await isAdbKeyboardInstalled();
    console.log(`ADB Keyboard: ${hasKeyboard ? '✅ 已安装' : '❌ 未安装'}\n`);
  }

  console.log('=== 测试完成 ===');
}

test().catch(console.error);
