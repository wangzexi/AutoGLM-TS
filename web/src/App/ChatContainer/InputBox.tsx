import { Square, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useIsRunning } from "../AppContext";

const HISTORY_KEY = "autoglm-input-history";
const MAX_HISTORY = 50;
const SKILLS_KEY = "autoglm-skills";

type Command = { name: string; description: string; prompt?: string };

const BUILT_IN_COMMANDS: Command[] = [
  { name: "/clear", description: "清空会话历史" },
  { name: "/newskill", description: "基于当前会话创建新技能" },
];

export type Skill = { name: string; prompt: string };

export function getSkills(): Skill[] {
  try {
    return JSON.parse(localStorage.getItem(SKILLS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveSkill(skill: Skill) {
  const skills = getSkills().filter((s) => s.name !== skill.name);
  skills.push(skill);
  localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
}

export function deleteSkill(name: string) {
  const skills = getSkills().filter((s) => s.name !== name);
  localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
}

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
  onCommand?: (command: string) => void;
  className?: string;
};

export type InputBoxRef = {
  setInput: (text: string) => void;
  focus: () => void;
  refreshSkills: () => void;
};

export const InputBox = forwardRef<InputBoxRef, InputBoxProps>(
  function InputBox({ onSubmit, onStop, onCommand, className = "" }, ref) {
    const isRunning = useIsRunning();
    const [input, setInput] = useState("");
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isComposing, setIsComposing] = useState(false);
    const [showCommands, setShowCommands] = useState(false);
    const [commandIndex, setCommandIndex] = useState(0);
    const [skillsVersion, setSkillsVersion] = useState(0);
    const tempInputRef = useRef("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 动态生成命令列表（内置 + skills）
    // skillsVersion 用于触发重新计算
    void skillsVersion;
    const allCommands: Command[] = [
      ...BUILT_IN_COMMANDS,
      ...getSkills().map((s) => ({
        name: `/skill:${s.name}`,
        description:
          s.prompt.slice(0, 30) + (s.prompt.length > 30 ? "..." : ""),
        prompt: s.prompt,
      })),
    ];

    // 匹配的命令列表
    const matchedCommands = input.startsWith("/")
      ? allCommands.filter((cmd) => cmd.name.startsWith(input))
      : [];

    // 重置选中索引当命令列表变化
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset on input change
    useEffect(() => {
      setCommandIndex(0);
    }, [input]);

    useImperativeHandle(ref, () => ({
      setInput: (text: string) => {
        setInput(text);
        setHistoryIndex(-1);
        tempInputRef.current = "";
      },
      focus: () => {
        textareaRef.current?.focus();
      },
      refreshSkills: () => {
        setSkillsVersion((v) => v + 1);
      },
    }));

    // 自动调整高度
    // biome-ignore lint/correctness/useExhaustiveDependencies: adjust height on input change
    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      const lineHeight = 20; // 约 1 行高度
      const maxHeight = lineHeight * 5;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }, [input]);

    // 显示/隐藏命令菜单
    useEffect(() => {
      setShowCommands(matchedCommands.length > 0);
    }, [matchedCommands.length]);

    const handleSelectCommand = (command: string) => {
      // 如果是 skill 命令，填充 prompt 到输入框
      const skillCmd = allCommands.find((c) => c.name === command && c.prompt);
      if (skillCmd?.prompt) {
        setInput(skillCmd.prompt);
        setShowCommands(false);
        return;
      }
      // 否则执行命令
      if (onCommand) {
        onCommand(command);
      }
      setInput("");
      setShowCommands(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // 命令面板打开时的键盘处理
      if (showCommands && matchedCommands.length > 0) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setCommandIndex((prev) =>
            prev > 0 ? prev - 1 : matchedCommands.length - 1,
          );
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setCommandIndex((prev) =>
            prev < matchedCommands.length - 1 ? prev + 1 : 0,
          );
          return;
        }
        if (e.key === "Enter" && !e.shiftKey && !isComposing) {
          e.preventDefault();
          handleSelectCommand(matchedCommands[commandIndex].name);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setInput("");
          return;
        }
      }

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

    const handleDeleteSkill = (skillName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteSkill(skillName);
      setSkillsVersion((v) => v + 1);
    };

    return (
      <div className={`relative ${className}`}>
        {/* 命令补全菜单 */}
        {showCommands && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden">
            {matchedCommands.map((cmd, index) => (
              <div
                key={cmd.name}
                className={`flex items-center ${
                  index === commandIndex ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectCommand(cmd.name)}
                  className="flex-1 px-4 py-2.5 text-left flex items-center gap-3"
                >
                  <span className="text-sm font-medium text-zinc-900">
                    <span className="text-blue-500">{input}</span>
                    {cmd.name.slice(input.length)}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {cmd.description}
                  </span>
                </button>
                {cmd.prompt && (
                  <button
                    type="button"
                    onClick={(e) =>
                      handleDeleteSkill(cmd.name.replace("/skill:", ""), e)
                    }
                    className="mr-2 p-1.5 text-zinc-400 hover:bg-zinc-200 rounded-full transition"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: click to focus textarea */}
          <div
            className="bg-zinc-100 rounded-3xl p-4 cursor-text"
            onClick={() => textareaRef.current?.focus()}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="输入任务开始自动化操作..."
              className="w-full bg-transparent focus:outline-none resize-none text-zinc-900 text-sm placeholder-zinc-400 placeholder:font-normal align-top leading-5 overflow-y-auto"
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
