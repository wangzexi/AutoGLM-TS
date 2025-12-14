import { useState, useRef, useEffect } from "react";

type Message =
	| { role: "user"; content: string }
	| { role: "assistant"; thinking: string; action?: Record<string, unknown>; screenshot?: string; finished?: boolean; message?: string };

type Device = {
	deviceId: string;
	status: string;
	model?: string;
};

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

export default function App() {
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [devices, setDevices] = useState<Device[]>([]);
	const [selectedDevice, setSelectedDevice] = useState<string>("");
	const tempInputRef = useRef(""); // 不需要状态，用 ref
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// 获取设备列表
	useEffect(() => {
		fetch("/rpc/device/list", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ json: {} }),
		})
			.then((res) => res.json())
			.then((data) => {
				const list = data.json || [];
				setDevices(list);
				if (list.length > 0 && !selectedDevice) {
					setSelectedDevice(list[0].deviceId);
				}
			})
			.catch(console.error);
	}, []);

	// 滚动到底部
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		const history = getHistory();
		if (history.length === 0) return;

		if (e.key === "ArrowUp") {
			e.preventDefault();
			if (historyIndex === -1) {
				tempInputRef.current = input;
			}
			const newIndex = Math.min(historyIndex + 1, history.length - 1);
			setHistoryIndex(newIndex);
			setInput(history[history.length - 1 - newIndex]);
		} else if (e.key === "ArrowDown") {
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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isRunning) return;

		const userMessage = input.trim();

		// 保存到历史
		const history = getHistory();
		if (history[history.length - 1] !== userMessage) {
			saveHistory([...history, userMessage]);
		}

		setInput("");
		setHistoryIndex(-1);
		tempInputRef.current = "";
		setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
		setIsRunning(true);

		try {
			const res = await fetch("/rpc/task/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ json: { task: userMessage, deviceId: selectedDevice || undefined } }),
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
						if (data.type === "step") {
							const step = data.step;
							setMessages((prev) => [
								...prev,
								{
									role: "assistant",
									thinking: step.thinking,
									action: step.action,
									screenshot: step.screenshot,
									finished: step.finished,
									message: step.message,
								},
							]);
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

	return (
		<div className="min-h-screen bg-white text-zinc-900">
			{/* 消息区域 */}
			<div className="max-w-3xl mx-auto px-4 pt-4 pb-24 space-y-6">
				{messages.length === 0 && (
					<div className="h-[80vh] flex items-center justify-center text-zinc-400">
						<div className="text-center">
							<div className="text-6xl mb-4">📱</div>
							<p className="text-lg">AutoGLM</p>
							<p className="text-sm mt-2">输入任务开始自动化操作</p>

							{/* 设备选择 */}
							<div className="mt-6">
								{devices.length === 0 ? (
									<p className="text-sm text-zinc-500">未检测到设备</p>
								) : (
									<select
										value={selectedDevice}
										onChange={(e) => setSelectedDevice(e.target.value)}
										className="bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:border-zinc-400"
									>
										{devices.map((d) => (
											<option key={d.deviceId} value={d.deviceId}>
												{d.model || d.deviceId} ({d.status})
											</option>
										))}
									</select>
								)}
							</div>
						</div>
					</div>
				)}

				{messages.map((msg, i) =>
					msg.role === "user" ? (
						<div key={i} className="flex justify-end">
							<div className="bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
								{msg.content}
							</div>
						</div>
					) : (
						<div key={i} className="space-y-3">
							{/* 思考过程 */}
							<p className="text-zinc-700 whitespace-pre-wrap">{msg.thinking}</p>

							{/* 操作 */}
							{msg.action && (
								<div className="text-sm text-blue-600">
									{msg.action._type === "finish" ? (
										<span>✅ {String(msg.action.message)}</span>
									) : (
										<span>
											🎯 {String(msg.action.action)}
											{msg.action.element ? ` → ${JSON.stringify(msg.action.element)}` : ""}
										</span>
									)}
								</div>
							)}

							{/* 截图 */}
							{msg.screenshot && (
								<img
									src={`data:image/png;base64,${msg.screenshot}`}
									alt="Screenshot"
									className="rounded-lg cursor-pointer hover:opacity-90 transition border border-zinc-200"
									style={{ maxHeight: "500px" }}
									onClick={() => window.open(`data:image/png;base64,${msg.screenshot}`, "_blank")}
								/>
							)}
						</div>
					)
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* 输入区域 - ChatGPT 风格 */}
			<div className="fixed bottom-0 left-0 right-0 pb-4 pt-2 bg-gradient-to-t from-white from-50% to-transparent pointer-events-none">
				<form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 pointer-events-auto">
					<div className="relative">
						<input
							type="text"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="输入任务..."
							className="w-full bg-white border border-zinc-300 rounded-2xl pl-4 pr-12 py-3 focus:outline-none focus:border-zinc-400 shadow-sm"
							disabled={isRunning}
						/>
						<button
							type="submit"
							disabled={isRunning || !input.trim()}
							className="absolute right-2 top-1/2 -translate-y-1/2 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white w-8 h-8 rounded-lg flex items-center justify-center transition"
						>
							{isRunning ? "·" : "↑"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
