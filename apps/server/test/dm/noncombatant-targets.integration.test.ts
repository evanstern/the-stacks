import { afterAll, describe, expect, it } from "vitest";
import type { PlanVerdict } from "../../src/dm/gates/plan-gate.js";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
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
  type World,
} from "./world.js";

/**
 * Specs 068 and 075 (TASK-0194, TASK-0210): acting on a non-combatant NPC pulls them in. The
 * fixture rebuilds run 3 seq 118 / 133 ("I run to Pell and attempt to free
 * him") from docs/playtests/2026-11-01-two-browser-alpha-run-3.md item 13.
 */

loudSkip("noncombatant-targets.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const ACTION = "act-free-pell";
const TEXT = "I run to Pell and attempt to free him.";
const retrieve = async () => ({
  mode: "fts" as const,
  embeddingModel: null,
  candidates: { vector: null, fts: 0 },
  passages: [],
});
const chronicle = {
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
};

/** Scene start, then one turn of free-pell.json; `mutate` edits the interpret reading. */
async function runFreePell(
  mutate?: (stages: Record<string, unknown>[]) => Record<string, unknown>[],
  extraDice: number[] = [],
) {
  const s = script("free-pell.json");
  const start = script("scene-start.json");
  // biome-ignore lint/suspicious/noExplicitAny: scripted JSON is untyped
  const calls = (s.calls as { purpose: string; respond: { value: any } }[]).map(
    (c) => {
      if (c.purpose !== "dm.interpret" || !mutate) return c;
      // Only the free-Pell reading (the second interpret call).
      if (c.respond.value.readings[0].actionId !== ACTION) return c;
      const value = structuredClone(c.respond.value);
      value.readings[0].stages = mutate(value.readings[0].stages);
      return { ...c, respond: { ...c.respond, value } };
    },
  );
  const w: World = await createWorld({
    dice: [...s.dice, ...extraDice],
    calls: [...start.calls, ...calls, chronicle, chronicle, chronicle],
  });
  const { worker } = workerFor(w, { retrieve });
  await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
    start: {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: TAMSIN_USER, kestrel: KESTREL_USER },
    },
  });
  await drainAll(worker);
  // Turn 1 enters the camp: the encounter starts and Pell arrives (present).
  await commitAction(
    w,
    "I follow the old timber posts into the reeds.",
    "act-advance",
  );
  await tick();
  await drainAll(worker);
  await commitAction(w, TEXT, ACTION);
  await tick();
  await drainAll(worker);
  const jobs = await listDmJobs(requireDb(), w.sessionId, 50, "turn");
  return {
    w,
    worker,
    rows: await readRows(w), // The newest turn that ran a beat (an AI-seat `ruling` turn follows it).
    turn: jobs.find(
      (j) => (j.input as { trigger?: string }).trigger !== "ruling",
    ),
  };
}

interface Cp {
  planGate?: PlanVerdict[];
  submissions: {
    key: string;
    result: string;
    refusal: { code: string } | null;
  }[];
}
const cpOf = (turn: { result: unknown } | undefined): Cp => {
  if (!turn) throw new Error("expected a turn job");
  return (turn.result as { checkpoint: Cp }).checkpoint;
};
const planGateOf = (turn: { result: unknown } | undefined) =>
  cpOf(turn).planGate;

const resolvedOf = (rows: Awaited<ReturnType<typeof readRows>>) =>
  rows.find(
    (r) =>
      r.type === "action.resolved" &&
      (r.payload as { actionId: string }).actionId === ACTION,
  );

const eventOf = (r: { payload: unknown }) =>
  // biome-ignore lint/suspicious/noExplicitAny: event payloads vary by type
  (r.payload as { event: Record<string, any> }).event;

describe.skipIf(!reachable)("non-combatant targets (database)", () => {
  it("replays run 3 seq 118: freeing Pell pulls him in and resolves applied", async () => {
    const { rows, turn } = await runFreePell();
    expect(resolvedOf(rows)?.payload).toMatchObject({ outcome: "applied" });

    const added = rows.findIndex(
      (r) => r.type === "combatant.added" && eventOf(r).combatantId === "pell",
    );
    // The encounter is active, so Pell rolls into the live order (AC #4).
    const joined = rows.findIndex(
      (r, i) =>
        i > added &&
        r.type === "encounter.changed" &&
        JSON.stringify(r.payload).includes('"pell"'),
    );
    const check = rows.findIndex(
      (r) => r.type === "check.resolved" && eventOf(r).combatantId === "tamsin",
    );
    expect(added).toBeGreaterThan(-1);
    expect(joined).toBeGreaterThan(added);
    expect(check).toBeGreaterThan(joined);

    const order = rows
      .filter((r) => r.type === "encounter.changed")
      .map((r) => eventOf(r).after.order as { combatantId: string }[])
      .at(-1);
    expect(order?.filter((o) => o.combatantId === "pell")).toHaveLength(1);

    // OQ-3 (a): Pell has no starting condition, so the engine refuses the removal.
    const subs = cpOf(turn).submissions.filter((x) =>
      x.key.startsWith("act:act-free-pell"),
    );
    expect(subs.find((x) => x.key.endsWith(":e0"))).toMatchObject({
      result: "refused",
      refusal: { code: "CONDITION_NOT_PRESENT" },
    });
    expect(subs.some((x) => x.refusal?.code === "UNKNOWN_COMBATANT")).toBe(
      false,
    );
    expect(planGateOf(turn)).toEqual([{ actionId: ACTION, ok: true }]);
  });

  it("an attack on Pell pulls him in and resolves (spec 075)", async () => {
    // One extra die feeds the damage roll.
    const { rows, turn } = await runFreePell(
      () => [
        {
          intent: {
            kind: "attack",
            targets: [{ kind: "actor", id: "pell" }],
            params: { weapon: "Longsword" },
          },
          beside: null,
        },
      ],
      [5],
    );
    expect(resolvedOf(rows)?.payload).toMatchObject({ outcome: "applied" });
    expect(planGateOf(turn)).toEqual([{ actionId: ACTION, ok: true }]);
    const added = rows.findIndex(
      (r) => r.type === "combatant.added" && eventOf(r).combatantId === "pell",
    );
    const attack = rows.findIndex(
      (r) => r.type === "attack.resolved" && eventOf(r).targetId === "pell",
    );
    expect(added).toBeGreaterThan(-1);
    expect(attack).toBeGreaterThan(added);
    const order = rows
      .filter((r) => r.type === "encounter.changed")
      .map((r) => eventOf(r).after.order as { combatantId: string }[])
      .at(-1);
    expect(order?.filter((o) => o.combatantId === "pell")).toHaveLength(1);
  });

  it("reclaim: each pull is one keyed submission, written once", async () => {
    const { rows, turn } = await runFreePell();
    // Spec 104: the planner's batch carries the pull; the Intent stage is one keyed submission
    // (declared, confirmed), so a replay writes no second pull.
    const stage = cpOf(turn).submissions.filter((x) =>
      x.key.startsWith("act:act-free-pell:i0"),
    );
    expect(stage.map((x) => x.key).slice(0, 2)).toEqual([
      "act:act-free-pell:i0:d",
      "act:act-free-pell:i0",
    ]);
    expect(
      rows.filter(
        (r) =>
          r.type === "combatant.added" && eventOf(r).combatantId === "pell",
      ),
    ).toHaveLength(1);
    expect(rows.filter((r) => r.type === "encounter.changed")).toHaveLength(1);
  });
});
