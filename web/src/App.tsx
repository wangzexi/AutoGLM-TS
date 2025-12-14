import { useState } from "react";
import type { AppContextType, Device, Message } from "./contexts/AppContext";
import { AppContext } from "./contexts/AppContext";
import { DeviceSelector } from "./components/DeviceSelector";
import { ChatContainer } from "./components/ChatContainer";
import { X } from "lucide-react";

export default function App() {
	const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [enlargedScreenshot, setEnlargedScreenshot] = useState<string | null>(null);

	const contextValue: AppContextType = {
		selectedDevice,
		setSelectedDevice,
		messages,
		setMessages,
		isRunning,
		setIsRunning,
		enlargedScreenshot,
		setEnlargedScreenshot,
	};

	const handleBack = () => {
		setSelectedDevice(null);
		setMessages([]);
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
