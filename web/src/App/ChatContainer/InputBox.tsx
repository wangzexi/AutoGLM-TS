import { Square } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useAppContext } from "../AppContext";

const HISTORY_KEY = "autoglm-input-history";
const MAX_HISTORY = 50;

function getHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.slice(-MAX_HISTORY)),
  );
}

type InputBoxProps = {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  className?: string;
};

export type InputBoxRef = {
  setInput: (text: string) => void;
  focus: () => void;
};

export const InputBox = forwardRef<InputBoxRef, InputBoxProps>(
  function InputBox({ onSubmit, onStop, className = "" }, ref) {
    const { isRunning } = useAppContext();
    const [input, setInput] = useState("");
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isComposing, setIsComposing] = useState(false);
    const tempInputRef = useRef("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      setInput: (text: string) => {
        setInput(text);
        setHistoryIndex(-1);
        tempInputRef.current = "";
      },
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
        if (input.trim() && !isRunning) {
          handleSubmitClick();
        }
        return;
      }

      const history = getHistory();
      if (history.length === 0) return;

      if (e.key === "ArrowUp" && !input.includes("\n")) {
        e.preventDefault();
        if (historyIndex === -1) {
          tempInputRef.current = input;
        }
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      } else if (e.key === "ArrowDown" && !input.includes("\n")) {
        e.preventDefault();
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          setInput(tempInputRef.current);
        } else {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(history[history.length - 1 - newIndex]);
        }
      }
    };

    const handleSubmitClick = () => {
      if (!input.trim() || isRunning) return;

      const userMessage = input.trim();
      const history = getHistory();
      if (history[history.length - 1] !== userMessage) {
        saveHistory([...history, userMessage]);
      }

      onSubmit(userMessage);
      setInput("");
      setHistoryIndex(-1);
      tempInputRef.current = "";
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleSubmitClick();
    };

    return (
      <div className={className}>
        <form onSubmit={handleSubmit}>
          <div className="bg-zinc-100 rounded-3xl px-4 py-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="输入任务开始自动化操作..."
              rows={1}
              className="w-full bg-transparent focus:outline-none resize-none text-zinc-900 text-sm placeholder-zinc-400 placeholder:font-normal disabled:cursor-not-allowed"
              disabled={isRunning}
              style={{ minHeight: "24px" }}
            />
            <div className="flex items-end justify-between mt-2">
              <div className="text-zinc-300 text-xs">
                {getHistory().length > 0
                  ? "↑ 查看历史  /  Shift+Enter 换行"
                  : "Shift+Enter 换行"}
              </div>
              {isRunning ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="bg-zinc-900 hover:bg-zinc-700 text-white w-9 h-9 rounded-3xl flex items-center justify-center transition flex-shrink-0"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white w-9 h-9 rounded-3xl flex items-center justify-center transition flex-shrink-0"
                >
                  ↑
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  },
);
