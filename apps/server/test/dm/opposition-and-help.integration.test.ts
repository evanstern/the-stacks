import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  checkStep,
  createWorld,
  db,
  helpStep,
  loudSkip,
  payloadOf,
  player,
  reachable,
  reading,
  readRows,
  startScene,
  type World,
} from "./world.js";

/**
 * Spec 084 US1, US2, US4 end to end over the greyhollow-ford seed (reed-camp
 * encounter): an opposed check derives its DC from the opponent's stats, a
 * help assist grants advantage to the ally's next matching check, and an
 * unused assist ends at the start of the helper's next turn.
 */

loudSkip("opposition-and-help.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

type Ev = Record<string, unknown>;
const events = async (w: World, type: string) =>
  (await readRows(w))
    .filter((r) => r.type === type)
    .map((r) => payloadOf<{ event: Ev }>(r).event);

async function run(w: World, readings: unknown[], extra = {}) {
  const { result } = await w.runResolve({
    readings: readings as never,
    ...extra,
  });
  if (!result.ok) throw new Error(`resolve failed: ${result.error.message}`);
  return result.output as ResolveOutput;
}

/** A party-scope action, so any party member may act in it (spec 079 D5). */
async function commitParty(w: World, id: string, text: string) {
  await w.as(player, {
    kind: "action.declare",
    action: { actionId: id, characterId: "tamsin", scope: "party", text },
  });
  await w.as(player, { kind: "action.commit", actionId: id });
  return id;
}

const INIT = [20, 1, 1, 1, 1, 1, 1];
const startReedCamp = {
  director: {
    tableMode: {
      to: "turn" as const,
      encounterId: "reed-camp",
      reason: "The goblins rush out.",
    },
  },
};

describe.skipIf(!reachable)("opposition and help (database)", () => {
  it("Tamsin's Athletics check opposed by Snag rolls against DC 9 and records the opposition", async () => {
    const w = await createWorld({ dice: [...INIT, 15] });
    await startScene(w);
    const id = await commitParty(w, "act-opp", "Tamsin shoves Snag.");
    await run(
      w,
      [
        reading(id, [
          checkStep({
            reason: "Tamsin shoves Snag",
            difficulty: { opposedBy: "snag", rule: "unarmed-strike" },
          }),
        ]),
      ],
      startReedCamp,
    );
    const [check] = await events(w, "check.resolved");
    expect(check).toMatchObject({
      combatantId: "tamsin",
      dc: 9,
      opposition: { opponentId: "snag", rule: "unarmed-strike" },
    });
  });

  it("Kestrel's help gives Tamsin's Acrobatics check two d20s and the assist ends used", async () => {
    const w = await createWorld({ dice: [4, 17, 3] });
    await startScene(w);
    const id = await commitParty(w, "act-help", "Kestrel steadies Tamsin.");
    await run(w, [reading(id, [helpStep()], { intent: "help" })]);
    const [granted] = await events(w, "assist.granted");
    expect(granted).toMatchObject({
      combatantId: "tamsin",
      after: {
        kind: "ability-check",
        helperId: "kestrel",
        skill: "acrobatics",
      },
    });
    const id2 = await commitParty(w, "act-flip", "Tamsin vaults the rail.");
    await run(w, [
      reading(id2, [
        checkStep({
          reason: "Tamsin vaults the rail",
          ability: "dex",
          skill: "acrobatics",
        }),
      ]),
    ]);
    const dice = (await events(w, "dice.rolled")).filter(
      (e) => e.purpose !== "initiative",
    );
    const roll = dice.at(-1) as { terms: { faces?: number[] }[] };
    expect(roll.terms[0]?.faces).toHaveLength(2);
    expect(await events(w, "assist.ended")).toMatchObject([
      { combatantId: "tamsin", cause: "used" },
    ]);
  });

  it("an unused assist ends at the start of Kestrel's next turn in an encounter", async () => {
    const w = await createWorld({ dice: [1, 1, 20, 1, 1, 1, 1] });
    await startScene(w);
    await run(w, [], startReedCamp);
    const id = await commitParty(w, "act-help2", "Kestrel steadies Tamsin.");
    const out = await run(w, [reading(id, [helpStep()], { intent: "help" })]);
    // Kestrel is on turn (TASK-0244: an off-turn companion's action is held).
    expect(out.actionResults[0]?.outcome).toBe("applied");
    // Run the DM's turn advances until the order comes round to Kestrel again.
    for (let i = 0; i < 10; i++) {
      if ((await events(w, "assist.ended")).length > 0) break;
      await w.gate.submit(w.sessionId, { kind: "ai", actor: "ai:dm" }, {
        kind: "mechanics",
        command: { type: "turn.advance", reason: "next turn" },
        actionId: null,
        visibility: "public",
        summary: null,
        rationale: null,
      } as never);
    }
    expect(await events(w, "assist.ended")).toMatchObject([
      { combatantId: "tamsin", cause: "expired" },
    ]);
  });
});
