import { createContext, useContext } from "react";

export type Message =
	| { role: "user"; content: string }
	| {
			role: "assistant";
			thinking: string;
			action?: Record<string, unknown>;
			screenshot?: string;
			finished?: boolean;
			message?: string;
	  };

export type Device = {
	deviceId: string;
	status: string;
	model?: string;
	brand?: string;
	marketName?: string;
	androidVersion?: string;
	screenshot?: string;
};

export type AppContextType = {
	selectedDevice: Device | null;
	setSelectedDevice: (device: Device | null) => void;
	messages: Message[];
	setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
	isRunning: boolean;
	setIsRunning: (running: boolean) => void;
	enlargedScreenshot: string | null;
	setEnlargedScreenshot: (screenshot: string | null) => void;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function useAppContext() {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error("useAppContext must be used within AppProvider");
	}
	return context;
}
