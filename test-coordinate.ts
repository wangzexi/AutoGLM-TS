/**
 * 测试坐标转换逻辑
 */

import { toAbsolute } from "./src/actions/types.ts";

console.log("🧪 测试坐标转换\n");

// 测试用例
const testCases = [
  { rel: [0, 0], screen: [1080, 1920], expected: [0, 0], name: "左上角" },
  { rel: [500, 500], screen: [1080, 1920], expected: [540, 960], name: "中心点" },
  { rel: [1000, 1000], screen: [1080, 1920], expected: [1080, 1920], name: "右下角" },
  { rel: [250, 250], screen: [720, 1280], expected: [180, 320], name: "小屏幕" },
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = toAbsolute(test.rel, test.screen[0], test.screen[1]);
  const isCorrect =
    result[0] === test.expected[0] && result[1] === test.expected[1];

  if (isCorrect) {
    console.log(`✅ ${test.name}`);
    console.log(`   输入: [${test.rel}] -> 屏幕 ${test.screen[0]}x${test.screen[1]}`);
    console.log(`   输出: [${result}]`);
    console.log(`   期望: [${test.expected}]`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   输入: [${test.rel}] -> 屏幕 ${test.screen[0]}x${test.screen[1]}`);
    console.log(`   输出: [${result}]`);
    console.log(`   期望: [${test.expected}]`);
    failed++;
  }
  console.log();
}

console.log("=".repeat(50));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);

if (failed === 0) {
  console.log("🎉 所有测试通过!");
} else {
  console.log("⚠️  有测试失败");
  process.exit(1);
}
