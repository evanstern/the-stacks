import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./app", import.meta.url).pathname,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: ["vm-104.tailb3c1b6.ts.net", "thestacks.ikis.ai"],
    proxy: {
      "/records": {
        target: "http://api:8000",
        changeOrigin: true,
        bypass: (request) => {
          const url = request.url ?? "";
          if (/^\/records\/sources\/[^/]+\/archive\//.test(url)) {
            return undefined;
          }
          return "/index.html";
        },
      },
    },
  },
});
