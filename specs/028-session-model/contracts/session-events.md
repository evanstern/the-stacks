# Contract: session events (types, versions, payloads, visibility)

Package: `@the-stacks/session-model` (`packages/session-model`). This file is binding for
TASK-0045 (gate), TASK-0046 (DM runtime) and TASK-0047 (play route). A change to any type,
version, field or visibility rule below is a contract change: update this file in the same PR.

Sibling contracts: [projections.md](projections.md), [fixtures.md](fixtures.md),
[package-api.md](package-api.md), [boundary-rule.md](boundary-rule.md). Engine contracts:
`specs/026-dnd5e-engine/contracts/`.

## The log row (unchanged, M0)

A session event is one row of the M0 `events` table. This feature adds no column:

| Column | Meaning here |
|---|---|
| `session_id` | the play session |
| `seq` | position, assigned by `append` |
| `actor` | who caused the event (see Actors) |
| `type` | a catalog type (this file) |
| `payload` | JSONB, validated by the catalog schema for `(type, payload_version)` |
| `payload_version` | the catalog version of that type's payload |
| `visibility` | `public`, `dm`, or one user id (see Visibility) |
| `ts` | assigned by the database |

The package's in-memory form of a row:

```ts
export const StoredEventSchema = z.object({
  sessionId: z.uuid(),
  seq: z.number().int().min(1),
  actor: ActorIdSchema,
  type: z.string().min(1).max(100),
  payload: z.unknown(),
  payloadVersion: z.number().int().min(1),
  visibility: VisibilitySchema,
  ts: z.iso.datetime({ offset: true }),       // ISO 8601 (zod 4); the server converts Drizzle's Date
});
export type StoredEvent = z.infer<typeof StoredEventSchema>;
```

## Shared fragments

```ts
export const RefIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_.:-]{0,63}$/);
// ids for actions, batches, characters, scenes, journal entries, trackers.
// A UUID (lowercase) matches. Combatant ids reuse the engine's CombatantIdSchema (same regex).

export const ActorIdSchema = z.string().min(1).max(128);
// A human actor is the user id the server records (a UUID).
// Reserved AI and system actors:
//   "ai:dm"                       the AI DM (TASK-0046)
//   "ai:companion:<characterId>"  an AI companion (decision-0014)
//   "system"                      server bookkeeping (fixtures, migrations of play state)

export const VisibilitySchema = z.string().min(1).max(128);
export const PUBLIC = "public";
export const DM_ONLY = "dm";
// Any other value is one user id (a whisper). See Visibility.

const Reason = z.string().min(1).max(500);         // same bounds as the engine's Reason
```

## Visibility

`canSee(viewer, visibility)` is the one rule (package-api.md):

| `visibility` | DM viewer | Player viewer `{ userId }` |
|---|---|---|
| `public` | yes | yes |
| `dm` | yes | no |
| a user id | yes | only when it equals `userId` |

Per-type rules, enforced by `appendSessionEvent` (refusal `VISIBILITY_NOT_ALLOWED`):

- `tracker.changed` MUST carry `dm`.
- Every other type accepts any visibility. The default is `public`.

Projections apply a second rule independent of the marker: a player projection drops every
`tracker.changed` event (projections.md).

## Catalog

The catalog maps each `(type, version)` to exactly one schema and one kind. Version is the
row's `payload_version`. Every type below is at version 1.

| Type | Kind | Visibility rule | Payload schema |
|---|---|---|---|
| `talk` | `talk` | any | `TalkV1` |
| `narration` | `talk` | any | `NarrationV1` |
| `action.declared` | `lifecycle` | any | `ActionDeclaredV1` |
| `action.commented` | `lifecycle` | any | `ActionCommentedV1` |
| `action.committed` | `lifecycle` | any | `ActionCommittedV1` |
| `action.resolved` | `lifecycle` | any | `ActionResolvedV1` |
| `action.withdrawn` | `lifecycle` | any | `ActionWithdrawnV1` (added by `029-proposal-gate/contracts/proposal-events.md`, "Action withdrawal"; TASK-0114, W-A ruling) |
| `table-mode.changed` | `state-change` | any | `TableModeChangedV1` |
| `scene.changed` | `state-change` | any | `SceneChangedV1` |
| `scene-presence.changed` | `state-change` | any | `ScenePresenceChangedV1` (TASK-0141) |
| `party.member.changed` | `state-change` | any | `PartyMemberChangedV1` |
| `tracker.changed` | `state-change` | `dm` only | `TrackerChangedV1` |
| `journal.entry.added` | `record` | any | `JournalEntryAddedV1` |
| each of the 18 engine event types | `marker` or `state-change` | any | `MechanicsEnvelopeV1` |

Kinds (research R4):

- `talk` — transcript only. Never changes another projection (AC #2).
- `lifecycle` — the actions projection and the transcript.
- `state-change` — MUST carry `reason`, `before` and `after` (AC #6). `null` in `before`
  means "did not exist"; `null` in `after` means "removed".
- `marker` — the engine's `dice.rolled`, `attack.resolved`, `check.resolved` and
  `rest.completed`. MUST carry `reason` (AC #6).
- `record` — the journal only.

Engine kinds: `dice.rolled`, `attack.resolved`, `check.resolved` and `rest.completed` are
`marker`; the other 14 engine types are `state-change` (engine events.md).

**Name rule.** No session-native type equals an engine event type. A test asserts the two
sets are disjoint. A future card adds a type by adding a catalog entry (for example
TASK-0045's `proposal.created`), and a new version of an existing type by adding a
`(type, version + 1)` entry; the old entry stays so the log replays (constitution IV).

## Payload schemas (version 1)

### Talk and narration

```ts
export const TalkV1 = z.object({
  text: z.string().min(1).max(4000),
  channel: z.enum(["ic", "ooc"]),               // in character / out of character
  characterId: RefIdSchema.nullable(),           // the speaking character, when in character
});

export const NarrationV1 = z.object({
  text: z.string().min(1).max(8000),
  actionIds: z.array(RefIdSchema).max(20),       // the resolved actions this narrates; may be []
});
```

Narration is the DM's story output (TASK-0046 `narrate`). A narrator chime-in that is talk
(decision-0016) uses `talk` with actor `ai:dm`.

### Action lifecycle

```ts
export const ActionDeclaredV1 = z.object({
  actionId: RefIdSchema,
  characterId: RefIdSchema.nullable(),           // null only for a party-scope action
  scope: z.enum(["character", "party"]),         // decision-0016: own character, or the party
  text: z.string().min(1).max(2000),
}).refine((p) => p.scope === "party" || p.characterId !== null,
  { message: "a character-scope action names its character" });

export const ActionCommentedV1 = z.object({
  actionId: RefIdSchema,
  stance: z.enum(["comment", "approve", "object"]),  // approve/object serve group sign-off
  text: z.string().max(2000),
}).refine((p) => p.stance !== "comment" || p.text.length > 0,
  { message: "a comment carries text" });

export const ActionCommittedV1 = z.object({
  actionId: RefIdSchema,
  authority: z.enum(["declarer", "active-player", "group", "dm"]),
  // The decision-0016 row the committer relied on. This card records it; TASK-0045 checks it.
});

export const ActionResolvedV1 = z.object({
  actionId: RefIdSchema,
  outcome: z.enum(["applied", "refused", "no-effect"]),
  // applied: the engine produced events; refused: the engine refused;
  // no-effect: resolved without mechanics (no roll was needed)
  batchIds: z.array(RefIdSchema).max(20),
  refusalCode: RefusalCodeSchema.nullable(),     // from @the-stacks/dnd5e-engine
}).superRefine((p, ctx) => {
  // applied  ⇒ batchIds.length ≥ 1 and refusalCode === null
  // refused  ⇒ refusalCode !== null and batchIds.length === 0
  // no-effect ⇒ batchIds.length === 0 and refusalCode === null
});
```

The `refusalCode` set follows the engine enum. `ACTOR_UNABLE` was added 2026-10-27 (TASK-0112, operator ruling). Amended 2026-10-27 (TASK-0112, operator ruling). The payload stays v1.

Status rules for the projection are in projections.md ("Actions").

### Scene presence

```ts
export const ScenePresenceSchema = z.enum(["present", "yielded", "absent"]);
export const PresenceReasonSchema = z.enum([
  "arrived", "left", "fled", "removed", "surrendered", "conceded",
]);
export const REASON_TO_PRESENCE = {
  arrived: "present",
  left: "absent", fled: "absent", removed: "absent",
  surrendered: "yielded", conceded: "yielded",
} as const;

export const ScenePresenceChangedV1 = z.object({
  actorId: RefIdSchema,                          // a character id, an NPC id or a combatant id
  before: ScenePresenceSchema,
  after: ScenePresenceSchema,
  reason: PresenceReasonSchema,
  actionId: RefIdSchema.nullable(),              // the resolving action; null for the NPC group
}).refine((p) => p.after === REASON_TO_PRESENCE[p.reason])
  .refine((p) => p.before !== p.after);
```

- Kind `state-change`, visibility `any`, current at version 1.
- The reason fixes the new value. The schema refuses an `after` that does not match the reason.
- The schema refuses a payload where `before` equals `after`.
- The gate writes this row only through the `scene-presence` proposal kind.

Amended 2026-10-27 (TASK-0141, operator ruling OQ-1):

> "TASK-0141 OQ-1 (a) scene-presence.changed via a new scene-presence proposal kind including
> the frozen 029 and 028 amendments, OQ-2 (a)"

### Table mode

```ts
export const TableModeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("free") }),
  z.object({
    mode: z.literal("turn"),
    activeActor: ActorIdSchema,                  // who holds commit authority this turn
    activeCharacterId: RefIdSchema.nullable(),
  }),
]);

export const TableModeChangedV1 = z.object({
  reason: Reason,
  before: TableModeSchema,
  after: TableModeSchema,
});
```

A session starts in `{ mode: "free" }`. Passing the turn in turn mode is a
`table-mode.changed` from turn to turn with a new `activeActor`.

### Scene

```ts
export const SceneSchema = z.object({
  sceneId: RefIdSchema,
  title: z.string().min(1).max(200),
  summary: z.string().max(4000),
  location: z.string().max(200).nullable(),
});

export const SceneChangedV1 = z.object({
  reason: Reason,
  before: SceneSchema.nullable(),
  after: SceneSchema.nullable(),                 // null: the scene ended
}).refine((p) => p.before !== null || p.after !== null);
```

### Party

```ts
export const ControllerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("player"), userId: z.uuid() }),
  z.object({ kind: z.literal("ai-companion"), actor: ActorIdSchema }),  // "ai:companion:<id>"
]);

export const PartyMemberSchema = z.object({
  characterId: RefIdSchema,
  name: z.string().min(1).max(100),
  controller: ControllerSchema,
  combatantId: CombatantIdSchema.nullable(),     // the engine combatant, once added
});

export const PartyMemberChangedV1 = z.object({
  reason: Reason,
  characterId: RefIdSchema,
  before: PartyMemberSchema.nullable(),          // null: joined
  after: PartyMemberSchema.nullable(),           // null: left
}).superRefine((p, ctx) => {
  // not both null; every non-null side has characterId === p.characterId
});
```

### Secret trackers

```ts
export const TrackerSchema = z.object({
  trackerId: RefIdSchema,
  name: z.string().min(1).max(100),              // "The cult completes the ritual"
  segments: z.number().int().min(2).max(12),
  filled: z.number().int().min(0),               // refine: filled <= segments
  note: z.string().max(1000).nullable(),
});

export const TrackerChangedV1 = z.object({
  reason: Reason,
  trackerId: RefIdSchema,
  before: TrackerSchema.nullable(),              // null: created
  after: TrackerSchema.nullable(),               // null: removed
}).superRefine((p, ctx) => {
  // not both null; ids match p.trackerId
});
```

Visibility MUST be `dm` (refusal `VISIBILITY_NOT_ALLOWED` otherwise).

### Journal

```ts
export const JournalEntryAddedV1 = z.object({
  entryId: RefIdSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  sourceActionIds: z.array(RefIdSchema).max(50),
});
```

TASK-0046's `chronicle` node writes journal entries (as proposals, through TASK-0045). A
DM-only note is a journal entry with visibility `dm`.

### Mechanics envelope (all 18 engine types)

```ts
export const MechanicsEnvelopeV1 = z.object({
  batchId: RefIdSchema,                          // one engine `execute` result
  index: z.number().int().min(0),                // position in that result's events array
  count: z.number().int().min(1).max(500),       // the result's events.length
  actionId: RefIdSchema.nullable(),              // the action this resolves, if any
  proposalId: RefIdSchema.nullable(),            // opaque; TASK-0045 defines proposals
  event: EngineEventSchema,                      // from @the-stacks/dnd5e-engine, unchanged
}).refine((p) => p.index < p.count);
```

- The row's `type` MUST equal `payload.event.type`; a mismatch decodes as `invalid` and is
  refused at append (`TYPE_MISMATCH`).
- `payload_version` versions the envelope (1). The engine event keeps its own `v` inside
  `event`. A new engine `v` needs no new envelope version as long as `EngineEventSchema`
  accepts it.
- An engine event's `rollIndex` resolves to the envelope in the same batch whose `index`
  equals it.
- **Atomic batches.** All envelopes of one batch are appended in one transaction under the
  log's sequencing lock (`appendMechanicsBatch` → `appendBatch`): they land with consecutive
  `seq` values and one visibility, or not at all (spec FR-021). Consumers still resolve
  `rollIndex` through `batchId` and `index`, never through `seq` arithmetic.
- Every ledger guarantee comes from `EngineEventSchema`: rolls carry `reason`, state changes
  carry `reason`, `before` and `after` (engine events.md).

## Decoding

```ts
export type DecodeResult =
  | { status: "known"; kind: EventKind; event: SessionEvent }   // typed, discriminated by type
  | { status: "unknown-type" }
  | { status: "unknown-version" }
  | { status: "invalid"; issues: string[] };

export function decodeEvent(stored: StoredEvent): DecodeResult;
```

`SessionEvent` is the discriminated union of every catalog entry's typed payload, each
carrying the row's envelope fields (`seq`, `actor`, `visibility`, `ts`, `type`). Decoding
never throws.

## Append refusal codes (server seam, package-api.md)

| Code | When |
|---|---|
| `UNKNOWN_EVENT_TYPE` | the type is not in the catalog |
| `UNKNOWN_EVENT_VERSION` | the type exists at no such version (the seam always appends the current version, so this is reachable only through `appendDecoded` tests) |
| `INVALID_PAYLOAD` | the payload fails its schema |
| `TYPE_MISMATCH` | a mechanics row whose `type` differs from `payload.event.type` |
| `VISIBILITY_NOT_ALLOWED` | the visibility breaks the type's rule (a non-`dm` tracker) |
| `INVALID_VISIBILITY` | the visibility is empty or longer than 128 characters |

A refusal writes nothing.

## Example rows

```json
{ "seq": 4, "actor": "6f1c…-player", "type": "action.declared", "payloadVersion": 1,
  "visibility": "public",
  "payload": { "actionId": "act-lockpick", "characterId": "ana", "scope": "character",
               "text": "Ana picks the lock on the vault door." } }

{ "seq": 9, "actor": "ai:dm", "type": "dice.rolled", "payloadVersion": 1, "visibility": "public",
  "payload": { "batchId": "b-lockpick", "index": 0, "count": 2, "actionId": "act-lockpick",
               "proposalId": null,
               "event": { "type": "dice.rolled", "v": 1, "reason": "Ana picks the vault lock",
                          "expression": "1d20+5", "mode": "normal", "purpose": "check",
                          "critical": false, "combatantId": "ana",
                          "terms": [ { "kind": "dice", "sign": 1, "count": 1, "sides": 20,
                                       "keep": null, "faces": [13], "kept": [true],
                                       "subtotal": 13 },
                                     { "kind": "modifier", "value": 5 } ],
                          "total": 18, "natural": 13 } } }

{ "seq": 12, "actor": "ai:dm", "type": "tracker.changed", "payloadVersion": 1, "visibility": "dm",
  "payload": { "reason": "the alarm bell rang", "trackerId": "ritual",
               "before": { "trackerId": "ritual", "name": "The cult completes the ritual",
                           "segments": 6, "filled": 1, "note": null },
               "after":  { "trackerId": "ritual", "name": "The cult completes the ritual",
                           "segments": 6, "filled": 2, "note": null } } }
```

> Extended by specs/029-proposal-gate/contracts/proposal-events.md: five catalog types (`proposal.created`, `proposal.approved`, `proposal.rejected`, `dm.seat.changed`, `gate.policy.changed`), the `proposal` event kind, and the mechanics envelope `proposalId` definition.
