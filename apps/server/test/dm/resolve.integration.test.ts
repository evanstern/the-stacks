import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { diffSnapshots } from "../../src/dm/snapshot/index.js";
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

  it("names the seqs each submission appended; a refusal names none", async () => {
    const w = await createWorld({ dice: [10] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin swings at a shadow.");
    const out = await run(w, [
      reading(id, [attackStep("nobody")], { intent: "attack" }),
    ]);
    const refused = out.submissions.find((x) => x.result === "refused");
    expect(refused?.seqs).toEqual([]);
    const applied = out.submissions.filter((x) => x.result === "applied");
    expect(applied.length).toBeGreaterThan(0);
    const named = applied.flatMap((x) => x.seqs);
    expect(named.length).toBeGreaterThan(0);
    const seqs = (await readRows(w)).map((r) => r.seq);
    for (const x of applied) {
      expect([...x.seqs].sort((a, b) => a - b)).toEqual(x.seqs);
      for (const q of x.seqs) expect(seqs).toContain(q);
    }
    expect(out.appendedRows.map((r) => r.seq).sort((a, b) => a - b)).toEqual(
      out.submissions.flatMap((x) => x.seqs).sort((a, b) => a - b),
    );
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

  describe("resolve order (decision-0025 §4)", () => {
    let jobN = 0;
    /** A job id distinct from every earlier resolve in the world. */
    const nextJob = () => ({
      id: `00000000-0000-4000-8000-${String(++jobN).padStart(12, "0")}`,
    });
    /** Initiative dice that put the combatant at `first` (party then monster order) on top. */
    const initDice = (first: number) =>
      [1, 1, 1, 1, 1, 1, 1].map((d, i) => (i === first ? 20 : d));
    const TAMSIN_FIRST = 0;
    const SNAG_FIRST = 3;

    /** Starts the scene, then enters turn mode in `reed-camp`; returns with a fresh checkpoint. */
    async function inTurnMode(dice: number[]) {
      const w = await createWorld({ dice });
      await startScene(w);
      await run(w, [], {
        director: {
          tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
        },
        job: nextJob(),
      });
      w.checkpoint.current = {
        ...w.checkpoint.current,
        submissions: [],
        lastSeq: 0,
      };
      return w;
    }
    const freshCheckpoint = (w: World) => {
      w.checkpoint.current = {
        ...w.checkpoint.current,
        submissions: [],
        lastSeq: 0,
      };
    };
    type Row = Awaited<ReturnType<typeof readRows>>[number];
    const seqOf = (
      rows: Row[],
      type: string,
      nth: "first" | "last" = "first",
    ) => {
      const hits = rows.filter((r) => r.type === type);
      const row = nth === "first" ? hits[0] : hits.at(-1);
      if (!row) throw new Error(`no ${type} row`);
      return row.seq;
    };
    const resolvedRow = (rows: Row[], actionId: string) => {
      const row = rows.find(
        (r) =>
          r.type === "action.resolved" &&
          (r.payload as { actionId: string }).actionId === actionId,
      );
      if (!row) throw new Error(`no action.resolved row for ${actionId}`);
      return row;
    };

    it("an action resolves before a free decision ends the encounter, and no turn advances", async () => {
      const w = await inTurnMode([...initDice(TAMSIN_FIRST), 15]);
      const id = await commitAction(w, "Tamsin forces the shutter.");
      freshCheckpoint(w);
      await run(w, [reading(id, [checkStep()])], {
        director: { tableMode: { to: "free", reason: "The goblins flee." } },
        job: nextJob(),
      });
      const rows = await readRows(w);
      const resolved = resolvedRow(rows, id);
      expect((resolved.payload as { outcome: string }).outcome).toBe("applied");
      const ended = seqOf(rows, "encounter.ended");
      const freed = seqOf(rows, "table-mode.changed", "last");
      expect(resolved.seq).toBeLessThan(ended);
      expect(ended).toBeLessThan(freed);
      expect(
        rows.some((r) => r.type === "turn.advanced" && r.seq > ended),
      ).toBe(false);
      expect(rows.some((r) => r.type === "turn.advanced")).toBe(false);
      const p = await w.projections();
      expect(p.tableMode.mode).toBe("free");
    });

    it("an encounter start runs before an action that names a combatant it adds", async () => {
      const w = await createWorld({ dice: [...initDice(TAMSIN_FIRST), 3] });
      await startScene(w);
      const id = await commitAction(
        w,
        "Tamsin lunges at the pot-helmed goblin.",
      );
      freshCheckpoint(w);
      const out = await run(
        w,
        [reading(id, [attackStep("goblin-2")], { intent: "attack" })],
        {
          director: {
            tableMode: {
              to: "turn",
              encounterId: "reed-camp",
              reason: "The goblins rush out.",
            },
          },
          job: nextJob(),
        },
      );
      expect(out.actionResults[0]?.refusalCode).toBeNull();
      expect(out.actionResults[0]?.outcome).toBe("applied");
      const rows = await readRows(w);
      const added = rows.filter(
        (r) =>
          r.type === "combatant.added" &&
          (r.payload as { event: { combatantId: string } }).event
            .combatantId === "goblin-2",
      );
      expect(added).toHaveLength(1);
      const started = seqOf(rows, "encounter.started");
      const resolved = resolvedRow(rows, id);
      expect(added[0]?.seq).toBeLessThan(started);
      expect(started).toBeLessThan(resolved.seq);
      expect(rows.some((r) => r.type === "turn.advanced")).toBe(false);
    });

    it("an npc-turn job runs its step rows before the encounter ends", async () => {
      const w = await inTurnMode([...initDice(SNAG_FIRST), 3]);
      freshCheckpoint(w);
      const out = await run(
        w,
        [
          reading(null, [attackStep("tamsin", { attackerId: "snag" })], {
            intent: "attack",
          }),
        ],
        {
          director: { tableMode: { to: "free", reason: "The goblins flee." } },
          job: { ...nextJob(), trigger: "npc-turn" },
        },
      );
      expect(out.npcTurn).not.toBeNull();
      const rows = await readRows(w);
      const attack = seqOf(rows, "attack.resolved");
      expect(attack).toBeLessThan(seqOf(rows, "encounter.ended"));
      expect(rows.some((r) => r.type === "turn.advanced")).toBe(false);
    });

    it("tracker advances and the scene end follow the action, in order", async () => {
      const w = await inTurnMode([...initDice(TAMSIN_FIRST), 15]);
      const id = await commitAction(w, "Tamsin forces the shutter.");
      freshCheckpoint(w);
      await run(w, [reading(id, [checkStep()])], {
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
        job: nextJob(),
      });
      const rows = await readRows(w);
      const resolved = resolvedRow(rows, id).seq;
      const tracker = seqOf(rows, "tracker.changed", "last");
      const ended = seqOf(rows, "encounter.ended");
      const scene = seqOf(rows, "scene.changed", "last");
      expect(resolved).toBeLessThan(tracker);
      expect(tracker).toBeLessThan(ended);
      expect(ended).toBeLessThan(scene);
      const p = await w.projections();
      expect(p.scene).toBeNull();
    });

    it("a hold runs the opening and closing moves only", async () => {
      const w = await createWorld();
      await startScene(w);
      const id = await commitAction(w, "Tamsin forces the shutter.");
      freshCheckpoint(w);
      const out = await run(w, [reading(id, [checkStep()])], {
        director: {
          beat: { decision: "hold", companions: ["odo"], reason: "ask Odo" },
          trackers: [
            { trackerId: "dusk", advance: 1, reason: "An hour passed." },
          ],
        },
        job: nextJob(),
      });
      expect(out.submissions.length).toBeGreaterThan(0);
      expect(
        out.submissions.some(
          (s) => s.key.startsWith("act:") || s.key.startsWith("npc:"),
        ),
      ).toBe(false);
      expect(out.actionResults).toEqual([]);
      expect(out.submissions.map((s) => s.key)).toEqual([
        "director:tracker:dusk",
      ]);
    });

    it("a refused action still resolves before the encounter ends (rows 260-265 of the F54 evidence)", async () => {
      const w = await inTurnMode([...initDice(TAMSIN_FIRST), 10]);
      const id = await commitAction(w, "Tamsin bargains with Pell.");
      freshCheckpoint(w);
      // TASK-0112 AC #5 will refuse this plan at the plan gate; until then the
      // engine refuses the step, and the refusal must land before the encounter ends.
      const out = await run(
        w,
        [reading(id, [checkStep({ combatantId: "pell" })])],
        {
          director: { tableMode: { to: "free", reason: "The goblins flee." } },
          job: nextJob(),
        },
      );
      expect(out.actionResults[0]).toMatchObject({
        outcome: "refused",
        refusalCode: "UNKNOWN_COMBATANT",
      });
      const rows = await readRows(w);
      expect(resolvedRow(rows, id).seq).toBeLessThan(
        seqOf(rows, "encounter.ended"),
      );
    });
  });

  describe("S1 and the diff", () => {
    it("a scripted-dice damage hit gives S1 the lowered HP and the exact diff", async () => {
      const w = await createWorld({ dice: [14, 8] });
      await startScene(w);
      const id = await commitAction(w, "Tamsin spars with Odo.");
      const { result, ctx } = await w.runResolve({
        readings: [
          reading(id, [attackStep("odo")], { intent: "attack" }),
        ] as never,
      });
      if (!result.ok) throw new Error("resolve failed");
      const out = result.output as ResolveOutput;
      const s0 = ctx.results.assemble?.snapshot;
      if (!s0) throw new Error("no S0");
      const p = await w.projections();
      const odoNow = p.engine.combatants.odo;
      const odo = out.snapshot.actors.find((a) => a.id === "odo");
      expect(odo?.hp?.current).toBe(odoNow?.hp.current);
      expect(odo?.hp?.current).toBeLessThan(
        s0.actors.find((a) => a.id === "odo")?.hp?.current ?? 0,
      );
      expect(out.snapshot.throughSeq).toBe(p.throughSeq);
      expect(out.diff).toEqual(diffSnapshots(s0, out.snapshot));
      const odoChanges = out.diff.actors.filter((c) => c.actorId === "odo");
      expect(odoChanges.some((c) => c.kind === "hp")).toBe(true);
      expect(out.diff.actors.every((c) => c.actorId === "odo")).toBe(true);
      if (odoNow?.lifeState !== "conscious") {
        expect(odo?.lifeState).toBe(odoNow?.lifeState);
        expect(odoChanges.some((c) => c.kind === "life-state")).toBe(true);
      }
    });

    it("an encounter start gives joined actors and stage entries", async () => {
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
      const joined = out.diff.actors
        .filter((c) => c.kind === "joined")
        .map((c) => c.actorId);
      expect(joined).toEqual(
        expect.arrayContaining(["goblin-2", "goblin-3", "goblin-4"]),
      );
      const kinds = out.diff.stage.map((c) => c.kind);
      expect(kinds).toContain("encounter-started");
      expect(kinds).toContain("table-mode");
      expect(out.snapshot.stage.encounter).not.toBeNull();
    });

    it("a no-op turn gives an empty diff", async () => {
      const w = await createWorld();
      await startScene(w);
      const out = await run(w, []);
      expect(out.diff.actors).toEqual([]);
      expect(out.diff.stage).toEqual([]);
    });

    it("a reclaim rebuilds an equal S1", async () => {
      const w = await createWorld({ dice: [15] });
      await startScene(w);
      const id = await commitAction(w, "Tamsin forces the shutter.");
      const first = await w.runResolve({
        readings: [reading(id, [checkStep()])] as never,
      });
      if (!first.result.ok) throw new Error("first failed");
      const saved = w.checkpoint.current;
      const again = await w.runResolve({
        readings: [reading(id, [checkStep()])] as never,
        job: { attempt: 2 },
        checkpoint: saved,
      });
      if (!again.result.ok) throw new Error("reclaim failed");
      const a = first.result.output as ResolveOutput;
      const b = again.result.output as ResolveOutput;
      expect(b.snapshot).toEqual(a.snapshot);
    });
  });
});
