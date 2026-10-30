import type { Proposer } from "@the-stacks/session-model";
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
  createWorld,
  db,
  loudSkip,
  player,
  reachable,
  readRows,
  requireDb,
  TAMSIN_USER,
  type World,
} from "./world.js";

/**
 * Spec 064 (TASK-0182): a compound plan resolves only its first stage. The
 * fixture is run 2 item 4 of the two-browser alpha playtest.
 */

loudSkip("plan-first-step.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
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

/** A duo table after scene start, then one turn of `turnScript` for act-197dae73. */
async function runTurn(turnScript: string, actionId: string) {
  const s = script(turnScript);
  const start = script("scene-start.json");
  const w: World = await createWorld({
    dice: s.dice,
    // Chronicle passes vary with idle timing; spare ones are harmless.
    calls: [...start.calls, ...s.calls, chronicle, chronicle, chronicle],
  });
  const { worker } = workerFor(w, { retrieve });
  await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
    start: {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: TAMSIN_USER, kestrel: KESTREL_USER },
    },
  });
  await drainAll(worker);
  const who: Proposer = player;
  const declared = await w.as(who, {
    kind: "action.declare",
    action: {
      actionId,
      characterId: "tamsin",
      scope: "character",
      text: "I walk openly to the camp; Kestrel and Odo follow hidden.",
    },
  });
  if (!declared.ok)
    throw new Error(`declare refused: ${declared.refusal.code}`);
  const committed = await w.as(who, { kind: "action.commit", actionId });
  if (!committed.ok)
    throw new Error(`commit refused: ${committed.refusal.code}`);
  await tick();
  await drainAll(worker);
  const jobs = await listDmJobs(requireDb(), w.sessionId, 50, "turn");
  // Newest first: the action turn follows the scene-start turn.
  return { w, rows: await readRows(w), turn: jobs.at(0) };
}

function checkpointOf(turn: { result: unknown } | undefined): TurnCheckpoint {
  if (!turn) throw new Error("expected a turn job");
  return (turn.result as { checkpoint: TurnCheckpoint }).checkpoint;
}

describe.skipIf(!reachable)("plan first step (database)", () => {
  it("resolves two stealth checks and holds the rest of the plan", async () => {
    const { rows, turn } = await runTurn("plan-approach.json", "act-197dae73");
    // Event types are the real catalog names (engine and session catalogs).
    const checks = rows.filter((r) => r.type === "check.resolved");
    expect(checks).toHaveLength(2);
    for (const c of checks)
      expect(c.payload).toMatchObject({ skill: "stealth" });
    const none = (type: string) =>
      expect(rows.filter((r) => r.type === type)).toHaveLength(0);
    none("attack.resolved");
    none("combatant.added");
    none("encounter.started");
    none("turn.advanced");
    none("table-mode.changed");
    none("tracker.changed");

    const resolved = rows.find(
      (r) =>
        r.type === "action.resolved" &&
        (r.payload as { actionId: string }).actionId === "act-197dae73",
    );
    expect(resolved?.payload).toMatchObject({ outcome: "applied" });

    const cp = checkpointOf(turn);
    expect(cp.cut).toBe(true);
    const held = cp.director?.overrides.map((o) => o.decision) ?? [];
    expect(held).toEqual(expect.arrayContaining(["turn", "tracker"]));

    // The facts carry the persuasion and the attack reasons as follow-ups.
    const followUps = cp.interpret?.readings.flatMap((r) => r.followUps) ?? [];
    expect(followUps).toHaveLength(2);
    expect(followUps.join(" ")).toMatch(/parley/);
    expect(followUps.join(" ")).toMatch(/attacks Snag/);
  });

  it("control: exploration-check still advances dusk and stores no follow-ups", async () => {
    const { rows, turn } = await runTurn(
      "exploration-check.json",
      "act-search",
    );
    const tracker = rows.filter((r) => r.type === "tracker.changed");
    expect(JSON.stringify(tracker.at(-1)?.payload)).toContain("dusk");
    const cp = checkpointOf(turn);
    expect(cp.interpret?.readings.flatMap((r) => r.followUps) ?? []).toEqual(
      [],
    );
  });
});
