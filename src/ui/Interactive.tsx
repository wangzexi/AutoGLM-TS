import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { PhoneAgent } from "../phone-agent/agent.js";

interface Props {
	args: any;
	devices: any[];
}

export const Interactive: React.FC<Props> = ({ args, devices }) => {
	const [input, setInput] = useState("");
	const [agent, setAgent] = useState<PhoneAgent | null>(null);
	const [output, setOutput] = useState<string[]>([]);
	const [running, setRunning] = useState(false);
	const [historyIndex, setHistoryIndex] = useState(-1);

	useEffect(() => {
		const phoneAgent = new PhoneAgent(
			{
				baseUrl: args.baseUrl,
				modelName: args.model,
				apiKey: args.apikey,
			},
			{
				maxSteps: args.maxSteps,
				deviceId: args.deviceId || devices[0]?.deviceId,
				verbose: !args.quiet,
			}
		);

		setAgent(phoneAgent);

		if (args.task) {
			execute(args.task);
		}
	}, []);

	const execute = async (task: string) => {
		if (!agent || running) return;

		setRunning(true);
		setOutput((prev) => [...prev, `➜ ${task}`]);

		try {
			const result = await agent.run(task);
			setOutput((prev) => [...prev, result, ""]);
			setInput("");
			agent.reset();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			setOutput((prev) => [...prev, `❌ ${msg}`, ""]);
		} finally {
			setRunning(false);
		}
	};

	useInput((input, key) => {
		if (key.escape) {
			process.exit(0);
		}

		if (key.return && !running && input) {
			execute(input);
			setInput("");
			setHistoryIndex(-1);
		} else if (key.return && !running && !input) {
			const lastIndex = output.length - 1;
			if (lastIndex >= 0) {
				const lastCommand = output[lastIndex].replace(/^➜ /, "");
				setInput(lastCommand);
				setHistoryIndex(lastIndex);
			}
		} else if (key.backspace) {
			setInput((prev) => prev.slice(0, -1));
		} else if (!running && key.ctrl && key.u) {
			setInput("");
		} else if (!running && input && input.length === 1) {
			setInput((prev) => prev + input);
		}
	});

	return (
		<Box flexDirection="column" marginTop={3}>
			<Box
				borderStyle="round"
				borderColor="cyan"
				padding={1}
				flexDirection="column"
				height={20}
			>
				<Text bold color="cyan">
					Interactive Mode
				</Text>
				<Text color="gray" fontSize={8}>
					Press ESC to quit | Type "quit" to exit
				</Text>

				<Box flexDirection="column" marginTop={1} flexGrow={1}>
					{output.length === 0 ? (
						<Text color="gray" italic>
							Ready. Enter your task...
						</Text>
					) : (
						<Box flexDirection="column" overflow="hidden">
							{output.slice(-12).map((line, idx) => (
								<Text key={`${idx}-${line}`} fontSize={9}>
									{line}
								</Text>
							))}
						</Box>
					)}
				</Box>
			</Box>

			<Box marginTop={1}>
				<Text color="cyan">➜ {input || (running ? "Running..." : "Enter task...")}</Text>
			</Box>
		</Box>
	);
};
