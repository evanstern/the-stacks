/**
 * API process entrypoint. Owns everything that belongs to the *process*, not
 * the app: env validation, model-role resolution, migrations, port binding.
 * buildApp (app.ts) stays pure/injectable so tests never come through here.
 *
 * Boot order is doctrine (FR-002, research R10): validate env -> resolve the
 * embedding model role -> run migrations -> listen. Each step fails fast with
 * a message naming what's missing, because a half-configured single-operator
 * deployment that limps up is worse than one that refuses to start.
 */
import { resolveModelRole } from "@stacks/core";
import { createDbClient, runMigrations } from "@stacks/db";

import { buildApp } from "./app";

// Checked before anything else so the failure message names every missing
// variable at once, instead of dying one variable per restart.
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
  // The API never embeds — the worker does — but validating here surfaces a bad
  // embedding config at deploy time instead of on the first queued run.
  resolveModelRole("embedding");

  const { db, pool } = createDbClient(process.env.DATABASE_URL!);

  // Migrations apply before the port binds — /ready therefore implies
  // schema-current (research R10, FR-002).
  await runMigrations(db);

  const app = await buildApp({
    db,
    pool,
    operatorPasswordHash: process.env.OPERATOR_PASSWORD_HASH!,
    sessionSecret: process.env.SESSION_SECRET!,
    sessionCookieSecure: process.env.SESSION_COOKIE_SECURE === "true",
  });

  const port = Number.parseInt(process.env.V3_API_PORT ?? "4401", 10);
  await app.listen({ host: "0.0.0.0", port });
}

main().catch((error) => {
  console.error("API failed to start:", error);
  process.exit(1);
});
