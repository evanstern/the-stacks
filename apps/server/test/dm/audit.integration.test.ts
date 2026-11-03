import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mechanicsProposal } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import { checkClaims } from "../../src/dm/claims.js";
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
    expect(text).toContain("vs DC 15: success");
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
    expect(text).toContain("Tamsin Vale pulls it off.");
    expect(text).toContain("vs DC 15: success");
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

  it("ships the narration when dm.audit returns only doctrine issues (advisory)", async () => {
    const { w, outcome } = await fullTurn("audit-advisory.json");
    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    const record = outcome.results.audit.record;
    expect(record.attempts).toHaveLength(1);
    expect(record.final).toBe("passed");
    expect(record.flagged).toBe(false);
    expect(record.attempts[0]?.llm).toMatchObject({
      verdict: "fail",
      issues: [{ kind: "doctrine", blocking: false }],
    });
    const rows = await readRows(w);
    const narrations = rows.filter((r) => r.type === "narration");
    expect(payloadOf<{ text: string }>(narrations[0]).text).toContain(
      "The shutter shrieks",
    );
    expect(rows.some((r) => r.type === "journal.entry.added")).toBe(false);
    expect(w.scripted.remaining().calls["dm.audit"]).toBe(0);
  });

  /** A turn in which Tamsin was already downed before her action resolves. */
  async function downedTurn(name: string) {
    const s = script(name);
    const w = await createWorld({ dice: s.dice, calls: s.calls });
    await startScene(w);
    await commitAction(w, "Tamsin forces the stuck shutter.", "act-shutter");
    const hp = (await w.projections()).engine.combatants.tamsin?.hp.current;
    const res = await w.gate.submit(
      w.sessionId,
      { kind: "ai", actor: "ai:dm" },
      mechanicsProposal(
        {
          type: "damage.apply",
          reason: "setup",
          targetId: "tamsin",
          components: [
            { amount: { kind: "fixed", value: hp }, damageType: "slashing" },
          ],
          critical: false,
          defenses: null,
        } as never,
        { actionId: null, summary: "setup", rationale: "setup" },
      ),
    );
    if (!res.ok) throw new Error(`setup refused: ${res.refusal.code}`);
    w.checkpoint.current = {
      ...w.checkpoint.current,
      submissions: [],
      lastSeq: 0,
    };
    const outcome = await runTurn(w.ctx({ job: { id: JOB } }), nodes);
    return { w, outcome };
  }

  it("ships the fallback after three refused downed-actor narrations (spec 051)", async () => {
    const { w, outcome } = await downedTurn("audit-claim-fallback.json");
    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    const record = outcome.results.audit.record;
    expect(record.attempts).toHaveLength(3);
    for (const a of record.attempts) {
      expect(a.deterministic.pass).toBe(false);
      expect(
        a.deterministic.issues.some(
          (i) =>
            i.blocking &&
            i.kind === "ledger-mismatch" &&
            i.detail.startsWith("Actor state:"),
        ),
      ).toBe(true);
      expect(a.llm).toEqual({ skipped: true });
    }
    expect(record.final).toBe("fallback");
    expect(record.flagged).toBe(true);

    const rows = await readRows(w);
    const flag = rows.find(
      (r) =>
        r.type === "journal.entry.added" &&
        (r.payload as { entryId: string }).entryId === `audit-${JOB}`,
    );
    expect(flag?.visibility).toBe("dm");
    const shipped = outcome.results.audit.shipped;
    expect(shipped?.fallback).toBe(true);
    const state = {
      snapshot: outcome.results.resolve.snapshot,
      diff: outcome.results.resolve.diff,
    };
    expect(checkClaims(state, shipped?.prose ?? "").pass).toBe(true);
    expect(w.scripted.remaining().calls).toEqual(
      expect.objectContaining({ "dm.narrate": 0, "dm.audit": 0 }),
    );
  });

  it("regenerates a refused narration and ships the later clean attempt (spec 051)", async () => {
    const { w, outcome } = await downedTurn("audit-claim-regenerate.json");
    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    const record = outcome.results.audit.record;
    expect(record.attempts).toHaveLength(2);
    expect(record.attempts[0]?.deterministic.pass).toBe(false);
    expect(record.attempts[0]?.llm).toEqual({ skipped: true });
    expect(record.attempts[1]?.deterministic.pass).toBe(true);
    expect(record.final).toBe("passed-after-regenerate");
    expect(outcome.results.audit.shipped?.fallback).toBe(false);
    expect(outcome.results.audit.shipped?.prose).toContain("lies senseless");
    expect(w.scripted.remaining().calls).toEqual(
      expect.objectContaining({ "dm.narrate": 0, "dm.audit": 0 }),
    );
  });

  it("blanks a refused goalNote, records it as advisory and does not fall back (spec 051)", async () => {
    const { outcome } = await downedTurn("audit-claim-goalnote.json");
    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(outcome.results.narrate.facts.director.goalNote).toBe("");
    const record = outcome.results.audit.record;
    const first = record.attempts[0];
    expect(first?.deterministic.pass).toBe(true);
    expect(first?.deterministic.issues).toHaveLength(1);
    expect(first?.deterministic.issues[0]).toMatchObject({
      kind: "ledger-mismatch",
      blocking: false,
    });
    expect(first?.deterministic.issues[0]?.detail).toMatch(
      /^Actor state: withheld goalNote: /,
    );
    expect(record.final).toBe("passed");
    expect(outcome.results.audit.shipped?.fallback).toBe(false);
  });
});
