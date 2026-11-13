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
} from "./world.js";

/**
 * Spec 088 (TASK-0238): an encounter monster can be acted on before its
 * encounter starts. Replays run 1 seq 52-58 and seq 73-92
 * (docs/playtests/2026-11-03-runbook-b-playtest.md findings 16 and 19).
 */

loudSkip("pre-encounter-monster.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const chronicle = {
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
};
// Initiative: Tamsin first, then Odo, Kestrel and the four goblins.
const INIT = [20, 10, 9, 2, 3, 4, 5];
const CHECK = 15;

type Variant =
  | "arrival"
  | "unseen"
  | "same-beat"
  | "earlier"
  | "control"
  | "wrong-id";
// biome-ignore lint/suspicious/noExplicitAny: script JSON
type Call = { purpose: string; respond: { value: Record<string, any> } };

/** Scene start, then turn A (seq 52-58) and/or turn B (seq 73-92) of parley-lookout.json. */
async function run(variant: Variant) {
  const s = script("parley-lookout.json");
  const start = script("scene-start.json");
  const calls = structuredClone(s.calls) as Call[];
  const turnA = calls.slice(0, 3);
  const turnB = calls.slice(3);
  let chosen: Call[];
  let dice: number[];
  if (variant === "unseen" || variant === "same-beat") {
    if (variant === "same-beat") turnB[0].respond.value.arrivals = ["goblin-3"];
    chosen = turnB;
    dice = [...INIT, CHECK];
  } else if (variant === "earlier") {
    chosen = [...turnA, ...turnB];
    dice = [CHECK, ...INIT, CHECK];
  } else {
    if (variant === "control") delete turnA[0].respond.value.arrivals;
    chosen = turnA;
    dice = [CHECK];
  }
  const w = await createWorld({
    dice,
    calls: [...start.calls, ...chosen, chronicle, chronicle, chronicle],
  });
  const { worker } = workerFor(w);
  await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
    start: {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: TAMSIN_USER, kestrel: KESTREL_USER },
    },
  });
  await drainAll(worker);
  const ids =
    variant === "unseen" || variant === "same-beat"
      ? ["act-coin"]
      : variant === "earlier"
        ? ["act-parley", "act-coin"]
        : ["act-parley"];
  for (const id of ids) {
    await commitAction(w, "Tamsin talks to the lookout.", id);
    await tick();
    await drainAll(worker);
  }
  const jobs = await listDmJobs(requireDb(), w.sessionId, 50, "turn");
  const planGates = jobs
    .map(
      (j) =>
        (j.result as { checkpoint?: { planGate?: PlanVerdict[] } } | null)
          ?.checkpoint?.planGate,
    )
    .filter((g): g is PlanVerdict[] => !!g);
  const requests = w.scripted.provider.chatCalls.map((c) => ({
    purpose: c.request.purpose,
    text: JSON.stringify(c.request.messages),
  }));
  return { rows: await readRows(w), planGates, requests };
}

type Rows = Awaited<ReturnType<typeof readRows>>;
const eventOf = (r: { payload: unknown }) =>
  // biome-ignore lint/suspicious/noExplicitAny: event payloads vary by type
  (r.payload as { event: Record<string, any> }).event;
const added = (rows: Rows) =>
  rows.flatMap((r, i) =>
    r.type === "combatant.added" && eventOf(r).combatantId === "goblin-3"
      ? [i]
      : [],
  );
const resolved = (rows: Rows, id: string) =>
  rows.find(
    (r) =>
      r.type === "action.resolved" &&
      (r.payload as { actionId: string }).actionId === id,
  );
const unknown = (gates: PlanVerdict[][]) => gates.flat().filter((v) => !v.ok);
const opposed = (rows: Rows) =>
  rows.filter(
    (r) => r.type === "check.resolved" && eventOf(r).opposition?.opponentId,
  );

describe.skipIf(!reachable)("pre-encounter monster (database)", () => {
  it("seq 52-58, free mode: the arrival logs before the opposed check", async () => {
    const { rows, planGates } = await run("arrival");
    const a = added(rows);
    expect(a).toHaveLength(1);
    const check = rows.findIndex(
      (r) => r.type === "check.resolved" && eventOf(r).opposition,
    );
    expect(check).toBeGreaterThan(a[0]);
    expect(eventOf(rows[check]).opposition).toMatchObject({
      opponentId: "goblin-3",
      rule: "influence",
    });
    expect(resolved(rows, "act-parley")?.payload).toMatchObject({
      outcome: "applied",
    });
    expect(unknown(planGates)).toHaveLength(0);
    expect(rows.some((r) => r.type === "encounter.started")).toBe(false);
  });

  it("seq 73-92, unseen: the same-beat encounter start names goblin-3 and the check rolls", async () => {
    const { rows, planGates, requests } = await run("unseen");
    expect(rows.some((r) => r.type === "encounter.started")).toBe(true);
    expect(added(rows)).toHaveLength(1);
    expect(opposed(rows)).toHaveLength(1);
    expect(resolved(rows, "act-coin")?.payload).toMatchObject({
      outcome: "applied",
    });
    expect(unknown(planGates)).toHaveLength(0);
    const interpret = requests.find((q) => q.purpose === "dm.interpret");
    expect(interpret?.text).toContain("Arriving this beat");
    expect(interpret?.text).toContain("goblin-3");
  });

  it("seq 73-92, arrived earlier: the encounter still starts, goblin-3 is added once", async () => {
    const { rows, planGates } = await run("earlier");
    expect(rows.filter((r) => r.type === "encounter.started")).toHaveLength(1);
    expect(added(rows)).toHaveLength(1);
    const started = rows.find((r) => r.type === "encounter.started");
    const ev = eventOf(started as (typeof rows)[number]);
    const order = ((ev.after ?? ev).order ?? []) as {
      combatantId?: string;
      id?: string;
    }[];
    console.log(JSON.stringify(ev).slice(0, 700));
    expect(
      order.filter((o) => (o.combatantId ?? o.id) === "goblin-3"),
    ).toHaveLength(1);
    expect(opposed(rows)).toHaveLength(2);
    expect(unknown(planGates)).toHaveLength(0);
  });

  it("seq 73-92, arrival and encounter start in one beat: goblin-3 is added once", async () => {
    const { rows, planGates } = await run("same-beat");
    expect(rows.some((r) => r.type === "encounter.started")).toBe(true);
    expect(added(rows)).toHaveLength(1);
    expect(opposed(rows)).toHaveLength(1);
    expect(unknown(planGates)).toHaveLength(0);
  });

  it("control: no arrivals, the planner still pulls the seed NPC in (spec 104 behavior change)", async () => {
    const { rows, planGates } = await run("control");
    // Spec 104: the legacy plan gate refused a seed NPC the beat never arrived (`not-in-snapshot`).
    // The planner's actor table holds every seed NPC as present, so it pulls goblin-3 in and the
    // opposed check rolls. Open question for the orchestrator: whether arrival gating belongs in
    // `buildPlanState` (session-model) or the Director's arrivals.
    expect(resolved(rows, "act-parley")?.payload).toMatchObject({
      outcome: "applied",
    });
    expect(planGates.flat()[0]).toMatchObject({ ok: true });
    expect(added(rows)).toHaveLength(1);
  });
});
