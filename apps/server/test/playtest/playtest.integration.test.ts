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
    // FR-015: no refusals, and the confirm move shipped a search Intent with a zone target.
    expect(manifest.moves.refusals).toEqual([]);
    const transcript = readFileSync(join(out, "transcript.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const searchItems = transcript
      .filter((r) => r.type === "action.suggested")
      .flatMap((r) => r.payload.items)
      .filter((i: { intent: { kind: string } }) => i.intent.kind === "search");
    expect(searchItems).toHaveLength(1);
    expect(searchItems[0].intent.targets).toEqual([
      { kind: "zone", id: "ferry-house" },
    ]);
    // FR-014 (spec 116): the confirm-move reply carried invented params; they are stripped.
    const moveItems = transcript
      .filter((r) => r.type === "action.suggested")
      .flatMap((r) => r.payload.items)
      .filter((i: { intent: { kind: string } }) => i.intent.kind === "move");
    expect(moveItems).toHaveLength(1);
    expect(moveItems[0].intent.targets).toEqual([
      { kind: "zone", id: "near-bank" },
    ]);
    expect(moveItems[0].intent.params).toEqual({});
    // OQ-4 ruling (a), 2026-11-14: the `intent: true` deeds run as direct Intents, so
    // the two interpret calls left are the check moves (act-persuade, act-strike),
    // and no turn job triggered by "intent" or its ruling spent an interpret call.
    const jobs = JSON.parse(readFileSync(join(out, "jobs.json"), "utf8")) as {
      trigger: string | null;
      check?: { stripped?: { key: string }[] };
      calls: { purpose: string }[];
    }[];
    const stripped = jobs
      .filter((j) => j.trigger === "talk")
      .flatMap((j) => j.check?.stripped ?? [])
      .map((x) => x.key);
    expect(stripped).toEqual(["ready", "caution"]);
    expect(jobs.filter((j) => j.trigger === "intent")).not.toHaveLength(0);
    for (const j of jobs.filter((j) => j.trigger === "intent")) {
      expect(j.calls.map((c) => c.purpose)).toEqual(["dm.narrate"]);
    }
    const interprets = jobs
      .flatMap((j) => j.calls)
      .filter((c) => c.purpose === "dm.interpret");
    expect(interprets).toHaveLength(4);
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
