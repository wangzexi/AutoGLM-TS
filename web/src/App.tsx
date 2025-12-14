import { useState, useRef, useEffect } from "react";

type Message =
	| { role: "user"; content: string }
	| { role: "assistant"; thinking: string; action?: Record<string, unknown>; screenshot?: string; finished?: boolean; message?: string };

export default function App() {
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// 滚动到底部
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isRunning) return;

		const userMessage = input.trim();
		setInput("");
		setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
		setIsRunning(true);

		try {
			const res = await fetch("http://localhost:3000/rpc/task/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ json: { task: userMessage } }),
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
		<div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col">
			{/* 消息区域 */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.length === 0 && (
					<div className="h-full flex items-center justify-center text-zinc-600">
						<div className="text-center">
							<div className="text-6xl mb-4">📱</div>
							<p className="text-lg">AutoGLM</p>
							<p className="text-sm mt-2">输入任务开始自动化操作</p>
						</div>
					</div>
				)}

				{messages.map((msg, i) =>
					msg.role === "user" ? (
						<div key={i} className="flex justify-end">
							<div className="bg-blue-600 rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
								{msg.content}
							</div>
						</div>
					) : (
						<div key={i} className="flex justify-start">
							<div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%] space-y-3">
								{/* 思考过程 */}
								<p className="text-zinc-300 whitespace-pre-wrap">{msg.thinking}</p>

								{/* 操作 */}
								{msg.action && (
									<div className="text-sm text-blue-400 bg-zinc-900 rounded px-2 py-1">
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
										className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition"
										style={{ maxHeight: "400px" }}
										onClick={() => window.open(`data:image/png;base64,${msg.screenshot}`, "_blank")}
									/>
								)}
							</div>
						</div>
					)
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* 输入区域 */}
			<form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800">
				<div className="flex gap-2">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="输入任务，如：打开美团搜索瑞幸咖啡"
						className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-3 focus:outline-none focus:border-blue-500"
						disabled={isRunning}
					/>
					<button
						type="submit"
						disabled={isRunning || !input.trim()}
						className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 px-6 py-3 rounded-full font-medium transition"
					>
						{isRunning ? "..." : "发送"}
					</button>
				</div>
			</form>
		</div>
	);
}
