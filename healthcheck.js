// Docker healthcheck for the `app` service. GET /health always returns
// HTTP 200 by contract (specs/002-compose-stack/contracts/healthcheck.md) —
// a status-code-only check would report a database-down container as
// healthy. This parses the body and exits 0 only when status is "ok".
// Uses Node's built-in http module: node:22-alpine has no curl/jq, and the
// runtime already has Node.
"use strict";
const http = require("node:http");

const port = process.env.APP_PORT || 3000;
const req = http.get(
  { host: "127.0.0.1", port, path: "/health", timeout: 2000 },
  (res) => {
    let body = "";
    res.on("data", (chunk) => {
      body += chunk;
    });
    res.on("end", () => {
      try {
        process.exit(JSON.parse(body).status === "ok" ? 0 : 1);
      } catch {
        process.exit(1);
      }
    });
  },
);
req.on("error", () => process.exit(1));
req.on("timeout", () => {
  req.destroy();
  process.exit(1);
});
