import { emptyState } from "@the-stacks/dnd5e-engine";
import {
  type Proposer,
  project,
  type SessionProjections,
  type StoredEvent,
} from "../src/index.js";
import {
  anaCombatant,
  batchSpecs,
  goblinCombatant,
  makeRows,
  member,
  PLAYER_A,
  PLAYER_B,
  type RowSpec,
  run,
  scene,
} from "./helpers.js";

export const DM_USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const OPERATOR = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

export const seatedDm: Proposer = {
  kind: "human",
  userId: DM_USER,
  role: "player",
};
export const operator: Proposer = {
  kind: "human",
  userId: OPERATOR,
  role: "operator",
};
export const aiDm: Proposer = { kind: "ai", actor: "ai:dm" };
export const bram: Proposer = { kind: "ai", actor: "ai:companion:bram" };
export const ana: Proposer = {
  kind: "human",
  userId: PLAYER_A,
  role: "player",
};
export const outsider: Proposer = {
  kind: "human",
  userId: PLAYER_B,
  role: "player",
};

export const bramMember = {
  characterId: "bram",
  name: "Bram",
  controller: { kind: "ai-companion", actor: "ai:companion:bram" },
  combatantId: "bram",
};

export interface StreamOptions {
  /** Seat a human DM (DM_USER). Default: the AI seat. */
  humanDm?: boolean;
  /** Add a second human to the party (PLAYER_B controls "cade"). */
  twoHumans?: boolean;
  /** Turn mode with this active actor / character. */
  turn?: { activeActor: string; activeCharacterId: string | null };
  /** Extra rows appended after the base stream. */
  extra?: RowSpec[];
}

/**
 * A DM projection with a scene, a party (Ana: PLAYER_A; Bram: companion), engine
 * combatants ana and goblin, and three open actions: act-ana (Ana, character),
 * act-bram (Bram, character), act-party (Ana, party).
 */
export function stream(options: StreamOptions = {}): StoredEvent[] {
  let state = emptyState();
  const specs: RowSpec[] = [];
  const mech = (command: unknown, batchId: string) => {
    const executed = run(state, command);
    state = executed.state;
    specs.push(...batchSpecs(executed.events, batchId, { actor: "ai:dm" }));
  };
  if (options.humanDm) {
    specs.push({
      type: "dm.seat.changed",
      payload: {
        reason: "seat",
        before: { kind: "ai" },
        after: { kind: "human", userId: DM_USER },
      },
      opts: { actor: OPERATOR },
    });
  }
  specs.push({
    type: "scene.changed",
    payload: { reason: "start", before: null, after: scene },
  });
  mech(
    { type: "combatant.add", combatant: anaCombatant, reason: "r" },
    "b-ana",
  );
  mech(
    { type: "combatant.add", combatant: goblinCombatant, reason: "r" },
    "b-gob",
  );
  specs.push({
    type: "party.member.changed",
    payload: { reason: "j", characterId: "ana", before: null, after: member },
  });
  specs.push({
    type: "party.member.changed",
    payload: {
      reason: "j",
      characterId: "bram",
      before: null,
      after: bramMember,
    },
  });
  if (options.twoHumans) {
    specs.push({
      type: "party.member.changed",
      payload: {
        reason: "j",
        characterId: "cade",
        before: null,
        after: {
          characterId: "cade",
          name: "Cade",
          controller: { kind: "player", userId: PLAYER_B },
          combatantId: null,
        },
      },
    });
  }
  specs.push(
    {
      type: "action.declared",
      payload: {
        actionId: "act-ana",
        characterId: "ana",
        scope: "character",
        text: "Ana picks the lock.",
      },
      opts: { actor: PLAYER_A },
    },
    {
      type: "action.declared",
      payload: {
        actionId: "act-bram",
        characterId: "bram",
        scope: "character",
        text: "Bram keeps watch.",
      },
      opts: { actor: "ai:companion:bram" },
    },
    {
      type: "action.declared",
      payload: {
        actionId: "act-party",
        characterId: null,
        scope: "party",
        text: "We take the left passage.",
      },
      opts: { actor: PLAYER_A },
    },
  );
  if (options.turn) {
    specs.push({
      type: "table-mode.changed",
      payload: {
        reason: "turns",
        before: { mode: "free" },
        after: { mode: "turn", ...options.turn },
      },
    });
  }
  specs.push(...(options.extra ?? []));
  return makeRows(specs);
}

export function dmFold(options: StreamOptions = {}): SessionProjections {
  return project(stream(options), { role: "dm" });
}

/** The base stream plus engine commands run in order against its engine state. */
export function dmFoldWith(
  commands: unknown[],
  options: StreamOptions = {},
): SessionProjections {
  const base = project(stream(options), { role: "dm" });
  let state = base.engine;
  const extra: RowSpec[] = [...(options.extra ?? [])];
  commands.forEach((command, i) => {
    const executed = run(state, command);
    state = executed.state;
    extra.push(...batchSpecs(executed.events, `b-x${i}`, { actor: "ai:dm" }));
  });
  return project(stream({ ...options, extra }), { role: "dm" });
}

export const CADE_USER = PLAYER_B;
export const BRAM_ACTOR = "ai:companion:bram";

export interface FloorOptions {
  /** Seat a human DM (DM_USER). Default: true. */
  humanDm?: boolean;
  /** The combatant whose turn it is. Default: ana. Initiative order: ana, bram, cade, goblin. */
  active?: "ana" | "bram" | "cade" | "goblin";
  /** Drop Bram to 0 HP (dying) before initiative. */
  downBram?: boolean;
  /** The DM holds the floor (table mode names the DM; the engine turn is unchanged). */
  held?: boolean;
}

const ORDER = ["ana", "bram", "cade", "goblin"] as const;

const FLOOR_ACTORS: Record<
  (typeof ORDER)[number],
  { activeActor: string; activeCharacterId: string | null }
> = {
  ana: { activeActor: PLAYER_A, activeCharacterId: "ana" },
  bram: { activeActor: BRAM_ACTOR, activeCharacterId: "bram" },
  cade: { activeActor: PLAYER_B, activeCharacterId: "cade" },
  goblin: { activeActor: "ai:dm", activeCharacterId: null },
};

/**
 * A turn-mode DM projection with two humans (Ana, Cade), one companion (Bram), one goblin and
 * a rolled encounter. Initiative ties break by id, so the order is ana, bram, cade, goblin.
 */
export function floorFold(options: FloorOptions = {}): SessionProjections {
  const humanDm = options.humanDm ?? true;
  const active = options.active ?? "ana";
  const base = project(stream({ humanDm, twoHumans: true }), { role: "dm" });
  let state = base.engine;
  const extra: RowSpec[] = [];
  const mech = (command: unknown, batchId: string) => {
    const executed = run(state, command);
    state = executed.state;
    extra.push(...batchSpecs(executed.events, batchId, { actor: "ai:dm" }));
  };
  const hero = (id: string, name: string) => ({
    id,
    name,
    hp: { max: 10 },
    zeroHpRule: "death-saves",
    ac: 14,
    hitDice: [{ die: 8, total: 2 }],
  });
  extra.push({
    type: "party.member.changed",
    payload: {
      reason: "j",
      characterId: "cade",
      before: {
        characterId: "cade",
        name: "Cade",
        controller: { kind: "player", userId: PLAYER_B },
        combatantId: null,
      },
      after: {
        characterId: "cade",
        name: "Cade",
        controller: { kind: "player", userId: PLAYER_B },
        combatantId: "cade",
      },
    },
  });
  mech(
    { type: "combatant.add", combatant: hero("cade", "Cade"), reason: "r" },
    "b-cade",
  );
  mech(
    { type: "combatant.add", combatant: hero("bram", "Bram"), reason: "r" },
    "b-bram",
  );
  if (options.downBram) {
    mech(
      {
        type: "damage.apply",
        targetId: "bram",
        components: [
          { amount: { kind: "fixed", value: 10 }, damageType: "fire" },
        ],
        reason: "r",
      },
      "b-down",
    );
  }
  mech(
    {
      type: "initiative.roll",
      participants: ORDER.map((combatantId) => ({ combatantId })),
      reason: "r",
    },
    "b-init",
  );
  for (let i = 0; i < ORDER.indexOf(active); i++) {
    mech({ type: "turn.advance", reason: "r" }, `b-adv${i}`);
  }
  extra.push({
    type: "action.declared",
    payload: {
      actionId: "act-cade",
      characterId: "cade",
      scope: "character",
      text: "Cade readies a bow.",
    },
    opts: { actor: PLAYER_B },
  });
  extra.push({
    type: "table-mode.changed",
    payload: {
      reason: "turns",
      before: { mode: "free" },
      after: {
        mode: "turn",
        ...(options.held
          ? { activeActor: DM_USER, activeCharacterId: null }
          : FLOOR_ACTORS[active]),
      },
    },
  });
  return project(stream({ humanDm, twoHumans: true, extra }), { role: "dm" });
}
