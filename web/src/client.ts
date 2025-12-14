// biome-ignore lint/suspicious/noExplicitAny: RPC client uses dynamic types
async function rpcFetch(path: string, input?: any) {
  const res = await fetch(`/rpc${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json();
  return data.json;
}

export const client = {
  session: {
    // biome-ignore lint/suspicious/noExplicitAny: RPC client
    create: (input: any) => rpcFetch("/session/create", input),
    close: () => rpcFetch("/session/close"),
    get: () => rpcFetch("/session/get"),
  },
  device: {
    list: () => rpcFetch("/device/list"),
    // biome-ignore lint/suspicious/noExplicitAny: RPC client
    home: (input: any) => rpcFetch("/device/home", input),
    // biome-ignore lint/suspicious/noExplicitAny: RPC client
    recent: (input: any) => rpcFetch("/device/recent", input),
    // biome-ignore lint/suspicious/noExplicitAny: RPC client
    screenshot: (input: any) => rpcFetch("/device/screenshot", input),
    // biome-ignore lint/suspicious/noExplicitAny: RPC client
    tap: (input: any) => rpcFetch("/device/tap", input),
    // biome-ignore lint/suspicious/noExplicitAny: RPC client
    swipe: (input: any) => rpcFetch("/device/swipe", input),
  },
  task: {
    // biome-ignore lint/suspicious/noExplicitAny: RPC client
    start: (input: any) =>
      fetch("/rpc/task/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: input }),
      }),
    cancel: () => rpcFetch("/task/cancel"),
  },
  config: {
    get: () => rpcFetch("/config/get"),
  },
  skill: {
    generate: () => rpcFetch("/skill/generate"),
  },
};
