/**
 * Session 管理 - 全局单例
 */

export type SessionMessage = {
	role: "user" | "assistant";
	content: string; // 纯文本，不存图片
};

export type Session = {
	id: string;
	deviceId: string;
	messages: SessionMessage[];
	abortController: AbortController; // 可变，用于取消后重建
	createdAt: Date;
};

// 全局单例
let currentSession: Session | null = null;

const genId = () => Math.random().toString(36).slice(2, 10);

/**
 * 创建新会话（自动关闭旧的）
 */
export const createSession = (deviceId: string): Session => {
	// 关闭旧会话
	if (currentSession) {
		currentSession.abortController.abort();
		currentSession = null;
	}

	const session: Session = {
		id: genId(),
		deviceId,
		messages: [],
		abortController: new AbortController(),
		createdAt: new Date(),
	};

	currentSession = session;
	return session;
};

/**
 * 关闭当前会话
 */
export const closeSession = (): void => {
	if (currentSession) {
		currentSession.abortController.abort();
		currentSession = null;
	}
};

/**
 * 获取当前会话
 */
export const getSession = (): Session | null => {
	return currentSession;
};

/**
 * 追加用户消息
 */
export const appendUserMessage = (content: string): void => {
	if (!currentSession) return;
	currentSession.messages.push({ role: "user", content });
};

/**
 * 追加助手消息
 */
export const appendAssistantMessage = (content: string): void => {
	if (!currentSession) return;
	currentSession.messages.push({ role: "assistant", content });
};

/**
 * 获取历史消息（供 agent 使用）
 */
export const getHistoryMessages = (): SessionMessage[] => {
	if (!currentSession) return [];
	return [...currentSession.messages];
};
