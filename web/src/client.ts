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
    create: (input: any) => rpcFetch("/session/create", input),
    close: () => rpcFetch("/session/close"),
    get: () => rpcFetch("/session/get"),
  },
  device: {
    list: () => rpcFetch("/device/list"),
    home: (input: any) => rpcFetch("/device/home", input),
    recent: (input: any) => rpcFetch("/device/recent", input),
    screenshot: (input: any) => rpcFetch("/device/screenshot", input),
    tap: (input: any) => rpcFetch("/device/tap", input),
    swipe: (input: any) => rpcFetch("/device/swipe", input),
  },
  task: {
    start: (input: any) => fetch("/rpc/task/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: input }),
    }),
    cancel: () => rpcFetch("/task/cancel"),
  },
  config: {
    get: () => rpcFetch("/config/get"),
  },
};
