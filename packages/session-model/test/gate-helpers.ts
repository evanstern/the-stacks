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
