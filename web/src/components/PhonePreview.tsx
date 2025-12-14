import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Home, ImageDown, LayoutGrid } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

async function rpc(path: string, json: Record<string, unknown>) {
	return fetch(`/rpc/${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ json }),
	});
}

type PhonePreviewProps = {
	onBack: () => void;
	latestScreenshot: string | undefined;
};

export function PhonePreview({ onBack, latestScreenshot }: PhonePreviewProps) {
	const { selectedDevice } = useAppContext();
	const [screenSize, setScreenSize] = useState<{ width: number; height: number } | null>(null);
	const [dragStartRef, setDragStartRef] = useState<{ x: number; y: number } | null>(null);
	const imgRef = useRef<HTMLImageElement>(null);

	const { data: liveScreenshotData } = useQuery({
		queryKey: ["screenshot", selectedDevice?.deviceId],
		queryFn: async () => {
			const res = await rpc("device/screenshot", { deviceId: selectedDevice!.deviceId });
			const data = await res.json();
			return data.json?.screenshot as string | undefined;
		},
		enabled: Boolean(selectedDevice),
		refetchInterval: 500,
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
		mutationFn: (p: { x1: number; y1: number; x2: number; y2: number }) =>
			rpc("device/swipe", { deviceId: selectedDevice?.deviceId, ...p }),
	});

	const displayScreenshot = liveScreenshotData || latestScreenshot;

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
		setDragStartRef(coords);
	};

	const handleMouseUp = (e: React.MouseEvent<HTMLImageElement>) => {
		const endCoords = getPhoneCoords(e);
		const startCoords = dragStartRef;
		setDragStartRef(null);

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

	const handleDownloadScreenshot = () => {
		if (!displayScreenshot) return;
		const link = document.createElement("a");
		link.href = `data:image/png;base64,${displayScreenshot}`;
		link.download = `screenshot-${Date.now()}.png`;
		link.click();
	};

	return (
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
							onClick={onBack}
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
	);
}
