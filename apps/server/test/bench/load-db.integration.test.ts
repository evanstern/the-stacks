import { sql } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  dropLoadDb,
  preloadHistory,
  recreateLoadDb,
  resolveLoadUrl,
  seedUsers,
} from "../../src/bench/load/db.js";
import { createDb, probeReachable } from "../../src/db.js";

/**
 * Integration tests for the load database's isolation guards
 * (specs/021-load-bench research R3, R9, R4) against a REAL Postgres.
 * Loud-skip harness in the style of
 * apps/server/test/library/worker.integration.test.ts, written fresh for
 * this file (no code import, research R13).
 */

const baseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const baseDb = baseUrl ? createDb(baseUrl) : undefined;
const reachable = baseDb ? await probeReachable(baseDb.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/bench/load-db.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${baseUrl ?? "<unset>"}). ` +
    `This is the load bench's database-isolation guard (specs/021-load-bench research R3); a ` +
    `skip here proves NOTHING about recreateLoadDb, seedUsers, or preloadHistory. Start one ` +
    `with: pnpm env:up, then set TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await baseDb?.$client.end();
});

describe.skipIf(!reachable)("load database isolation (integration)", () => {
  it("recreateLoadDb creates and migrates the load database; refuses while it is in use; succeeds again once free", async () => {
    const { baseUrl: resolvedBase, loadUrl } = resolveLoadUrl(process.env);
    expect(resolvedBase).toBe(baseUrl);

    await recreateLoadDb(resolvedBase, loadUrl);

    // A held connection to the load database makes the next
    // recreateLoadDb refuse (research R3's concurrent-run guard).
    const holder = new Client({ connectionString: loadUrl });
    await holder.connect();
    try {
      await expect(recreateLoadDb(resolvedBase, loadUrl)).rejects.toThrow(
        /existing connection/,
      );
    } finally {
      await holder.end();
    }

    // Once released, recreateLoadDb succeeds again and leaves the
    // migrations applied (the jobs table exists and is empty).
    await recreateLoadDb(resolvedBase, loadUrl);
    const loadDb = createDb(loadUrl);
    try {
      const { rows } = await loadDb.execute(
        sql`SELECT count(*)::int AS n FROM jobs`,
      );
      expect((rows[0] as { n: number }).n).toBe(0);

      const seeded = await seedUsers(loadDb, 3);
      expect(seeded).toHaveLength(3);
      expect(new Set(seeded.map((u) => u.id)).size).toBe(3);
      expect(
        seeded.every((u) => typeof u.token === "string" && u.token.length > 0),
      ).toBe(true);

      await preloadHistory(loadDb, 5);
      const { rows: jobRows } = await loadDb.execute(
        sql`SELECT count(*)::int AS n FROM jobs WHERE status = 'succeeded'`,
      );
      expect((jobRows[0] as { n: number }).n).toBe(5);
    } finally {
      await loadDb.$client.end();
    }

    await dropLoadDb(resolvedBase, loadUrl);
  }, 30_000);
});
