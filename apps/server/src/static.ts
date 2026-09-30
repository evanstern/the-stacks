import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import type { WebRequestHandler } from "@the-stacks/shared";
import type { MiddlewareHandler } from "hono";
import type { IdentityLookup } from "./auth/identity.js";
import { createWebLoadContext } from "./web.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/**
 * Where the built web client lives at runtime, resolved from this module's
 * own location rather than the process cwd (plan D4, research R5).
 * apps/server/dist/static.js and apps/web/build/client sit in the same
 * relative position in a worktree and in the image (/app/apps/…), so
 * WORKDIR doesn't matter.
 */
const DEFAULT_CLIENT_ROOT = join(
  moduleDir,
  "..",
  "..",
  "web",
  "build",
  "client",
);

/** The SSR entry `react-router build` writes, resolved the same way. */
const DEFAULT_SERVER_ENTRY = join(
  moduleDir,
  "..",
  "..",
  "web",
  "build",
  "server",
  "index.js",
);

// Paths that keep their existing handlers (JSON 404 included) and must
// never be shadowed by the web app's own fallback (FR-003, plan D4).
// /library joins the reserved set here (card AC #3, plan checkpoint 2).
// /ws is upgraded before Hono routing ever sees it, but listing it here
// costs nothing and documents the intent.
const RESERVED_PREFIXES = ["/health", "/api", "/auth", "/ws", "/library"];

/** Exported for dev mode (plan D7): a non-reserved request runs through Vite first. */
export function isReservedPath(path: string): boolean {
  return RESERVED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

// Loaded once, on the first non-asset request, so the server test suite and
// a server-only build can boot without a web build at all (research R5).
let cachedDefaultHandler: Promise<WebRequestHandler> | undefined;

function loadDefaultHandler(): Promise<WebRequestHandler> {
  if (!cachedDefaultHandler) {
    cachedDefaultHandler = import(DEFAULT_SERVER_ENTRY).then(
      (mod) => mod.handle as WebRequestHandler,
    );
  }
  return cachedDefaultHandler;
}

export interface CreateWebMiddlewareOptions {
  /** Override for the web client's static root — tests point this at a fixture. */
  clientRoot?: string;
  /** Override for the SSR handler loader — tests inject a fake. */
  handler?: () => Promise<WebRequestHandler>;
  lookup: IdentityLookup;
}

/**
 * Serves the built web client's static assets, then hands an unmatched
 * non-reserved request to the React Router SSR handler (plan D4). Mount
 * LAST in app.ts, after /health, /api/echo, /auth, and /library — see
 * plan D4 for why order is what makes FR-003 hold.
 */
export function createWebMiddleware({
  clientRoot = DEFAULT_CLIENT_ROOT,
  handler = loadDefaultHandler,
  lookup,
}: CreateWebMiddlewareOptions): MiddlewareHandler {
  const serve = serveStatic({ root: clientRoot });

  return async (c, next) => {
    // Never touch reserved paths — let them fall through to their own
    // routes (already registered earlier) or to the global JSON 404.
    if (isReservedPath(c.req.path)) return next();

    // Real static assets (hashed JS/CSS, etc.) are served as-is. serveStatic
    // resolves to the Response when it finds a file, or to whatever its
    // "next" returns when it doesn't — a dummy next resolving to `undefined`
    // makes the two cases distinguishable without relying on `c.finalized`,
    // which only reflects the *outer* dispatch's assignment to `c.res`, not
    // a Response returned by a middleware called directly like this.
    const asset = await serve(c, async () => undefined);
    if (asset) return asset;

    // No static file matched: hand the request to React Router's own SSR
    // handler, which renders the matching route or its own 404 (plan D4 —
    // an unknown non-reserved path is no longer a 200 shell).
    const handle = await handler();
    return handle(c.req.raw, createWebLoadContext(c, lookup));
  };
}
