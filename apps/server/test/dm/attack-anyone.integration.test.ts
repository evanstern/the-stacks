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
 * Spec 075 (TASK-0210): an attack may target any present NPC, combatant or
 * not. Rebuilt from run 1 seq 45 ("I take aim and shoot at Snag") in
 * docs/playtests/2026-11-02-runbook-a-playtest.md findings 5 and 6.
 */

loudSkip("attack-anyone.integration.test.ts");
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

/** Scene start, then (unless skipped) the reveal turn, then Kestrel's shot. */
async function run(opts: { reveal: boolean }) {
  const s = script("shoot-snag.json");
  const start = script("scene-start.json");
  // Skipping the reveal drops its four calls and its die.
  const calls = opts.reveal ? s.calls : s.calls.slice(4);
  const w: World = await createWorld({
    dice: opts.reveal ? s.dice : s.dice.slice(1),
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
  if (opts.reveal) {
    await commitAction(w, "We hold. Looking and listening.", "act-listen");
    await tick();
    await drainAll(worker);
  }
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

describe.skipIf(!reachable)("attack anyone (database)", () => {
  it("replays run 1 seq 45: shooting present Snag pulls him in and resolves applied", async () => {
    const { rows, planGate } = await run({ reveal: true });
    expect(resolvedOf(rows)?.payload).toMatchObject({ outcome: "applied" });
    expect(planGate).toEqual([{ actionId: ACTION, ok: true, pull: ["snag"] }]);
    const added = snagAdded(rows);
    const attack = rows.findIndex(
      (r) => r.type === "attack.resolved" && eventOf(r).targetId === "snag",
    );
    expect(added).toBeGreaterThan(-1);
    expect(attack).toBeGreaterThan(added);
    expect(resolvedOf(rows)?.payload).not.toMatchObject({
      refusalCode: "UNKNOWN_COMBATANT",
    });
    // OQ-1 (a): a pull starts no encounter.
    expect(rows.some((r) => r.type === "encounter.started")).toBe(false);
  });

  it("control: an absent Snag is still refused as absent", async () => {
    const { rows, planGate } = await run({ reveal: false });
    expect(resolvedOf(rows)?.payload).toMatchObject({
      outcome: "refused",
      refusalCode: "UNKNOWN_COMBATANT",
    });
    expect(planGate?.[0]).toMatchObject({
      ok: false,
      code: "UNKNOWN_COMBATANT",
      failure: { field: "targetId", id: "snag", reason: "absent" },
    });
    expect(snagAdded(rows)).toBe(-1);
  });
});
