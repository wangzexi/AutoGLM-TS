import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { SystemCheck } from "./SystemCheck.js";
import { Interactive } from "./Interactive.js";
import { DeviceList } from "./DeviceList.js";
import { execSync } from "child_process";
import { listDevices } from "../phone-agent/adb.js";

interface Props {
	args: any;
}

export const App: React.FC<Props> = ({ args }) => {
	const [step, setStep] = useState<"init" | "check" | "devices" | "main">("init");
	const [devices, setDevices] = useState<any[]>([]);
	const [systemReady, setSystemReady] = useState(false);

	useEffect(() => {
		if (args.listDevices) {
			setStep("devices");
			return;
		}

		setStep("check");
	}, []);

	const handleSystemCheck = (status: any) => {
		if (status.adb && status.device && status.keyboard) {
			setSystemReady(true);
			setDevices(listDevices());
			setStep("main");
		}
	};

	const handleDeviceList = (deviceList: any[]) => {
		setDevices(deviceList);
		if (args.task) {
			setStep("main");
		} else {
			process.exit(0);
		}
	};

	return (
		<Box flexDirection="column" padding={2}>
			<Text bold color="cyan" fontSize={24}>
				📱 AutoGLM-TS
			</Text>
			<Text color="gray">AI-powered phone automation</Text>

			{step === "check" && (
				<SystemCheck onCheck={handleSystemCheck} />
			)}

			{step === "devices" && (
				<DeviceList onSelect={handleDeviceList} />
			)}

			{step === "main" && systemReady && (
				<Interactive args={args} devices={devices} />
			)}

			{step === "init" && (
				<Box marginTop={2}>
					<Text color="gray">Loading...</Text>
				</Box>
			)}
		</Box>
	);
};
