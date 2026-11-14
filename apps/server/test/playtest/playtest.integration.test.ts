import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, probeReachable } from "../../src/db.js";
import { ReportSchema } from "../../src/playtest/auditor/schema.js";
import { runPlaytest } from "../../src/playtest/harness.js";
import { loadScenario } from "../../src/playtest/scenario.js";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\nSKIPPING apps/server/test/playtest/playtest.integration.test.ts — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about the playtest. Start one with: pnpm env:up.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});
beforeEach(async () => {
  if (db) {
    await db.execute(
      sql`DELETE FROM jobs WHERE kind IN ('turn', 'companion', 'chronicle')`,
    );
  }
});

const SHIPPED = new URL(
  "../../playtests/scenarios/greyhollow-ford.json",
  import.meta.url,
).pathname;

describe.skipIf(!reachable)("the CI playtest with its audit (AC #3)", () => {
  it("plays the scenario and the auditor reports pass", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "playtest-ci-")), "run");
    const manifest = await runPlaytest({
      db: db as NonNullable<typeof db>,
      scenario: loadScenario(SHIPPED),
      mode: "ci",
      out,
    });
    expect(manifest.outcome).toBe("ended");
    const report = ReportSchema.parse(
      JSON.parse(readFileSync(join(out, "report.json"), "utf8")),
    );
    expect(report.verdict).toBe("pass");
    expect(report.counts.segments).toBe(10);
    expect(report.counts.findings.fail).toBe(0);
    // TASK-0337: the two Intent deeds are told, and the check ran on every segment.
    for (const seg of report.segments) {
      expect(seg.checks.find((c) => c.id === "deeds-narrated")).toEqual({
        id: "deeds-narrated",
        pass: true,
      });
    }
    expect(manifest.scriptRemaining?.calls["playtest.audit"]).toBe(0);
    expect(report.fight).not.toBeNull();
    expect(report.fight?.attackRolls.players).toBeGreaterThanOrEqual(1);
    expect(existsSync(join(out, "report.md"))).toBe(true);
  });
});
