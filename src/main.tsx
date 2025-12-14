#!/usr/bin/env node
import { render } from "ink";
import React from "react";
import { App } from "./ui/App.js";
import { parseArgs } from "./utils/args.js";

const args = parseArgs();

if (args.listApps) {
	import("./phone-agent/config/apps.js").then(({ listSupportedApps }) => {
		console.log("Supported apps:");
		listSupportedApps().forEach((app) => console.log(`  - ${app}`));
		process.exit(0);
	});
} else {
	render(React.createElement(App, { args }));
}
