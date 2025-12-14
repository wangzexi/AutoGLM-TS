import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { execSync } from "child_process";

interface Props {
	onCheck: (status: { adb: boolean; device: boolean; keyboard: boolean }) => void;
}

export const SystemCheck: React.FC<Props> = ({ onCheck }) => {
	const [checks, setChecks] = useState([
		{ id: "adb", name: "ADB", status: "pending" },
		{ id: "device", name: "Device", status: "pending" },
		{ id: "keyboard", name: "Keyboard", status: "pending" },
	]);

	useEffect(() => {
		runChecks();
	}, []);

	const runChecks = async () => {
		const results = { adb: false, device: false, keyboard: false };

		for (const check of checks) {
			setChecks((prev) =>
				prev.map((c) =>
					c.id === check.id ? { ...c, status: "running" } : c
				)
			);

			try {
				switch (check.id) {
					case "adb":
						execSync("adb version", { timeout: 10000 });
						results.adb = true;
						break;

					case "device":
						const output = execSync("adb devices", {
							encoding: "utf-8",
							timeout: 10000,
						});
						const devices = output
							.trim()
							.split("\n")
							.slice(1)
							.filter((line) => line.includes("\tdevice"));
						results.device = devices.length > 0;
						break;

					case "keyboard":
						const result = execSync("adb shell ime list -s", {
							encoding: "utf-8",
							timeout: 10000,
						});
						results.keyboard = result
							.toString()
							.includes("com.android.adbkeyboard/.AdbIME");
						break;
				}

				setChecks((prev) =>
					prev.map((c) =>
						c.id === check.id ? { ...c, status: "success" } : c
					)
				);
			} catch {
				setChecks((prev) =>
					prev.map((c) =>
						c.id === check.id ? { ...c, status: "error" } : c
					)
				);
			}

			await new Promise((r) => setTimeout(r, 300));
		}

		setTimeout(() => onCheck(results), 500);
	};

	return (
		<Box flexDirection="column" marginTop={3}>
			<Text bold>System Check</Text>
			<Box flexDirection="column" marginTop={2}>
				{checks.map((check) => (
					<Box key={check.id}>
						<Text width={40}>
							{check.status === "running" && "⟳"}
							{check.status === "success" && "✅"}
							{check.status === "error" && "❌"}
							{check.status === "pending" && "⏳"}
							{"  "}
							<Text
								color={
									check.status === "error"
										? "red"
										: check.status === "success"
										? "green"
										: "gray"
								}
							>
								{check.name}
							</Text>
						</Text>
					</Box>
				))}
			</Box>
		</Box>
	);
};
