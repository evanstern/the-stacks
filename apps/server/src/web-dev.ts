import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WebRequestHandler } from "@the-stacks/shared";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** apps/web, resolved from this module's own location (plan D7, static.ts's pattern). */
const WEB_ROOT = join(moduleDir, "..", "..", "web");

/** Connect middleware shape (vite's `ViteDevServer.middlewares`), typed locally
 * so this file needs no non-`import type` reference to "vite" (plan D7: dev-only). */
export type Middlewares = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;

export interface WebDev {
  /** Re-imports the SSR entry per call, so a route edit takes effect on the next request. */
  handler: () => Promise<WebRequestHandler>;
  /** Serves `/@vite/*`, module requests, and CSS; falls through to Hono via `next()`. */
  middlewares: Middlewares;
}

/**
 * Vite in middleware mode, inside this process (plan D7, research R8): loaders
 * get the same load context as production. Dev-only — call only behind
 * STACKS_WEB_DEV, and only via a dynamic `import("./web-dev.js")`, never a
 * static one, so production never pulls in `vite`.
 */
export async function createWebDev(): Promise<WebDev> {
  const { createServer } = await import("vite");
  const hmrPort = Number(process.env.WEB_HMR_PORT) || 24678;
  const vite = await createServer({
    root: WEB_ROOT,
    appType: "custom",
    server: { middlewareMode: true, hmr: { port: hmrPort } },
  });
  return {
    handler: async () => (await vite.ssrLoadModule("/server.ts")).handle,
    middlewares: vite.middlewares as Middlewares,
  };
}
