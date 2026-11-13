export const SESSION_MODEL_VERSION = 1;

export type {
  CatalogEntry,
  DecodeResult,
  EventKind,
  MechanicsEvent,
  SessionEvent,
  SessionNativeEvent,
} from "./catalog.js";
export {
  catalog,
  catalogEntry,
  currentVersion,
  decodeEvent,
  MECHANICS_EVENT_TYPES,
  SESSION_EVENT_TYPES,
} from "./catalog.js";
export type { ActionSuggested, SuggestionItem } from "./events/actions.js";
export {
  ActionCommentedV1,
  ActionCommittedV1,
  ActionDeclaredV1,
  ActionResolvedV1,
  ActionSuggestedV1,
  ActionWithdrawnV1,
  SuggestionItemV1,
} from "./events/actions.js";
export {
  DmSeatChangedV1,
  GatePolicyChangedV1,
} from "./events/gate-config.js";
export type { IntentRecorded } from "./events/intents.js";
export { IntentRecordedV1 } from "./events/intents.js";
export { JournalEntryAddedV1 } from "./events/journal.js";
export type { MechanicsEnvelope } from "./events/mechanics.js";
export { MechanicsEnvelopeV1 } from "./events/mechanics.js";
export type { Controller, PartyMember } from "./events/party.js";
export {
  ControllerSchema,
  PartyMemberChangedV1,
  PartyMemberSchema,
} from "./events/party.js";
export type { PresencePurpose, PresenceRecorded } from "./events/presence.js";
export { PRESENCE_PURPOSES, PresenceRecordedV1 } from "./events/presence.js";
export {
  ProposalApprovedV1,
  ProposalCreatedV1,
  ProposalRejectedV1,
} from "./events/proposals.js";
export type { CastEntry, Scene, Way } from "./events/scene.js";
export {
  CastEntrySchema,
  SceneChangedV1,
  SceneSchema,
  WaySchema,
} from "./events/scene.js";
export type {
  PresenceReason,
  ScenePresence,
  ScenePresenceChanged,
} from "./events/scene-presence.js";
export {
  PresenceReasonSchema,
  REASON_TO_PRESENCE,
  ScenePresenceChangedV1,
  ScenePresenceSchema,
} from "./events/scene-presence.js";
export type { ZoneRevealed } from "./events/space.js";
export { ZoneRevealedV1 } from "./events/space.js";
export type { TableMode } from "./events/table-mode.js";
export { TableModeChangedV1, TableModeSchema } from "./events/table-mode.js";
export type { Narration, Talk } from "./events/talk.js";
export { NarrationV1, TalkV1 } from "./events/talk.js";
export type { Tracker } from "./events/tracker.js";
export { TrackerChangedV1, TrackerSchema } from "./events/tracker.js";
export type { CommitDecision } from "./gate/authority.js";
export { commitAuthority } from "./gate/authority.js";
export type { DeclareResult } from "./gate/declare.js";
export { declareIntent } from "./gate/declare.js";
export { fogRows, revealRows } from "./gate/fog.js";
export type { PermissionResult } from "./gate/permissions.js";
export { checkPermission } from "./gate/permissions.js";
export type {
  PlanContext,
  PlanIds,
  PlannedRow,
  PlanResult,
} from "./gate/plan.js";
export { mechanicsRows, planProposal } from "./gate/plan.js";
export type { PlannerInputs } from "./gate/plan-state.js";
export { buildPlanState, EMPTY_PLANNER_INPUTS } from "./gate/plan-state.js";
export type { Policy, PolicyTable, Route } from "./gate/policy.js";
export {
  DEFAULT_POLICIES,
  effectivePolicy,
  PolicySchema,
  routeProposal,
} from "./gate/policy.js";
export type {
  DmProposalKind,
  GateRequest,
  Proposal,
  ProposalKind,
  Proposer,
} from "./gate/proposals.js";
export {
  actorOf,
  DmProposalKindSchema,
  GATE_REQUEST_KINDS,
  GATE_REQUEST_VERSION,
  GateRequestSchema,
  mechanicsProposal,
  ProposalKindSchema,
  ProposalSchema,
} from "./gate/proposals.js";
export type {
  GateRefusal,
  GateRefusalCode,
  GateRefusalSource,
} from "./gate/refusals.js";
export {
  CHARACTER_UNABLE_REASONS,
  GateRefusalCodeSchema,
} from "./gate/refusals.js";
export type { DmSeat } from "./gate/seat.js";
export { DmSeatSchema } from "./gate/seat.js";
export type {
  SignoffRow,
  SignoffStance,
  SignoffState,
} from "./gate/signoff.js";
export { signoffState } from "./gate/signoff.js";
export type { SettleStep, TurnRef } from "./gate/turn.js";
export {
  ABSENCE_PASS_REASON,
  activeActorFor,
  canAct,
  currentTurn,
  floorHeld,
  INCAPACITATING,
  nextSettleStep,
} from "./gate/turn.js";
export {
  ActorIdSchema,
  CombatantIdSchema,
  DM_ONLY,
  PUBLIC,
  ReasonSchema,
  RefIdSchema,
  VisibilitySchema,
} from "./ids.js";
export { applyEvent, emptyProjections, project } from "./projections/apply.js";
export { openRulings } from "./projections/intents.js";
export { findProposal, pendingProposals } from "./projections/proposals.js";
export type { SpatialView, TargetStatus } from "./projections/spatial.js";
export { reachOf, spatialFor, targetStatus } from "./projections/spatial.js";
export type {
  ActionAuthority,
  ActionStatus,
  ActionView,
  Diagnostics,
  EncounterView,
  GateView,
  IntentView,
  JournalEntryView,
  LedgerRow,
  PartyMemberView,
  PresenceView,
  ProposalStatus,
  ProposalView,
  ScenePresenceEntry,
  SessionProjections,
  SuggestionView,
  TranscriptEntry,
} from "./projections/types.js";
export type {
  ReadablePost,
  ReadRule,
  SuggestionState,
} from "./read.js";
export {
  isDmQuestion,
  isDmReadOutput,
  latestReadablePostSeq,
  READ_QUIET_MS,
  RING_BLANK_MS,
  readablePosts,
  readWindowMs,
  suggestionState,
} from "./read.js";
export type { StoredEvent } from "./stored-event.js";
export { StoredEventSchema } from "./stored-event.js";
export type { Viewer } from "./visibility.js";
export { canSee } from "./visibility.js";
