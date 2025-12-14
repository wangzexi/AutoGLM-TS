import { CheckCircle, SquareFunction } from "lucide-react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-6">
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
            {msg.screenshot && (
              <img
                src={`data:image/png;base64,${msg.screenshot}`}
                alt={`Step ${i}`}
                className="w-24 h-auto flex-shrink-0 rounded-lg shadow border border-zinc-200 cursor-pointer hover:opacity-80 transition"
                onClick={() => {
                  if (msg.screenshot) {
                    setEnlargedScreenshot(msg.screenshot);
                  }
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && msg.screenshot) {
                    setEnlargedScreenshot(msg.screenshot);
                  }
                }}
              />
            )}
            <div className="flex-1 space-y-2">
              {msg.thinking ? (
                <p className="text-zinc-700 whitespace-pre-wrap">
                  {msg.thinking.replace(/\\n/g, "\n")}
                </p>
              ) : (
                <span className="inline-block w-0.5 h-4 bg-zinc-400 animate-[pulse_0.8s_ease-in-out_infinite]" />
              )}
              {msg.action && (
                <div className="text-sm">
                  {msg.action.action === "finish" ? (
                    <div className="flex gap-2 text-green-600">
                      <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <p className="whitespace-pre-wrap">
                        {String(msg.action.message || "完成").replace(
                          /\\n/g,
                          "\n",
                        )}
                      </p>
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
