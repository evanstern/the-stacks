// PlanState builders: a three-zone space A-B-C, party and hostile combatants, a cleric, an NPC init.
import {
  type Combatant,
  type CombatantStats,
  type EngineState,
  emptyState,
  spaceViewOf,
} from "@the-stacks/dnd5e-engine";
import { type Intent, IntentSchema } from "@the-stacks/intent";
import type { SpaceView } from "@the-stacks/space";
import type { PlanActor, PlanState } from "../src/index.js";

export const SPACE = {
  zones: [
    { id: "a", name: "Gate", kind: "area" as const, tags: [], hidden: false },
    { id: "b", name: "Yard", kind: "area" as const, tags: [], hidden: false },
    { id: "c", name: "Keep", kind: "room" as const, tags: [], hidden: false },
  ],
  edges: [
    { from: "a", to: "b", kind: "open" as const, feet: 30 },
    { from: "b", to: "c", kind: "open" as const, feet: 30 },
  ],
};

export function combatant(
  id: string,
  over: Partial<Combatant> = {},
  stats?: Partial<CombatantStats>,
): Combatant {
  return {
    id,
    name: id,
    hp: { current: 12, max: 12, temp: 0 },
    zeroHpRule: "death-saves",
    lifeState: "conscious",
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    conditionSeq: 0,
    hitDice: [],
    spellSlots: { standard: { "1": { max: 2, expended: 0 } }, pact: null },
    initiativeBonus: 0,
    conModifier: 0,
    ac: 14,
    defenses: { resistances: [], vulnerabilities: [], immunities: [] },
    placement: { zoneId: "a" },
    speed: 30,
    stats: {
      abilityMods: { str: 1, dex: 1, con: 1, int: 0, wis: 1, cha: 0 },
      proficiencyBonus: 2,
      saves: {},
      skills: {},
      attacks: [],
      spellcastingAbility: null,
      abilityScores: { str: 12, dex: 12, con: 12, int: 10, wis: 12, cha: 10 },
      ...stats,
    },
    ...over,
  };
}

export const THORIN = combatant(
  "thorin",
  {},
  {
    abilityMods: { str: 3, dex: 1, con: 2, int: 0, wis: 1, cha: 0 },
    skills: { athletics: 5, intimidation: 2 },
    attacks: [
      {
        name: "Longsword",
        range: "melee",
        reachFt: 5,
        toHit: 5,
        damage: [
          {
            amount: { kind: "roll", expression: "1d8+3" },
            damageType: "slashing",
          },
        ],
      },
      {
        name: "Shortbow",
        range: "ranged",
        rangeFt: { normal: 80, long: 320 },
        toHit: 3,
        damage: [
          {
            amount: { kind: "roll", expression: "1d6+1" },
            damageType: "piercing",
          },
        ],
      },
    ],
  },
);

export const KESTREL = combatant(
  "kestrel",
  {},
  {
    abilityMods: { str: 0, dex: 2, con: 1, int: 1, wis: 2, cha: 3 },
    skills: { intimidation: 5, stealth: 4, perception: 4 },
    attacks: [
      {
        name: "Dagger",
        range: "melee-or-ranged",
        reachFt: 5,
        rangeFt: { normal: 20, long: 60 },
        toHit: 4,
        damage: [
          {
            amount: { kind: "roll", expression: "1d4+2" },
            damageType: "piercing",
          },
        ],
      },
    ],
  },
);

export const MIRA = combatant(
  "mira",
  {
    spellSlots: { standard: { "1": { max: 3, expended: 0 } }, pact: null },
  },
  {
    abilityMods: { str: 0, dex: 1, con: 1, int: 0, wis: 3, cha: 1 },
    spellcastingAbility: "wis",
    attacks: [],
  },
);

export const GOBLIN2 = combatant(
  "goblin-2",
  { ac: 13, hp: { current: 7, max: 7, temp: 0 } },
  {
    abilityMods: { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: -1 },
    attacks: [
      {
        name: "Scimitar",
        range: "melee",
        reachFt: 5,
        toHit: 4,
        damage: [
          {
            amount: { kind: "roll", expression: "1d6+2" },
            damageType: "slashing",
          },
        ],
      },
    ],
    abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  },
);

export const SNAG = combatant(
  "snag",
  { ac: 13, hp: { current: 7, max: 7, temp: 0 }, placement: { zoneId: "c" } },
  {
    abilityMods: { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: -1 },
    attacks: [
      {
        name: "Scimitar",
        range: "melee",
        reachFt: 5,
        toHit: 4,
        damage: [
          {
            amount: { kind: "roll", expression: "1d6+2" },
            damageType: "slashing",
          },
        ],
      },
    ],
  },
);

const actor = (
  id: string,
  side: PlanActor["side"],
  over: Partial<PlanActor> = {},
): PlanActor => ({
  id,
  combatantId: id,
  side,
  presence: "present",
  seen: true,
  controller: "human",
  ...over,
});

/** Quiet scene: everyone in the engine, no encounter. */
export function baseState(over: Partial<PlanState> = {}): PlanState {
  const engine: EngineState = emptyState();
  engine.space = SPACE;
  for (const c of [THORIN, KESTREL, MIRA, GOBLIN2, SNAG]) {
    engine.combatants[c.id] = structuredClone(c);
  }
  return {
    engine,
    actors: {
      thorin: actor("thorin", "party"),
      kestrel: actor("kestrel", "party"),
      mira: actor("mira", "party", { controller: "ai" }),
      "goblin-2": actor("goblin-2", "hostile"),
      snag: actor("snag", "hostile"),
      "orc-1": actor("orc-1", "hostile", { combatantId: null }),
    },
    casters: {
      mira: {
        level: 3,
        spells: [
          "fire-bolt",
          "sacred-flame",
          "inflict-wounds",
          "ray-of-sickness",
          "cure-wounds",
          "healing-word",
        ],
      },
    },
    srdSpellIds: [
      "fire-bolt",
      "sacred-flame",
      "inflict-wounds",
      "ray-of-sickness",
      "cure-wounds",
      "healing-word",
      "fireball",
    ],
    inits: {
      "orc-1": {
        id: "orc-1",
        name: "Orc",
        hp: { max: 15 },
        zeroHpRule: "dies",
        initiativeBonus: 1,
        conModifier: 2,
        ac: 13,
        defenses: { resistances: [], vulnerabilities: [], immunities: [] },
        hitDice: [],
        spellSlots: { standard: {}, pact: null },
      },
    },
    openRequests: {},
    tableRules: { outcomeBands: false, naturals: false },
    ...over,
  };
}

/** A running encounter: `order` ids in initiative order, `turn` the active index. */
export function inEncounter(
  state: PlanState,
  order: string[],
  turn = 0,
): PlanState {
  return {
    ...state,
    engine: {
      ...state.engine,
      encounter: {
        round: 1,
        turnIndex: turn,
        order: order.map((combatantId, i) => ({
          combatantId,
          total: 20 - i,
          bonus: 0,
        })),
      },
    },
  };
}

export function withCombatant(
  state: PlanState,
  id: string,
  over: Partial<Combatant>,
): PlanState {
  return {
    ...state,
    engine: {
      ...state.engine,
      combatants: {
        ...state.engine.combatants,
        [id]: { ...(state.engine.combatants[id] as Combatant), ...over },
      },
    },
  };
}

export const view = (s: PlanState): SpaceView => spaceViewOf(s.engine);

const A = {
  pc: { kind: "pc", id: "thorin" },
  kestrel: { kind: "pc", id: "kestrel" },
  companion: { kind: "companion", id: "mira" },
  npc: { kind: "npc", id: "goblin-2" },
  dm: { kind: "dm" },
  aiDm: { kind: "ai:dm" },
} as const;
export const actors = A;

let n = 0;
/** Parse one Intent through the real schema. */
export function intent(
  kind: string,
  over: Record<string, unknown> = {},
): Intent {
  n += 1;
  return IntentSchema.parse({
    id: `i-${kind}-${n}`,
    kind,
    actor: A.pc,
    source: "composer",
    commit: "confirmed",
    text: kind === "attempt" ? "I try something." : undefined,
    ...over,
  });
}
export const tgt = (id: string) => ({ kind: "actor", id }) as const;
export const zone = (id: string) => ({ kind: "zone", id }) as const;

/** Patch one actor in place (state builders return fresh objects, so mutation is local). */
export function setActor(
  state: PlanState,
  id: string,
  patch: Partial<PlanActor>,
): PlanState {
  state.actors[id] = { ...(state.actors[id] as PlanActor), ...patch };
  return state;
}
