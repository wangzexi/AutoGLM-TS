import { useState, useRef } from "react";
import { useAppContext } from "../contexts/AppContext";

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
	localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
}

type InputBoxProps = {
	onSubmit: (text: string) => void;
};

export function InputBox({ onSubmit }: InputBoxProps) {
	const { isRunning } = useAppContext();
	const [input, setInput] = useState("");
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [isComposing, setIsComposing] = useState(false);
	const tempInputRef = useRef("");

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
		<div className="sticky bottom-0 pb-4 pt-2 px-4 bg-gradient-to-t from-white from-50% to-transparent">
			<form onSubmit={handleSubmit}>
				<div className="bg-zinc-100 rounded-3xl px-4 py-2">
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						onCompositionStart={() => setIsComposing(true)}
						onCompositionEnd={() => setIsComposing(false)}
						placeholder="输入任务..."
						rows={1}
						className="w-full bg-transparent focus:outline-none resize-none text-zinc-900 placeholder-zinc-400 disabled:cursor-not-allowed"
						disabled={isRunning}
						style={{ minHeight: "24px" }}
					/>
					<div className="flex items-center justify-between mt-2">
						<div className="text-zinc-400 text-xs">
							{getHistory().length > 0 ? "↑ 查看历史  /  Shift+Enter 换行" : "Shift+Enter 换行"}
						</div>
						<button
							type="submit"
							disabled={isRunning || !input.trim()}
							className="bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-300 text-white w-8 h-8 rounded-full flex items-center justify-center transition"
						>
							{isRunning ? "·" : "↑"}
						</button>
					</div>
				</div>
			</form>
		</div>
	);
}
