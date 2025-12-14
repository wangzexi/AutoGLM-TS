import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { listDevices } from "../phone-agent/adb.js";

interface Props {
	onSelect: (devices: any[]) => void;
}

export const DeviceList: React.FC<Props> = ({ onSelect }) => {
	const [devices, setDevices] = useState<any[]>([]);

	useEffect(() => {
		const deviceList = listDevices();
		setDevices(deviceList);
		setTimeout(() => onSelect(deviceList), 1000);
	}, []);

	return (
		<Box flexDirection="column" marginTop={3}>
			<Text bold marginBottom={2}>
				Connected Devices
			</Text>

			{devices.length === 0 ? (
				<Text color="red">No devices connected</Text>
			) : (
				<Box flexDirection="column">
					<Box>
						<Text bold color="gray">ID</Text>
						<Text> | </Text>
						<Text bold color="gray">Status</Text>
						<Text> | </Text>
						<Text bold color="gray">Connection</Text>
					</Box>
					{devices.map((device, idx) => (
						<Box key={idx}>
							<Text width={35}>{device.deviceId}</Text>
							<Text> | </Text>
							<Text color={device.status === "device" ? "green" : "red"}>
								{device.status}
							</Text>
							<Text> | </Text>
							<Text color="gray">{device.connectionType}</Text>
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
};
