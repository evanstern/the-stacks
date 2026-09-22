import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabaseProbe } from "./db.js";

const config = loadConfig();
const app = createApp({
  databaseProbe: createDatabaseProbe(config.databaseUrl),
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Server listening on port ${info.port}`);
});
