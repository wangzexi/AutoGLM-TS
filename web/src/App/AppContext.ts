import { createContext, useContext } from "react";

export type Message =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      stepIndex?: number; // 步骤索引，用于匹配更新
      thinking: string;
      action?: Record<string, unknown>;
      screenshot?: string;
      finished?: boolean;
      message?: string;
      error?: string;
    };

export type SessionMessage = {
  role: "user" | "assistant";
  content: string;
  screenshot?: string;
};

export type Device = {
  deviceId: string;
  model?: string;
  brand?: string;
  marketName?: string;
  androidVersion?: string;
  screenshot?: string;
};

export type AppContextType = {
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device) => void;
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  enlargedScreenshot: string | null;
  setEnlargedScreenshot: (screenshot: string | null) => void;
  model: string | null;
  setModel: (model: string | null) => void;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}

// 根据消息列表计算是否正在运行
export function useIsRunning(): boolean {
  const { messages } = useAppContext();
  const lastMessage = messages[messages.length - 1];
  return (
    lastMessage?.role === "assistant" &&
    !lastMessage.finished
  );
}
