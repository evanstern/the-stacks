import type { Combatant, ConditionInstance } from "@the-stacks/dnd5e-engine";
import {
  emptyProjections,
  type SessionProjections,
} from "@the-stacks/session-model";
import { loadSeed } from "../../src/dm/seed/load.js";
import type { SceneSeed } from "../../src/dm/seed/schema.js";
import { testSeed } from "./helpers.js";

/** Hand-built projections for snapshot tests: engine state is set directly. */

export const PLAYER_USER = "00000000-0000-4000-8000-000000000001";
/** The second human at the duo table (Kestrel's seat). */
export const SECOND_USER = "00000000-0000-4000-8000-000000000002";
/** The third human at the trio table (Kestrel's seat). */
export const THIRD_USER = "00000000-0000-4000-8000-000000000003";

export function combatant(
  id: string,
  name: string,
  over: Partial<Combatant> = {},
): Combatant {
  return {
    id,
    name,
    hp: { current: 10, max: 10, temp: 0 },
    zeroHpRule: "dies",
    lifeState: "conscious",
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    conditionSeq: 0,
    hitDice: [],
    spellSlots: { standard: {}, pact: null },
    initiativeBonus: 0,
    conModifier: 0,
    ac: 12,
    defenses: { resistances: [], vulnerabilities: [], immunities: [] },
    ...over,
  };
}

export function condition(
  instanceId: string,
  key: ConditionInstance["condition"],
  level: number | null = null,
): ConditionInstance {
  return {
    instanceId,
    condition: key,
    level,
    source: "test",
    expiresAt: null,
  };
}

export interface Scenario {
  projections: SessionProjections;
  seed: SceneSeed;
}

/**
 * The Greyhollow Ford scene mid-fight: Tamsin (human), Odo and Kestrel
 * (companions), Snag (seed NPC with a combatant) and three goblins in the
 * encounter, plus Wenna and Pell (seed NPCs with no combatant). Nine actors.
 */
export function greyhollowFight(): Scenario {
  const seed = testSeed();
  const p = emptyProjections({ role: "dm" });
  const combatants: Record<string, Combatant> = {
    tamsin: combatant("tamsin", "Tamsin Vale", {
      hp: { current: 18, max: 22, temp: 0 },
      ac: 15,
      hitDice: [{ die: 8, total: 3, remaining: 2 }],
    }),
    odo: combatant("odo", "Brother Odo", {
      hp: { current: 20, max: 20, temp: 3 },
      ac: 16,
      spellSlots: {
        standard: { "1": { max: 3, expended: 1 } },
        pact: null,
      },
    }),
    kestrel: combatant("kestrel", "Kestrel", {
      hp: { current: 14, max: 14, temp: 0 },
      ac: 14,
    }),
    snag: combatant("snag", "Snag", {
      hp: { current: 7, max: 7, temp: 0 },
      ac: 13,
    }),
    "goblin-2": combatant("goblin-2", "Goblin", { ac: 15 }),
    "goblin-3": combatant("goblin-3", "Goblin", { ac: 15 }),
    "goblin-4": combatant("goblin-4", "Goblin", { ac: 15 }),
  };
  p.engine = {
    v: 1,
    combatants,
    encounter: {
      round: 2,
      turnIndex: 1,
      order: [
        { combatantId: "kestrel", total: 18, bonus: 3 },
        { combatantId: "snag", total: 15, bonus: 2 },
        { combatantId: "tamsin", total: 12, bonus: 1 },
        { combatantId: "goblin-2", total: 10, bonus: 2 },
        { combatantId: "odo", total: 8, bonus: 0 },
      ],
    },
  };
  p.party = seed.characters.map((c) => ({
    characterId: c.characterId,
    name: c.name,
    controller:
      c.seat === "human"
        ? { kind: "player" as const, userId: PLAYER_USER }
        : {
            kind: "ai-companion" as const,
            actor: `ai:companion:${c.characterId}`,
          },
    combatantId: c.characterId,
    combatant: null,
  }));
  p.encounter = {
    round: 2,
    turnIndex: 1,
    activeCombatantId: "snag",
    order:
      p.engine.encounter?.order.map((o) => {
        const c = combatants[o.combatantId] as Combatant;
        return {
          combatantId: o.combatantId,
          name: c.name,
          initiative: o.total,
          hp: c.hp,
          lifeState: c.lifeState,
          conditions: c.conditions,
          characterId: null,
        };
      }) ?? [],
  };
  p.tableMode = { mode: "turn", activeActor: "ai:dm", activeCharacterId: null };
  p.scene = {
    sceneId: "greyhollow-ford",
    title: "Greyhollow Ford",
    summary: "",
    location: "the ford",
  };
  p.trackers = [
    { trackerId: "dusk", name: "Dusk", segments: 6, filled: 2, note: null },
  ];
  p.throughSeq = 120;
  return { projections: p, seed };
}

/**
 * The two-player scene (seed `greyhollow-ford-duo`) at its opening: Tamsin and
 * Kestrel held by two different users, Odo an AI companion, no fight yet.
 */
export function greyhollowDuo(): Scenario {
  const seed = loadSeed("greyhollow-ford-duo");
  const p = emptyProjections({ role: "dm" });
  const users: Record<string, string> = {
    tamsin: PLAYER_USER,
    kestrel: SECOND_USER,
  };
  p.engine = {
    v: 1,
    combatants: Object.fromEntries(
      seed.characters.map((c) => [
        c.characterId,
        combatant(c.characterId, c.name),
      ]),
    ),
    encounter: null,
  };
  p.party = seed.characters.map((c) => {
    const userId = users[c.characterId];
    return {
      characterId: c.characterId,
      name: c.name,
      controller:
        c.seat === "human" && userId
          ? { kind: "player" as const, userId }
          : {
              kind: "ai-companion" as const,
              actor: `ai:companion:${c.characterId}`,
            },
      combatantId: c.characterId,
      combatant: null,
    };
  });
  p.tableMode = { mode: "free" };
  p.scene = {
    sceneId: "greyhollow-ford",
    title: "Greyhollow Ford",
    summary: "",
    location: "the ford",
  };
  p.throughSeq = 10;
  return { projections: p, seed };
}

/**
 * The three-player scene (seed `greyhollow-ford-trio`) at its opening: Tamsin,
 * Odo and Kestrel held by three different users, no companion, no fight yet.
 */
export function greyhollowTrio(): Scenario {
  const seed = loadSeed("greyhollow-ford-trio");
  const p = emptyProjections({ role: "dm" });
  const users: Record<string, string> = {
    tamsin: PLAYER_USER,
    odo: SECOND_USER,
    kestrel: THIRD_USER,
  };
  p.engine = {
    v: 1,
    combatants: Object.fromEntries(
      seed.characters.map((c) => [
        c.characterId,
        combatant(c.characterId, c.name),
      ]),
    ),
    encounter: null,
  };
  p.party = seed.characters.map((c) => {
    const userId = users[c.characterId];
    return {
      characterId: c.characterId,
      name: c.name,
      controller:
        c.seat === "human" && userId
          ? { kind: "player" as const, userId }
          : {
              kind: "ai-companion" as const,
              actor: `ai:companion:${c.characterId}`,
            },
      combatantId: c.characterId,
      combatant: null,
    };
  });
  p.tableMode = { mode: "free" };
  p.scene = {
    sceneId: "greyhollow-ford",
    title: "Greyhollow Ford",
    summary: "",
    location: "the ford",
  };
  p.throughSeq = 10;
  return { projections: p, seed };
}

/** Deep clone, so a test can mutate a copy as "S1". */
export function clone<T>(v: T): T {
  return structuredClone(v);
}

/** An empty S1 and diff for ResolveOutput fixtures that do not exercise the snapshot. */
export const EMPTY_RESOLVE_SNAPSHOT = {
  snapshot: {
    v: 1,
    throughSeq: 0,
    seedId: null,
    actors: [],
    stage: {
      tableMode: { mode: "free" },
      encounter: null,
      scene: null,
      trackers: [],
      zones: null,
    },
  } as import("../../src/dm/snapshot/index.js").ActorSnapshot,
  diff: {
    fromSeq: 0,
    toSeq: 0,
    actors: [],
    stage: [],
  } as import("../../src/dm/snapshot/index.js").SnapshotDiff,
};

/** A copy of `p` with `n` extra live monsters, enough to overflow every view. */
export function withManyMonsters(
  p: SessionProjections,
  n: number,
): SessionProjections {
  const out = structuredClone(p);
  for (let i = 0; i < n; i++) {
    const id = `extra-${i}`;
    out.engine.combatants[id] = combatant(id, `Extra Goblin ${i}`, {
      conditions: [condition(`c-${i}`, "frightened")],
    });
  }
  return out;
}
