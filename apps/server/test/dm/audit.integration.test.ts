import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { adjudicate } from "../../src/dm/nodes/adjudicate.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import { audit } from "../../src/dm/nodes/audit.js";
import { director } from "../../src/dm/nodes/director.js";
import { interpret } from "../../src/dm/nodes/interpret.js";
import { narrate } from "../../src/dm/nodes/narrate.js";
import { resolve } from "../../src/dm/nodes/resolve.js";
import { runTurn } from "../../src/dm/pipeline/runner.js";
import {
  commitAction,
  createWorld,
  db,
  loudSkip,
  payloadOf,
  reachable,
  readRows,
  startScene,
} from "./world.js";

loudSkip("audit.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "scripts");
const script = (name: string) =>
  JSON.parse(readFileSync(join(SCRIPTS, name), "utf8")) as {
    dice: number[];
    calls: unknown[];
  };

const nodes = {
  assemble,
  director,
  interpret,
  adjudicate,
  resolve,
  narrate,
  audit,
};
const JOB = "00000000-0000-4000-8000-0000000000cc";

async function fullTurn(name: string) {
  const s = script(name);
  const w = await createWorld({ dice: s.dice, calls: s.calls });
  await startScene(w);
  await commitAction(w, "Tamsin forces the stuck shutter.", "act-shutter");
  w.checkpoint.current = {
    ...w.checkpoint.current,
    submissions: [],
    lastSeq: 0,
  };
  const outcome = await runTurn(w.ctx({ job: { id: JOB } }), nodes);
  return { w, outcome };
}

describe.skipIf(!reachable)("audit through a full pipeline (database)", () => {
  it("regenerates once and ships the second text with a one-failure record", async () => {
    const { w, outcome } = await fullTurn("audit-regenerate.json");
    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    const record = outcome.results.audit.record;
    expect(record.attempts).toHaveLength(2);
    expect(record.attempts[0]?.deterministic.pass).toBe(false);
    expect(record.final).toBe("passed-after-regenerate");
    expect(record.flagged).toBe(true);

    const rows = await readRows(w);
    const narrations = rows.filter((r) => r.type === "narration");
    expect(narrations).toHaveLength(1);
    const text = payloadOf<{ text: string }>(narrations[0]).text;
    expect(text).toContain("The shutter shrieks");
    expect(text).not.toContain("fails to move");
    expect(text).toContain("vs DC 12: success");
    expect(rows.some((r) => r.type === "journal.entry.added")).toBe(false);
    expect(w.scripted.remaining()).toEqual({
      calls: expect.objectContaining({ "dm.narrate": 0, "dm.audit": 0 }),
      dice: 0,
    });
    expect(outcome.results.resolve.chronicle).toBe(true);
  });

  it("ships the factual summary and a dm journal flag after three failures", async () => {
    const { w, outcome } = await fullTurn("audit-fallback.json");
    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    const record = outcome.results.audit.record;
    expect(record.attempts).toHaveLength(3);
    expect(record.final).toBe("fallback");
    expect(record.flagged).toBe(true);

    const rows = await readRows(w);
    const narrations = rows.filter((r) => r.type === "narration");
    expect(narrations).toHaveLength(1);
    const text = payloadOf<{ text: string }>(narrations[0]).text;
    expect(text).toContain("Tamsin Vale succeeds.");
    expect(text).toContain("vs DC 12: success");
    const flag = rows.find(
      (r) =>
        r.type === "journal.entry.added" &&
        (r.payload as { entryId: string }).entryId === `audit-${JOB}`,
    );
    expect(flag).toBeDefined();
    expect(flag?.visibility).toBe("dm");
    expect(payloadOf<{ body: string }>(flag).body).toMatch(/Attempt 3/);
    expect(w.scripted.remaining().dice).toBe(0);
  });
});
