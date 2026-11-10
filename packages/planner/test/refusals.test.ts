// Coverage: every code in contract §6 "Refusals raised" has one golden case. The test fails when a
// code has no case.
import { describe, expect, it } from "vitest";
import { type PlanResult, plan } from "../src/index.js";
import {
  actors,
  baseState,
  inEncounter,
  intent,
  patchStats,
  placeAt,
  setActor,
  tgt,
  view,
  withCombatant,
  zone,
} from "./fixtures.js";

const run = (i: ReturnType<typeof intent>, s = baseState()) =>
  plan(s, view(s), i);

const PLANNER = [
  "KIND_UNSERVED",
  "TARGET_NOT_PRESENT",
  "TARGET_UNSEEN",
  "OUT_OF_REACH",
  "OUT_OF_RANGE",
  "NO_MOVEMENT_LEFT",
  "REQUEST_NOT_OPEN",
  "DM_SEAT_REQUIRED",
] as const;
const ENGINE = [
  "UNKNOWN_COMBATANT",
  "ACTOR_UNABLE",
  "STAT_UNDEFINED",
  "SPELL_UNKNOWN",
  "SPELL_NOT_PREPARED",
  "SPELL_UNRESOLVED",
  "MOVE_BLOCKED",
  "MOVE_OVER_SPEED",
] as const;

const hit = (over: Record<string, unknown> = {}) =>
  intent("attack", {
    targets: [tgt("goblin-2")],
    params: { weapon: "Longsword" },
    ...over,
  });
const cast = (spell: string, params: object = {}) =>
  intent("cast", {
    actor: actors.companion,
    targets: [tgt("goblin-2")],
    params: { spell, ...params },
  });

const unable = withCombatant(baseState(), "thorin", {
  lifeState: "unconscious",
  hp: { current: 0, max: 12, temp: 0 },
});
const unseen = setActor(baseState(), "goblin-2", { seen: false });
const noMove = (() => {
  const s = inEncounter(baseState(), ["thorin", "goblin-2"]);
  if (s.engine.encounter) {
    s.engine.encounter.movement = {
      combatantId: "thorin",
      round: 1,
      usedFt: 30,
      dashes: 0,
      disengaged: false,
    };
  }
  return s;
})();
const blocked = (() => {
  const s = baseState();
  s.engine.space = {
    zones: s.engine.space?.zones ?? [],
    edges: [{ from: "a", to: "b", kind: "blocked", feet: 30 }],
  };
  return s;
})();
const slow = withCombatant(
  inEncounter(baseState(), ["thorin", "goblin-2"]),
  "thorin",
  { speed: 20 },
);
const bowFar = (() => {
  const s = placeAt(baseState(), "goblin-2", "c");
  return patchStats(s, "thorin", {
    attacks: [
      {
        name: "Shortbow",
        range: "ranged",
        rangeFt: { normal: 5, long: 20 },
        toHit: 3,
        damage: [],
      },
    ],
  });
})();
const lowCaster = (() => {
  const s = baseState();
  s.casters.mira = { level: 3, spells: ["fireball"] };
  return s;
})();
const noStat = withCombatant(baseState(), "thorin", { stats: undefined });

const CASES: [string, "planner" | "engine", () => PlanResult][] = [
  ["KIND_UNSERVED", "planner", () => run(intent("dodge"))],
  [
    "TARGET_NOT_PRESENT",
    "planner",
    () => run(hit({ targets: [tgt("ghost")] })),
  ],
  ["TARGET_UNSEEN", "planner", () => run(hit(), unseen)],
  [
    "OUT_OF_REACH",
    "planner",
    () => run(hit(), placeAt(baseState(), "goblin-2", "b")),
  ],
  [
    "OUT_OF_RANGE",
    "planner",
    () => run(hit({ params: { weapon: "Shortbow" } }), bowFar),
  ],
  [
    "NO_MOVEMENT_LEFT",
    "planner",
    () => run(intent("move", { targets: [zone("b")] }), noMove),
  ],
  [
    "REQUEST_NOT_OPEN",
    "planner",
    () =>
      run(
        intent("ruling", {
          actor: actors.dm,
          params: { requestId: "x", decision: "reject" },
        }),
      ),
  ],
  [
    "DM_SEAT_REQUIRED",
    "planner",
    () => run(intent("end_combat", { actor: actors.aiDm })),
  ],
  [
    "UNKNOWN_COMBATANT",
    "engine",
    () => run(hit({ actor: { kind: "pc", id: "nobody" } })),
  ],
  ["ACTOR_UNABLE", "engine", () => run(hit(), unable)],
  [
    "STAT_UNDEFINED",
    "engine",
    () => run(hit({ params: { weapon: "Warhammer" } })),
  ],
  ["SPELL_UNKNOWN", "engine", () => run(cast("not-a-spell"))],
  ["SPELL_NOT_PREPARED", "engine", () => run(cast("fireball"))],
  ["SPELL_UNRESOLVED", "engine", () => run(cast("fireball"), lowCaster)],
  [
    "MOVE_BLOCKED",
    "engine",
    () => run(intent("move", { targets: [zone("b")] }), blocked),
  ],
  [
    "MOVE_OVER_SPEED",
    "engine",
    () => run(intent("move", { targets: [zone("b")] }), slow),
  ],
];

describe("refusal coverage (contract §6)", () => {
  it.each(CASES)("%s", (code, source, make) => {
    const r = make();
    expect(r.kind).toBe("refusal");
    if (r.kind !== "refusal") return;
    expect(r.refusal.code).toBe(code);
    expect(r.refusal.source).toBe(source);
  });

  it("covers every code the contract lists", () => {
    const have = new Set(CASES.map(([c]) => c));
    for (const code of [...PLANNER, ...ENGINE])
      expect(have.has(code), code).toBe(true);
    void noStat;
  });
});
