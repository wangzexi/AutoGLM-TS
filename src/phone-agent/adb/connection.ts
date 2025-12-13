/**
 * ADB connection management for local and remote devices.
 */

import { execSync } from "child_process";

export const ConnectionType = {
  USB: "usb",
  WIFI: "wifi",
  REMOTE: "remote",
} as const;

export type ConnectionTypeValue = (typeof ConnectionType)[keyof typeof ConnectionType];

export interface DeviceInfo {
  deviceId: string;
  status: string;
  connectionType: ConnectionTypeValue;
  model?: string;
  androidVersion?: string;
}

export class ADBConnection {
  private adbPath: string;

  constructor(adbPath: string = "adb") {
    this.adbPath = adbPath;
  }

  connect(address: string, timeout: number = 10): [boolean, string] {
    // Validate address format
    if (!address.includes(":")) {
      address = `${address}:5555`;
    }

    try {
      const cmd = `${this.adbPath} connect ${address}`;
      const output = execSync(cmd, { encoding: "utf-8", timeout: timeout * 1000 });

      if (output.toLowerCase().includes("connected")) {
        return [true, `Connected to ${address}`];
      } else if (output.toLowerCase().includes("already connected")) {
        return [true, `Already connected to ${address}`];
      } else {
        return [false, output.trim()];
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if ("killed" in error && error.killed) {
          return [false, `Connection timeout after ${timeout}s`];
        }
        return [false, `Connection error: ${error.message}`];
      }
      return [false, `Connection error: ${error}`];
    }
  }

  disconnect(address?: string): [boolean, string] {
    try {
      let cmd = `${this.adbPath} disconnect`;
      if (address) {
        cmd += ` ${address}`;
      }

      const output = execSync(cmd, { encoding: "utf-8", timeout: 5000 });
      return [true, output.trim() || "Disconnected"];
    } catch (error: unknown) {
      if (error instanceof Error) {
        return [false, `Disconnect error: ${error.message}`];
      }
      return [false, `Disconnect error: ${error}`];
    }
  }

  listDevices(): DeviceInfo[] {
    try {
      const output = execSync(`${this.adbPath} devices -l`, {
        encoding: "utf-8",
        timeout: 5000,
      });

      const devices: DeviceInfo[] = [];
      const lines = output.trim().split("\n").slice(1); // Skip header

      for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const deviceId = parts[0];
          const status = parts[1];

          let connType = ConnectionType.USB;
          if (deviceId.includes(":")) {
            connType = ConnectionType.REMOTE;
          }

          let model: string | undefined;
          for (const part of parts.slice(2)) {
            if (part.startsWith("model:")) {
              model = part.split(":", 2)[1];
              break;
            }
          }

          devices.push({
            deviceId,
            status,
            connectionType: connType,
            model,
          });
        }
      }

      return devices;
    } catch (error) {
      console.error(`Error listing devices: ${error}`);
      return [];
    }
  }

  getDeviceInfo(deviceId?: string): DeviceInfo | undefined {
    const devices = this.listDevices();

    if (!devices.length) {
      return undefined;
    }

    if (!deviceId) {
      return devices[0];
    }

    return devices.find((d) => d.deviceId === deviceId);
  }

  isConnected(deviceId?: string): boolean {
    const devices = this.listDevices();

    if (!devices.length) {
      return false;
    }

    if (!deviceId) {
      return devices.some((d) => d.status === "device");
    }

    return devices.some((d) => d.deviceId === deviceId && d.status === "device");
  }

  enableTcpip(port: number = 5555, deviceId?: string): [boolean, string] {
    try {
      let cmd = this.adbPath;
      if (deviceId) {
        cmd += ` -s ${deviceId}`;
      }
      cmd += ` tcpip ${port}`;

      const output = execSync(cmd, { encoding: "utf-8", timeout: 10000 });

      if (output.toLowerCase().includes("restarting")) {
        // Wait for ADB to restart
        new Promise((resolve) => setTimeout(resolve, 2000));
        return [true, `TCP/IP mode enabled on port ${port}`];
      } else {
        return [true, `TCP/IP mode enabled on port ${port}`];
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return [false, `Error enabling TCP/IP: ${error.message}`];
      }
      return [false, `Error enabling TCP/IP: ${error}`];
    }
  }

  getDeviceIp(deviceId?: string): string | undefined {
    try {
      let cmd = this.adbPath;
      if (deviceId) {
        cmd += ` -s ${deviceId}`;
      }
      cmd += " shell ip route";

      const output = execSync(cmd, { encoding: "utf-8", timeout: 5000 });

      for (const line of output.split("\n")) {
        if (line.includes("src")) {
          const parts = line.split(/\s+/);
          for (let i = 0; i < parts.length; i++) {
            if (parts[i] === "src" && i + 1 < parts.length) {
              return parts[i + 1];
            }
          }
        }
      }

      // Alternative: try wlan0 interface
      let cmd2 = this.adbPath;
      if (deviceId) {
        cmd2 += ` -s ${deviceId}`;
      }
      cmd2 += " shell ip addr show wlan0";

      const output2 = execSync(cmd2, { encoding: "utf-8", timeout: 5000 });

      for (const line of output2.split("\n")) {
        if (line.includes("inet ")) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            return parts[1].split("/")[0];
          }
        }
      }

      return undefined;
    } catch (error) {
      console.error(`Error getting device IP: ${error}`);
      return undefined;
    }
  }

  restartServer(): [boolean, string] {
    try {
      execSync(`${this.adbPath} kill-server`, {
        timeout: 5000,
        stdio: "ignore",
      });

      new Promise((resolve) => setTimeout(resolve, 1000));

      execSync(`${this.adbPath} start-server`, {
        timeout: 5000,
        stdio: "ignore",
      });

      return [true, "ADB server restarted"];
    } catch (error: unknown) {
      if (error instanceof Error) {
        return [false, `Error restarting server: ${error.message}`];
      }
      return [false, `Error restarting server: ${error}`];
    }
  }
}

export function quickConnect(address: string): [boolean, string] {
  const conn = new ADBConnection();
  return conn.connect(address);
}

export function listDevices(): DeviceInfo[] {
  const conn = new ADBConnection();
  return conn.listDevices();
}
