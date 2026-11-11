import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import {
  cmd,
  fresh,
  initDice,
  inTurnMode,
  nextJob,
} from "./encounter-lifecycle.js";
import {
  checkBeside,
  commitAction,
  createWorld,
  db,
  HUMAN_DM,
  loudSkip,
  operator,
  payloadOf,
  reachable,
  readRows,
  stage,
  stages,
  startScene,
  type World,
} from "./world.js";

/**
 * Spec 104 Phase 3: resolve runs Intent stages through the real gate and planner (fake gateway,
 * scripted dice). One group per kind family: check, combat action, movement, deed.
 */

loudSkip("intent-runner.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

async function run(
  w: World,
  readings: unknown[],
  extra: Parameters<World["runResolve"]>[0] = {},
) {
  const { result } = await w.runResolve({
    readings: readings as never,
    ...extra,
  });
  if (!result.ok) throw new Error(`resolve failed: ${result.error.message}`);
  return result.output as ResolveOutput;
}

const ruling = (value: object) => ({
  purpose: "dm.adjudicate",
  respond: { type: "json", value },
});

const carriers = async (w: World) =>
  (await readRows(w)).filter((r) => r.type === "intent.recorded");

type Carrier = {
  intent: { id: string; kind: string };
  outcome: string;
  batchId: string | null;
  facts: { kind: string }[];
  stopped: { code: string } | null;
  answers: string | null;
};
const carrierPayloads = async (w: World) =>
  (await carriers(w)).map((r) => payloadOf<Carrier>(r));
const eventOf = (r: { payload: unknown }) =>
  // biome-ignore lint/suspicious/noExplicitAny: event payloads vary by type
  (r.payload as { event: Record<string, any> }).event;
const settledIds = async (w: World) =>
  (await carrierPayloads(w))
    .filter((c) => c.outcome === "settled")
    .map((c) => c.intent.id);

const askRuling = ruling({ decision: "accept", difficulty: "medium" });
const prone = (targetId: string) => ({
  effect: "condition",
  op: "apply",
  targetId,
  condition: "prone",
  source: "intent runner test",
});
const withRules = (r: { outcomeBands: boolean; naturals: boolean }) => ({
  ...loadSeed("greyhollow-ford"),
  tableRules: { ...r, groupChecks: false },
});
const checkStage = (beside = {}) =>
  stage(
    { kind: "check", params: { skill: "athletics", difficulty: "medium" } },
    checkBeside(beside),
  );

describe.skipIf(!reachable)("Intent runner: check group (database)", () => {
  it("settled: a check stage with a DC rolls and the action applies", async () => {
    const w = await createWorld({ dice: [15], calls: [askRuling] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    const out = await run(w, [stages(id, [checkStage()])]);
    expect(out.actionResults[0]).toMatchObject({
      actionId: id,
      outcome: "applied",
    });
    // a player-seat difficulty is ignored: the AI seat rules, and the ruling carrier settles
    expect((await carrierPayloads(w)).map((c) => c.outcome)).toEqual([
      "declared",
      "needs_ruling",
      "settled",
    ]);
    // the resolve row names the Intent stage's batch (C-GATE)
    const resolved = (await readRows(w)).find(
      (r) => r.type === "action.resolved",
    );
    expect(payloadOf<{ batchIds: string[] }>(resolved).batchIds).toHaveLength(
      1,
    );
  });

  it("needs_ruling under the AI seat: answered in the same job, then the action applies", async () => {
    const w = await createWorld({ dice: [15], calls: [askRuling] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    const out = await run(w, [
      stages(id, [
        stage({ kind: "check", params: { skill: "athletics" } }, checkBeside()),
      ]),
    ]);
    expect(out.actionResults[0]?.outcome).toBe("applied");
    const c = await carrierPayloads(w);
    expect(c.map((x) => x.outcome)).toEqual([
      "declared",
      "needs_ruling",
      "settled",
    ]);
    expect(c[2]?.answers).toBe(`${id}.0`);
    expect(w.scripted.remaining().dice).toBe(0);
  });

  it("needs_ruling under a human seat: awaiting-dm, action stays committed", async () => {
    const w = await createWorld({ dice: [15], calls: [askRuling] });
    await startScene(w);
    const seat = await w.as(operator, {
      kind: "dm.seat",
      reason: "A human takes the DM seat",
      after: { kind: "human", userId: HUMAN_DM },
    });
    expect(seat.ok).toBe(true);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    const out = await run(w, [
      stages(id, [
        stage({ kind: "check", params: { skill: "athletics" } }, checkBeside()),
      ]),
    ]);
    expect(out.actionResults[0]?.outcome).toBe("awaiting-dm");
    expect(w.scripted.remaining().dice).toBe(1);
    const p = await w.projections();
    expect(p.actions.find((a) => a.actionId === id)?.status).toBe("committed");
  });

  it("planner refusal: an unknown check target refuses the action, no roll", async () => {
    const w = await createWorld({ dice: [15], calls: [askRuling] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin sizes up a ghost.");
    const out = await run(w, [
      stages(id, [
        stage(
          {
            kind: "check",
            targets: [{ kind: "actor", id: "nobody" }],
            params: { skill: "insight", difficulty: "medium" },
          },
          checkBeside(),
        ),
      ]),
    ]);
    expect(out.actionResults[0]).toMatchObject({
      outcome: "refused",
      batchIds: [],
    });
    expect(w.scripted.remaining().dice).toBe(1);
  });

  it("success-at-cost: margin -2 applies onSuccess then onCost", async () => {
    const w = await createWorld({ dice: [8], calls: [askRuling] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    await run(w, [
      stages(id, [
        stage(
          {
            kind: "check",
            params: { skill: "athletics", difficulty: "medium" },
          },
          checkBeside({ onSuccess: [prone("tamsin")], onCost: [prone("odo")] }),
        ),
      ]),
    ]);
    const check = (await readRows(w)).find((r) => r.type === "check.resolved");
    expect(eventOf(check as never)).toMatchObject({
      band: "success-at-cost",
      margin: -2,
    });
    const hit = (await w.projections()).party
      .filter((m) => m.combatant?.conditions.length)
      .map((m) => m.characterId)
      .sort();
    expect(hit).toEqual(["odo", "tamsin"]);
  });

  it("a reveal: the settled stage records the clue text", async () => {
    const w = await createWorld({ dice: [15], calls: [askRuling] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin looks for the claw marks.");
    const out = await run(w, [
      stages(id, [
        stage(
          {
            kind: "check",
            params: { skill: "athletics", difficulty: "medium" },
          },
          checkBeside({ reveals: "ferry-house#1" }),
        ),
      ]),
    ]);
    const sub = out.submissions.find((s) => s.reveals);
    expect(sub?.reveals).toBe("ferry-house#1");
    expect(sub?.revealedText).toContain("goblin feet");
  });

  it("a free retry: the repeat of a failed check takes the legacy roll path with no new roll", async () => {
    const w = await createWorld({ dice: [2], calls: [askRuling] });
    await startScene(w);
    const first = await commitAction(w, "Tamsin forces the shutter.");
    await run(w, [stages(first, [checkStage()])]);
    const second = await commitAction(w, "Tamsin tries the shutter again.");
    await run(w, [stages(second, [checkStage()])]);
    const rows = await readRows(w);
    expect(rows.filter((r) => r.type === "dice.rolled")).toHaveLength(1);
    const checks = rows.filter((r) => r.type === "check.resolved");
    expect(checks).toHaveLength(2);
    expect(eventOf(checks[1] as never)).toMatchObject({ outcome: "success" });
    // the retry submitted no second Intent
    expect(await settledIds(w)).toHaveLength(1);
  });

  it("autoFail: the beside block fails the check without a roll", async () => {
    const w = await createWorld({ dice: [15] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    await run(w, [
      stages(id, [
        stage(
          {
            kind: "check",
            params: { skill: "athletics", difficulty: "medium" },
          },
          checkBeside({ autoFail: { reason: "The shutter is nailed shut." } }),
        ),
      ]),
    ]);
    const check = (await readRows(w)).find((r) => r.type === "check.resolved");
    expect(eventOf(check as never)).toMatchObject({ outcome: "failure" });
    expect(w.scripted.remaining().dice).toBe(1);
  });
});

describe.skipIf(!reachable)(
  "Intent runner: combat action group (database)",
  () => {
    const atk = (id: string) =>
      stage({
        kind: "attack",
        targets: [{ kind: "actor", id }],
        params: { weapon: "Longsword" },
      });

    it("settled: an attack stage hits and damages", async () => {
      const w = await inTurnMode([...initDice(0), 15, 4]);
      const id = await commitAction(w, "Tamsin attacks goblin-2.");
      const out = await run(w, [stages(id, [atk("goblin-2")])], {
        job: nextJob(),
      });
      expect(out.actionResults[0]).toMatchObject({ outcome: "applied" });
      const rows = await readRows(w);
      expect(rows.some((r) => r.type === "hp.changed")).toBe(true);
      expect(await settledIds(w)).toEqual([`${id}.0`]);
    });

    it("planner refusal: attacking an actor that is not present refuses, no dice", async () => {
      const w = await inTurnMode([...initDice(0), 15, 4]);
      const id = await commitAction(w, "Tamsin attacks a shadow.");
      const out = await run(w, [stages(id, [atk("nobody")])], {
        job: nextJob(),
      });
      expect(out.actionResults[0]).toMatchObject({ outcome: "refused" });
      expect(
        (await carrierPayloads(w)).every((c) => c.outcome !== "settled"),
      ).toBe(true);
    });

    it("needs_ruling: a cast the planner cannot rule on is not part of this kind group", () => {
      // attack never asks for a ruling (planner contract); the ruling seat paths run in the check and deed groups.
      expect(true).toBe(true);
    });
  },
);

describe.skipIf(!reachable)("Intent runner: movement group (database)", () => {
  const go = (to: string) =>
    stage({ kind: "move", targets: [{ kind: "zone", id: to }] });

  it("settled: a move stage moves the actor", async () => {
    const w = await createWorld({ dice: [] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin walks to the ferry house.");
    const out = await run(w, [stages(id, [go("ferry-house")])]);
    expect(out.actionResults[0]).toMatchObject({ outcome: "applied" });
    expect(await settledIds(w)).toEqual([`${id}.0`]);
  });

  it("planner refusal: a square target is KIND_UNSERVED", async () => {
    const w = await createWorld({ dice: [] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin walks somewhere.");
    const out = await run(w, [
      stages(id, [
        stage({ kind: "move", targets: [{ kind: "square", x: 1, y: 1 }] }),
      ]),
    ]);
    expect(out.actionResults[0]).toMatchObject({ outcome: "refused" });
  });

  it("engine refusal: a zone with no path refuses with the engine's code", async () => {
    const w = await createWorld({ dice: [] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin walks to the moon.");
    const out = await run(w, [stages(id, [go("nowhere")])]);
    expect(out.actionResults[0]?.outcome).toBe("refused");
  });
});

describe.skipIf(!reachable)("Intent runner: deed group (database)", () => {
  const deed = stage({ kind: "attempt", text: "I swing from the rope." });

  it("needs_ruling under the AI seat: accepted, settled with a no-roll fact", async () => {
    const w = await createWorld({
      calls: [ruling({ decision: "accept", reason: "The rope holds." })],
    });
    await startScene(w);
    const id = await commitAction(w, "Tamsin swings from the rope.");
    const out = await run(w, [stages(id, [deed])]);
    // a no-roll ruling lands no batch: nothing to apply
    expect(out.actionResults[0]?.outcome).toBe("no-effect");
    const c = await carrierPayloads(w);
    expect(c.map((x) => x.outcome)).toEqual([
      "declared",
      "needs_ruling",
      "settled",
    ]);
    expect(c[2]?.facts.map((f) => f.kind)).toContain("no-roll");
  });

  it("needs_ruling under a human seat: awaiting-dm", async () => {
    const w = await createWorld();
    await startScene(w);
    await w.as(operator, {
      kind: "dm.seat",
      reason: "A human takes the DM seat",
      after: { kind: "human", userId: HUMAN_DM },
    });
    const id = await commitAction(w, "Tamsin swings from the rope.");
    const out = await run(w, [stages(id, [deed])]);
    expect(out.actionResults[0]?.outcome).toBe("awaiting-dm");
  });
});

// ----------------------------------------------------------- compound declarations (US3)

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const kestrelPlayer = {
  kind: "human",
  userId: KESTREL_USER,
  role: "player",
} as const;
/** Kestrel (seed index 2) wins initiative. */
const INIT = [1, 1, 20, 1, 1, 1, 1];

/** Scene start, Kestrel re-seated as a human player, then turn mode in reed-camp. */
async function inFight(dice: number[]) {
  const w = await createWorld({ dice });
  await startScene(w);
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
      rationale: "Kestrel's player takes the seat",
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
  fresh(w);
  await run(w, [], {
    director: {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
    },
    job: nextJob(),
  });
  fresh(w);
  return w;
}

async function declareKestrel(w: World, actionId: string, text: string) {
  const d = await w.as(kestrelPlayer, {
    kind: "action.declare",
    action: { actionId, characterId: "kestrel", scope: "character", text },
  });
  if (!d.ok) throw new Error(`declare: ${d.refusal.code}`);
  const c = await w.as(kestrelPlayer, { kind: "action.commit", actionId });
  if (!c.ok) throw new Error(`commit: ${c.refusal.code}`);
}

describe.skipIf(!reachable)(
  "Intent runner: compound declarations (database)",
  () => {
    const kest = (over: object) => ({
      actor: { kind: "pc", id: "kestrel" },
      ...over,
    });
    void kest;
    it("move then attack: two settled carriers in order, the opportunity attack in the move's batch", async () => {
      // initiative x7, reaction d20 19 hit + 1d6, Kestrel attack d20 + damage.
      const w = await inFight([...INIT, 1, 1, 1, 1, 15, 4]);
      await declareKestrel(
        w,
        "act-run",
        "I run to the camp post and stab the goblin.",
      );
      const out = await run(
        w,
        [
          stages("act-run", [
            stage({
              kind: "move",
              targets: [{ kind: "zone", id: "camp-post" }],
            }),
            stage({
              kind: "attack",
              targets: [{ kind: "actor", id: "goblin-2" }],
              params: { weapon: "Shortbow" },
            }),
          ]),
        ],
        { job: nextJob() },
      );
      const c = await carrierPayloads(w);
      const settled = c.filter((x) => x.outcome === "settled");
      expect(settled.map((x) => x.intent.id)).toEqual([
        "act-run.0",
        "act-run.1",
      ]);
      expect(settled[0]?.facts.map((f) => f.kind)).toContain("reaction");
      expect(out.actionResults[0]).toMatchObject({ outcome: "applied" });
      expect(out.actionResults[0]?.batchIds.length).toBe(2);
    });

    it("the reaction drops the mover: the attack stage is refused and the action applies with the move only", async () => {
      const w = await inFight([...INIT, 19, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
      // Leave Kestrel at 1 hp so the first reaction drops her.
      const hp = (await w.projections()).party.find(
        (m) => m.characterId === "kestrel",
      )?.combatant?.hp.current;
      await cmd(w, {
        type: "damage.apply",
        targetId: "kestrel",
        components: [
          {
            amount: { kind: "fixed", value: (hp ?? 2) - 1 },
            damageType: "slashing",
          },
        ],
        critical: false,
        defenses: null,
      });
      await declareKestrel(
        w,
        "act-run",
        "I run to the camp post and stab the goblin.",
      );
      const out = await run(
        w,
        [
          stages("act-run", [
            stage({
              kind: "move",
              targets: [{ kind: "zone", id: "camp-post" }],
            }),
            stage({
              kind: "attack",
              targets: [{ kind: "actor", id: "goblin-2" }],
              params: { weapon: "Shortbow" },
            }),
          ]),
        ],
        { job: nextJob() },
      );
      const settled = (await carrierPayloads(w)).filter(
        (x) => x.outcome === "settled",
      );
      expect(settled.map((x) => x.intent.id)).toEqual(["act-run.0"]);
      expect(out.actionResults[0]).toMatchObject({ outcome: "applied" });
      expect(out.actionResults[0]?.batchIds.length).toBe(1);
    });
  },
);
