import { useRef } from "react";
import type { Message } from "../AppContext";
import { useAppContext } from "../AppContext";
import { InputBox, type InputBoxRef } from "./InputBox";
import { MessageList } from "./MessageList";
import { PhonePreview } from "./PhonePreview";

const EXAMPLES = ["打开美团帮我点一杯瑞幸咖啡", "打开小红书搜索美食攻略"];

type ChatContainerProps = {
  onBack: () => void;
};

export function ChatContainer({ onBack }: ChatContainerProps) {
  const { selectedDevice, messages, setMessages, setIsRunning } =
    useAppContext();
  const inputBoxRef = useRef<InputBoxRef>(null);

  const getLatestScreenshot = (): string | undefined => {
    return (
      [...messages]
        .reverse()
        .find(
          (m): m is Extract<Message, { role: "assistant" }> =>
            m.role === "assistant" && Boolean(m.screenshot),
        )?.screenshot || selectedDevice?.screenshot
    );
  };

  const handleExampleClick = (text: string) => {
    inputBoxRef.current?.setInput(text);
    inputBoxRef.current?.focus();
  };

  const handleStop = async () => {
    await fetch("/rpc/task/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: {} }),
    });
    setIsRunning(false);
  };

  const handleSubmit = async (userMessage: string) => {
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsRunning(true);

    try {
      const res = await fetch("/rpc/task/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { task: userMessage } }),
      });

      if (!res.ok) throw new Error("请求失败");
      if (!res.body) throw new Error("无响应体");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            const data = payload.json;

            if (data.type === "thinking") {
              // 开始新的一步，显示截图 + 光标
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  thinking: "",
                  screenshot: data.screenshot,
                },
              ]);
            } else if (data.type === "inference") {
              // 收到推理结果（thinking），立即显示
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    thinking: data.thinking,
                    screenshot: data.screenshot,
                  };
                }
                return updated;
              });
            } else if (data.type === "action") {
              // 收到 action（执行前），立即显示
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    action: data.action,
                    screenshot: data.screenshot,
                  };
                }
                return updated;
              });
            } else if (data.type === "step") {
              // 执行完成，更新最终结果
              const step = data.step;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    role: "assistant",
                    thinking: step.thinking,
                    action: step.action,
                    screenshot: step.screenshot,
                    finished: step.finished,
                    message: step.message,
                  };
                }
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", thinking: "执行出错，请重试", finished: true },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex">
      {/* 左侧聊天区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {isEmpty ? (
          // 空状态：居中布局
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-xl">
              <InputBox
                ref={inputBoxRef}
                onSubmit={handleSubmit}
                onStop={handleStop}
              />
              <div className="flex flex-wrap gap-2 mt-3 px-1">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handleExampleClick(example)}
                    className="px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-full transition"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // 有消息：常规布局
          <>
            <MessageList messages={messages} />
            <InputBox
              ref={inputBoxRef}
              onSubmit={handleSubmit}
              onStop={handleStop}
              className="sticky bottom-0 pb-4 pt-2 px-4 bg-gradient-to-t from-white from-50% to-transparent"
            />
          </>
        )}
      </div>

      {/* 右侧手机预览 */}
      <PhonePreview onBack={onBack} latestScreenshot={getLatestScreenshot()} />
    </div>
  );
}
