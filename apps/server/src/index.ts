import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Server listening on port ${info.port}`);
});
