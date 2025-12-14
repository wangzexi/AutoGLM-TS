import { useRef, useEffect } from "react";
import type { Message } from "../contexts/AppContext";
import { useAppContext } from "../contexts/AppContext";

type MessageListProps = {
	messages: Message[];
};

export function MessageList({ messages }: MessageListProps) {
	const { setEnlargedScreenshot } = useAppContext();
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	return (
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
	);
}
