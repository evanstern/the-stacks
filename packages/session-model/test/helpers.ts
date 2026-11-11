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
  step({
    type: "combatant.side",
    combatantId: "goblin",
    side: "hostile",
    reason: r,
  });
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
  // Spec 084: a second grant replaces the first, which emits assist.ended.
  for (let i = 0; i < 2; i++) {
    step({
      type: "help.grant",
      helperId: "ana",
      assist: { kind: "attack", targetId: "goblin" },
      reason: r,
    });
  }
  // Spec 094: space, placement and movement events.
  const zoneOf = (id: string) => ({
    id,
    name: id,
    kind: "room",
    tags: [],
    hidden: false,
  });
  step({
    type: "space.define",
    space: {
      zones: [zoneOf("hall"), zoneOf("ford")],
      edges: [{ from: "hall", to: "ford", kind: "open", feet: 10 }],
    },
    reason: r,
  });
  step({
    type: "combatant.place",
    combatantId: "ana",
    zoneId: "hall",
    reason: r,
  });
  step({ type: "move", combatantId: "ana", toZoneId: "ford", reason: r });
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
  "action.withdrawn": { actionId: "act-1" },
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
  "scene-presence.changed": {
    actorId: "goblin-1",
    before: "present",
    after: "absent",
    reason: "fled",
    actionId: null,
  },
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
  "proposal.created": {
    proposalId: "prop-1",
    policy: "ask",
    proposal: {
      kind: "narration",
      summary: null,
      rationale: null,
      narration: { text: "The door groans.", actionIds: [] },
      visibility: "public",
    },
  },
  "proposal.approved": { proposalId: "prop-1", batchId: null },
  "proposal.rejected": { proposalId: "prop-1", reason: null },
  "dm.seat.changed": {
    reason: "a human takes the seat",
    before: { kind: "ai" },
    after: { kind: "human", userId: PLAYER_A },
  },
  "gate.policy.changed": {
    reason: "journal needs a look",
    proposalKind: "journal",
    before: "auto",
    after: "ask",
  },
  "presence.recorded": {
    present: [PLAYER_A],
    purpose: "director",
  },
  "zone.revealed": {
    reason: "The party sees the loft",
    reset: false,
    zones: [
      { id: "loft", name: "Loft", kind: "room", tags: [], hidden: false },
    ],
    edges: [{ from: "house", to: "loft", kind: "climb", feet: 10 }],
    occupants: {},
  },
  "intent.recorded": {
    intent: {
      id: "i-1",
      kind: "attack",
      actor: { kind: "pc", id: "ana" },
      targets: [{ kind: "actor", id: "goblin" }],
      params: { weapon: "Longsword", mode: "normal" },
      source: "composer",
      commit: "confirmed",
    },
    schemaVersion: 1,
    outcome: "settled",
    batchId: "b-1",
    facts: [],
    request: null,
    answers: null,
    stopped: null,
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
  "scene-presence.changed": [
    {
      actorId: "goblin-1",
      before: "present",
      after: "present",
      reason: "arrived",
      actionId: null,
    },
    {
      actorId: "goblin-1",
      before: "present",
      after: "yielded",
      reason: "fled",
      actionId: null,
    },
  ],
  "action.committed": [{ actionId: "act-1", authority: "everyone" }],
  "action.withdrawn": [{ actionId: "Bad Id" }, {}],
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
  "proposal.created": [
    { proposalId: "prop-1", policy: "auto", proposal: { kind: "talk" } },
    { proposalId: "prop-1", policy: "ask", proposal: { kind: "nope" } },
  ],
  "proposal.approved": [{ proposalId: "Bad Id", batchId: null }],
  "proposal.rejected": [{ proposalId: "prop-1", reason: "" }],
  "dm.seat.changed": [
    {
      reason: "x",
      before: { kind: "ai" },
      after: { kind: "human", userId: "not-a-uuid" },
    },
  ],
  "gate.policy.changed": [
    {
      reason: "x",
      proposalKind: "action.declare",
      before: "auto",
      after: "ask",
    },
    { reason: "x", proposalKind: "journal", before: "auto", after: "never" },
  ],
  "zone.revealed": [
    {
      reason: "x",
      reset: false,
      zones: [{ id: "a", name: "A", kind: "room", tags: [], hidden: true }],
      edges: [],
      occupants: {},
    },
    { reason: "x", reset: false, zones: [], edges: [], occupants: {} },
  ],
  "intent.recorded": [
    { outcome: "settled" },
    {
      ...(sessionPayloads["intent.recorded"] as object),
      outcome: "maybe",
    },
    {
      ...(sessionPayloads["intent.recorded"] as object),
      schemaVersion: 2,
    },
  ],
  "presence.recorded": [
    { present: ["not-a-uuid"], purpose: "director" },
    { present: [], purpose: "everyone" },
    { present: [] },
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

export interface RowSpec {
  type: string;
  payload: unknown;
  opts?: RowOptions;
}

/** Wraps one engine result in mechanics envelopes (one batch). */
export function batchSpecs(
  events: readonly EngineEvent[],
  batchId: string,
  opts: RowOptions & { actionId?: string | null } = {},
): RowSpec[] {
  const { actionId = null, ...rowOpts } = opts;
  return events.map((event, index) => ({
    type: event.type,
    payload: envelope(event, {
      batchId,
      index,
      count: events.length,
      actionId,
    }),
    opts: rowOpts,
  }));
}

const reason = "test";

export const anaCombatant = ana;
export const goblinCombatant = goblin;

/**
 * A stream with a scene, a party, an encounter, a roll, a secret tracker, a dm roll,
 * a dm journal entry, an action lifecycle and talk. Returns rows from seq 1.
 */
export function richSpecs(): RowSpec[] {
  let state = emptyState();
  const specs: RowSpec[] = [];
  const mech = (command: unknown, batchId: string, opts = {}) => {
    const executed = run(state, command);
    state = executed.state;
    specs.push(...batchSpecs(executed.events, batchId, opts));
  };
  specs.push({
    type: "scene.changed",
    payload: { reason, before: null, after: scene },
  });
  mech({ type: "combatant.add", combatant: ana, reason }, "b-add-ana");
  mech({ type: "combatant.add", combatant: goblin, reason }, "b-add-gob");
  specs.push({
    type: "party.member.changed",
    payload: { reason, characterId: "ana", before: null, after: member },
  });
  specs.push({
    type: "talk",
    payload: { text: "Ready.", channel: "ooc", characterId: null },
    opts: { actor: PLAYER_A },
  });
  specs.push({
    type: "action.declared",
    payload: {
      actionId: "act-1",
      characterId: "ana",
      scope: "character",
      text: "Ana attacks.",
    },
    opts: { actor: PLAYER_A },
  });
  specs.push({
    type: "action.committed",
    payload: { actionId: "act-1", authority: "declarer" },
    opts: { actor: PLAYER_A },
  });
  mech(
    {
      type: "initiative.roll",
      participants: [{ combatantId: "ana" }, { combatantId: "goblin" }],
      reason,
    },
    "b-init",
  );
  mech(
    {
      type: "attack.roll",
      attackerId: "ana",
      targetId: "goblin",
      expression: "1d20+4",
      reason: "Ana swings",
    },
    "b-attack",
    { actionId: "act-1" },
  );
  specs.push({
    type: "action.resolved",
    payload: {
      actionId: "act-1",
      outcome: "applied",
      batchIds: ["b-attack"],
      refusalCode: null,
    },
  });
  specs.push({
    type: "tracker.changed",
    payload: {
      reason: "the alarm bell rang",
      trackerId: "ritual",
      before: null,
      after: tracker,
    },
    opts: { visibility: "dm" },
  });
  mech(
    { type: "roll", expression: "1d20+1", reason: "secret hidden reason" },
    "b-secret",
    { visibility: "dm" },
  );
  specs.push({
    type: "journal.entry.added",
    payload: {
      entryId: "j-dm",
      title: "DM secret title",
      body: "Only the DM knows.",
      sourceActionIds: [],
    },
    opts: { visibility: "dm" },
  });
  specs.push({
    type: "journal.entry.added",
    payload: {
      entryId: "j-pub",
      title: "Public title",
      body: "Everyone knows.",
      sourceActionIds: ["act-1"],
    },
  });
  specs.push({
    type: "table-mode.changed",
    payload: {
      reason,
      before: { mode: "free" },
      after: { mode: "turn", activeActor: PLAYER_A, activeCharacterId: "ana" },
    },
  });
  return specs;
}

export function richRows(): StoredEvent[] {
  return makeRows(richSpecs());
}

/** Recursively freezes a value. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
