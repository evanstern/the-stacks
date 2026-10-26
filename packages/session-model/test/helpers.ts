import {
  type EngineEvent,
  type EngineState,
  emptyState,
  evolve,
  execute,
  type Rng,
} from "@the-stacks/dnd5e-engine";
import type { StoredEvent } from "../src/index.js";

export const SESSION_ID = "11111111-1111-4111-8111-111111111111";
export const PLAYER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PLAYER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** A deterministic rng: low faces, valid for any die. */
const lowRng: Rng = { rollDie: (sides) => Math.min(sides, 5) };

export interface RowOptions {
  actor?: string;
  visibility?: string;
  payloadVersion?: number;
}

/** Builds StoredEvent rows with ascending seq and a fixed ISO ts. */
export function makeRows(
  specs: readonly { type: string; payload: unknown; opts?: RowOptions }[],
  startSeq = 1,
): StoredEvent[] {
  return specs.map((spec, i) => {
    const seq = startSeq + i;
    return {
      sessionId: SESSION_ID,
      seq,
      actor: spec.opts?.actor ?? "ai:dm",
      type: spec.type,
      payload: spec.payload,
      payloadVersion: spec.opts?.payloadVersion ?? 1,
      visibility: spec.opts?.visibility ?? "public",
      ts: new Date(Date.UTC(2026, 9, 26, 18, 0, seq)).toISOString(),
    };
  });
}

export function row(
  type: string,
  payload: unknown,
  opts: RowOptions & { seq?: number } = {},
): StoredEvent {
  const { seq, ...rest } = opts;
  const [made] = makeRows([{ type, payload, opts: rest }], seq ?? 1);
  return made as StoredEvent;
}

export interface Executed {
  state: EngineState;
  events: EngineEvent[];
}

/** Runs one engine command with the low rng; throws on refusal. */
export function run(state: EngineState, command: unknown): Executed {
  const result = execute(state, command, lowRng);
  if (!result.ok) {
    throw new Error(
      `engine refused ${result.refusal.code}: ${result.refusal.message}`,
    );
  }
  let next = state;
  for (const event of result.events) next = evolve(next, event);
  return { state: next, events: [...result.events] };
}

const ana = {
  id: "ana",
  name: "Ana",
  hp: { max: 12 },
  zeroHpRule: "death-saves",
  ac: 15,
  hitDice: [{ die: 8, total: 2 }],
  spellSlots: { standard: { "1": 2 }, pact: null },
};
const goblin = {
  id: "goblin",
  name: "Goblin",
  hp: { max: 7 },
  zeroHpRule: "dies",
  ac: 12,
};
const bram = {
  id: "bram",
  name: "Bram",
  hp: { max: 10 },
  zeroHpRule: "death-saves",
  ac: 14,
  hitDice: [{ die: 8, total: 2 }],
};

/** One valid engine event of every type, produced by running real commands. */
export function engineExamples(): Record<string, EngineEvent> {
  const out: Record<string, EngineEvent> = {};
  let state = emptyState();
  const step = (command: unknown) => {
    const executed = run(state, command);
    state = executed.state;
    for (const event of executed.events) out[event.type] ??= event;
  };
  const r = "example";
  step({ type: "combatant.add", combatant: ana, reason: r });
  step({ type: "combatant.add", combatant: goblin, reason: r });
  step({ type: "combatant.add", combatant: bram, reason: r });
  step({ type: "roll", expression: "1d20+2", reason: r });
  step({
    type: "attack.roll",
    attackerId: "ana",
    targetId: "goblin",
    expression: "1d20+4",
    reason: r,
  });
  step({
    type: "check.roll",
    combatantId: "ana",
    kind: "ability-check",
    ability: "dex",
    expression: "1d20+3",
    dc: 10,
    reason: r,
  });
  step({
    type: "damage.apply",
    targetId: "goblin",
    components: [
      { amount: { kind: "fixed", value: 2 }, damageType: "slashing" },
    ],
    reason: r,
  });
  step({
    type: "condition.apply",
    targetId: "goblin",
    condition: "poisoned",
    source: "trap",
    reason: r,
  });
  step({
    type: "condition.remove",
    targetId: "goblin",
    condition: "poisoned",
    reason: r,
  });
  step({ type: "exhaustion.adjust", targetId: "ana", delta: 1, reason: r });
  step({ type: "exhaustion.adjust", targetId: "ana", delta: 1, reason: r });
  step({
    type: "initiative.roll",
    participants: [{ combatantId: "ana" }, { combatantId: "goblin" }],
    reason: r,
  });
  step({ type: "initiative.join", combatantId: "bram", reason: r });
  step({ type: "turn.advance", reason: r });
  step({
    type: "spell-slot.expend",
    targetId: "ana",
    pool: "standard",
    level: 1,
    reason: r,
  });
  step({
    type: "damage.apply",
    targetId: "ana",
    components: [{ amount: { kind: "fixed", value: 14 }, damageType: "fire" }],
    reason: r,
  });
  step({ type: "death-save.roll", targetId: "ana", reason: r });
  step({ type: "encounter.end", reason: r });
  step({
    type: "damage.apply",
    targetId: "bram",
    components: [{ amount: { kind: "fixed", value: 4 }, damageType: "fire" }],
    reason: r,
  });
  step({
    type: "rest.short",
    participants: [{ combatantId: "bram", spend: [{ die: 8, count: 1 }] }],
    reason: r,
  });
  step({ type: "combatant.remove", combatantId: "goblin", reason: r });
  return out;
}

export const tracker = {
  trackerId: "ritual",
  name: "The cult completes the ritual",
  segments: 6,
  filled: 1,
  note: null,
};

export const scene = {
  sceneId: "vault",
  title: "The vault door",
  summary: "A heavy door with a lock.",
  location: "Undercroft",
};

export const member = {
  characterId: "ana",
  name: "Ana",
  controller: { kind: "player", userId: PLAYER_A },
  combatantId: "ana",
};

/** A valid version-1 payload for every session-native type. */
export const sessionPayloads: Record<string, unknown> = {
  talk: { text: "Hello.", channel: "ic", characterId: "ana" },
  narration: { text: "The door groans.", actionIds: ["act-1"] },
  "action.declared": {
    actionId: "act-1",
    characterId: "ana",
    scope: "character",
    text: "Ana picks the lock.",
  },
  "action.commented": {
    actionId: "act-1",
    stance: "comment",
    text: "Careful.",
  },
  "action.committed": { actionId: "act-1", authority: "declarer" },
  "action.resolved": {
    actionId: "act-1",
    outcome: "applied",
    batchIds: ["b-1"],
    refusalCode: null,
  },
  "table-mode.changed": {
    reason: "combat begins",
    before: { mode: "free" },
    after: { mode: "turn", activeActor: PLAYER_A, activeCharacterId: "ana" },
  },
  "scene.changed": { reason: "the party arrives", before: null, after: scene },
  "party.member.changed": {
    reason: "Ana joins",
    characterId: "ana",
    before: null,
    after: member,
  },
  "tracker.changed": {
    reason: "the alarm bell rang",
    trackerId: "ritual",
    before: tracker,
    after: { ...tracker, filled: 2 },
  },
  "journal.entry.added": {
    entryId: "j-1",
    title: "The vault",
    body: "The party found a vault.",
    sourceActionIds: ["act-1"],
  },
};

/** A payload that fails the schema of the same type. */
export const invalidSessionPayloads: Record<string, unknown[]> = {
  talk: [
    { text: "", channel: "ic", characterId: null },
    { text: "x", channel: "loud", characterId: null },
  ],
  narration: [{ text: "x", actionIds: "act-1" }],
  "action.declared": [
    { actionId: "act-1", characterId: null, scope: "character", text: "x" },
    { actionId: "Bad Id", characterId: null, scope: "party", text: "x" },
  ],
  "action.commented": [
    { actionId: "act-1", stance: "comment", text: "" },
    { actionId: "act-1", stance: "shout", text: "x" },
  ],
  "action.committed": [{ actionId: "act-1", authority: "everyone" }],
  "action.resolved": [
    { actionId: "act-1", outcome: "applied", batchIds: [], refusalCode: null },
    {
      actionId: "act-1",
      outcome: "applied",
      batchIds: ["b"],
      refusalCode: "INVALID_STATE",
    },
    { actionId: "act-1", outcome: "refused", batchIds: [], refusalCode: null },
    {
      actionId: "act-1",
      outcome: "refused",
      batchIds: ["b"],
      refusalCode: "INVALID_STATE",
    },
    {
      actionId: "act-1",
      outcome: "no-effect",
      batchIds: ["b"],
      refusalCode: null,
    },
    {
      actionId: "act-1",
      outcome: "no-effect",
      batchIds: [],
      refusalCode: "INVALID_STATE",
    },
    {
      actionId: "act-1",
      outcome: "refused",
      batchIds: [],
      refusalCode: "NOT_A_CODE",
    },
  ],
  "table-mode.changed": [
    { reason: "x", before: { mode: "free" }, after: { mode: "turn" } },
    { reason: "", before: { mode: "free" }, after: { mode: "free" } },
  ],
  "scene.changed": [{ reason: "x", before: null, after: null }],
  "party.member.changed": [
    { reason: "x", characterId: "ana", before: null, after: null },
    {
      reason: "x",
      characterId: "ana",
      before: null,
      after: { ...member, characterId: "bram" },
    },
  ],
  "tracker.changed": [
    { reason: "x", trackerId: "ritual", before: null, after: null },
    {
      reason: "x",
      trackerId: "ritual",
      before: null,
      after: { ...tracker, filled: 9 },
    },
    { reason: "x", trackerId: "other", before: null, after: tracker },
  ],
  "journal.entry.added": [
    { entryId: "j-1", title: "", body: "x", sourceActionIds: [] },
  ],
};

export function envelope(
  event: EngineEvent,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    batchId: "b-1",
    index: 0,
    count: 1,
    actionId: null,
    proposalId: null,
    event,
    ...overrides,
  };
}
