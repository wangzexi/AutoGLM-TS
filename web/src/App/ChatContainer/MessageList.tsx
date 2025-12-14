import { AlertCircle, CheckCircle, SquareFunction } from "lucide-react";
import Markdown from "markdown-to-jsx";
import { useEffect, useRef } from "react";
import type { Message } from "../AppContext";
import { useAppContext } from "../AppContext";

function ActionCard({ action }: { action: Record<string, unknown> }) {
  const actionName = String(action.action);
  const params = Object.fromEntries(
    Object.entries(action).filter(([k]) => k !== "action"),
  );

  return (
    <div className="inline-flex items-center gap-1.5 text-zinc-500">
      <SquareFunction size={14} />
      <span>{actionName}</span>
      {Object.keys(params).length > 0 && (
        <span className="text-zinc-400 text-xs">{JSON.stringify(params)}</span>
      )}
    </div>
  );
}

type MessageListProps = {
  messages: Message[];
};

export function MessageList({ messages }: MessageListProps) {
  const { setEnlargedScreenshot } = useAppContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true); // 记录是否在底部

  // 检测是否接近底部（允许 50px 误差）
  const checkIfAtBottom = () => {
    const container = containerRef.current;
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < 50;
  };

  // 滚动时更新状态
  const handleScroll = () => {
    isAtBottomRef.current = checkIfAtBottom();
  };

  // 消息更新时，只有在底部才自动滚动
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on messages change
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-6"
    >
      {messages.map((msg, i) =>
        msg.role === "user" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: messages array is immutable, index is stable
          <div key={`user-${i}`} className="flex justify-end">
            <div className="bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] whitespace-pre-wrap">
              {msg.content}
            </div>
          </div>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: messages array is immutable, index is stable
          <div key={`assistant-${i}`} className="flex gap-3 items-start">
            {msg.screenshot &&
              (() => {
                // 判断是否是当前运行中的消息（最后一条且未完成）
                const isRunning = i === messages.length - 1 && !msg.finished;
                return (
                  <img
                    src={`data:image/png;base64,${msg.screenshot}`}
                    alt={`Step ${i}`}
                    className={`w-24 h-auto flex-shrink-0 rounded-lg shadow border border-zinc-200 cursor-pointer hover:opacity-80 transition ${
                      isRunning ? "" : "opacity-50 grayscale-[30%]"
                    }`}
                    onClick={() => {
                      if (msg.screenshot) {
                        setEnlargedScreenshot(msg.screenshot);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        (e.key === "Enter" || e.key === " ") &&
                        msg.screenshot
                      ) {
                        setEnlargedScreenshot(msg.screenshot);
                      }
                    }}
                  />
                );
              })()}
            <div className="flex-1 space-y-2">
              {/* 错误显示 */}
              {msg.error && (
                <div className="flex gap-2 text-red-600">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <p className="whitespace-pre-wrap text-sm">
                    {msg.error.replace(/\\n/g, "\n")}
                  </p>
                </div>
              )}
              {/* thinking 显示 */}
              {!msg.error &&
                (msg.thinking ? (
                  <div className="text-sm text-zinc-700 whitespace-pre-wrap break-words contain-layout">
                    <Markdown>{msg.thinking.replace(/\\n/g, "\n")}</Markdown>
                  </div>
                ) : !msg.action ? (
                  <span className="inline-block w-0.5 h-4 bg-zinc-400 animate-[pulse_0.8s_ease-in-out_infinite]" />
                ) : null)}
              {msg.action && (
                <div className="text-sm">
                  {msg.action.action === "finish" ? (
                    <div className="flex gap-2 text-green-600">
                      <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <div className="text-sm whitespace-pre-wrap break-words contain-layout">
                        <Markdown>
                          {String(msg.action.message || "完成").replace(
                            /\\n/g,
                            "\n",
                          )}
                        </Markdown>
                      </div>
                    </div>
                  ) : msg.action.action === "Take_over" ? (
                    <div className="flex gap-2 text-amber-600">
                      <span className="flex-shrink-0">✋</span>
                      <p className="whitespace-pre-wrap">
                        需要接管:{" "}
                        {String(msg.action.message || "请手动操作").replace(
                          /\\n/g,
                          "\n",
                        )}
                      </p>
                    </div>
                  ) : msg.message?.startsWith("⚠️") ? (
                    <p className="text-red-600 whitespace-pre-wrap">
                      {msg.message.replace(/\\n/g, "\n")}
                    </p>
                  ) : (
                    <ActionCard action={msg.action} />
                  )}
                </div>
              )}
            </div>
          </div>
        ),
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
