/**
 * Vitest config — deliberately separate from vite.config.ts so tests don't
 * load the React Router framework plugin (it assumes a full app build).
 * Only tsconfigPaths is shared, so "~/*" imports resolve in tests too.
 *
 * environment is happy-dom, NOT jsdom, and that choice is load-bearing:
 * RR7's client runtime constructs Request/AbortSignal objects, and jsdom's
 * realm-separated globals fail RR7's instanceof/brand checks (a real
 * cross-realm bug hit during this feature). happy-dom shares Node's
 * fetch primitives, so those checks pass.
 */
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    globals: true,
  },
});
