/**
 * Unified ADB client for Android device automation.
 * Replaces the entire adb/ directory with a single, simpler file.
 */

import {
  AdbServerClient,
  Adb,
} from '@yume-chan/adb';
import { AdbServerNodeTcpConnector } from '@yume-chan/adb-server-node-tcp';
import sharp from 'sharp';
import { APP_PACKAGES } from './config/apps.ts';

// Single ADB client instance
let adbClient: AdbServerClient | null = null;

function getClient(): AdbServerClient {
  if (!adbClient) {
    const connector = new AdbServerNodeTcpConnector({
      host: 'localhost',
      port: 5037,
    });
    adbClient = new AdbServerClient(connector);
  }
  return adbClient;
}

// Cache Adb instances per device to avoid recreating
const adbInstances = new Map<string, Adb>();

async function getAdbInstance(deviceId?: string): Promise<Adb> {
  const client = getClient();
  const deviceKey = deviceId || 'default';

  if (adbInstances.has(deviceKey)) {
    return adbInstances.get(deviceKey)!;
  }

  const devices = await client.getDevices();

  let targetDevice;
  if (deviceId) {
    targetDevice = devices.find((d) => d.serial === deviceId);
  } else {
    targetDevice = devices[0];
  }

  if (!targetDevice) {
    throw new Error('Device not found');
  }

  const adb = await client.createAdb({ serial: targetDevice.serial });
  adbInstances.set(deviceKey, adb);
  return adb;
}

/**
 * Get current app name from device
 */
export async function getCurrentApp(deviceId?: string): Promise<string> {
  try {
    const adb = await getAdbInstance(deviceId);
    const socket = await adb.createSocket('shell:dumpsys window');

    const chunks: Uint8Array[] = [];
    for await (const chunk of socket.readable) {
      chunks.push(chunk);
    }

    const output = Buffer.from(chunks.join('')).toString('utf-8');
    socket.close();

    for (const [appName, packageName] of Object.entries(APP_PACKAGES)) {
      if (output.includes(packageName)) {
        return appName;
      }
    }

    return "System Home";
  } catch {
    return "System Home";
  }
}

/**
 * Tap at coordinates
 */
export async function tap(
  x: number,
  y: number,
  deviceId?: string,
  delay: number = 1
): Promise<void> {
  try {
    const adb = await getAdbInstance(deviceId);
    const socket = await adb.createSocket(`shell:input tap ${x} ${y}`);
    socket.close();

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch (error) {
    console.error('Tap error:', error);
  }
}

/**
 * Double tap at coordinates
 */
export async function doubleTap(
  x: number,
  y: number,
  deviceId?: string,
  delay: number = 1
): Promise<void> {
  try {
    const adb = await getAdbInstance(deviceId);

    const socket1 = await adb.createSocket(`shell:input tap ${x} ${y}`);
    socket1.close();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const socket2 = await adb.createSocket(`shell:input tap ${x} ${y}`);
    socket2.close();

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch (error) {
    console.error('DoubleTap error:', error);
  }
}

/**
 * Long press at coordinates
 */
export async function longPress(
  x: number,
  y: number,
  durationMs: number = 3000,
  deviceId?: string,
  delay: number = 1
): Promise<void> {
  try {
    const adb = await getAdbInstance(deviceId);
    const socket = await adb.createSocket(
      `shell:input swipe ${x} ${y} ${x} ${y} ${durationMs}`
    );
    socket.close();

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch (error) {
    console.error('LongPress error:', error);
  }
}

/**
 * Swipe from one point to another
 */
export async function swipe(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  durationMs?: number,
  deviceId?: string,
  delay: number = 1
): Promise<void> {
  try {
    const adb = await getAdbInstance(deviceId);

    let duration = durationMs;
    if (duration === undefined) {
      const distSq = Math.pow(startX - endX, 2) + Math.pow(startY - endY, 2);
      duration = Math.floor(distSq / 1000);
      duration = Math.max(1000, Math.min(duration, 2000));
    }

    const socket = await adb.createSocket(
      `shell:input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`
    );
    socket.close();

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch (error) {
    console.error('Swipe error:', error);
  }
}

/**
 * Press back button
 */
export async function back(deviceId?: string, delay: number = 1): Promise<void> {
  try {
    const adb = await getAdbInstance(deviceId);
    const socket = await adb.createSocket('shell:input keyevent 4');
    socket.close();

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch (error) {
    console.error('Back error:', error);
  }
}

/**
 * Press home button
 */
export async function home(deviceId?: string, delay: number = 1): Promise<void> {
  try {
    const adb = await getAdbInstance(deviceId);
    const socket = await adb.createSocket('shell:input keyevent 3');
    socket.close();

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  } catch (error) {
    console.error('Home error:', error);
  }
}

/**
 * Launch an app using monkey command (more universal)
 */
export async function launchApp(
  appName: string,
  deviceId?: string,
  delay: number = 2
): Promise<boolean> {
  if (!(appName in APP_PACKAGES)) {
    return false;
  }

  try {
    const adb = await getAdbInstance(deviceId);
    const packageName = APP_PACKAGES[appName as keyof typeof APP_PACKAGES];

    // Use monkey command which works for any app without knowing the activity name
    const socket = await adb.createSocket(
      `shell:monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`
    );

    // Read output to ensure command completes
    for await (const _ of socket.readable) {}
    socket.close();

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }

    return true;
  } catch (error) {
    console.error('LaunchApp error:', error);
    return false;
  }
}

/**
 * Type text
 */
export async function typeText(text: string, deviceId?: string): Promise<void> {
  try {
    const adb = await getAdbInstance(deviceId);
    // Replace spaces with %s for Android input
    const encodedText = text.replace(/ /g, '%s');
    const socket = await adb.createSocket(`shell:input text ${encodedText}`);
    socket.close();
  } catch (error) {
    console.error('TypeText error:', error);
  }
}

/**
 * Clear text
 */
export async function clearText(deviceId?: string): Promise<void> {
  try {
    const adb = await getAdbInstance(deviceId);

    // Select all and delete
    const socket1 = await adb.createSocket('shell:input keyevent 113'); // CTRL+A
    socket1.close();

    const socket2 = await adb.createSocket('shell:input keyevent 67'); // DEL
    socket2.close();
  } catch (error) {
    console.error('ClearText error:', error);
  }
}

/**
 * Detect and set ADB keyboard
 */
export async function detectAndSetAdbKeyboard(
  deviceId?: string
): Promise<string> {
  try {
    const adb = await getAdbInstance(deviceId);

    // Get current IME
    const socket = await adb.createSocket(
      'shell:settings get secure default_input_method'
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of socket.readable) {
      chunks.push(chunk);
    }

    const currentIme = Buffer.from(chunks.join('')).toString('utf-8').trim();
    socket.close();

    // Switch to ADB Keyboard if not already set
    if (!currentIme.includes('com.android.adbkeyboard/.AdbIME')) {
      try {
        const socket2 = await adb.createSocket(
          'shell:ime set com.android.adbkeyboard/.AdbIME'
        );
        socket2.close();
      } catch (error) {
        console.error('Failed to set ADB Keyboard:', error);
      }
    }

    // Warm up the keyboard
    await typeText('', deviceId);

    return currentIme;
  } catch (error) {
    console.error('detectAndSetAdbKeyboard error:', error);
    return '';
  }
}

/**
 * Restore keyboard
 */
export async function restoreKeyboard(
  ime: string,
  deviceId?: string
): Promise<void> {
  try {
    if (!ime) return;

    const adb = await getAdbInstance(deviceId);
    const socket = await adb.createSocket(`shell:ime set ${ime}`);
    socket.close();
  } catch (error) {
    console.error('restoreKeyboard error:', error);
  }
}

/**
 * Screenshot interface
 */
export interface Screenshot {
  base64Data: string;
  width: number;
  height: number;
  isSensitive: boolean;
}

/**
 * Take a screenshot
 */
export async function getScreenshot(
  deviceId?: string,
  timeout: number = 10
): Promise<Screenshot> {
  try {
    const adb = await getAdbInstance(deviceId);

    // Take screenshot using screencap to stdout (not file)
    const socket = await adb.createSocket('shell:screencap -p');

    const chunks: Uint8Array[] = [];
    for await (const chunk of socket.readable) {
      chunks.push(chunk);
    }
    socket.close();

    const imageBuffer = Buffer.concat(chunks);

    // Try to get metadata, but don't fail if it doesn't work
    let width = 1080;
    let height = 2400;

    try {
      const metadata = await sharp(imageBuffer).metadata();
      width = metadata.width || width;
      height = metadata.height || height;
    } catch (err) {
      // If metadata fails, still try to use the image
      console.warn('Failed to get image metadata, using defaults');
    }

    // Encode to base64
    const base64Data = imageBuffer.toString('base64');

    return {
      base64Data,
      width,
      height,
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

  const base64Data = blackImage.toString('base64');

  return {
    base64Data,
    width: defaultWidth,
    height: defaultHeight,
    isSensitive,
  };
}

/**
 * List connected devices
 */
export async function listDevices(): Promise<
  Array<{
    deviceId: string;
    status: string;
    model?: string;
  }>
> {
  try {
    const client = getClient();
    const devices = await client.getDevices();

    return devices.map((device) => ({
      deviceId: device.serial,
      status: device.state,
      model: device.model,
    }));
  } catch (error) {
    console.error(`Error listing devices: ${error}`);
    return [];
  }
}

/**
 * Check if ADB Keyboard is installed
 */
export async function isAdbKeyboardInstalled(deviceId?: string): Promise<boolean> {
  try {
    const adb = await getAdbInstance(deviceId);
    const socket = await adb.createSocket('shell:ime list -s');

    const chunks: Uint8Array[] = [];
    for await (const chunk of socket.readable) {
      chunks.push(chunk);
    }

    const output = Buffer.from(chunks.join('')).toString('utf-8');
    socket.close();

    return output.includes('com.android.adbkeyboard/.AdbIME');
  } catch {
    return false;
  }
}

/**
 * Check if ADB server is available
 */
export async function isAdbServerAvailable(): Promise<boolean> {
  try {
    const client = getClient();
    await client.getDevices();
    return true;
  } catch {
    return false;
  }
}

/**
 * Connect to a remote ADB device
 */
export async function connect(address: string): Promise<[boolean, string]> {
  try {
    const { execSync } = await import('child_process');
    const output = execSync(`adb connect ${address}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    const success = output.includes('connected to') || output.includes('already connected');
    return [success, output.trim()];
  } catch (error: any) {
    return [false, error.message || 'Connection failed'];
  }
}

/**
 * Disconnect from a remote ADB device
 */
export async function disconnect(address?: string): Promise<[boolean, string]> {
  try {
    const { execSync } = await import('child_process');
    const output = execSync(`adb disconnect ${address || ''}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return [true, output.trim()];
  } catch (error: any) {
    return [false, error.message || 'Disconnect failed'];
  }
}

/**
 * Enable TCP/IP mode on a device
 */
export async function enableTcpip(
  port: number,
  deviceId?: string
): Promise<[boolean, string]> {
  try {
    const { execSync } = await import('child_process');
    const deviceArg = deviceId ? `-s ${deviceId}` : '';
    const output = execSync(`adb ${deviceArg} tcpip ${port}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return [true, output.trim()];
  } catch (error: any) {
    return [false, error.message || 'Failed to enable TCP/IP mode'];
  }
}
