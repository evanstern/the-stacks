import type {
  ConditionInstance,
  EngineEvent,
  EngineState,
} from "@the-stacks/dnd5e-engine";
import type { Intent } from "@the-stacks/intent";
import type { RulingRequest } from "@the-stacks/planner";
import type { PartyMember } from "../events/party.js";
import type { Scene } from "../events/scene.js";
import type {
  PresenceReason,
  ScenePresence,
} from "../events/scene-presence.js";
import type { TableMode } from "../events/table-mode.js";
import type { Tracker } from "../events/tracker.js";
import type { Policy } from "../gate/policy.js";
import type {
  DmProposalKind,
  Proposal,
  ProposalKind,
} from "../gate/proposals.js";
import type { DmSeat } from "../gate/seat.js";
import type { Viewer } from "../visibility.js";
import type { SpatialView } from "./spatial.js";

export type { SpatialView };

export type ActionAuthority = "declarer" | "active-player" | "group" | "dm";
export type Stance = "comment" | "approve" | "object";
export type Outcome = "applied" | "refused" | "no-effect";
export type LifeState = "conscious" | "unconscious" | "stable" | "dead";

export type DiceRolledEvent = Extract<EngineEvent, { type: "dice.rolled" }>;
export type AttackResolvedEvent = Extract<
  EngineEvent,
  { type: "attack.resolved" }
>;
export type CheckResolvedEvent = Extract<
  EngineEvent,
  { type: "check.resolved" }
>;
export type RestCompletedEvent = Extract<
  EngineEvent,
  { type: "rest.completed" }
>;

export interface Diagnostics {
  /** AC #8. */
  skippedUnknownType: number;
  /** AC #8. */
  skippedUnknownVersion: number;
  /** AC #8: the payload failed its schema. */
  skippedInvalid: number;
  /** seq <= throughSeq (a duplicate delivery). */
  outOfOrder: number;
  /** A lifecycle event that breaks the status rules. */
  ignoredTransitions: number;
  /** A state change whose `before` differs from the projected state. */
  beforeMismatches: number;
  /** The engine's evolve threw (for example an unknown combatant). */
  engineRejected: number;
  /** Defensive: batch ids seen fewer times than their count. */
  incompleteBatches: string[];
}

export type TranscriptEntry = {
  seq: number;
  ts: string;
  actor: string;
  visibility: string;
} & (
  | {
      kind: "talk";
      text: string;
      channel: "ic" | "ooc";
      characterId: string | null;
    }
  | { kind: "narration"; text: string; actionIds: string[] }
  | {
      kind: "action.declared";
      actionId: string;
      characterId: string | null;
      scope: "character" | "party";
      text: string;
    }
  | { kind: "action.commented"; actionId: string; stance: Stance; text: string }
  | { kind: "action.committed"; actionId: string; authority: ActionAuthority }
  | { kind: "action.withdrawn"; actionId: string }
  | {
      kind: "action.resolved";
      actionId: string;
      outcome: Outcome;
      refusalCode: string | null;
    }
);

export type ActionStatus =
  | "declared"
  | "discussed"
  | "committed"
  | "resolved"
  | "withdrawn";

export interface ActionView {
  actionId: string;
  declaredSeq: number;
  actor: string;
  characterId: string | null;
  scope: "character" | "party";
  text: string;
  status: ActionStatus;
  comments: { seq: number; actor: string; stance: Stance; text: string }[];
  committed: { seq: number; actor: string; authority: ActionAuthority } | null;
  resolved: {
    seq: number;
    outcome: Outcome;
    batchIds: string[];
    refusalCode: string | null;
  } | null;
}

export interface PartyMemberView extends PartyMember {
  combatant: {
    hp: { current: number; max: number; temp: number };
    lifeState: LifeState;
    deathSaves: { successes: number; failures: number };
    conditions: ConditionInstance[];
    ac: number | null;
  } | null;
}

export interface EncounterView {
  round: number;
  turnIndex: number;
  activeCombatantId: string;
  order: {
    combatantId: string;
    name: string;
    initiative: number;
    hp: { current: number; max: number; temp: number };
    lifeState: LifeState;
    conditions: ConditionInstance[];
    characterId: string | null;
  }[];
}

export interface JournalEntryView {
  seq: number;
  ts: string;
  actor: string;
  visibility: string;
  entryId: string;
  title: string;
  body: string;
  sourceActionIds: string[];
}

export type LedgerRow =
  | {
      kind: "roll";
      seq: number;
      actor: string;
      visibility: string;
      reason: string;
      batchId: string;
      index: number;
      actionId: string | null;
      roll: DiceRolledEvent;
    }
  | {
      kind: "outcome";
      seq: number;
      actor: string;
      visibility: string;
      reason: string;
      batchId: string;
      index: number;
      actionId: string | null;
      outcome: AttackResolvedEvent | CheckResolvedEvent | RestCompletedEvent;
    }
  | {
      kind: "change";
      seq: number;
      actor: string;
      visibility: string;
      reason: string;
      type: string;
      subject: string | null;
      before: unknown;
      after: unknown;
      batchId: string | null;
      index: number | null;
      actionId: string | null;
    };

export interface GateView {
  /** { kind: "ai" } initially. */
  seat: DmSeat;
  /** {} initially. */
  policyOverrides: Partial<Record<DmProposalKind, Policy>>;
}

export type ProposalStatus = "pending" | "approved" | "rejected";

export interface ProposalView {
  proposalId: string;
  createdSeq: number;
  ts: string;
  /** The created row's actor. */
  proposer: string;
  policy: "ask" | "suggest";
  kind: ProposalKind;
  proposal: Proposal;
  /** A suggestion stays "pending" until rejected. */
  status: ProposalStatus;
  decided: {
    seq: number;
    actor: string;
    batchId: string | null;
    reason: string | null;
  } | null;
}

export interface IntentView {
  id: string;
  /** The seq of the first carrier row for this id. */
  seq: number;
  /** The carrier row's actor. */
  actor: string;
  intent: Intent;
  status: "declared" | "settled" | "needs_ruling" | "answered";
  request: RulingRequest | null;
  /** The `proposal.created` row that mirrors an open request under a human seat. */
  proposalId: string | null;
}

export interface PresenceView {
  /** The latest marker's present set (sorted ascending user ids). */
  present: string[];
  purpose: "director" | "signoff" | "floor";
  actionId: string | null;
  /** The marker's seq. */
  seq: number;
}

export interface ScenePresenceEntry {
  presence: ScenePresence;
  reason: PresenceReason;
  /** The seq of the row that set it. */
  seq: number;
}

export interface SessionProjections {
  /** Projection shape version. */
  v: 1;
  viewer: Viewer;

  scene: Scene | null;
  tableMode: TableMode;
  /** Per actor id, the latest logged presence. No entry means present. */
  scenePresence: Record<string, ScenePresenceEntry>;
  party: PartyMemberView[];
  encounter: EncounterView | null;
  journal: JournalEntryView[];
  transcript: TranscriptEntry[];
  actions: ActionView[];
  ledger: LedgerRow[];
  /** Always [] for a player viewer (AC #5). */
  trackers: Tracker[];
  engine: EngineState;
  gate: GateView;
  /** Always [] for a player viewer. */
  proposals: ProposalView[];
  /** One entry per recorded Intent id, in log order. */
  intents: IntentView[];
  /** The latest presence marker; null until one is folded (decision-0024). */
  presence: PresenceView | null;
  /** This viewer's space, the players' map and placements (spec 100). */
  spatial: SpatialView;

  /** Highest seq folded for this viewer; 0 initially. */
  throughSeq: number;
  diagnostics: Diagnostics;
  /**
   * Fold bookkeeping behind `diagnostics.incompleteBatches`: envelopes seen per batch that
   * has not yet reached its count. Not a projection; excluded from AC #2 comparisons.
   */
  pendingBatches: Record<string, { seen: number; count: number }>;
}
