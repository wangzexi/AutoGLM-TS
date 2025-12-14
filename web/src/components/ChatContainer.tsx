import type { Message } from "../contexts/AppContext";
import { useAppContext } from "../contexts/AppContext";
import { InputBox } from "./InputBox";
import { MessageList } from "./MessageList";
import { PhonePreview } from "./PhonePreview";

type ChatContainerProps = {
	onBack: () => void;
};

export function ChatContainer({ onBack }: ChatContainerProps) {
	const { selectedDevice, messages, setMessages, setIsRunning } = useAppContext();

	const getLatestScreenshot = (): string | undefined => {
		return [...messages]
			.reverse()
			.find((m): m is Extract<Message, { role: "assistant" }> => m.role === "assistant" && Boolean(m.screenshot))
			?.screenshot || selectedDevice?.screenshot;
	};

	const handleSubmit = async (userMessage: string) => {
		setMessages([...messages, { role: "user", content: userMessage }]);
		setIsRunning(true);

		try {
			const res = await fetch("/rpc/task/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ json: { task: userMessage, deviceId: selectedDevice!.deviceId } }),
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
							setMessages([
								...messages,
								{
									role: "assistant",
									thinking: "",
									screenshot: data.screenshot,
								},
							]);
						} else if (data.type === "step") {
							const step = data.step;
							setMessages((prev: Message[]) => {
								const updated = [...prev];
								const last = updated[updated.length - 1];
								if (last?.role === "assistant" && !last.thinking) {
									updated[updated.length - 1] = {
										role: "assistant",
										thinking: step.thinking,
										action: step.action,
										screenshot: step.screenshot,
										finished: step.finished,
										message: step.message,
									};
								} else {
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
			setMessages((prev: Message[]) => [...prev, { role: "assistant", thinking: "执行出错，请重试", finished: true }]);
		} finally {
			setIsRunning(false);
		}
	};

	return (
		<div className="min-h-screen bg-white text-zinc-900 flex">
			{/* 左侧聊天区域 */}
			<div className="flex-1 flex flex-col min-w-0">
				<MessageList messages={messages} />
				<InputBox onSubmit={handleSubmit} />
			</div>

			{/* 右侧手机预览 */}
			<PhonePreview onBack={onBack} latestScreenshot={getLatestScreenshot()} />
		</div>
	);
}
