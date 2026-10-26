import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  attackStep,
  checkStep,
  commitAction,
  createWorld,
  db,
  loudSkip,
  payloadOf,
  reachable,
  reading,
  readRows,
  startScene,
  type World,
} from "./world.js";

/**
 * Resolve against a REAL Postgres through the real gate, with scripted dice
 * and no model: the gateway is never asked for anything.
 */

loudSkip("resolve.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

const MARKER = /\[[0-9a-f-]+#\d+\]$/;

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

describe.skipIf(!reachable)("resolve (database)", () => {
  it("runs the Director group at scene start: scene, party, combatants, dm trackers", async () => {
    const w = await createWorld();
    const out = await startScene(w);
    expect(out.submissions.every((s) => s.result === "applied")).toBe(true);
    const rows = await readRows(w);
    const types = rows.map((r) => r.type);
    expect(types.filter((t) => t === "scene.changed")).toHaveLength(1);
    expect(types.filter((t) => t === "party.member.changed")).toHaveLength(3);
    expect(types.filter((t) => t === "combatant.added")).toHaveLength(3);
    const trackers = rows.filter((r) => r.type === "tracker.changed");
    expect(trackers).toHaveLength(2);
    expect(trackers.every((r) => r.visibility === "dm")).toBe(true);
    expect(rows.every((r) => r.actor === "ai:dm")).toBe(true);
    const p = await w.projections();
    expect(p.scene?.sceneId).toBe("greyhollow-ford");
    expect(p.party.map((m) => m.characterId).sort()).toEqual([
      "kestrel",
      "odo",
      "tamsin",
    ]);
    expect(p.party.find((m) => m.characterId === "odo")?.controller).toEqual({
      kind: "ai-companion",
      actor: "ai:companion:odo",
    });
    expect(p.trackers.map((t) => t.filled)).toEqual([0, 0]);
  });

  it("resolves a check and runs the success effects only", async () => {
    const w = await createWorld({ dice: [15] });
    await startScene(w);
    const id = await commitAction(
      w,
      "Tamsin forces the shutter and shoves Odo aside.",
    );
    const out = await run(w, [
      reading(id, [
        checkStep({
          onSuccess: [
            {
              effect: "condition",
              op: "apply",
              targetId: "odo",
              condition: "prone",
              source: "Tamsin's shove",
            },
          ],
          onFailure: [
            {
              effect: "condition",
              op: "apply",
              targetId: "kestrel",
              condition: "prone",
              source: "falling shutter",
            },
          ],
        }),
      ]),
    ]);
    expect(out.actionResults).toMatchObject([
      { actionId: id, outcome: "applied" },
    ]);
    expect(out.actionResults[0]?.batchIds).toHaveLength(2);
    const p = await w.projections();
    const odo = p.party.find((m) => m.characterId === "odo");
    const kestrel = p.party.find((m) => m.characterId === "kestrel");
    expect(odo?.combatant?.conditions.map((c) => c.condition)).toEqual([
      "prone",
    ]);
    expect(kestrel?.combatant?.conditions).toEqual([]);
    expect(p.actions.find((a) => a.actionId === id)?.status).toBe("resolved");
    expect(w.scripted.remaining().dice).toBe(0);
  });

  it("runs the failure effects on a failed check", async () => {
    const w = await createWorld({ dice: [2] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    await run(w, [
      reading(id, [
        checkStep({
          onSuccess: [],
          onFailure: [
            {
              effect: "condition",
              op: "apply",
              targetId: "kestrel",
              condition: "prone",
              source: "falling shutter",
            },
          ],
        }),
      ]),
    ]);
    const p = await w.projections();
    expect(
      p.party.find((m) => m.characterId === "kestrel")?.combatant?.conditions,
    ).toHaveLength(1);
  });

  it("applies damage on a hit, with critical false on a plain hit", async () => {
    const w = await createWorld({ dice: [14, 2] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin spars with Odo.");
    const out = await run(w, [
      reading(id, [attackStep("odo")], { intent: "attack" }),
    ]);
    expect(out.actionResults[0]?.outcome).toBe("applied");
    const rows = await readRows(w);
    const hp = rows.filter((r) => r.type === "hp.changed");
    expect(hp).toHaveLength(1);
    const ev = payloadOf<{
      event: { critical: boolean; after: { current: number } };
    }>(hp[0]).event;
    expect(ev.critical).toBe(false);
    expect(ev.after.current).toBe(5);
  });

  it("sets critical only on a critical hit", async () => {
    const w = await createWorld({ dice: [20, 1, 1, 1, 1] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin spars hard with Kestrel.");
    await run(w, [reading(id, [attackStep("kestrel")], { intent: "attack" })]);
    const rows = await readRows(w);
    const hp = rows.find((r) => r.type === "hp.changed");
    const ev = payloadOf<{ event: { critical: boolean } }>(hp).event;
    expect(ev.critical).toBe(true);
    const attack = rows.find((r) => r.type === "attack.resolved");
    expect(
      payloadOf<{ event: { outcome: string } }>(attack).event.outcome,
    ).toBe("critical-hit");
  });

  it("runs no damage on a miss and still marks the action applied", async () => {
    const w = await createWorld({ dice: [3] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin swings at Odo.");
    const out = await run(w, [
      reading(id, [attackStep("odo")], { intent: "attack" }),
    ]);
    expect(out.actionResults[0]?.outcome).toBe("applied");
    const rows = await readRows(w);
    expect(rows.some((r) => r.type === "hp.changed")).toBe(false);
    expect(w.scripted.remaining().dice).toBe(0);
  });

  it("records an engine refusal as a refused action with the engine's code", async () => {
    const w = await createWorld({ dice: [10] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin swings at a shadow.");
    const out = await run(w, [
      reading(id, [attackStep("nobody")], { intent: "attack" }),
    ]);
    expect(out.actionResults[0]).toMatchObject({
      outcome: "refused",
      refusalCode: "UNKNOWN_COMBATANT",
      batchIds: [],
    });
    const p = await w.projections();
    expect(p.actions.find((a) => a.actionId === id)?.resolved?.outcome).toBe(
      "refused",
    );
    expect(w.scripted.remaining().dice).toBe(1);
  });

  it("marks a clarify or none step no-effect", async () => {
    const w = await createWorld();
    await startScene(w);
    const a = await commitAction(w, "Tamsin looks around.");
    const b = await commitAction(w, "Tamsin mutters something.");
    const out = await run(w, [
      reading(a, [{ step: "none", reason: "A look is certain." }]),
      reading(b, [], { clarify: "Mutters to whom?" }),
    ]);
    expect(out.actionResults.map((r) => r.outcome)).toEqual([
      "no-effect",
      "no-effect",
    ]);
  });

  it("resolves actions in commit order", async () => {
    const w = await createWorld({ dice: [15, 16] });
    await startScene(w);
    const second = await commitAction(w, "Second declared.", "act-b");
    // act-a is declared later but committed first? Commit order is what counts.
    const first = await commitAction(w, "Third declared.", "act-a");
    const out = await run(w, [
      reading(first, [checkStep()]),
      reading(second, [checkStep()]),
    ]);
    expect(out.actionResults.map((r) => r.actionId)).toEqual([second, first]);
    const rows = await readRows(w);
    const resolved = rows
      .filter((r) => r.type === "action.resolved")
      .map((r) => (r.payload as { actionId: string }).actionId);
    expect(resolved).toEqual([second, first]);
  });

  it("ends every mechanics reason with its marker", async () => {
    const w = await createWorld({ dice: [14, 4] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin spars with Odo.");
    await run(w, [reading(id, [attackStep("odo")], { intent: "attack" })]);
    const p = await w.projections();
    const dm = p.ledger.filter((r) => r.batchId !== null);
    expect(dm.length).toBeGreaterThan(0);
    for (const r of dm) expect(r.reason, r.kind).toMatch(MARKER);
  });

  it("never reads a model", async () => {
    const w = await createWorld({ dice: [15] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    await run(w, [reading(id, [checkStep()])]);
    const calls = w.scripted.provider.chatCalls.length;
    expect(calls).toBe(0);
  });

  it("enters turn mode from the Director: SRD combatants, initiative, table mode", async () => {
    const w = await createWorld({ dice: [15, 12, 9, 14, 11, 8, 6] });
    await startScene(w);
    const out = await run(w, [], {
      director: {
        tableMode: {
          to: "turn",
          encounterId: "reed-camp",
          reason: "The goblins rush out.",
        },
      },
    });
    expect(out.submissions.every((s) => s.result === "applied")).toBe(true);
    const p = await w.projections();
    expect(Object.keys(p.engine.combatants).sort()).toEqual([
      "goblin-2",
      "goblin-3",
      "goblin-4",
      "kestrel",
      "odo",
      "snag",
      "tamsin",
    ]);
    expect(p.encounter?.order).toHaveLength(7);
    expect(p.tableMode.mode).toBe("turn");
    const active = p.encounter?.activeCombatantId ?? "";
    const expectedActor = ["snag", "goblin-2", "goblin-3", "goblin-4"].includes(
      active,
    )
      ? "ai:dm"
      : active === "tamsin"
        ? "00000000-0000-4000-8000-0000000000a1"
        : `ai:companion:${active}`;
    expect(p.tableMode.mode === "turn" && p.tableMode.activeActor).toBe(
      expectedActor,
    );
    // A human active actor queues nothing; a monster or companion does.
    expect(out.nextJob === null).toBe(active === "tamsin");
  });

  it("ends the encounter and returns to free mode on a free decision", async () => {
    const w = await createWorld({ dice: [15, 12, 9, 14, 11, 8, 6] });
    await startScene(w);
    await run(w, [], {
      director: {
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
      },
    });
    w.checkpoint.current = {
      ...w.checkpoint.current,
      submissions: [],
      lastSeq: 0,
    };
    await run(w, [], {
      director: { tableMode: { to: "free", reason: "The goblins flee." } },
      job: { id: "00000000-0000-4000-8000-0000000000ab" },
    });
    const p = await w.projections();
    expect(p.encounter).toBeNull();
    expect(p.tableMode.mode).toBe("free");
  });

  it("advances a tracker as a dm-only row and ends the scene", async () => {
    const w = await createWorld();
    await startScene(w);
    await run(w, [], {
      director: {
        trackers: [
          { trackerId: "dusk", advance: 2, reason: "An hour passed." },
        ],
        scene: {
          status: "end",
          outcome: "retreat",
          reason: "The party withdrew.",
        },
      },
    });
    const p = await w.projections();
    expect(p.trackers.find((t) => t.trackerId === "dusk")?.filled).toBe(2);
    expect(p.scene).toBeNull();
    const rows = await readRows(w);
    const last = rows.filter((r) => r.type === "tracker.changed").at(-1);
    expect(last?.visibility).toBe("dm");
  });

  it("replays recorded submissions on a reclaim and submits nothing twice", async () => {
    const w = await createWorld({ dice: [15] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    const first = await w.runResolve({
      readings: [reading(id, [checkStep()])] as never,
    });
    expect(first.result.ok).toBe(true);
    const saved = w.checkpoint.current;
    expect(saved.submissions.length).toBeGreaterThan(0);
    const before = w.submitCalls.count;
    const rowsBefore = (await readRows(w)).length;
    // A reclaim: same planning outputs, attempt 2, the saved checkpoint.
    const again = await w.runResolve({
      readings: [reading(id, [checkStep()])] as never,
      job: { attempt: 2 },
      checkpoint: saved,
    });
    expect(again.result.ok).toBe(true);
    expect(w.submitCalls.count).toBe(before);
    expect((await readRows(w)).length).toBe(rowsBefore);
  });

  it("finds the in-flight submission by its marker", async () => {
    const w = await createWorld({ dice: [15] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    const jobId = "00000000-0000-4000-8000-0000000000aa";
    // The submission landed but the checkpoint save was lost.
    const landed = await w.gate.submit(
      w.sessionId,
      { kind: "ai", actor: "ai:dm" },
      {
        kind: "mechanics",
        command: {
          type: "check.roll",
          combatantId: "tamsin",
          kind: "ability-check",
          ability: "str",
          skill: "athletics",
          expression: "1d20+4",
          mode: "normal",
          dc: 12,
          autoFail: null,
          reason: `Tamsin forces the stuck shutter [${jobId}#1]`,
        },
        actionId: id,
        visibility: "public",
        summary: null,
        rationale: null,
      },
    );
    expect(landed.ok).toBe(true);
    const out = await run(w, [reading(id, [checkStep()])], {
      job: { attempt: 2, id: jobId },
    });
    expect(out.actionResults[0]).toMatchObject({ outcome: "applied" });
    const rows = await readRows(w);
    expect(rows.filter((r) => r.type === "dice.rolled")).toHaveLength(1);
    expect(w.scripted.remaining().dice).toBe(0);
  });
});
