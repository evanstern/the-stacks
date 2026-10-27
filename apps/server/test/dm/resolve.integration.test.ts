import { mechanicsProposal } from "@the-stacks/session-model";
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
    const id = await commitAction(w, "Tamsin swings at Kestrel.");
    // An engine refusal that passes the plan gate: both ids are S0 combatants.
    const out = await run(w, [
      reading(id, [attackStep("kestrel", { expression: "not dice" })], {
        intent: "attack",
      }),
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
      expect(out.planGate).toEqual([{ actionId: id, ok: true }]);
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
      // The plan gate (TASK-0112) refuses this plan; the refusal must land
      // before the encounter ends.
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

    describe("plan gate (TASK-0112)", () => {
      it("refuses the whole action group when a later step names a non-combatant, with no row from step 0", async () => {
        const w = await inTurnMode([...initDice(TAMSIN_FIRST), 15]);
        const id = await commitAction(
          w,
          "Tamsin forces the shutter, then Pell.",
        );
        freshCheckpoint(w);
        const before = (await readRows(w)).length;
        const out = await run(
          w,
          [reading(id, [checkStep(), checkStep({ combatantId: "pell" })])],
          { job: nextJob() },
        );
        expect(out.actionResults).toMatchObject([
          {
            actionId: id,
            outcome: "refused",
            refusalCode: "UNKNOWN_COMBATANT",
          },
        ]);
        expect(out.planGate).toMatchObject([
          {
            actionId: id,
            ok: false,
            code: "UNKNOWN_COMBATANT",
            failure: { stepIndex: 1, id: "pell", reason: "not-a-combatant" },
          },
        ]);
        const rows = (await readRows(w)).slice(before);
        expect(rows.some((r) => r.type === "check.resolved")).toBe(false);
        expect(
          out.submissions.map((s) => s.key).filter((k) => k.startsWith("act:")),
        ).toEqual([`act:${id}:resolve`]);
        expect(w.scripted.remaining().dice).toBe(1);
      });

      it("a refused NPC group runs no step and the turn still advances", async () => {
        const w = await inTurnMode([...initDice(SNAG_FIRST), 3]);
        freshCheckpoint(w);
        const before = (await readRows(w)).length;
        const out = await run(
          w,
          [reading(null, [attackStep("pell", { attackerId: "snag" })])],
          { job: { ...nextJob(), trigger: "npc-turn" } },
        );
        expect(out.planGate).toMatchObject([
          { actionId: null, ok: false, failure: { id: "pell" } },
        ]);
        expect(out.npcTurn).toMatchObject({ batchIds: [], awaitingDm: false });
        const rows = (await readRows(w)).slice(before);
        expect(rows.some((r) => r.type === "attack.resolved")).toBe(false);
        expect(rows.some((r) => r.type === "turn.advanced")).toBe(true);
      });

      it("records an all-valid verdict and runs the plan unchanged", async () => {
        const w = await createWorld({ dice: [15] });
        await startScene(w);
        const id = await commitAction(w, "Tamsin forces the shutter.");
        const out = await run(w, [reading(id, [checkStep()])]);
        expect(out.planGate).toEqual([{ actionId: id, ok: true }]);
        expect(out.actionResults[0]?.outcome).toBe("applied");
      });
    });

    describe("settling (TASK-0112, plan D4)", () => {
      const dm = { kind: "ai", actor: "ai:dm" } as const;
      /** An engine command through the gate as the DM; throws on refusal. */
      async function cmd(w: World, command: Record<string, unknown>) {
        const res = await w.gate.submit(
          w.sessionId,
          dm,
          mechanicsProposal({ reason: "setup", ...command } as never, {
            actionId: null,
            summary: "setup",
            rationale: "setup",
          }),
        );
        if (!res.ok) throw new Error(`setup refused: ${res.refusal.code}`);
      }
      /** Drops a party member to 0 HP: unconscious, dying. */
      async function down(w: World, id: string) {
        const hp = (await w.projections()).engine.combatants[id]?.hp.current;
        await cmd(w, {
          type: "damage.apply",
          targetId: id,
          components: [
            { amount: { kind: "fixed", value: hp }, damageType: "slashing" },
          ],
          critical: false,
          defenses: null,
        });
      }
      const stun = (w: World, id: string) =>
        cmd(w, {
          type: "condition.apply",
          targetId: id,
          condition: "stunned",
          source: "test",
          expiresAt: null,
        });
      const count = (rows: Row[], type: string) =>
        rows.filter((r) => r.type === type).length;
      const eventOf = (r: Row) =>
        (r.payload as { event: Record<string, unknown> }).event;
      const saveRolls = (rows: Row[]) =>
        rows.filter(
          (r) =>
            r.type === "dice.rolled" && eventOf(r).purpose === "death-save",
        );

      /** Tamsin (first) acts and the turn advances onto the next combatant. */
      async function tamsinActs(w: World) {
        const id = await commitAction(w, "Tamsin forces the shutter.");
        freshCheckpoint(w);
        const before = (await readRows(w)).length;
        const out = await run(w, [reading(id, [checkStep()])], {
          job: nextJob(),
        });
        return { out, rows: (await readRows(w)).slice(before) };
      }

      it("rolls the unconscious party member's death save, then the turn passes", async () => {
        const w = await inTurnMode([...initDice(TAMSIN_FIRST), 15, 12]);
        await down(w, "kestrel");
        const { out, rows } = await tamsinActs(w);
        expect(saveRolls(rows)).toHaveLength(1);
        expect(count(rows, "death-saves.changed")).toBe(1);
        // The action's own advance, then the settle advance past kestrel.
        expect(count(rows, "turn.advanced")).toBe(2);
        expect(out.submissions.map((s) => s.key)).toEqual(
          expect.arrayContaining(["settle:0:save", "settle:0:advance"]),
        );
        const p = await w.projections();
        expect(p.encounter?.activeCombatantId).toBe("goblin-2");
        expect(p.tableMode).toMatchObject({
          mode: "turn",
          activeActor: "ai:dm",
        });
        expect(out.nextJob).toEqual({ kind: "turn", trigger: "npc-turn" });
        expect(w.scripted.remaining().dice).toBe(0);
      });

      it("passes a stable combatant with no roll", async () => {
        const w = await inTurnMode([...initDice(TAMSIN_FIRST), 15]);
        await down(w, "kestrel");
        await cmd(w, { type: "stabilize", targetId: "kestrel" });
        const { rows } = await tamsinActs(w);
        expect(saveRolls(rows)).toHaveLength(0);
        expect(count(rows, "turn.advanced")).toBe(2);
        expect((await w.projections()).encounter?.activeCombatantId).toBe(
          "goblin-2",
        );
      });

      it("keeps the turn on a natural 20: 1 HP, conscious, table mode on it", async () => {
        const w = await inTurnMode([...initDice(TAMSIN_FIRST), 15, 20]);
        await down(w, "kestrel");
        const { out, rows } = await tamsinActs(w);
        expect(saveRolls(rows)).toHaveLength(1);
        // Only the action's own advance: settling did not advance past kestrel.
        expect(count(rows, "turn.advanced")).toBe(1);
        const p = await w.projections();
        expect(p.engine.combatants.kestrel).toMatchObject({
          lifeState: "conscious",
          hp: { current: 1 },
        });
        expect(p.encounter?.activeCombatantId).toBe("kestrel");
        expect(p.tableMode).toMatchObject({
          mode: "turn",
          activeActor: "ai:companion:kestrel",
        });
        expect(out.nextJob).toMatchObject({ kind: "companion" });
      });

      it("a third failed save kills the combatant and the turn passes", async () => {
        // A natural 1 counts two failures; the settled save adds the third.
        const w = await inTurnMode([...initDice(TAMSIN_FIRST), 1, 15, 5]);
        await down(w, "kestrel");
        await cmd(w, {
          type: "death-save.roll",
          targetId: "kestrel",
          mode: "normal",
        });
        const { rows } = await tamsinActs(w);
        expect(saveRolls(rows)).toHaveLength(1);
        const p = await w.projections();
        expect(p.engine.combatants.kestrel?.lifeState).toBe("dead");
        expect(count(rows, "turn.advanced")).toBe(2);
        expect(p.encounter?.activeCombatantId).toBe("goblin-2");
      });

      it("an encounter start whose first combatant is downed settles it", async () => {
        const w = await createWorld({ dice: [...initDice(2), 12] });
        await startScene(w);
        await down(w, "kestrel");
        const out = await run(w, [], {
          director: {
            tableMode: {
              to: "turn",
              encounterId: "reed-camp",
              reason: "Fight.",
            },
          },
          job: nextJob(),
        });
        const rows = await readRows(w);
        expect(count(rows, "encounter.started")).toBe(1);
        expect(saveRolls(rows)).toHaveLength(1);
        expect(count(rows, "turn.advanced")).toBe(1);
        const p = await w.projections();
        expect(p.encounter?.activeCombatantId).toBe("goblin-2");
        expect(p.tableMode).toMatchObject({
          mode: "turn",
          activeActor: "ai:dm",
        });
        expect(out.nextJob).toEqual({ kind: "turn", trigger: "npc-turn" });
      });

      it("passes an unable non-party combatant with no roll and queues no job for it", async () => {
        const w = await inTurnMode([...initDice(TAMSIN_FIRST), 15]);
        await down(w, "kestrel");
        await cmd(w, { type: "stabilize", targetId: "kestrel" });
        await stun(w, "goblin-2");
        const { out, rows } = await tamsinActs(w);
        expect(saveRolls(rows)).toHaveLength(0);
        expect(count(rows, "turn.advanced")).toBe(3);
        const p = await w.projections();
        expect(p.encounter?.activeCombatantId).toBe("goblin-3");
        // The queued job belongs to the combatant the turn stops on.
        expect(out.nextJob).toEqual({ kind: "turn", trigger: "npc-turn" });
        expect(p.tableMode).toMatchObject({ activeActor: "ai:dm" });
      });

      it("a reclaim finds the landed death save by its marker and rolls nothing twice", async () => {
        const crash = { armed: false };
        const w = await createWorld({
          dice: [...initDice(TAMSIN_FIRST), 15, 12],
          gate: (g) => ({
            ...g,
            submit: async (...args) => {
              const res = await g.submit(...args);
              const proposal = args[2] as {
                kind: string;
                command?: { type?: string };
              };
              if (
                crash.armed &&
                proposal.kind === "mechanics" &&
                proposal.command?.type === "death-save.roll"
              ) {
                crash.armed = false;
                // The save landed; the process dies before its checkpoint.
                throw new Error("crash after the death save");
              }
              return res;
            },
          }),
        });
        await startScene(w);
        await run(w, [], {
          director: {
            tableMode: {
              to: "turn",
              encounterId: "reed-camp",
              reason: "Fight.",
            },
          },
          job: nextJob(),
        });
        freshCheckpoint(w);
        await down(w, "kestrel");
        const id = await commitAction(w, "Tamsin forces the shutter.");
        const job = nextJob();
        const readings = [reading(id, [checkStep()])] as never;
        crash.armed = true;
        await expect(w.runResolve({ readings, job })).rejects.toThrow(/crash/);
        const saved = w.checkpoint.current;
        expect(saved.submissions.map((x) => x.key)).not.toContain(
          "settle:0:save",
        );
        const rowsMid = await readRows(w);
        expect(saveRolls(rowsMid)).toHaveLength(1);

        const again = await w.runResolve({
          readings,
          job: { ...job, attempt: 2 },
          checkpoint: saved,
        });
        expect(again.result.ok).toBe(true);
        const rows = await readRows(w);
        expect(saveRolls(rows)).toHaveLength(1);
        expect(count(rows, "death-saves.changed")).toBe(1);
        expect(w.scripted.remaining().dice).toBe(0);
        const p = await w.projections();
        expect(p.encounter?.activeCombatantId).toBe("goblin-2");
        expect(count(rows, "turn.advanced")).toBe(2);
      });

      it("a reclaim after a landed advance does not skip the turn-advance group and writes no duplicate rows", async () => {
        const crash = { armed: false };
        const w = await createWorld({
          dice: [...initDice(TAMSIN_FIRST), 15],
          gate: (g) => ({
            ...g,
            submit: async (...args) => {
              const res = await g.submit(...args);
              const proposal = args[2] as {
                kind: string;
                command?: { type?: string };
              };
              if (
                crash.armed &&
                proposal.kind === "mechanics" &&
                proposal.command?.type === "turn.advance"
              ) {
                crash.armed = false;
                // The advance landed; the process dies before its checkpoint.
                throw new Error("crash after the advance");
              }
              return res;
            },
          }),
        });
        await startScene(w);
        await run(w, [], {
          director: {
            tableMode: {
              to: "turn",
              encounterId: "reed-camp",
              reason: "Fight.",
            },
          },
          job: nextJob(),
        });
        freshCheckpoint(w);
        const id = await commitAction(w, "Tamsin forces the shutter.");
        const job = nextJob();
        const readings = [reading(id, [checkStep()])] as never;
        const before = (await readRows(w)).length;
        crash.armed = true;
        await expect(w.runResolve({ readings, job })).rejects.toThrow(/crash/);
        const saved = w.checkpoint.current;
        expect(saved.submissions.map((x) => x.key)).not.toContain("advance");
        expect(count((await readRows(w)).slice(before), "turn.advanced")).toBe(
          1,
        );

        const again = await w.runResolve({
          readings,
          job: { ...job, attempt: 2 },
          checkpoint: saved,
        });
        expect(again.result.ok).toBe(true);
        const rows = (await readRows(w)).slice(before);
        // The landed advance is found by its marker: one advance, one check, no repeat.
        expect(count(rows, "turn.advanced")).toBe(1);
        expect(
          rows.filter(
            (r) =>
              r.type === "dice.rolled" && eventOf(r).purpose !== "death-save",
          ),
        ).toHaveLength(1);
        expect(count(rows, "action.resolved")).toBe(1);
        // The group still ran: the table mode follows the new active combatant.
        const p = await w.projections();
        expect(p.encounter?.activeCombatantId).not.toBe("tamsin");
        expect(p.tableMode).toMatchObject({ mode: "turn" });
        expect(w.scripted.remaining().dice).toBe(0);
      });

      it("stops after one lap when every combatant is unable", async () => {
        const w = await inTurnMode([...initDice(SNAG_FIRST)]);
        for (const id of Object.keys(
          (await w.projections()).engine.combatants,
        )) {
          await stun(w, id);
        }
        freshCheckpoint(w);
        const before = (await readRows(w)).length;
        const out = await run(
          w,
          [reading(null, [{ step: "none", reason: "Snag reels." }])],
          {
            job: { ...nextJob(), trigger: "npc-turn" },
          },
        );
        const rows = (await readRows(w)).slice(before);
        // The npc-turn advance, then one lap (seven combatants) of settle advances.
        expect(count(rows, "turn.advanced")).toBe(8);
        expect(saveRolls(rows)).toHaveLength(0);
        expect(
          out.submissions.filter((s) => s.key.endsWith(":advance")),
        ).toHaveLength(7);
      });
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
