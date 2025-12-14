/**
 * HTTP Server - 提供 oRPC API 和静态文件服务
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { RPCHandler } from "@orpc/server/node";
import { CORSPlugin } from "@orpc/server/plugins";
import { router } from "./router.ts";

const MIME_TYPES: Record<string, string> = {
	".html": "text/html",
	".js": "application/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

const WEB_DIR = join(import.meta.dirname, "../../web/dist");

// oRPC Handler
const rpcHandler = new RPCHandler(router, {
	plugins: [new CORSPlugin()],
});

// 静态文件服务
async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
	const url = new URL(req.url || "/", `http://${req.headers.host}`);
	let filePath = join(WEB_DIR, url.pathname);

	// SPA fallback
	try {
		const stats = await stat(filePath);
		if (stats.isDirectory()) {
			filePath = join(filePath, "index.html");
		}
	} catch {
		filePath = join(WEB_DIR, "index.html");
	}

	try {
		const content = await readFile(filePath);
		const ext = extname(filePath);
		res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
		res.end(content);
		return true;
	} catch {
		return false;
	}
}

// 创建服务器
export function createWebServer(port = 3000) {
	const server = createServer(async (req, res) => {
		const url = req.url || "/";

		// API 路由
		if (url.startsWith("/rpc")) {
			// 重写 URL，移除 /rpc 前缀
			req.url = url.slice(4) || "/";
			const result = await rpcHandler.handle(req, res, {
				context: {},
			});
			if (!result.matched) {
				res.statusCode = 404;
				res.end("No procedure matched");
			}
			return;
		}

		// 静态文件
		const served = await serveStatic(req, res);
		if (!served) {
			res.statusCode = 404;
			res.end("Not found");
		}
	});

	return {
		start: () => {
			return new Promise<void>((resolve) => {
				server.listen(port, "127.0.0.1", () => {
					console.log(`🌐 Web UI: http://localhost:${port}`);
					resolve();
				});
			});
		},
		stop: () => {
			return new Promise<void>((resolve) => {
				server.close(() => resolve());
			});
		},
	};
}
