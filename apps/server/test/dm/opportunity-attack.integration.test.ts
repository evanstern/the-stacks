import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  checkStep,
  createWorld,
  db,
  gatherParty,
  loudSkip,
  reachable,
  reading,
  readRows,
  TAMSIN_USER,
  type World,
} from "./world.js";

/**
 * Spec 079 (TASK-0208): a move away from a hostile draws the engine's
 * reaction. Rebuilt from runbook A playtest run 1 seq 151-161, finding 19
 * (docs/playtests/2026-11-02-runbook-a-playtest.md, PR #109): Kestrel ran to
 * Pell and goblin-2's scimitar hit her as if it were her own action. Rebuilt
 * on the greyhollow-ford seed (it has the same reed-camp encounter) with
 * Kestrel re-seated human.
 */

loudSkip("opportunity-attack.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const kestrelPlayer = {
  kind: "human",
  userId: KESTREL_USER,
  role: "player",
} as const;
type Row = Awaited<ReturnType<typeof readRows>>[number];
const ev = (r: Row) =>
  // biome-ignore lint/suspicious/noExplicitAny: event payloads vary by type
  (r.payload as { event: Record<string, any> }).event;

let jobN = 0;
const nextJob = () => ({
  id: `00000000-0000-4000-8000-${String(++jobN).padStart(12, "0")}`,
});
const fresh = (w: World) => {
  w.checkpoint.current = {
    ...w.checkpoint.current,
    submissions: [],
    lastSeq: 0,
  };
};

async function run(
  w: World,
  readings: unknown[],
  extra: Parameters<World["runResolve"]>[0] = {},
) {
  fresh(w);
  const { result } = await w.runResolve({
    readings: readings as never,
    job: nextJob(),
    ...extra,
  });
  if (!result.ok) throw new Error(`resolve failed: ${result.error.message}`);
  return result.output as ResolveOutput;
}

/** Scene start, Kestrel re-seated as a human player, then turn mode in reed-camp. */
async function inFight(dice: number[]) {
  const w = await createWorld({ dice });
  const start = await w.runResolve({
    job: {
      trigger: "scene-start",
      start: {
        seedId: "greyhollow-ford",
        seats: { tamsin: TAMSIN_USER },
      },
    },
  });
  if (!start.result.ok) throw new Error(start.result.error.message);
  // The default seed seats Kestrel as a companion; run 1 had her human.
  const member = (await w.projections()).party.find(
    (m) => m.characterId === "kestrel",
  );
  if (!member) throw new Error("no kestrel in the party");
  const seated = await w.gate.submit(
    w.sessionId,
    { kind: "ai", actor: "ai:dm" },
    {
      kind: "party",
      summary: "Seat Kestrel",
      rationale: "Run 1 had Kestrel as a human player.",
      reason: "Kestrel's player takes the seat",
      characterId: "kestrel",
      after: {
        characterId: member.characterId,
        name: member.name,
        controller: { kind: "player", userId: KESTREL_USER },
        combatantId: member.combatantId,
        class: member.class,
        level: member.level,
      },
    } as never,
  );
  if (!seated.ok) throw new Error(`seat: ${seated.refusal.code}`);
  await run(w, [], {
    director: {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
    },
  });
  await gatherParty(w);
  return w;
}

async function declare(w: World, actionId: string, text: string) {
  const d = await w.as(kestrelPlayer, {
    kind: "action.declare",
    action: { actionId, characterId: "kestrel", scope: "character", text },
  });
  if (!d.ok) throw new Error(`declare: ${d.refusal.code}`);
  const c = await w.as(kestrelPlayer, { kind: "action.commit", actionId });
  if (!c.ok) throw new Error(`commit: ${c.refusal.code}`);
}

const moveStep = {
  step: "move",
  reason: "Kestrel runs for Pell",
  combatantId: "kestrel",
  leavesReachOf: ["goblin-2"],
};
const freeStep = checkStep({
  reason: "Kestrel cuts Pell's bonds",
  combatantId: "kestrel",
  ability: "dex",
  skill: "sleight-of-hand",
  expression: "1d20+4",
  dc: 10,
});
const TEXT = "I run to Pell and attempt to free him.";
/** Kestrel (seed index 2) wins initiative. */
const INIT = [1, 1, 20, 1, 1, 1, 1];

describe.skipIf(!reachable)("opportunity attack (database)", () => {
  it("replays run 1 seq 151-161: goblin-2 reacts on its own side, then Kestrel's check runs", async () => {
    // initiative x7, reaction d20 19 (+4 = 23 vs AC), 1d6 = 2 (+2 = 4), check d20.
    const w = await inFight([...INIT, 19, 2, 15]);
    await declare(w, "act-run", TEXT);
    await run(w, [reading("act-run", [moveStep, freeStep])]);
    const rows = await readRows(w);
    const at = rows.findIndex(
      (r) => r.type === "attack.resolved" && ev(r).reaction === true,
    );
    expect(at).toBeGreaterThan(-1);
    expect(ev(rows[at] as Row)).toMatchObject({
      attackerId: "goblin-2",
      targetId: "kestrel",
      total: 23,
      outcome: "hit",
    });
    const after = rows.slice(at + 1);
    const spend = after.findIndex((r) => r.type === "encounter.changed");
    const hp = after.findIndex(
      (r) => r.type === "hp.changed" && ev(r).combatantId === "kestrel",
    );
    const check = after.findIndex(
      (r) => r.type === "check.resolved" && ev(r).combatantId === "kestrel",
    );
    expect(spend).toBeGreaterThan(-1);
    expect(hp).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(Math.max(spend, hp));
    // The spend is recorded for the reactor.
    expect(ev(after[spend] as Row).after.reactionsSpent).toEqual(["goblin-2"]);
    const resolved = rows.find(
      (r) =>
        r.type === "action.resolved" &&
        (r.payload as { actionId: string }).actionId === "act-run",
    );
    expect(resolved?.payload).toMatchObject({ outcome: "applied" });
  });

  it("a second move before goblin-2's turn writes no second attack row", async () => {
    const w = await inFight([...INIT, 19, 2, 15]);
    await declare(w, "act-run", TEXT);
    await run(w, [reading("act-run", [moveStep, moveStep, freeStep])]);
    const rows = await readRows(w);
    expect(
      rows.filter((r) => r.type === "attack.resolved" && ev(r).reaction),
    ).toHaveLength(1);
    expect(rows.filter((r) => r.type === "check.resolved")).toHaveLength(1);
  });

  it("refuses run 1's original plan (goblin-2's attack inside Kestrel's action)", async () => {
    const w = await inFight([...INIT, 19, 2]);
    await declare(w, "act-run", TEXT);
    const out = await run(w, [
      reading("act-run", [
        {
          step: "attack",
          reason: "Goblin-2's scimitar catches Kestrel",
          attackerId: "goblin-2",
          targetId: "kestrel",
          expression: "1d20+4",
          mode: "normal",
          targetAc: 14,
          onHit: [],
        },
      ]),
    ]);
    expect(out.planGate?.[0]).toMatchObject({
      ok: false,
      code: "STEP_ACTOR_MISMATCH",
      failure: { field: "attackerId", id: "goblin-2", reason: "not-the-actor" },
    });
    const rows = await readRows(w);
    expect(rows.some((r) => r.type === "attack.resolved")).toBe(false);
    expect(out.actionResults[0]).toMatchObject({
      outcome: "refused",
      refusalCode: "STEP_ACTOR_MISMATCH",
    });
  });

  it("the turn reaching goblin-2 resets its Reaction", async () => {
    const w = await inFight([...INIT, 19, 2, 15]);
    await declare(w, "act-run", TEXT);
    await run(w, [reading("act-run", [moveStep, freeStep])]);
    const resets = async () =>
      (await readRows(w)).filter(
        (r) =>
          r.type === "encounter.changed" &&
          ev(r).combatantId === "goblin-2" &&
          ev(r).before.reactionsSpent?.includes("goblin-2") &&
          !ev(r).after.reactionsSpent?.includes("goblin-2"),
      );
    // Advance (as the DM) until goblin-2 holds the turn.
    for (let i = 0; i < 8; i++) {
      const p = await w.projections();
      if (p.encounter?.activeCombatantId === "goblin-2") break;
      const r = await w.gate.submit(
        w.sessionId,
        { kind: "ai", actor: "ai:dm" },
        {
          kind: "mechanics",
          command: { type: "turn.advance", reason: "next turn" },
          actionId: null,
          visibility: "public",
          summary: null,
          rationale: null,
        } as never,
      );
      if (!r.ok) throw new Error(`advance: ${r.refusal.code}`);
    }
    expect(await resets()).toHaveLength(1);
  });
});
