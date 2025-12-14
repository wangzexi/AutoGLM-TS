import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type {
  AppContextType,
  Device,
  Message,
  SessionMessage,
} from "./AppContext";
import { AppContext } from "./AppContext";
import { ChatContainer } from "./ChatContainer";
import { DeviceSelector } from "./DeviceSelector";
import { client } from "../client";

export default function App() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [enlargedScreenshot, setEnlargedScreenshot] = useState<string | null>(
    null,
  );
  const [model, setModel] = useState<string | null>(null);

  // 页面加载时尝试恢复 session 并获取配置
  useEffect(() => {
    // 获取模型配置
    client.config.get().then((data) => {
      if (data.model) {
        setModel(data.model);
      }
    });

    client.session.get().then((data) => {
      if (data) {
        // 恢复历史消息
        const restored: Message[] = data.messages.map((m: SessionMessage) =>
          m.role === "user"
            ? { role: "user" as const, content: m.content }
            : {
                role: "assistant" as const,
                thinking: m.content,
                finished: true,
              },
        );
        setMessages(restored);
        // 恢复设备（只设置 deviceId，其他信息从设备列表获取）
        setSelectedDevice({ deviceId: data.deviceId });
      }
    });
  }, []);

  // 轮询检测设备断开
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => client.session.get(),
    refetchInterval: selectedDevice ? 2000 : false,
    enabled: !!selectedDevice,
  });

  useEffect(() => {
    if (!session) {
      setSelectedDevice(null);
      setMessages([]);
    }
  }, [session]);

  // 选择设备时创建 session
  const handleSelectDevice = async (device: Device) => {
    await client.session.create({ deviceId: device.deviceId });
    setSelectedDevice(device);
    setMessages([]);
  };

  // 关闭时销毁 session
  const handleBack = async () => {
    await client.session.close();
    setSelectedDevice(null);
    setMessages([]);
  };

  const contextValue: AppContextType = {
    selectedDevice,
    setSelectedDevice: handleSelectDevice,
    messages,
    setMessages,
    enlargedScreenshot,
    setEnlargedScreenshot,
    model,
    setModel,
  };

  if (!selectedDevice) {
    return (
      <AppContext.Provider value={contextValue}>
        <DeviceSelector />
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <>
        <ChatContainer onBack={handleBack} />

        {/* 截图放大弹窗 */}
        {enlargedScreenshot && (
          // biome-ignore lint/a11y/useSemanticElements: modal backdrop requires custom styling
          <div
            role="button"
            tabIndex={0}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
            onClick={() => setEnlargedScreenshot(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape" || e.key === "Enter") {
                setEnlargedScreenshot(null);
              }
            }}
          >
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: click-only intentional */}
            <img
              role="presentation"
              src={`data:image/png;base64,${enlargedScreenshot}`}
              alt="Enlarged screenshot"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setEnlargedScreenshot(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center"
            >
              <X size={24} />
            </button>
          </div>
        )}
      </>
    </AppContext.Provider>
  );
}
