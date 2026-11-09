import { describe, expect, it } from "vitest";
import { checkPlan } from "../../src/dm/gates/plan-gate.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { seatActorIds } from "../../src/dm/nodes/interpret.js";
import type { InterpretReading } from "../../src/dm/nodes/schemas.js";
import { buildDirectorPrompt } from "../../src/dm/prompts/director.js";
import { buildInterpretPrompt } from "../../src/dm/prompts/interpret.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import {
  commit,
  freeEventsThrough,
  makeCtx,
  projectDm,
  row,
} from "./helpers.js";
import { greyhollowFight } from "./snapshot-fixtures.js";
import { attackStep, reading } from "./world.js";

// R1 baseline playtest, session 3406d9ae seq 117: attackerId was the user id.
const USER = "6ff0a0f1-073a-4b11-b31b-5a0ede04f613";

describe("seat actor id (TASK-0302)", () => {
  const { projections, seed } = greyhollowFight();
  projections.party = projections.party.map((m) =>
    m.characterId === "tamsin"
      ? { ...m, controller: { kind: "player" as const, userId: USER } }
      : m,
  );
  const snapshot = buildSnapshot(projections, seed);
  const seq117 = reading(
    "a1",
    [
      attackStep("goblin-3", {
        attackerId: USER,
        reason: "Tamsin shoots the wounded goblin lookout on the rise.",
      }),
    ],
    {},
  ) as unknown as InterpretReading;
  const gate = (readings: InterpretReading[]) =>
    checkPlan({
      snapshot,
      readings,
      rulings: [],
      combatants: {},
      joining: [],
      arriving: [],
      resumed: [],
      actors: new Map([["a1", "tamsin"]]),
    });

  it("reproduces the refusal, then resolves as tamsin", () => {
    expect(gate([seq117])[0]).toMatchObject({
      ok: false,
      code: "STEP_ACTOR_MISMATCH",
    });
    const { readings, swaps } = seatActorIds([seq117], projections.party);
    expect(swaps).toEqual([{ actionId: "a1", field: "attackerId" }]);
    expect(readings[0]?.steps[0]).toMatchObject({ attackerId: "tamsin" });
    expect(gate(readings)[0]).toMatchObject({ ok: true });
  });

  it("does not rewrite a user id that seats nobody", () => {
    const r = reading(
      "a1",
      [
        attackStep("goblin-3", {
          attackerId: "11111111-0000-4000-8000-000000000000",
        }),
      ],
      {},
    ) as unknown as InterpretReading;
    const out = seatActorIds([r], projections.party);
    expect(out.swaps).toEqual([]);
    expect(out.readings[0]).toEqual(r);
  });

  it("renders no user id in the interpret and director prompts", async () => {
    const ANA = "00000000-0000-4000-8000-000000000001";
    const events = [
      ...freeEventsThrough("action.committed"),
      row(900, ANA, "action.declared", {
        actionId: "party-1",
        characterId: null,
        scope: "party",
        text: "We move on together",
      }),
      commit(901, "party-1"),
    ];
    const ctx = makeCtx({
      deps: { loadProjections: async () => projectDm(events) },
    });
    const a = await assemble(ctx);
    if (!a.ok) throw new Error("assemble failed");
    const director: DirectorNodeOutput = {
      beat: { decision: "resolve" },
      tableMode: { to: "stay" },
      trackers: [],
      scene: { status: "continue" },
      pacing: { tension: "low", spotlight: null, beatId: null },
      goalNote: "",
      companionPrompts: [],
    } as never;
    const i = buildInterpretPrompt({ ctx, assembled: a.output, director });
    const d = buildDirectorPrompt({
      ctx,
      assembled: a.output,
      aiCompanions: [],
      runnableEncounterIds: [],
      offstageNpcs: [],
      unseenMonsters: [],
    });
    for (const p of [i, d]) expect(p.user).not.toContain(ANA);
    expect(i.user).toMatch(/ana declared /);
    expect(i.user).toContain("by ana (party)");
  });
});
