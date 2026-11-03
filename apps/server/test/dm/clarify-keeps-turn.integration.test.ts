import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  checkStep,
  commitAction,
  createWorld,
  db,
  loudSkip,
  reachable,
  reading,
  readRows,
  startScene,
  type World,
} from "./world.js";

/**
 * A human's clarify holds the turn (specs/073-clarify-keeps-turn, TASK-0209).
 * Source: playtest alpha run 1 seq 172-176, finding 21: "I attack Pell" read
 * clarify, resolved no-effect, and the turn advanced past Tamsin. Rebuilt on
 * the `greyhollow-ford` seed with scripted dice and no model.
 */

loudSkip("clarify-keeps-turn.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

let jobN = 0;
const nextJob = () => ({
  id: `00000000-0000-4000-8000-${String(900 + ++jobN).padStart(12, "0")}`,
});
const TAMSIN_FIRST = 0;
const initDice = (first: number) =>
  [1, 1, 1, 1, 1, 1, 1].map((d, i) => (i === first ? 20 : d));

async function run(w: World, readings: unknown[]) {
  const { result } = await w.runResolve({
    readings: readings as never,
    job: nextJob(),
  });
  if (!result.ok) throw new Error(`resolve failed: ${result.error.message}`);
  return result.output as ResolveOutput;
}
const fresh = (w: World) => {
  w.checkpoint.current = {
    ...w.checkpoint.current,
    submissions: [],
    lastSeq: 0,
  };
};
async function inTurnMode(dice: number[]) {
  const w = await createWorld({ dice });
  await startScene(w);
  await w.runResolve({
    readings: [] as never,
    director: {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
    },
    job: nextJob(),
  });
  fresh(w);
  return w;
}
const advances = async (w: World) =>
  (await readRows(w)).filter((r) => r.type === "turn.advanced").length;

describe.skipIf(!reachable)("clarify keeps the turn (database)", () => {
  it("a clarify reading spends no turn", async () => {
    const w = await inTurnMode([...initDice(TAMSIN_FIRST), 15]);
    const id = await commitAction(w, "I attack Pell.");
    fresh(w);
    const out = await run(w, [
      reading(id, [], {
        intent: "attack",
        clarify: "Longsword in melee, or the light crossbow at range?",
      }),
    ]);
    expect(out.actionResults[0]).toMatchObject({
      actionId: id,
      outcome: "no-effect",
    });
    const rows = await readRows(w);
    expect(rows.some((r) => r.type === "turn.advanced")).toBe(false);
    expect((await w.projections()).encounter?.activeCombatantId).toBe("tamsin");
    expect(out.nextJob).toBeNull();
  });

  it("the answer resolves and advances the turn exactly once", async () => {
    const w = await inTurnMode([...initDice(TAMSIN_FIRST), 15]);
    const first = await commitAction(w, "I attack Pell.");
    fresh(w);
    await run(w, [reading(first, [], { clarify: "Which weapon?" })]);
    expect(await advances(w)).toBe(0);
    const answer = await commitAction(w, "I swing my longsword at Pell.");
    fresh(w);
    await run(w, [reading(answer, [checkStep()])]);
    expect(await advances(w)).toBe(1);
  });

  it("control: the same declaration without a clarify advances the turn", async () => {
    const w = await inTurnMode([...initDice(TAMSIN_FIRST), 15]);
    const id = await commitAction(w, "I attack Pell.");
    fresh(w);
    await run(w, [reading(id, [checkStep()])]);
    expect(await advances(w)).toBe(1);
  });
});
