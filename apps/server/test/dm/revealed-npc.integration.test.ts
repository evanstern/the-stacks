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
 * Spec 078 (TASK-0206): the NPC the DM reveals is present in the state. Replays
 * run 1 seq 40-45 (docs/playtests/2026-11-02-runbook-a-playtest.md findings 5
 * and 6): the reveal writes no presence effect; the Director reports arrivals.
 */

loudSkip("revealed-npc.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const kestrelPlayer = {
  kind: "human",
  userId: KESTREL_USER,
  role: "player",
} as const;
const ACTION = "act-shoot";
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

type Variant = "free" | "encounter" | "control";

/** Scene start, the reveal turn, then Kestrel's shot (run 1 seq 40-45). */
async function run(variant: Variant) {
  const s = script("reveal-snag.json");
  const start = script("scene-start.json");
  const calls = structuredClone(s.calls);
  const director2 = (
    calls[3] as { respond: { value: Record<string, unknown> } }
  ).respond.value;
  let dice = s.dice;
  if (variant === "control") delete director2.arrivals;
  if (variant === "encounter") {
    director2.tableMode = {
      to: "turn",
      encounterId: "reed-camp",
      reason: "The goblins spring up as the party reaches the island.",
    };
    // Initiative: party first (tamsin, kestrel), then the four goblins; then the attack.
    dice = [s.dice[0], 18, 17, 2, 3, 4, 5, ...s.dice.slice(1)];
  }
  const w: World = await createWorld({
    dice,
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
  await commitAction(w, "We hold. Looking and listening.", "act-listen");
  await tick();
  await drainAll(worker);
  const declared = await w.as(kestrelPlayer, {
    kind: "action.declare",
    action: {
      actionId: ACTION,
      characterId: "kestrel",
      scope: "character",
      text: "I take aim and shoot at Snag.",
    },
  });
  if (!declared.ok) throw new Error(`declare: ${declared.refusal.code}`);
  const committed = await w.as(kestrelPlayer, {
    kind: "action.commit",
    actionId: ACTION,
  });
  if (!committed.ok) throw new Error(`commit: ${committed.refusal.code}`);
  await tick();
  await drainAll(worker);
  const jobs = await listDmJobs(requireDb(), w.sessionId, 50, "turn");
  const turn = jobs.at(0);
  if (!turn) throw new Error("expected a turn job");
  const planGate = (turn.result as { checkpoint: { planGate?: PlanVerdict[] } })
    .checkpoint.planGate;
  return { rows: await readRows(w), planGate };
}

const eventOf = (r: { payload: unknown }) =>
  // biome-ignore lint/suspicious/noExplicitAny: event payloads vary by type
  (r.payload as { event: Record<string, any> }).event;
const resolvedOf = (rows: Awaited<ReturnType<typeof readRows>>) =>
  rows.find(
    (r) =>
      r.type === "action.resolved" &&
      (r.payload as { actionId: string }).actionId === ACTION,
  );
const snagAdded = (rows: Awaited<ReturnType<typeof readRows>>) =>
  rows.findIndex(
    (r) => r.type === "combatant.added" && eventOf(r).combatantId === "snag",
  );

const arrivedRows = (rows: Awaited<ReturnType<typeof readRows>>, id: string) =>
  rows.flatMap((r, i) =>
    r.type === "scene-presence.changed" &&
    (r.payload as { actorId: string }).actorId === id &&
    (r.payload as { reason: string }).reason === "arrived"
      ? [i]
      : [],
  );

describe.skipIf(!reachable)("revealed NPC is present (database)", () => {
  it("seq 40-45, free mode: arrivals log before the pull and the attack", async () => {
    const { rows, planGate } = await run("free");
    const snagArrived = arrivedRows(rows, "snag");
    const pellArrived = arrivedRows(rows, "pell");
    expect(snagArrived).toHaveLength(1);
    expect(pellArrived).toHaveLength(1);
    expect(rows[snagArrived[0]].visibility).toBe("public");
    const added = snagAdded(rows);
    const attack = rows.findIndex(
      (r) => r.type === "attack.resolved" && eventOf(r).targetId === "snag",
    );
    expect(added).toBeGreaterThan(snagArrived[0]);
    expect(attack).toBeGreaterThan(added);
    expect(resolvedOf(rows)?.payload).toMatchObject({ outcome: "applied" });
    expect(planGate).toEqual([{ actionId: ACTION, ok: true, pull: ["snag"] }]);
    expect(rows.some((r) => r.type === "encounter.started")).toBe(false);
  });

  it("same-beat encounter start: one arrived row each, Snag once in the order", async () => {
    const { rows } = await run("encounter");
    expect(arrivedRows(rows, "snag")).toHaveLength(1);
    expect(arrivedRows(rows, "pell")).toHaveLength(1);
    expect(rows.some((r) => r.type === "encounter.started")).toBe(true);
    expect(
      rows.filter(
        (r) =>
          r.type === "combatant.added" && eventOf(r).combatantId === "snag",
      ),
    ).toHaveLength(1);
    expect(resolvedOf(rows)?.payload).toMatchObject({ outcome: "applied" });
  });

  it("control: no arrivals, Snag is still refused as absent", async () => {
    const { rows, planGate } = await run("control");
    expect(resolvedOf(rows)?.payload).toMatchObject({
      outcome: "refused",
      refusalCode: "UNKNOWN_COMBATANT",
    });
    expect(planGate?.[0]).toMatchObject({
      ok: false,
      failure: { field: "targetId", id: "snag", reason: "absent" },
    });
    expect(arrivedRows(rows, "snag")).toHaveLength(0);
  });
});
