import { useState, useEffect } from "react";
import type { AppContextType, Device, Message, SessionMessage } from "./contexts/AppContext";
import { AppContext } from "./contexts/AppContext";
import { DeviceSelector } from "./components/DeviceSelector";
import { ChatContainer } from "./components/ChatContainer";
import { X } from "lucide-react";

// Session API
async function rpc(path: string, json: Record<string, unknown> = {}) {
	const res = await fetch(`/rpc/${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ json }),
	});
	return res.json();
}

export default function App() {
	const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [enlargedScreenshot, setEnlargedScreenshot] = useState<string | null>(null);
	const [model, setModel] = useState<string | null>(null);

	// 页面加载时尝试恢复 session 并获取配置
	useEffect(() => {
		// 获取模型配置
		rpc("config/get").then((data) => {
			if (data.json?.model) {
				setModel(data.json.model);
			}
		});

		rpc("session/get").then((data) => {
			const session = data.json;
			if (session) {
				// 恢复历史消息
				const restored: Message[] = session.messages.map((m: SessionMessage) =>
					m.role === "user"
						? { role: "user" as const, content: m.content }
						: { role: "assistant" as const, thinking: m.content, finished: true }
				);
				setMessages(restored);
				// 恢复设备（只设置 deviceId，其他信息从设备列表获取）
				setSelectedDevice({ deviceId: session.deviceId, status: "device" });
			}
		});
	}, []);

	// 轮询检测设备断开
	useEffect(() => {
		if (!selectedDevice) return;

		const interval = setInterval(async () => {
			const data = await rpc("session/get");
			if (!data.json) {
				// session 被销毁（设备断开）
				setSelectedDevice(null);
				setMessages([]);
			}
		}, 2000);

		return () => clearInterval(interval);
	}, [selectedDevice]);

	// 选择设备时创建 session
	const handleSelectDevice = async (device: Device) => {
		await rpc("session/create", { deviceId: device.deviceId });
		setSelectedDevice(device);
		setMessages([]);
	};

	// 关闭时销毁 session
	const handleBack = async () => {
		await rpc("session/close");
		setSelectedDevice(null);
		setMessages([]);
	};

	const contextValue: AppContextType = {
		selectedDevice,
		setSelectedDevice: handleSelectDevice,
		messages,
		setMessages,
		isRunning,
		setIsRunning,
		enlargedScreenshot,
		setEnlargedScreenshot,
		model,
		setModel,
	};

	if (!selectedDevice) {
		return (
			<AppContext.Provider value={contextValue}>
				<DeviceSelector />
			</AppContext.Provider>
		);
	}

	return (
		<AppContext.Provider value={contextValue}>
			<>
				<ChatContainer onBack={handleBack} />

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
			</>
		</AppContext.Provider>
	);
}
