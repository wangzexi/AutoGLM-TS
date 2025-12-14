# 工具目录

本目录包含项目所需的外部工具。

## 工具列表

### 1. ADB
- **路径**：`tools/adb`
- **用途**：与 Android 设备通信
- **下载**：[platform-tools-latest-darwin.zip](https://dl.google.com/android/repository/platform-tools-latest-darwin.zip)

### 2. ADB Keyboard
- **路径**：`ADBKeyboard.apk`
- **用途**：通过 ADB 输入文本
- **下载**：[ADBKeyboard.apk](https://github.com/senzhk/ADBKeyBoard/raw/master/ADBKeyboard.apk)
- **安装**：`adb install tools/ADBKeyboard.apk`

## 快速下载

```bash
# 下载 ADB
curl -L -o platform-tools.zip https://dl.google.com/android/repository/platform-tools-latest-darwin.zip
unzip -j platform-tools.zip "platform-tools/adb" -d tools/

# 下载 ADB Keyboard（如果慢可以使用代理）
curl -L -o tools/ADBKeyboard.apk https://github.com/senzhk/ADBKeyBoard/raw/master/ADBKeyboard.apk
# 或使用代理：
# curl -x http://localhost:1080 -L -o tools/ADBKeyboard.apk https://github.com/senzhk/ADBKeyBoard/raw/master/ADBKeyboard.apk
```
