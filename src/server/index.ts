/**
 * HTTP Server - Hono + oRPC + 静态文件服务
 */

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { router } from "./router.ts";

const app = new Hono();

// oRPC Handler
const rpcHandler = new RPCHandler(router);

// API 路由
app.use("/rpc/*", async (c) => {
  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: {},
  });
  if (matched) {
    return new Response(response.body, response);
  }
  return c.notFound();
});

// 静态文件服务
app.use("/*", serveStatic({ root: "./web/dist" }));

// SPA fallback
app.use("/*", serveStatic({ root: "./web/dist", path: "index.html" }));

// 创建服务器
export function createWebServer(port = 3000) {
  let server: ReturnType<typeof serve> | undefined;

  return {
    start: () =>
      new Promise<void>((resolve) => {
        server = serve(
          { fetch: app.fetch, port, hostname: "127.0.0.1" },
          () => {
            console.log(`🌐 Web UI: http://localhost:${port}`);
            resolve();
          },
        );
      }),
    stop: () =>
      new Promise<void>((resolve) => {
        server?.close(() => resolve());
      }),
  };
}
