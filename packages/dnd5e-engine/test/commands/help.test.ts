import { describe, expect, it } from "vitest";
import {
  expectOk,
  expectRefusal,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const stats = (skills = { athletics: 5 } as Record<string, number>) => ({
  abilityMods: { str: 3 },
  proficiencyBonus: 2,
  saves: {},
  skills,
  attacks: [],
  spellcastingAbility: null,
});
const kes = (over = {}) =>
  makeCombatant({ id: "pc-kes", name: "Kes", stats: stats(), ...over });
const tam = (over = {}) =>
  makeCombatant({ id: "pc-tam", name: "Tam", ...over });
const gob = (over = {}) => makeCombatant({ id: "gob-1", name: "Gob", ...over });
const help = (over: Record<string, unknown> = {}) => ({
  type: "help.grant",
  helperId: "pc-kes",
  assist: { kind: "ability-check", allyId: "pc-tam", skill: "athletics" },
  reason: "Kes steadies Tam",
  ...over,
});
const world = (...c: ReturnType<typeof makeCombatant>[]) =>
  stateWith(kes(), tam(), gob(), ...c);

describe("help.grant", () => {
  it("records an ability-check assist on the ally", () => {
    const s = world();
    const out = run(s, help());
    expect(expectOk(out.result)).toEqual([
      expect.objectContaining({
        type: "assist.granted",
        combatantId: "pc-tam",
        after: {
          kind: "ability-check",
          helperId: "pc-kes",
          skill: "athletics",
          expiresAt: null,
        },
      }),
    ]);
    expect(settle(s, out.result).combatants["pc-tam"]?.assists).toHaveLength(1);
  });
  it("records an attack assist on the enemy with the helper's next turn start", () => {
    const base = world();
    const roll = run(
      base,
      {
        type: "initiative.roll",
        participants: ["pc-kes", "pc-tam"].map((combatantId) => ({
          combatantId,
          mode: "normal",
        })),
        reason: "start",
      },
      [15, 5],
    );
    const s = settle(base, roll.result);
    const events = expectOk(
      run(s, help({ assist: { kind: "attack", targetId: "gob-1" } })).result,
    );
    // Kes is active at index 0: next turn start is round 2.
    expect(events[0]).toMatchObject({
      type: "assist.granted",
      combatantId: "gob-1",
      after: {
        kind: "attack",
        expiresAt: { round: 2, combatantId: "pc-kes", boundary: "turn-start" },
      },
    });
  });
  it("a second grant ends the first with replaced", () => {
    const first = run(world(), help());
    const s = settle(world(), first.result);
    const events = expectOk(
      run(s, help({ assist: { kind: "attack", targetId: "gob-1" } })).result,
    );
    expect(events.map((e) => e.type)).toEqual([
      "assist.ended",
      "assist.granted",
    ]);
    expect(events[0]).toMatchObject({
      cause: "replaced",
      combatantId: "pc-tam",
    });
  });
  it("refuses", () => {
    expectRefusal(
      run(
        world(),
        help({
          assist: { kind: "ability-check", allyId: "pc-tam", skill: "stealth" },
        }),
      ).result,
      "NOT_PROFICIENT",
    );
    expectRefusal(
      run(stateWith(kes({ stats: undefined }), tam()), help()).result,
      "STAT_UNDEFINED",
    );
    expectRefusal(
      run(
        stateWith(
          kes({
            conditions: [
              {
                instanceId: "c",
                condition: "stunned",
                level: null,
                source: "t",
                expiresAt: null,
              },
            ],
          }),
          tam(),
        ),
        help(),
      ).result,
      "ACTOR_UNABLE",
    );
    expectRefusal(
      run(
        world(),
        help({
          assist: {
            kind: "ability-check",
            allyId: "pc-kes",
            skill: "athletics",
          },
        }),
      ).result,
      "INVALID_COMMAND",
    );
    expectRefusal(
      run(world(), help({ assist: { kind: "attack", targetId: "nobody" } }))
        .result,
      "UNKNOWN_COMBATANT",
    );
    expectRefusal(
      run(
        stateWith(
          kes(),
          tam(),
          gob({ lifeState: "dead", hp: { current: 0, max: 12, temp: 0 } }),
        ),
        help({ assist: { kind: "attack", targetId: "gob-1" } }),
      ).result,
      "TARGET_DEAD",
    );
  });
});
