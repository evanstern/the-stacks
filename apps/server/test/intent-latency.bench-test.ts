import { afterAll, describe, expect, it } from "vitest";
import { percentile } from "../src/bench/load/stats.js";
import {
  createWorld,
  db,
  HUMAN_DM,
  loudSkip,
  operator,
  startScene,
  TAMSIN_USER,
  type World,
} from "./dm/world.js";

/**
 * Spec 106 (TASK-0300): CI latency gate. Times a confirmed Intent from `gate.handle` entry to the
 * `onAppended` call carrying its `intent.recorded` row (rows stored), on fixture tables.
 * Run by `pnpm check:timing`, serially. No model call, no provider key.
 */

loudSkip("intent-latency.bench-test.ts");
afterAll(async () => {
  await db?.$client.end();
});

// constitution IX: "A mechanic resolved in code MUST show its fact rows in under 1 s p95 from a confirmed Intent."
const BUDGET_MS = 1000;
const WARMUP = 20;
const SAMPLES = 200;

// Initiative (Tamsin first), then 1993 faces of 2 (schema caps dice at 2000): a miss on every attack, a failed medium check.
const DICE = [20, 1, 1, 1, 1, 1, 1, ...Array.from({ length: 1993 }, () => 2)];

const tamsin = { kind: "human", userId: TAMSIN_USER, role: "player" } as const;

async function turnWorld(): Promise<World> {
  const w = await createWorld({ dice: DICE });
  await startScene(w);
  const { result } = await w.runResolve({
    director: {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
    },
    job: { id: "00000000-0000-4000-8000-000000000a60" },
  });
  if (!result.ok) throw new Error(`turn mode failed: ${result.error.message}`);
  return w;
}

// Spec 117: one Action per turn. Advance the order a full round so Tamsin's Action returns
// before each sample; the 7 advances sit outside the timed span.
async function newRound(w: World): Promise<void> {
  for (let i = 0; i < 7; i++) {
    const r = await w.as(
      { kind: "ai", actor: "ai:dm" },
      {
        kind: "mechanics",
        command: { type: "turn.advance", reason: "next turn" },
      },
    );
    if (!r.ok) throw new Error(`turn.advance refused: ${r.refusal.code}`);
    // The AI DM's advance applies at once; under a human seat it waits for the operator.
    if (r.outcome !== "pending") continue;
    const ok = await w.as(operator, {
      kind: "proposal.approve",
      proposalId: r.proposalId,
    });
    if (!ok.ok) throw new Error(`approve refused: ${ok.refusal.code}`);
  }
}

async function timeOne(
  w: World,
  who: Parameters<World["as"]>[0],
  req: unknown,
  id: string,
  fact: string,
): Promise<number> {
  let stop = -1;
  let hasFact = false;
  const off = w.gate.onAppended((_s, events) => {
    const hit = events.some(
      (e) =>
        e.type === "intent.recorded" &&
        (e.payload as { intent: { id: string } }).intent.id === id,
    );
    if (hit) {
      stop = performance.now();
      hasFact = events.some((e) => e.type === fact);
    }
  });
  const start = performance.now();
  const res = await w.gate.handle(w.sessionId, who, req);
  off();
  if (!res.ok) throw new Error(`${id} refused: ${res.refusal.code}`);
  expect(stop, `${id}: no intent.recorded batch`).toBeGreaterThanOrEqual(0);
  expect(hasFact, `${id}: batch lacks ${fact}`).toBe(true);
  return stop - start;
}

const intent = (id: string, kind: string, extra: object) => ({
  kind: "intent",
  intent: { id, kind, source: "composer", commit: "confirmed", ...extra },
});

const attack = (n: number) =>
  intent(`atk-${n}`, "attack", {
    actor: { kind: "pc", id: "tamsin" },
    targets: [{ kind: "actor", id: "goblin-2" }],
    params: { weapon: "Longsword" },
  });
const playerCheck = (n: number) =>
  intent(`chk-${n}`, "check", {
    actor: { kind: "pc", id: "tamsin" },
    params: { skill: "athletics" },
    text: "I shove the shutter.",
  });
const ruling = (n: number) =>
  intent(`dc-${n}`, "ruling", {
    actor: { kind: "dm" },
    source: "console",
    params: {
      requestId: `chk-${n}`,
      decision: "accept",
      difficulty: "medium",
    },
  });

const calls = (w: World) =>
  Object.values(w.scripted.remaining().calls).reduce((a, b) => a + b, 0);

function report(kind: string, times: number[]): boolean {
  const s = [...times].sort((a, b) => a - b);
  const p50 = percentile(s, 50);
  const p95 = percentile(s, 95);
  const ok = p95 < BUDGET_MS;
  const f = (x: number) => x.toFixed(1);
  console.log(
    `latency ${kind} n=${SAMPLES} warmup=${WARMUP} p50=${f(p50)} p95=${f(p95)} max=${f(s[s.length - 1])} budget=${BUDGET_MS}ms ${ok ? "OK" : "FAIL"}`,
  );
  if (!ok) {
    const slow = times
      .map((t, i) => ({ id: i, t }))
      .sort((a, b) => b.t - a.t)
      .slice(0, 5);
    for (const x of slow) console.log(`  slow ${kind} #${x.id}: ${f(x.t)}ms`);
    throw new Error(
      `${kind}: p95 ${f(p95)} >= budget ${BUDGET_MS}ms (constitution IX)`,
    );
  }
  return ok;
}

describe.skipIf(!db)("intent latency gate (database)", () => {
  it("attack: p95 under budget", async () => {
    const w = await turnWorld();
    const times: number[] = [];
    for (let n = 0; n < WARMUP + SAMPLES; n++) {
      await newRound(w);
      const t = await timeOne(
        w,
        tamsin,
        attack(n),
        `atk-${n}`,
        "attack.resolved",
      );
      if (n >= WARMUP) times.push(t);
    }
    expect(calls(w)).toBe(0);
    report("attack", times);
  }, 400_000);

  it("check: p95 under budget", async () => {
    const w = await turnWorld();
    const seat = await w.as(operator, {
      kind: "dm.seat",
      reason: "A human takes the DM seat",
      after: { kind: "human", userId: HUMAN_DM },
    });
    if (!seat.ok) throw new Error(`seat refused: ${seat.refusal.code}`);
    const times: number[] = [];
    for (let n = 0; n < WARMUP + SAMPLES; n++) {
      await newRound(w);
      const setup = await w.as(tamsin, playerCheck(n));
      if (!setup.ok) throw new Error(`chk-${n} refused: ${setup.refusal.code}`);
      const t = await timeOne(
        w,
        operator,
        ruling(n),
        `dc-${n}`,
        "check.resolved",
      );
      if (n >= WARMUP) times.push(t);
    }
    expect(calls(w)).toBe(0);
    report("check", times);
    console.log("latency gate: PASS");
  }, 400_000);
});
