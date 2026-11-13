import { afterAll, describe, expect, it } from "vitest";
import {
  enqueueTurn,
  listDmJobs,
  type TurnCheckpoint,
} from "../../src/dm/jobs.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  commitAction,
  createWorld,
  db,
  loudSkip,
  reachable,
  readRows,
  requireDb,
  TAMSIN_USER,
} from "./world.js";

/**
 * Spec 077 (TASK-0205): an undeclared method is asked, not assumed. The
 * fixture rebuilds runbook A playtest run 1 seq 24-30 (finding 4) and seq 114
 * (finding 14), docs/playtests/2026-11-02-runbook-a-playtest.md, on
 * greyhollow-ford-duo with no model: the interpret reading is run 1's.
 */

loudSkip("no-undeclared-method.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const ACTION = "act-approach";
const RUN1_TEXT =
  "We move toward the reed camp until we see Goblins or they see us.";
const chronicle = {
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
};

/** Scene start, then one turn of approach-reed-camp.json; `mutate` edits the step. */
async function run(
  text: string,
  mutate?: (step: Record<string, unknown>) => Record<string, unknown>,
  dice: number[] = [],
) {
  const s = script("approach-reed-camp.json");
  const start = script("scene-start.json");
  // biome-ignore lint/suspicious/noExplicitAny: scripted JSON is untyped
  const calls = (s.calls as { purpose: string; respond: { value: any } }[]).map(
    (c) => {
      if (c.purpose !== "dm.interpret" || !mutate) return c;
      const value = structuredClone(c.respond.value);
      value.readings[0].stages = value.readings[0].stages.map(mutate);
      return { ...c, respond: { ...c.respond, value } };
    },
  );
  const w = await createWorld({
    dice,
    calls: [...start.calls, ...calls, chronicle, chronicle, chronicle],
  });
  const { worker } = workerFor(w);
  await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
    start: {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: TAMSIN_USER, kestrel: KESTREL_USER },
    },
  });
  await drainAll(worker);
  await commitAction(w, text, ACTION);
  await tick();
  await drainAll(worker);
  const jobs = await listDmJobs(requireDb(), w.sessionId, 50, "turn");
  const turn = jobs.at(0);
  if (!turn) throw new Error("expected a turn job");
  const rows = await readRows(w);
  const commitSeq =
    rows.find((r) => r.type === "action.committed")?.seq ??
    Number.POSITIVE_INFINITY;
  return {
    after: rows.filter((r) => r.seq > commitSeq),
    cp: (turn.result as { checkpoint: TurnCheckpoint }).checkpoint,
  };
}

type After = Awaited<ReturnType<typeof run>>["after"];
const resolvedOf = (after: After) =>
  after.find(
    (r) =>
      r.type === "action.resolved" &&
      (r.payload as { actionId: string }).actionId === ACTION,
  )?.payload;
const count = (after: After, type: string) =>
  after.filter((r) => r.type === type).length;

describe.skipIf(!reachable)("no undeclared method (database)", () => {
  it("replays run 1 seq 24: no Stealth check, a clarify, the turn holds", async () => {
    const { after, cp } = await run(RUN1_TEXT);
    expect(count(after, "check.resolved")).toBe(0);
    expect(resolvedOf(after)).toMatchObject({ outcome: "no-effect" });
    const r = cp.interpret?.readings.find((x) => x.actionId === ACTION);
    expect((r as { stages?: unknown[] }).stages).toEqual([]);
    expect(r?.clarify).toBe("Are you trying to stay unseen, or moving openly?");
    expect(count(after, "turn.advanced")).toBe(0);
  });

  it("another human's PC cannot be named: the stage actor is the declarer, stamped by code (spec 104)", async () => {
    // The legacy plan gate asked before rolling for another human's PC. An Intent stage names no
    // actor: the model cannot name Kestrel, so the rule cannot fire and the check is Tamsin's.
    const { after } = await run(
      "We sneak toward the reed camp.",
      undefined,
      [12, 14],
    );
    const checks = after.filter((r) => r.type === "check.resolved");
    for (const c of checks) {
      expect(
        (c.payload as { event: { combatantId: string } }).event.combatantId,
      ).toBe("tamsin");
    }
  });

  it("control: a stated manner for the declarer rolls", async () => {
    const { after } = await run(
      "We sneak toward the reed camp.",
      (stage) => stage,
      [12, 14],
    );
    const checks = after.filter((r) => r.type === "check.resolved");
    expect(checks).toHaveLength(1);
    expect(
      (checks[0]?.payload as { event: unknown } | undefined)?.event,
    ).toMatchObject({
      skill: "stealth",
      combatantId: "tamsin",
    });
    expect(resolvedOf(after)).toMatchObject({ outcome: "applied" });
  });
});
