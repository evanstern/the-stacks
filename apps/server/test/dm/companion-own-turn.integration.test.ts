import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  attackStep,
  checkStep,
  createWorld,
  db,
  loudSkip,
  player,
  reachable,
  reading,
  readRows,
  spellStep,
  startScene,
  type World,
} from "./world.js";

/**
 * Spec 087 (TASK-0244): a companion acts in its own turn. Rebuilt from
 * runbook B playtest run 1 finding 40, seq 206-230
 * (docs/playtests/2026-11-03-runbook-b-playtest.md, session 729a6c5c): the
 * party action "Odo casts Cure Wounds on Tamsin" resolved on Tamsin's turn,
 * so Odo acted twice in round 2. Rows are rebuilt from the log on the
 * greyhollow-ford seed; the seq numbers name the log's rows, not this
 * test's. Odo is the last in the order here, so he is off turn until round 1
 * ends.
 */

loudSkip("companion-own-turn.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

type Row = Awaited<ReturnType<typeof readRows>>[number];
const ev = (r: Row) =>
  // biome-ignore lint/suspicious/noExplicitAny: event payloads vary by type
  (r.payload as { event: Record<string, any> }).event;

async function run(w: World, readings: unknown[], extra = {}) {
  // Each call is a new job: clear the checkpoint's recorded submissions.
  w.checkpoint.current = {
    ...w.checkpoint.current,
    submissions: [],
    lastSeq: 0,
  };
  const { result } = await w.runResolve({
    readings: readings as never,
    ...extra,
  });
  if (!result.ok) throw new Error(`resolve failed: ${result.error.message}`);
  return result.output as ResolveOutput;
}

async function declare(
  w: World,
  actionId: string,
  scope: "party" | "character",
  text: string,
) {
  const d = await w.as(player, {
    kind: "action.declare",
    action: { actionId, characterId: "tamsin", scope, text },
  });
  if (!d.ok) throw new Error(`declare: ${d.refusal.code}`);
  const c = await w.as(player, { kind: "action.commit", actionId });
  if (!c.ok)
    throw new Error(
      `commit ${actionId}: ${c.refusal.code} ${JSON.stringify((await w.projections()).tableMode)}`,
    );
}

const active = async (w: World) =>
  (await w.projections()).encounter?.activeCombatantId;

/** Tamsin (seed index 0) leads, Odo (index 1) follows her. */
const INIT = [20, 15, 1, 1, 1, 1, 1];
const CAST = "Odo casts Cure Wounds on Tamsin.";
const castStep = spellStep("tamsin", {
  reason: "Odo heals Tamsin",
  spellId: "cure-wounds",
  slotLevel: 1,
});
const castReading = (id: string) => reading(id, [castStep], { intent: "cast" });
const slots = async (w: World) =>
  (await readRows(w)).filter(
    (r) => r.type === "spell-slots.changed" && ev(r).after.expended === 1,
  );

async function inFight(dice: number[]) {
  const w = await createWorld({ dice });
  await startScene(w);
  await run(w, [], {
    director: {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
    },
  });
  return w;
}

describe.skipIf(!reachable)(
  "a companion acts in its own turn (database)",
  () => {
    it("replays run 1 seq 206-230: the cast waits, then resolves once on Odo's turn", async () => {
      const w = await inFight([...INIT, 15, 6, 6, 6]);
      expect(await active(w)).toBe("tamsin");
      await declare(w, "act-cast", "party", CAST);

      // seq 206-210: off turn, the group is held. No slot spent, still committed.
      const held = await run(w, [castReading("act-cast")]);
      expect(held.planGate?.[0]).toMatchObject({
        ok: false,
        code: "TURN_HELD",
        heldFor: "odo",
      });
      expect(held.actionResults[0]).toMatchObject({
        outcome: "held",
        heldFor: "odo",
      });
      expect(await slots(w)).toHaveLength(0);
      expect(await active(w)).toBe("tamsin");

      // seq 211-221: Tamsin's own action ends her turn; the group stays held and
      // the turn reaches Odo.
      await declare(w, "act-own", "character", "Tamsin steadies her shield.");
      const handoff = await run(w, [
        castReading("act-cast"),
        reading("act-own", [checkStep({ reason: "Tamsin braces" })]),
      ]);
      expect(
        handoff.actionResults.find((r) => r.actionId === "act-cast")?.outcome,
      ).toBe("held");
      expect(
        handoff.actionResults.find((r) => r.actionId === "act-own")?.outcome,
      ).toBe("applied");
      expect(await slots(w)).toHaveLength(0);
      expect(await active(w)).toBe("odo");
      expect(handoff.nextJob).toEqual({ kind: "turn", trigger: "held" });

      // seq 222-230: the held turn job. The cast applies once; the turn moves on.
      const released = await run(w, [castReading("act-cast")]);
      expect(released.actionResults[0]).toMatchObject({
        outcome: "applied",
        stepActors: ["odo"],
      });
      const spent = await slots(w);
      expect(spent).toHaveLength(1);
      expect(spent[0]?.payload).toMatchObject({
        event: { combatantId: "odo" },
      });
      expect(await active(w)).toBe("kestrel");
      // Odo took no act of his own in the round.
      const rows = await readRows(w);
      expect(
        rows.filter(
          (r) =>
            r.type === "action.declared" &&
            JSON.stringify(r.payload).includes("ai:companion:odo"),
        ),
      ).toHaveLength(0);
    });

    it("refuses a group that names the off-turn companion and another actor (R3)", async () => {
      const w = await inFight([...INIT, 15]);
      await declare(
        w,
        "act-mix",
        "party",
        "Odo heals Tamsin while Tamsin slips by.",
      );
      const out = await run(w, [
        reading("act-mix", [
          castStep,
          attackStep("goblin-2", { reason: "Tamsin slips by" }),
        ]),
      ]);
      expect(out.planGate?.[0]).toMatchObject({
        ok: false,
        code: "STEP_ACTOR_MISMATCH",
        failure: { reason: "off-turn" },
      });
      expect(out.actionResults[0]).toMatchObject({
        outcome: "refused",
        refusalCode: "STEP_ACTOR_MISMATCH",
      });
      expect(await slots(w)).toHaveLength(0);
    });
  },
);
