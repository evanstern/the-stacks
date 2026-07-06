/**
 * Vite config for dev + production builds (vitest has its own config —
 * see vitest.config.ts for why). Three plugins, each pulling its weight:
 * Tailwind v4's Vite plugin (no tailwind.config.js — theme lives in
 * app.css), the RR7 framework plugin (routing, SSR build, .server.ts
 * stripping), and tsconfig paths so the "~/*" alias resolves.
 */
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
