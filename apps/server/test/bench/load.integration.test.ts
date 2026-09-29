import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { CASES, type RunContext } from "../../src/bench/load/cases.js";
import { dropLoadDb, resolveLoadUrl } from "../../src/bench/load/db.js";
import { loadProfile } from "../../src/bench/load/profile.js";
import { createDb, probeReachable } from "../../src/db.js";

/**
 * Every-commit-tier coverage (specs/021-load-bench T018, quickstart step 2):
 * the two `commit`-tier cases run for real against the load database; every
 * other case is a named, visible skip so a reader never has to wonder
 * whether it ran. Loud-skip harness copied from
 * apps/server/test/library/worker.integration.test.ts.
 */

const baseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const baseDb = baseUrl ? createDb(baseUrl) : undefined;
const reachable = baseDb ? await probeReachable(baseDb.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/bench/load.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${baseUrl ?? "<unset>"}). ` +
    `These are the load bench's every-commit cases (specs/021-load-bench T018); a skip here ` +
    `proves NOTHING about ingest-smoke or concurrency-smoke. Start one with: pnpm env:up, ` +
    `then set TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  if (reachable) {
    const { baseUrl: resolvedBase, loadUrl } = resolveLoadUrl(process.env);
    await dropLoadDb(resolvedBase, loadUrl).catch(() => {});
  }
  await baseDb?.$client.end();
});

const commitProfilePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../bench/load/profiles/commit.json",
);

describe.skipIf(!reachable)("load bench — every-commit tier", () => {
  for (const c of CASES) {
    if (c.tier === "commit") {
      it(c.id, async () => {
        const profile = loadProfile(commitProfilePath);
        const ctx: RunContext = { runId: randomUUID() };
        const outcome = await c.run(ctx, profile);
        expect(outcome.status, outcome.reason).toBe("pass");
      }, 30_000);
    } else {
      const reason = `tier ${c.tier} not selected`;
      console.info(`SKIP: ${c.id} [tier ${c.tier}] — ${reason}`);
      it.skip(`${c.id} [tier ${c.tier}] — ${reason}`, () => {});
    }
  }
});
