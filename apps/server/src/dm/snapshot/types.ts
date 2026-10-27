/**
 * The actor snapshot (specs/040-actor-snapshot/contracts/actor-snapshot.md,
 * decision-0025 card U1). Plain, JSON-serializable data built from the DM
 * projections and the scene seed. Types only from the engine and the session
 * model: narrate's import closure includes this module.
 */

export const SNAPSHOT_VERSION = 1;

export type ActorKind = "party" | "monster" | "npc";
export type ScenePresence = "present" | "yielded" | "absent";
export type LifeState = "conscious" | "unconscious" | "stable" | "dead";

export type ActorController =
  | { kind: "player"; userId: string }
  | { kind: "ai-companion"; actor: string }
  | { kind: "dm" };

export interface ActorCondition {
  /** The engine's condition instance id; the diff matches instances by it. */
  instanceId: string;
  /** An engine ConditionKey. */
  condition: string;
  /** Exhaustion level, else null. */
  level: number | null;
  source: string;
  expiresAt: {
    round: number;
    combatantId: string;
    boundary: "turn-start" | "turn-end";
  } | null;
}

export interface ActorResources {
  deathSaves: { successes: number; failures: number };
  hitDice: { die: 6 | 8 | 10 | 12; total: number; remaining: number }[];
  spellSlots: {
    level: number;
    max: number;
    expended: number;
    pact: boolean;
  }[];
}

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

/** The party sheet numbers the prompts carry today (seed `identity`). */
export interface ActorSheet {
  abilityMods: Partial<Record<AbilityKey, number>>;
  proficiencyBonus: number;
  saves: Partial<Record<AbilityKey, number>>;
  skills: Partial<Record<string, number>>;
  attacks: {
    name: string;
    expression: string;
    damage: { dice: string; damageType: string }[];
  }[];
  spells: string[];
}

export interface SnapshotActor {
  id: string;
  combatantId: string | null;
  characterId: string | null;
  name: string;
  aliases: string[];
  kind: ActorKind;
  controller: ActorController;
  hp: { current: number; max: number; temp: number } | null;
  lifeState: LifeState | null;
  conditions: ActorCondition[];
  ac: number | null;
  initiative: number | null;
  resources: ActorResources | null;
  sheet: ActorSheet | null;
  presence: ScenePresence;
}

export interface SnapshotStage {
  tableMode:
    | { mode: "free" }
    | {
        mode: "turn";
        activeActor: string;
        activeActorId: string | null;
      };
  encounter: {
    round: number;
    activeCombatantId: string;
    activeActorId: string | null;
    order: string[];
  } | null;
  scene: { sceneId: string; title: string; location: string | null } | null;
  trackers: {
    trackerId: string;
    name: string;
    filled: number;
    segments: number;
  }[];
}

export interface ActorSnapshot {
  v: typeof SNAPSHOT_VERSION;
  throughSeq: number;
  seedId: string | null;
  actors: SnapshotActor[];
  stage: SnapshotStage;
}

export type ActorChange =
  | { kind: "joined"; actorId: string }
  | { kind: "left"; actorId: string; name: string }
  | {
      kind: "hp";
      actorId: string;
      before: { current: number; temp: number };
      after: { current: number; temp: number };
    }
  | {
      kind: "life-state";
      actorId: string;
      before: LifeState | null;
      after: LifeState | null;
    }
  | {
      kind: "condition";
      actorId: string;
      op: "applied" | "removed";
      condition: string;
    }
  | {
      kind: "presence";
      actorId: string;
      before: ScenePresence;
      after: ScenePresence;
    }
  | {
      kind: "initiative";
      actorId: string;
      before: number | null;
      after: number | null;
    }
  | {
      kind: "resources";
      actorId: string;
      before: ActorResources | null;
      after: ActorResources | null;
    };

export type StageChange =
  | { kind: "table-mode"; before: "free" | "turn"; after: "free" | "turn" }
  | { kind: "active-actor"; before: string | null; after: string | null }
  | { kind: "encounter-started" }
  | { kind: "encounter-ended" }
  | { kind: "round"; before: number; after: number }
  | {
      kind: "tracker";
      trackerId: string;
      before: number | null;
      after: number | null;
    }
  | { kind: "scene"; before: string | null; after: string | null };

export interface SnapshotDiff {
  fromSeq: number;
  toSeq: number;
  actors: ActorChange[];
  stage: StageChange[];
}

export type SnapshotView = "dm" | "seat" | "fiction";

export interface RenderOptions {
  view: SnapshotView;
  /** estimateTokens budget for the whole section. */
  cap: number;
  /** dm view only: tracker lines, each with its advance-when text. */
  trackers?: { advanceWhen: ReadonlyMap<string, string> } | false;
  /** seat view only: the companion's own actor id (gets the full party line). */
  self?: string;
}

export interface OverflowDetail {
  view: SnapshotView;
  tokens: number;
  cap: number;
  actors: number;
  compressed: number;
}

export class SnapshotOverflowError extends Error {
  readonly code = "SNAPSHOT_OVERFLOW";
  readonly detail: OverflowDetail;
  constructor(detail: OverflowDetail) {
    super(
      `actor snapshot (${detail.view} view) needs ${detail.tokens} tokens, cap ${detail.cap} (${detail.actors} actors, ${detail.compressed} compressed)`,
    );
    this.name = "SnapshotOverflowError";
    this.detail = detail;
  }
}

export class SnapshotBuildError extends Error {
  readonly code: "ACTOR_ID_COLLISION";
  constructor(code: "ACTOR_ID_COLLISION", message: string) {
    super(message);
    this.name = "SnapshotBuildError";
    this.code = code;
  }
}
