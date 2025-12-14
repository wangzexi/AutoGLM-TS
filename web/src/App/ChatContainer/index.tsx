import { useRef, useState } from "react";
import { client } from "../../client";
import type { Message } from "../AppContext";
import { useAppContext } from "../AppContext";
import { InputBox, type InputBoxRef, saveSkill } from "./InputBox";
import { MessageList } from "./MessageList";
import { PhonePreview } from "./PhonePreview";

const EXAMPLES = ["打开美团帮我点一杯瑞幸咖啡", "打开小红书搜索美食攻略"];

type ChatContainerProps = {
  onBack: () => void;
};

export function ChatContainer({ onBack }: ChatContainerProps) {
  const { selectedDevice, messages, setMessages } = useAppContext();
  const inputBoxRef = useRef<InputBoxRef>(null);
  const [skillStatus, setSkillStatus] = useState<{
    type: "loading" | "success" | "error";
    message: string;
  } | null>(null);

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

  const handleCommand = async (command: string) => {
    if (command === "/clear") {
      setMessages([]);
    } else if (command === "/newskill") {
      if (messages.length === 0) {
        setSkillStatus({ type: "error", message: "没有会话历史" });
        setTimeout(() => setSkillStatus(null), 3000);
        return;
      }
      setSkillStatus({ type: "loading", message: "正在总结技能..." });
      try {
        const result = await client.skill.generate();
        if ("error" in result) {
          setSkillStatus({
            type: "error",
            message: `创建失败: ${result.error}`,
          });
          setTimeout(() => setSkillStatus(null), 3000);
          return;
        }
        saveSkill({ name: result.title, prompt: result.content });
        inputBoxRef.current?.refreshSkills();
        setSkillStatus({
          type: "success",
          message: `技能「${result.title}」已创建`,
        });
        setTimeout(() => setSkillStatus(null), 3000);
      } catch (e) {
        setSkillStatus({ type: "error", message: `创建失败: ${e}` });
        setTimeout(() => setSkillStatus(null), 3000);
      }
    }
  };

  const handleStop = async () => {
    await client.task.cancel();
  };

  const handleSubmit = async (userMessage: string) => {
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

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

            // 辅助函数：用 stepIndex 匹配消息
            const findMessageByStepIndex = (
              msgs: Message[],
              stepIndex: number,
            ): number => {
              for (let i = msgs.length - 1; i >= 0; i--) {
                const m = msgs[i];
                if (m.role === "assistant" && m.stepIndex === stepIndex)
                  return i;
              }
              return -1;
            };

            if (data.type === "thinking") {
              // 开始新的一步，创建消息
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  stepIndex: data.stepIndex,
                  thinking: "",
                  screenshot: data.screenshot,
                },
              ]);
            } else if (data.type === "inference") {
              // 用 stepIndex 匹配消息
              setMessages((prev) => {
                const updated = [...prev];
                const idx = findMessageByStepIndex(updated, data.stepIndex);
                if (idx !== -1 && updated[idx].role === "assistant") {
                  updated[idx] = {
                    ...updated[idx],
                    thinking: data.thinking,
                    screenshot: data.screenshot,
                  } as Message;
                }
                return updated;
              });
            } else if (data.type === "action") {
              // 用 stepIndex 匹配消息
              setMessages((prev) => {
                const updated = [...prev];
                const idx = findMessageByStepIndex(updated, data.stepIndex);
                if (idx !== -1 && updated[idx].role === "assistant") {
                  const msg = updated[idx] as Extract<
                    Message,
                    { role: "assistant" }
                  >;
                  updated[idx] = {
                    ...msg,
                    action: data.action,
                    screenshot: data.screenshot,
                    thinking: msg.thinking || "执行操作中...",
                  };
                }
                return updated;
              });
            } else if (data.type === "step") {
              // 用 step.index 匹配消息
              const step = data.step;
              setMessages((prev) => {
                const updated = [...prev];
                const idx = findMessageByStepIndex(updated, step.index);
                if (idx !== -1) {
                  updated[idx] = {
                    role: "assistant",
                    stepIndex: step.index,
                    thinking: step.thinking,
                    action: step.action,
                    screenshot: step.screenshot,
                    finished: step.finished,
                    message: step.message,
                  };
                }
                return updated;
              });
            } else if (data.type === "failed" || data.type === "error") {
              // 错误：更新最后一条 assistant 消息或创建新的
              setMessages((prev) => {
                const updated = [...prev];
                let lastIdx = -1;
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].role === "assistant") {
                    lastIdx = i;
                    break;
                  }
                }
                if (lastIdx !== -1) {
                  const msg = updated[lastIdx] as Extract<
                    Message,
                    { role: "assistant" }
                  >;
                  updated[lastIdx] = {
                    ...msg,
                    finished: true,
                    error: data.error,
                  };
                } else {
                  updated.push({
                    role: "assistant",
                    thinking: "",
                    finished: true,
                    error: data.error,
                  });
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
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex">
      {/* Toast */}
      {skillStatus && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`px-4 py-2 rounded-full text-sm shadow-lg ${
              skillStatus.type === "loading"
                ? "bg-zinc-800 text-white"
                : skillStatus.type === "success"
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
            }`}
          >
            {skillStatus.type === "loading" && (
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 align-middle" />
            )}
            {skillStatus.message}
          </div>
        </div>
      )}

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
                onCommand={handleCommand}
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
            <div className="sticky bottom-0 pb-4 px-4 bg-white">
              <InputBox
                ref={inputBoxRef}
                onSubmit={handleSubmit}
                onStop={handleStop}
                onCommand={handleCommand}
                className="max-w-xl mx-auto"
              />
            </div>
          </>
        )}
      </div>

      {/* 右侧手机预览 */}
      <PhonePreview onBack={onBack} latestScreenshot={getLatestScreenshot()} />
    </div>
  );
}
