/**
 * React Router 7 framework-mode config. ssr: true is load-bearing, not a
 * default worth trimming: the whole architecture (FR-019 / research R9)
 * depends on loaders/actions running on the server so the browser never
 * calls the API. Switching to SPA mode would move loaders into the browser
 * and break the web→api seam in lib/api.server.ts.
 */
import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
} satisfies Config;
