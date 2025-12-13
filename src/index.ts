#!/usr/bin/env node
/**
 * Phone Agent CLI - AI-powered phone automation.
 *
 * Usage:
 *     node src/index.ts [OPTIONS]
 *
 * Environment Variables:
 *     PHONE_AGENT_BASE_URL: Model API base URL (default: http://localhost:8000/v1)
 *     PHONE_AGENT_MODEL: Model name (default: autoglm-phone-9b)
 *     PHONE_AGENT_API_KEY: API key for model authentication (default: EMPTY)
 *     PHONE_AGENT_MAX_STEPS: Maximum steps per task (default: 100)
 *     PHONE_AGENT_DEVICE_ID: ADB device ID for multi-device setups
 */

import * as readline from "readline";
import { execSync } from "child_process";
import { ADBConnection, listDevices } from "./phone-agent/adb/connection.ts";
import { PhoneAgent, type AgentConfig } from "./phone-agent/agent.ts";
import { type ModelConfig } from "./phone-agent/model/client.ts";
import { listSupportedApps } from "./phone-agent/config/apps.ts";
import OpenAI from "openai";

function checkSystemRequirements(): boolean {
  console.log("🔍 Checking system requirements...");
  console.log("-".repeat(50));

  let allPassed = true;

  // Check 1: ADB installed
  console.log("1. Checking ADB installation...");
  try {
    const result = execSync("adb version", { encoding: "utf-8", timeout: 10000 });
    const versionLine = result.trim().split("\n")[0];
    console.log(`✅ OK (${versionLine})`);
  } catch {
    console.log("❌ FAILED");
    console.log("   Error: ADB is not installed or not in PATH.");
    console.log("   Solution: Install Android SDK Platform Tools:");
    console.log("     - macOS: brew install android-platform-tools");
    console.log("     - Linux: sudo apt install android-tools-adb");
    console.log(
      "     - Windows: Download from https://developer.android.com/studio/releases/platform-tools"
    );
    allPassed = false;
  }

  if (!allPassed) {
    console.log("-".repeat(50));
    console.log("❌ System check failed. Please fix the issues above.");
    return false;
  }

  // Check 2: Device connected
  console.log("2. Checking connected devices...");
  try {
    const output = execSync("adb devices", { encoding: "utf-8", timeout: 10000 });
    const lines = output.trim().split("\n");
    const devices = lines
      .slice(1)
      .filter((line) => line.trim() && line.includes("\tdevice"));

    if (!devices.length) {
      console.log("❌ FAILED");
      console.log("   Error: No devices connected.");
      console.log("   Solution:");
      console.log("     1. Enable USB debugging on your Android device");
      console.log("     2. Connect via USB and authorize the connection");
      console.log("     3. Or connect remotely: node src/index.ts --connect <ip>:<port>");
      allPassed = false;
    } else {
      const deviceIds = devices.map((d) => d.split("\t")[0]);
      console.log(`✅ OK (${devices.length} device(s): ${deviceIds.join(", ")})`);
    }
  } catch {
    console.log("❌ FAILED");
    console.log("   Error: ADB command timed out.");
    allPassed = false;
  }

  if (!allPassed) {
    console.log("-".repeat(50));
    console.log("❌ System check failed. Please fix the issues above.");
    return false;
  }

  // Check 3: ADB Keyboard installed
  console.log("3. Checking ADB Keyboard...");
  try {
    const result = execSync("adb shell ime list -s", {
      encoding: "utf-8",
      timeout: 10000,
    });
    const imeList = result.trim();

    if (imeList.includes("com.android.adbkeyboard/.AdbIME")) {
      console.log("✅ OK");
    } else {
      console.log("❌ FAILED");
      console.log("   Error: ADB Keyboard is not installed on the device.");
      console.log("   Solution:");
      console.log("     1. Download ADB Keyboard APK from:");
      console.log(
        "        https://github.com/senzhk/ADBKeyBoard/blob/master/ADBKeyboard.apk"
      );
      console.log("     2. Install it on your device: adb install ADBKeyboard.apk");
      console.log(
        "     3. Enable it in Settings > System > Languages & Input > Virtual Keyboard"
      );
      allPassed = false;
    }
  } catch {
    console.log("❌ FAILED");
    console.log("   Error: ADB command timed out.");
    allPassed = false;
  }

  console.log("-".repeat(50));

  if (allPassed) {
    console.log("✅ All system checks passed!\n");
  } else {
    console.log("❌ System check failed. Please fix the issues above.");
  }

  return allPassed;
}

function checkModelApi(baseUrl: string, modelName: string, apiKey: string = "EMPTY"): boolean {
  console.log("🔍 Checking model API...");
  console.log("-".repeat(50));

  // Check 1: Network connectivity using chat API
  console.log(`1. Checking API connectivity (${baseUrl})...`);
  try {
    const client = new OpenAI({ baseURL: baseUrl, apiKey, timeout: 30000 });

    client.chat.completions
      .create({
        model: modelName,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
        temperature: 0,
      })
      .then(() => {
        console.log("✅ OK");
        console.log("-".repeat(50));
        console.log("✅ Model API checks passed!\n");
      })
      .catch((error) => {
        console.log("❌ FAILED");
        console.log(`   Error: ${error.message}`);
        console.log("-".repeat(50));
        console.log("❌ Model API check failed. Please fix the issues above.");
      });

    return true;
  } catch (error) {
    console.log("❌ FAILED");
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   Error: ${errorMsg}`);
    console.log("-".repeat(50));
    console.log("❌ Model API check failed. Please fix the issues above.");
    return false;
  }
}

interface Args {
  baseUrl?: string;
  model?: string;
  apikey?: string;
  maxSteps?: number;
  deviceId?: string;
  connect?: string;
  disconnect?: string;
  listDevices?: boolean;
  enableTcpip?: number;
  quiet?: boolean;
  listApps?: boolean;
  task?: string;
}

function parseArgs(): Args {
  const args: Args = {};
  const env = process.env;

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const nextArg = process.argv[i + 1];

    switch (arg) {
      case "--base-url":
        args.baseUrl = nextArg;
        i++;
        break;
      case "--model":
        args.model = nextArg;
        i++;
        break;
      case "--apikey":
        args.apikey = nextArg;
        i++;
        break;
      case "--max-steps":
        args.maxSteps = parseInt(nextArg);
        i++;
        break;
      case "--device-id":
      case "-d":
        args.deviceId = nextArg;
        i++;
        break;
      case "--connect":
      case "-c":
        args.connect = nextArg;
        i++;
        break;
      case "--disconnect":
        args.disconnect = nextArg || "all";
        i++;
        break;
      case "--list-devices":
        args.listDevices = true;
        break;
      case "--enable-tcpip":
        args.enableTcpip = parseInt(nextArg) || 5555;
        i++;
        break;
      case "--quiet":
      case "-q":
        args.quiet = true;
        break;
      case "--list-apps":
        args.listApps = true;
        break;
      default:
        if (!arg.startsWith("-")) {
          args.task = arg;
        }
        break;
    }
  }

  args.baseUrl = args.baseUrl || env.PHONE_AGENT_BASE_URL || "http://localhost:8000/v1";
  args.model = args.model || env.PHONE_AGENT_MODEL || "autoglm-phone-9b";
  args.apikey = args.apikey || env.PHONE_AGENT_API_KEY || "EMPTY";
  args.maxSteps = args.maxSteps || parseInt(env.PHONE_AGENT_MAX_STEPS || "100");
  args.deviceId = args.deviceId || env.PHONE_AGENT_DEVICE_ID;

  return args;
}

function handleDeviceCommands(args: Args): boolean {
  const conn = new ADBConnection();

  if (args.listDevices) {
    const devices = listDevices();
    if (!devices.length) {
      console.log("No devices connected.");
    } else {
      console.log("Connected devices:");
      console.log("-".repeat(60));
      for (const device of devices) {
        const statusIcon = device.status === "device" ? "✓" : "✗";
        const connType = device.connectionType;
        const modelInfo = device.model ? ` (${device.model})` : "";
        console.log(
          `  ${statusIcon} ${device.deviceId.padEnd(30)} [${connType}]${modelInfo}`
        );
      }
    }
    return true;
  }

  if (args.connect) {
    console.log(`Connecting to ${args.connect}...`);
    const [success, message] = conn.connect(args.connect);
    console.log(`${success ? "✓" : "✗"} ${message}`);
    if (success) {
      args.deviceId = args.connect;
    }
    return !success;
  }

  if (args.disconnect) {
    if (args.disconnect === "all") {
      console.log("Disconnecting all remote devices...");
    } else {
      console.log(`Disconnecting from ${args.disconnect}...`);
    }
    const [success, message] = conn.disconnect(args.disconnect === "all" ? undefined : args.disconnect);
    console.log(`${success ? "✓" : "✗"} ${message}`);
    return true;
  }

  if (args.enableTcpip !== undefined) {
    const port = args.enableTcpip;
    console.log(`Enabling TCP/IP debugging on port ${port}...`);
    const [success, message] = conn.enableTcpip(port, args.deviceId);
    console.log(`${success ? "✓" : "✗"} ${message}`);

    if (success) {
      const ip = conn.getDeviceIp(args.deviceId);
      if (ip) {
        console.log(`\nYou can now connect remotely using:`);
        console.log(`  node src/index.ts --connect ${ip}:${port}`);
        console.log(`\nOr via ADB directly:`);
        console.log(`  adb connect ${ip}:${port}`);
      } else {
        console.log("\nCould not determine device IP. Check device WiFi settings.");
      }
    }
    return true;
  }

  return false;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.listApps) {
    console.log("Supported apps:");
    for (const app of sorted(listSupportedApps())) {
      console.log(`  - ${app}`);
    }
    return;
  }

  if (handleDeviceCommands(args)) {
    return;
  }

  if (!checkSystemRequirements()) {
    process.exit(1);
  }

  const modelConfig: ModelConfig = {
    baseUrl: args.baseUrl,
    modelName: args.model,
    apiKey: args.apikey,
  };

  const agentConfig: AgentConfig = {
    maxSteps: args.maxSteps,
    deviceId: args.deviceId,
    verbose: !args.quiet,
  };

  const agent = new PhoneAgent(modelConfig, agentConfig);

  console.log("=".repeat(50));
  console.log("Phone Agent - AI-powered phone automation");
  console.log("=".repeat(50));
  console.log(`Model: ${modelConfig.modelName}`);
  console.log(`Base URL: ${modelConfig.baseUrl}`);
  console.log(`Max Steps: ${agentConfig.maxSteps}`);

  const devices = listDevices();
  if (agentConfig.deviceId) {
    console.log(`Device: ${agentConfig.deviceId}`);
  } else if (devices.length > 0) {
    console.log(`Device: ${devices[0].deviceId} (auto-detected)`);
  }

  console.log("=".repeat(50));

  if (args.task) {
    console.log(`\nTask: ${args.task}\n`);
    const result = await agent.run(args.task);
    console.log(`\nResult: ${result}`);
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\nEntering interactive mode. Type 'quit' to exit.\n");

    while (true) {
      const task = await new Promise<string>((resolve) => {
        rl.question("Enter your task: ", resolve);
      });

      if (["quit", "exit", "q"].includes(task.toLowerCase())) {
        console.log("Goodbye!");
        rl.close();
        break;
      }

      if (!task.trim()) {
        continue;
      }

      console.log();
      try {
        const result = await agent.run(task);
        console.log(`\nResult: ${result}\n`);
      } catch (error) {
        console.log(`\nError: ${error}\n`);
      }

      agent.reset();
    }
  }
}

function sorted<T>(arr: T[]): T[] {
  return [...arr].sort();
}

main().catch((error) => {
  console.error(`Error: ${error}`);
  process.exit(1);
});
