import { useQuery } from "@tanstack/react-query";
import type { Device } from "../contexts/AppContext";
import { useAppContext } from "../contexts/AppContext";

async function fetchDevices(): Promise<Device[]> {
	const res = await fetch("/rpc/device/list", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ json: {} }),
	});
	const data = await res.json();
	return data.json || [];
}

export function DeviceSelector() {
	const { setSelectedDevice } = useAppContext();
	const { data: devices = [] } = useQuery({
		queryKey: ["devices"],
		queryFn: fetchDevices,
		refetchInterval: 1000,
	});

	return (
		<div className="min-h-screen bg-white text-zinc-900 flex items-center justify-center p-8">
			<div className="max-w-4xl w-full text-center">
				{devices.length === 0 ? (
					<div className="text-center py-20 text-zinc-400">
						<div className="text-5xl mb-4">📱</div>
						<p>未检测到设备</p>
						<p className="text-sm mt-2">请连接 Android 设备并开启 USB 调试</p>
					</div>
				) : (
					<>
						<p className="text-zinc-500 mb-8">选择要操作的设备</p>
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
					</>
				)}
			</div>
		</div>
	);
}
