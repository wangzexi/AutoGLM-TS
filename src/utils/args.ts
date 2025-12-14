export interface Args {
	baseUrl?: string;
	model?: string;
	apikey?: string;
	maxSteps?: number;
	deviceId?: string;
	connect?: string;
	disconnect?: string;
	listDevices?: boolean;
	enableTcpip?: number;
	quiet?: boolean;
	listApps?: boolean;
	task?: string;
}

export const parseArgs = (): Args => {
	const env = process.env;
	const args: Args = {};

	for (let i = 2; i < process.argv.length; i++) {
		const [key, value] = [process.argv[i], process.argv[i + 1]];

		switch (key) {
			case "--base-url":
				args.baseUrl = value;
				i++;
				break;
			case "--model":
				args.model = value;
				i++;
				break;
			case "--apikey":
				args.apikey = value;
				i++;
				break;
			case "--max-steps":
				args.maxSteps = parseInt(value);
				i++;
				break;
			case "--device-id":
			case "-d":
				args.deviceId = value;
				i++;
				break;
			case "--connect":
			case "-c":
				args.connect = value;
				i++;
				break;
			case "--disconnect":
				args.disconnect = value || "all";
				i++;
				break;
			case "--list-devices":
				args.listDevices = true;
				break;
			case "--enable-tcpip":
				args.enableTcpip = parseInt(value) || 5555;
				i++;
				break;
			case "--quiet":
			case "-q":
				args.quiet = true;
				break;
			case "--list-apps":
				args.listApps = true;
				break;
			default:
				if (!key.startsWith("-")) args.task = key;
		}
	}

	return {
		baseUrl: args.baseUrl || env.PHONE_AGENT_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
		model: args.model || env.PHONE_AGENT_MODEL || "autoglm-phone",
		apikey: args.apikey || env.PHONE_AGENT_API_KEY || "EMPTY",
		maxSteps: args.maxSteps || parseInt(env.PHONE_AGENT_MAX_STEPS || "100"),
		deviceId: args.deviceId || env.PHONE_AGENT_DEVICE_ID,
		...args,
	};
};
