import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

type Message =
	| { role: "user"; content: string }
	| { role: "assistant"; thinking: string; action?: Record<string, unknown>; screenshot?: string; finished?: boolean; message?: string };

type Device = {
	deviceId: string;
	status: string;
	model?: string;
	brand?: string;
	marketName?: string;
	screenshot?: string;
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

async function fetchDevices(): Promise<Device[]> {
	const res = await fetch("/rpc/device/list", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ json: {} }),
	});
	const data = await res.json();
	return data.json || [];
}

export default function App() {
	const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const tempInputRef = useRef("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// 轮询设备列表（仅在未选择设备时）
	const { data: devices = [] } = useQuery({
		queryKey: ["devices"],
		queryFn: fetchDevices,
		refetchInterval: selectedDevice ? false : 1000,
	});

	// 滚动到底部
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (input.trim() && !isRunning) {
				handleSubmit(e);
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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isRunning || !selectedDevice) return;

		const userMessage = input.trim();
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
				body: JSON.stringify({ json: { task: userMessage, deviceId: selectedDevice.deviceId } }),
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

	const handleBack = () => {
		setSelectedDevice(null);
		setMessages([]);
		setInput("");
	};

	// 设备选择页面
	if (!selectedDevice) {
		return (
			<div className="min-h-screen bg-white text-zinc-900 p-8">
				<div className="max-w-4xl mx-auto">
					<h1 className="text-2xl font-medium mb-2">AutoGLM</h1>
					<p className="text-zinc-500 mb-8">选择要操作的设备</p>

					{devices.length === 0 ? (
						<div className="text-center py-20 text-zinc-400">
							<div className="text-5xl mb-4">📱</div>
							<p>未检测到设备</p>
							<p className="text-sm mt-2">请连接 Android 设备并开启 USB 调试</p>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{devices.map((device) => (
								<button
									key={device.deviceId}
									onClick={() => setSelectedDevice(device)}
									className="bg-zinc-100 rounded-2xl p-3 hover:bg-zinc-200 transition text-left"
								>
									{device.screenshot ? (
										<div className="h-80 flex items-center justify-center">
											<img
												src={`data:image/png;base64,${device.screenshot}`}
												alt={device.model || device.deviceId}
												className="max-h-full max-w-full object-contain rounded-xl"
											/>
										</div>
									) : (
										<div className="h-80 bg-zinc-300 rounded-xl flex items-center justify-center text-zinc-500">
											无法获取截图
										</div>
									)}
									<div className="mt-2 px-1">
										<div className="font-medium truncate">
											{device.marketName || device.model || device.deviceId}
										</div>
										<div className="text-xs text-zinc-500">{device.brand}</div>
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		);
	}

	// 对话页面
	return (
		<div className="min-h-screen bg-white text-zinc-900">
			{/* 顶部栏 */}
			<div className="sticky top-0 bg-white/80 backdrop-blur border-b border-zinc-100 px-4 py-3">
				<div className="max-w-3xl mx-auto flex items-center gap-3">
					<button
						onClick={handleBack}
						className="text-zinc-500 hover:text-zinc-900 transition"
					>
						← 返回
					</button>
					<span className="text-zinc-900 font-medium">
						{selectedDevice.marketName || selectedDevice.model || selectedDevice.deviceId}
					</span>
				</div>
			</div>

			{/* 消息区域 */}
			<div className="max-w-3xl mx-auto px-4 pt-4 pb-32 space-y-6">
				{messages.length === 0 && (
					<div className="h-[60vh] flex items-center justify-center text-zinc-400">
						<div className="text-center">
							<div className="text-5xl mb-4">💬</div>
							<p>输入任务开始自动化操作</p>
						</div>
					</div>
				)}

				{messages.map((msg, i) =>
					msg.role === "user" ? (
						<div key={i} className="flex justify-end">
							<div className="bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] whitespace-pre-wrap">
								{msg.content}
							</div>
						</div>
					) : (
						<div key={i} className="space-y-3">
							<p className="text-zinc-700 whitespace-pre-wrap">{msg.thinking}</p>
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

			{/* 输入区域 */}
			<div className="fixed bottom-0 left-0 right-0 pb-4 pt-2 bg-gradient-to-t from-white from-50% to-transparent pointer-events-none">
				<form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 pointer-events-auto">
					<div className="bg-zinc-100 rounded-3xl px-4 pt-3 pb-2">
						<textarea
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="输入任务..."
							rows={1}
							className="w-full bg-transparent focus:outline-none resize-none text-zinc-900 placeholder-zinc-400 disabled:cursor-not-allowed"
							disabled={isRunning}
							style={{ minHeight: "24px", maxHeight: "150px" }}
							onInput={(e) => {
								const target = e.target as HTMLTextAreaElement;
								target.style.height = "auto";
								target.style.height = Math.min(target.scrollHeight, 150) + "px";
							}}
						/>
						<div className="flex items-center justify-between mt-2">
							<div className="text-zinc-400 text-xs">Shift+Enter 换行</div>
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
		</div>
	);
}
