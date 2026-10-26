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
export {
  ActionCommentedV1,
  ActionCommittedV1,
  ActionDeclaredV1,
  ActionResolvedV1,
} from "./events/actions.js";
export { JournalEntryAddedV1 } from "./events/journal.js";
export type { MechanicsEnvelope } from "./events/mechanics.js";
export { MechanicsEnvelopeV1 } from "./events/mechanics.js";
export type { Controller, PartyMember } from "./events/party.js";
export {
  ControllerSchema,
  PartyMemberChangedV1,
  PartyMemberSchema,
} from "./events/party.js";
export type { Scene } from "./events/scene.js";
export { SceneChangedV1, SceneSchema } from "./events/scene.js";
export type { TableMode } from "./events/table-mode.js";
export { TableModeChangedV1, TableModeSchema } from "./events/table-mode.js";
export type { Narration, Talk } from "./events/talk.js";
export { NarrationV1, TalkV1 } from "./events/talk.js";
export type { Tracker } from "./events/tracker.js";
export { TrackerChangedV1, TrackerSchema } from "./events/tracker.js";
export {
  ActorIdSchema,
  CombatantIdSchema,
  DM_ONLY,
  PUBLIC,
  ReasonSchema,
  RefIdSchema,
  VisibilitySchema,
} from "./ids.js";
export type { StoredEvent } from "./stored-event.js";
export { StoredEventSchema } from "./stored-event.js";
export type { Viewer } from "./visibility.js";
export { canSee } from "./visibility.js";
