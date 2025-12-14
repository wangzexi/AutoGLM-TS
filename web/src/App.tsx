import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Home, ImageDown, LayoutGrid } from "lucide-react";

type Message =
	| { role: "user"; content: string }
	| { role: "assistant"; thinking: string; action?: Record<string, unknown>; screenshot?: string; finished?: boolean; message?: string };

type Device = {
	deviceId: string;
	status: string;
	model?: string;
	brand?: string;
	marketName?: string;
	androidVersion?: string;
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
	const [screenSize, setScreenSize] = useState<{ width: number; height: number } | null>(null);
	const [enlargedScreenshot, setEnlargedScreenshot] = useState<string | null>(null);
	const [isComposing, setIsComposing] = useState(false);
	const tempInputRef = useRef("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const dragStartRef = useRef<{ x: number; y: number } | null>(null);

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

	// 轮询刷新截图
	const { data: liveScreenshotData } = useQuery({
		queryKey: ["screenshot", selectedDevice?.deviceId],
		queryFn: async () => {
			const res = await fetch("/rpc/device/screenshot", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ json: { deviceId: selectedDevice!.deviceId } }),
			});
			const data = await res.json();
			return data.json?.screenshot as string | undefined;
		},
		enabled: Boolean(selectedDevice),
		refetchInterval: 500,
	});

	// 设备操作 mutations（必须在条件返回之前）
	const rpc = (path: string, json: Record<string, unknown>) =>
		fetch(`/rpc/${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ json }),
		});

	const homeMutation = useMutation({
		mutationFn: () => rpc("device/home", { deviceId: selectedDevice?.deviceId }),
	});

	const recentMutation = useMutation({
		mutationFn: () => rpc("device/recent", { deviceId: selectedDevice?.deviceId }),
	});

	const tapMutation = useMutation({
		mutationFn: (p: { x: number; y: number }) => rpc("device/tap", { deviceId: selectedDevice?.deviceId, ...p }),
	});

	const swipeMutation = useMutation({
		mutationFn: (p: { x1: number; y1: number; x2: number; y2: number }) => rpc("device/swipe", { deviceId: selectedDevice?.deviceId, ...p }),
	});

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey && !isComposing) {
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
						if (data.type === "thinking") {
							// 收到截图，先显示"思考中"状态
							setMessages((prev) => [
								...prev,
								{
									role: "assistant",
									thinking: "",
									screenshot: data.screenshot,
								},
							]);
						} else if (data.type === "step") {
							const step = data.step;
							// 更新最后一条消息（thinking 阶段添加的）
							setMessages((prev) => {
								const updated = [...prev];
								const last = updated[updated.length - 1];
								if (last?.role === "assistant" && !last.thinking) {
									// 替换最后一条
									updated[updated.length - 1] = {
										role: "assistant",
										thinking: step.thinking,
										action: step.action,
										screenshot: step.screenshot,
										finished: step.finished,
										message: step.message,
									};
								} else {
									// 兜底：直接添加
									updated.push({
										role: "assistant",
										thinking: step.thinking,
										action: step.action,
										screenshot: step.screenshot,
										finished: step.finished,
										message: step.message,
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
				<div className="max-w-4xl mx-auto text-center">
					<h1 className="text-2xl font-medium mb-2">AutoGLM</h1>
					<p className="text-zinc-500 mb-8">选择要操作的设备</p>

					{devices.length === 0 ? (
						<div className="text-center py-20 text-zinc-400">
							<div className="text-5xl mb-4">📱</div>
							<p>未检测到设备</p>
							<p className="text-sm mt-2">请连接 Android 设备并开启 USB 调试</p>
						</div>
					) : (
						<div className="flex flex-wrap justify-center gap-4">
							{devices.map((device) => (
								<button
									key={device.deviceId}
									onClick={() => setSelectedDevice(device)}
									className="bg-zinc-100 rounded-2xl p-3 hover:bg-zinc-200 transition text-left"
								>
									{device.screenshot ? (
										<div className="h-[60vh] flex items-center justify-center">
											<img
												src={`data:image/png;base64,${device.screenshot}`}
												alt={device.model || device.deviceId}
												className="max-h-full max-w-full object-contain rounded-xl"
											/>
										</div>
									) : (
										<div className="h-[60vh] bg-zinc-300 rounded-xl flex items-center justify-center text-zinc-500">
											无法获取截图
										</div>
									)}
									<div className="mt-2 px-1 text-center">
										<div className="font-medium truncate">
											{device.marketName || device.model || device.deviceId}
										</div>
										<div className="text-xs text-zinc-500">
											{device.androidVersion ? `Android ${device.androidVersion}` : device.brand}
										</div>
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		);
	}

	// 获取最新截图（最后一条有截图的消息，或设备初始截图）
	const latestScreenshot = [...messages].reverse().find((m): m is Extract<Message, { role: "assistant" }> => m.role === "assistant" && Boolean(m.screenshot))?.screenshot || selectedDevice.screenshot;

	// 实际显示的截图（优先用轮询的实时截图）
	const displayScreenshot = liveScreenshotData || latestScreenshot;

	const handleDownloadScreenshot = () => {
		if (!displayScreenshot) return;
		const link = document.createElement("a");
		link.href = `data:image/png;base64,${displayScreenshot}`;
		link.download = `screenshot-${Date.now()}.png`;
		link.click();
	};

	// 计算点击坐标（相对于手机屏幕实际分辨率）
	const getPhoneCoords = (e: React.MouseEvent<HTMLImageElement> | MouseEvent) => {
		if (!imgRef.current || !screenSize) return null;
		const rect = imgRef.current.getBoundingClientRect();
		const x = Math.round(((e.clientX - rect.left) / rect.width) * screenSize.width);
		const y = Math.round(((e.clientY - rect.top) / rect.height) * screenSize.height);
		return { x, y };
	};

	const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
		const coords = getPhoneCoords(e);
		if (!coords) return;
		dragStartRef.current = coords;
	};

	const handleMouseUp = (e: React.MouseEvent<HTMLImageElement>) => {
		const endCoords = getPhoneCoords(e);
		const startCoords = dragStartRef.current;
		dragStartRef.current = null;

		if (!startCoords || !endCoords) return;

		const dx = Math.abs(endCoords.x - startCoords.x);
		const dy = Math.abs(endCoords.y - startCoords.y);

		if (dx < 10 && dy < 10) {
			tapMutation.mutate(startCoords);
		} else {
			swipeMutation.mutate({ x1: startCoords.x, y1: startCoords.y, x2: endCoords.x, y2: endCoords.y });
		}
	};

	const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
		const img = e.currentTarget;
		setScreenSize({ width: img.naturalWidth, height: img.naturalHeight });
	};

	// 对话页面：左侧聊天，右侧手机预览
	return (
		<div className="min-h-screen bg-white text-zinc-900 flex">
			{/* 左侧聊天区域 */}
			<div className="flex-1 flex flex-col min-w-0">
				{/* 消息区域 */}
				<div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-6">
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
								{msg.screenshot && (
									<img
										src={`data:image/png;base64,${msg.screenshot}`}
										alt={`Step ${i}`}
										className="w-24 rounded-lg shadow border border-zinc-200 cursor-pointer hover:opacity-80 transition"
										onClick={() => setEnlargedScreenshot(msg.screenshot!)}
									/>
								)}
								{msg.thinking ? (
									<p className="text-zinc-700 whitespace-pre-wrap">{msg.thinking}</p>
								) : (
									<div className="text-zinc-500">
										<span className="inline-block animate-pulse">思考中</span>
										<span className="inline-block w-0.5 h-4 bg-zinc-500 ml-1 animate-blink align-middle" />
									</div>
								)}
								{msg.action && (
									<div className="text-sm">
										{msg.action.action === "finish" ? (
											<span className="text-green-600">✅ {String(msg.action.message || "完成")}</span>
										) : msg.action.action === "Take_over" ? (
											<div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700">
												🖐️ 需要接管: {String(msg.action.message || "请手动操作")}
											</div>
										) : msg.message?.startsWith("⚠️") ? (
											<div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700">
												{msg.message}
											</div>
										) : (
											<span className="text-blue-600">
												🎯 {String(msg.action.action)}
												<span className="text-zinc-500 ml-2">
													{JSON.stringify(
														Object.fromEntries(
															Object.entries(msg.action).filter(([k]) => k !== "action")
														)
													)}
												</span>
											</span>
										)}
									</div>
								)}
							</div>
						)
					)}

					<div ref={messagesEndRef} />
				</div>

				{/* 输入区域 */}
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
							{(
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
							)}
						</div>
					</form>
				</div>
			</div>

			{/* 右侧手机预览 */}
			<div className="w-80 flex-shrink-0 border-l border-zinc-100 bg-zinc-50 p-4 sticky top-0 h-screen flex items-center justify-center">
				<div className="relative group">
					<div className="absolute -top-10 left-0 right-0 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
						<span className="text-sm text-zinc-500 truncate max-w-[140px]">
							{selectedDevice?.marketName || selectedDevice?.model || selectedDevice?.deviceId}
						</span>
						<div className="flex gap-2">
							<button
								onClick={() => recentMutation.mutate()}
								className="w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
								title="多任务"
							>
								<LayoutGrid size={16} />
							</button>
							<button
								onClick={() => homeMutation.mutate()}
								className="w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
								title="返回主屏幕"
							>
								<Home size={16} />
							</button>
							<button
								onClick={handleDownloadScreenshot}
								className="w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
								title="保存截图"
							>
								<ImageDown size={16} />
							</button>
							<button
								onClick={handleBack}
								className="w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
								title="关闭"
							>
								<X size={18} />
							</button>
						</div>
					</div>
					{displayScreenshot ? (
						<img
							ref={imgRef}
							src={`data:image/png;base64,${displayScreenshot}`}
							alt="Phone Screen"
							className="max-w-full h-auto object-contain rounded-xl shadow-lg select-none"
							style={{ maxHeight: "calc(100vh - 4rem)" }}
							draggable={false}
							onLoad={handleImgLoad}
							onMouseDown={handleMouseDown}
							onMouseUp={handleMouseUp}
						/>
					) : (
						<div className="text-zinc-400 text-center">
							<div className="text-4xl mb-2">📱</div>
							<p className="text-sm">等待截图...</p>
						</div>
					)}
				</div>
			</div>

			{/* 截图放大弹窗 */}
			{enlargedScreenshot && (
				<div
					className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
					onClick={() => setEnlargedScreenshot(null)}
				>
					<img
						src={`data:image/png;base64,${enlargedScreenshot}`}
						alt="Enlarged screenshot"
						className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					/>
					<button
						onClick={() => setEnlargedScreenshot(null)}
						className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center"
					>
						<X size={24} />
					</button>
				</div>
			)}
		</div>
	);
}
