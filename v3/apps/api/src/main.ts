import { resolveModelRole } from "@stacks/core";
import { createDbClient, runMigrations } from "@stacks/db";

import { buildApp } from "./app";

const REQUIRED_ENV_VARS = ["OPERATOR_PASSWORD_HASH", "SESSION_SECRET", "DATABASE_URL"];

function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

async function main(): Promise<void> {
  assertRequiredEnv();
  // Fails fast (naming the variable) if the embedding role's env is missing/malformed.
  resolveModelRole("embedding");

  const { db, pool } = createDbClient(process.env.DATABASE_URL!);

  // Migrations apply before the port binds — /ready therefore implies
  // schema-current (research R10, FR-002).
  await runMigrations(db);

  const app = buildApp({ pool });

  const port = Number.parseInt(process.env.V3_API_PORT ?? "4401", 10);
  await app.listen({ host: "0.0.0.0", port });
}

main().catch((error) => {
  console.error("API failed to start:", error);
  process.exit(1);
});
