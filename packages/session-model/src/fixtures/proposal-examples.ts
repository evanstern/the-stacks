import type { Proposal, ProposalKind } from "../gate/proposals.js";
import { fixtureIds as ids } from "./build.js";

/**
 * One valid proposal per kind, written against the `free-mode-action` fixture's ids (Ana,
 * Bram, the vault door scene). TASK-0047 renders each kind's body in the approval panel from
 * these. `fixtures.test.ts` parses every example with `ProposalSchema`.
 */
export const proposalExamples: Readonly<Record<ProposalKind, Proposal>> = {
  talk: {
    kind: "talk",
    summary: "Bram answers Ana",
    rationale: "Ana asked the corridor's watcher a question.",
    talk: {
      text: "Nothing stirs in the corridor. Take your time.",
      channel: "ic",
      characterId: "bram",
    },
    visibility: "public",
  },
  "action.declare": {
    kind: "action.declare",
    summary: "Ana picks the vault lock",
    rationale: null,
    action: {
      actionId: "act-lockpick",
      characterId: "ana",
      scope: "character",
      text: "Ana picks the lock on the vault door.",
    },
  },
  "action.comment": {
    kind: "action.comment",
    summary: "Bram approves the plan",
    rationale: "Bram's player backed the plan in the last scene.",
    comment: {
      actionId: "act-lockpick",
      stance: "approve",
      text: "Take your time. I will watch the corridor.",
    },
  },
  "action.commit": {
    kind: "action.commit",
    summary: "Commit Ana's lockpick",
    rationale: "Ana's player asked the DM to go ahead.",
    actionId: "act-lockpick",
  },
  "action.withdraw": {
    kind: "action.withdraw",
    summary: "Withdraw Ana's lockpick",
    rationale: "Ana's player changed their mind.",
    actionId: "act-lockpick",
  },
  "action.resolve": {
    kind: "action.resolve",
    summary: "Mark the lockpick applied",
    rationale: "The check roll landed; the action is done.",
    resolution: {
      actionId: "act-lockpick",
      outcome: "applied",
      batchIds: ["b-lockpick"],
      refusalCode: null,
    },
  },
  mechanics: {
    kind: "mechanics",
    summary: "Ana: DC 15 lockpick",
    rationale:
      "Ana committed to picking the lock; a Dexterity check decides it.",
    command: {
      type: "check.roll",
      combatantId: "ana",
      kind: "ability-check",
      ability: "dex",
      skill: null,
      expression: "1d20+5",
      mode: "normal",
      dc: 15,
      autoFail: null,
      reason: "Ana picks the vault lock",
    },
    actionId: "act-lockpick",
    visibility: "public",
  },
  narration: {
    kind: "narration",
    summary: "Narrate the door swinging open",
    rationale: "The check succeeded; the table needs the result described.",
    narration: {
      text: "The tumblers click one by one and the vault door swings inward.",
      actionIds: ["act-lockpick"],
    },
    visibility: "public",
  },
  "table-mode": {
    kind: "table-mode",
    summary: "Switch to turn mode, Ana first",
    rationale: "Guards are coming; initiative order matters now.",
    reason: "Guards arrive",
    after: {
      mode: "turn",
      activeActor: ids.playerUserId,
      activeCharacterId: "ana",
    },
  },
  scene: {
    kind: "scene",
    summary: "Move the party into the vault",
    rationale: "The door is open and the party is ready to enter.",
    reason: "The party steps through the open door",
    after: {
      sceneId: "vault-interior",
      title: "Inside the vault",
      summary: "Shelves of dusty crates line a low stone room.",
      location: "Undercroft",
    },
  },
  party: {
    kind: "party",
    summary: "Add Cade to the party",
    rationale: "A new player joined the table.",
    reason: "Cade joins the party",
    characterId: "cade",
    after: {
      characterId: "cade",
      name: "Cade",
      controller: { kind: "player", userId: ids.otherPlayerUserId },
      combatantId: null,
    },
  },
  tracker: {
    kind: "tracker",
    summary: "Start the hidden alarm tracker",
    rationale: "A trapped crate will raise an alarm the party cannot see.",
    reason: "The vault is trapped",
    trackerId: "vault-alarm",
    after: {
      trackerId: "vault-alarm",
      name: "The vault alarm",
      segments: 4,
      filled: 1,
      note: null,
    },
    visibility: "dm",
  },
  "scene-presence": {
    kind: "scene-presence",
    summary: "The watcher flees the corridor",
    rationale: "The watcher lost its nerve when Ana drew steel.",
    actorId: "watcher",
    reason: "fled",
    actionId: null,
  },
  journal: {
    kind: "journal",
    summary: "Record the vault opening",
    rationale: "A durable record of how the party got in.",
    entry: {
      entryId: "j-vault",
      title: "The vault opens",
      body: "Ana picked the lock on the undercroft vault door while Bram kept watch.",
      sourceActionIds: ["act-lockpick"],
    },
    visibility: "public",
  },
  floor: {
    kind: "floor",
    summary: "Pass the turn of an absent player",
    rationale: "Bram's player left the table, so the turn passes on.",
    op: "end",
    turn: { round: 1, combatantId: "ana" },
    reason: "Ana is away from the table.",
  },
};
