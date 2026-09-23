import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import type { MiddlewareHandler } from "hono";

/**
 * Where the built SPA lives at runtime, resolved from this module's own
 * location rather than the process cwd (plan D1). The Dockerfile sets
 * WORKDIR /app/apps/server before CMD, so cwd is not the repo root — but
 * this file's compiled location (apps/server/dist/static.js) is fixed
 * relative to apps/server/public, where the Dockerfile copies the client
 * build output.
 */
const DEFAULT_CLIENT_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);

// Paths that keep their existing handlers (JSON 404 included) and must
// never be shadowed by the SPA shell fallback (FR-003, plan D2). /ws is
// upgraded before Hono routing ever sees it, but listing it here costs
// nothing and documents the intent.
const RESERVED_PREFIXES = ["/health", "/api", "/auth", "/ws"];

function isReservedPath(path: string): boolean {
  return RESERVED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Serves the built SPA's static assets, and falls back to its index.html
 * shell for unmatched non-API paths so client-side routes survive a direct
 * load or reload (FR-002). Mount LAST in app.ts, after /health, /api/echo,
 * and /auth — see plan D2 for why order is what makes FR-003 hold.
 */
export function createStaticMiddleware(
  clientRoot: string = DEFAULT_CLIENT_ROOT,
): MiddlewareHandler {
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

    // Deep link / reload: no static file matched, so hand back the shell
    // and let the client router resolve the route.
    return c.html(readFileSync(join(clientRoot, "index.html"), "utf-8"));
  };
}
