import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, probeReachable } from "../../src/db.js";
import { readRunDir } from "../../src/playtest/export.js";
import { runPlaytest } from "../../src/playtest/harness.js";
import { loadScenario } from "../../src/playtest/scenario.js";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\nSKIPPING apps/server/test/playtest/harness.integration.test.ts — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about the harness. Start one with: pnpm env:up.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});
beforeEach(async () => {
  // Claims are global; clear other sessions' DM jobs so each run drains its own.
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

// biome-ignore lint/suspicious/noExplicitAny: ad-hoc JSON mutation in a test helper
type Json = Record<string, any>;

/** A scenario variant in a temp dir; `ci` paths made absolute from the shipped scenario. */
function variant(patch: (s: Json) => void, dmScript?: (d: Json) => void) {
  const base = loadScenario(SHIPPED);
  const raw = JSON.parse(readFileSync(SHIPPED, "utf8"));
  raw.ci = { ...base.ci };
  const dir = mkdtempSync(join(tmpdir(), "playtest-"));
  if (dmScript) {
    const d = JSON.parse(readFileSync(base.ci?.dmScript as string, "utf8"));
    dmScript(d);
    const p = join(dir, "dm.json");
    writeFileSync(p, JSON.stringify(d));
    raw.ci.dmScript = p;
  }
  patch(raw);
  const file = join(dir, "scenario.json");
  writeFileSync(file, JSON.stringify(raw));
  return { scenario: loadScenario(file), dir };
}

const lines = (p: string) =>
  readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim());

describe.skipIf(!reachable)("the harness run (database)", () => {
  it("plays the CI scenario to its end and writes the run directory", async () => {
    const scenario = loadScenario(SHIPPED);
    const out = join(mkdtempSync(join(tmpdir(), "run-")), "run");
    const manifest = await runPlaytest({
      db: db as NonNullable<typeof db>,
      scenario,
      mode: "ci",
      out,
    });
    expect(manifest.outcome).toBe("ended");
    expect(manifest.moves.refusals).toEqual([]);

    const run = readRunDir(out);
    for (const f of [
      "run.json",
      "transcript.jsonl",
      "transcript.md",
      "ledger.json",
      "jobs.json",
      "usage.json",
    ]) {
      expect(() => readFileSync(join(out, f))).not.toThrow();
    }

    // Rows are in ascending seq, one per line.
    const seqs = run.transcript.map((r) => r.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(lines(join(out, "transcript.jsonl"))).toHaveLength(seqs.length);

    // The ledger's rolled faces equal the DM script's dice, in order.
    const dm = JSON.parse(
      readFileSync(scenario.ci?.dmScript as string, "utf8"),
    );
    const faces: number[] = [];
    for (const row of run.ledger) {
      if (row.kind !== "roll") continue;
      const terms = (row.roll as unknown as { terms: { faces?: number[] }[] })
        .terms;
      for (const t of terms) faces.push(...(t.faces ?? []));
    }
    expect(dm.dice.length).toBeGreaterThan(0);
    expect(faces).toEqual(dm.dice);

    // Script spent, chronicle aside.
    expect(manifest.scriptRemaining?.dice).toBe(0);
    for (const [purpose, n] of Object.entries(
      manifest.scriptRemaining?.calls ?? {},
    )) {
      if (purpose !== "dm.chronicle") expect(n, purpose).toBe(0);
    }

    // The human seat and both companions committed.
    const committers = run.transcript
      .filter((r) => r.type === "action.committed")
      .map((r) => r.actor);
    expect(committers).toContain(scenario.seat.userId);
    expect(committers).toContain("ai:companion:odo");
    expect(committers).toContain("ai:companion:kestrel");
  });

  it("ends stalled with artifacts saved when the move cap is reached", async () => {
    const { scenario, dir } = variant((s) => {
      s.limits.maxMoves = 2;
    });
    const out = join(dir, "run");
    const manifest = await runPlaytest({
      db: db as NonNullable<typeof db>,
      scenario,
      mode: "ci",
      out,
    });
    expect(manifest.outcome).toBe("stalled");
    expect(readRunDir(out).transcript.length).toBeGreaterThan(0);
  });

  it("ends failed with the job id and artifacts saved on a DM error", async () => {
    const { scenario, dir } = variant(
      () => {},
      (d) => {
        const first = d.calls.find(
          (c: { purpose: string }) => c.purpose === "dm.director",
        );
        first.respond = { type: "error", kind: "upstream", message: "boom" };
        d.calls = d.calls.filter(
          (c: { purpose: string }) =>
            c.purpose !== "dm.director" || c === first,
        );
      },
    );
    const out = join(dir, "run");
    const manifest = await runPlaytest({
      db: db as NonNullable<typeof db>,
      scenario,
      mode: "ci",
      out,
    });
    expect(manifest.outcome).toBe("failed");
    expect(manifest.failedJobId).toBeTruthy();
    expect(readRunDir(out).jobs.some((j) => j.status === "failed")).toBe(true);
  });
});
