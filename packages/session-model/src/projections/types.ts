import type {
  ConditionInstance,
  EngineEvent,
  EngineState,
} from "@the-stacks/dnd5e-engine";
import type { PartyMember } from "../events/party.js";
import type { Scene } from "../events/scene.js";
import type { TableMode } from "../events/table-mode.js";
import type { Tracker } from "../events/tracker.js";
import type { Viewer } from "../visibility.js";

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
  | {
      kind: "action.resolved";
      actionId: string;
      outcome: Outcome;
      refusalCode: string | null;
    }
);

export type ActionStatus = "declared" | "discussed" | "committed" | "resolved";

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

export interface SessionProjections {
  /** Projection shape version. */
  v: 1;
  viewer: Viewer;

  scene: Scene | null;
  tableMode: TableMode;
  party: PartyMemberView[];
  encounter: EncounterView | null;
  journal: JournalEntryView[];
  transcript: TranscriptEntry[];
  actions: ActionView[];
  ledger: LedgerRow[];
  /** Always [] for a player viewer (AC #5). */
  trackers: Tracker[];
  engine: EngineState;

  /** Highest seq folded for this viewer; 0 initially. */
  throughSeq: number;
  diagnostics: Diagnostics;
  /**
   * Fold bookkeeping behind `diagnostics.incompleteBatches`: envelopes seen per batch that
   * has not yet reached its count. Not a projection; excluded from AC #2 comparisons.
   */
  pendingBatches: Record<string, { seen: number; count: number }>;
}
