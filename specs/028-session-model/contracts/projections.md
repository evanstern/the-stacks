# Contract: projections

Package: `@the-stacks/session-model`. Binding for TASK-0045 (reads `engine`, `tableMode`,
`actions`), TASK-0046 (`assemble` reads all of it) and TASK-0047 (renders all of it). The fold
API is in [package-api.md](package-api.md); event types are in
[session-events.md](session-events.md).

## Viewer

```ts
export type Viewer =
  | { role: "dm" }                               // the operator as DM, or the AI DM in the server
  | { role: "player"; userId: string };          // one human player
```

## Shape

```ts
export interface SessionProjections {
  v: 1;                                          // projection shape version
  viewer: Viewer;

  // ── projections (AC #4) ──
  scene: Scene | null;
  tableMode: TableMode;                          // { mode: "free" } initially
  party: PartyMemberView[];
  encounter: EncounterView | null;
  journal: JournalEntryView[];
  transcript: TranscriptEntry[];
  actions: ActionView[];
  ledger: LedgerRow[];
  trackers: Tracker[];                           // always [] for a player viewer (AC #5)
  engine: EngineState;                           // the engine's fold of visible mechanics events

  // ── fold bookkeeping (not projections; excluded from AC #2 comparisons) ──
  throughSeq: number;                            // highest seq folded for this viewer; 0 initially
  diagnostics: Diagnostics;
}

export interface Diagnostics {
  skippedUnknownType: number;                    // AC #8
  skippedUnknownVersion: number;                 // AC #8
  skippedInvalid: number;                        // AC #8: payload failed its schema
  outOfOrder: number;                            // seq <= throughSeq (a duplicate delivery)
  ignoredTransitions: number;                    // lifecycle event that breaks the status rules
  beforeMismatches: number;                      // state-change whose `before` differs from projected state
  engineRejected: number;                        // engine evolve threw (e.g. unknown combatant)
  incompleteBatches: string[];                   // defensive: batch ids seen fewer times than their count (see Engine state)
}
```

Every array is in log order (ascending `seq`) unless stated otherwise. Every value is plain
JSON (no `Date`, `Map` or class instance), so projections serialize and compare with deep
equality.

## Projection rules

### Visibility (AC #5)

1. An event with `canSee(viewer, visibility) === false` is dropped before decoding. It is
   **not counted** anywhere, and it does not move `throughSeq`.
2. For a player viewer, every `tracker.changed` event is dropped the same way, whatever its
   visibility.
3. For a player viewer, `trackers` is always `[]`, and no other field holds tracker data.

### Order and tolerance (AC #7, AC #8)

- An event with `seq <= throughSeq` is ignored and counts `outOfOrder`.
- Otherwise `throughSeq` becomes the event's `seq`, then the event is decoded:
  `unknown-type`, `unknown-version` and `invalid` each increment their counter and change
  nothing else.
- Nothing in the fold throws for any input stream.

### Transcript

```ts
export type TranscriptEntry = {
  seq: number; ts: string; actor: string; visibility: string;
} & (
  | { kind: "talk"; text: string; channel: "ic" | "ooc"; characterId: string | null }
  | { kind: "narration"; text: string; actionIds: string[] }
  | { kind: "action.declared"; actionId: string; characterId: string | null;
      scope: "character" | "party"; text: string }
  | { kind: "action.commented"; actionId: string; stance: "comment" | "approve" | "object";
      text: string }
  | { kind: "action.committed"; actionId: string; authority: ActionAuthority }
  | { kind: "action.withdrawn"; actionId: string }   // TASK-0114, W-A ruling
  | { kind: "action.resolved"; actionId: string; outcome: "applied" | "refused" | "no-effect";
      refusalCode: string | null }
);
```

Every `talk`, `narration` and lifecycle event the viewer sees appends one entry, even when
the lifecycle event is an ignored transition (the transcript is what was said). `talk`
changes no projection other than `transcript` (AC #2).

### Actions

```ts
export type ActionStatus = "declared" | "discussed" | "committed" | "resolved" | "withdrawn";  // `withdrawn`: TASK-0114, W-A ruling

export interface ActionView {
  actionId: string;
  declaredSeq: number;
  actor: string;                                 // the declarer
  characterId: string | null;
  scope: "character" | "party";
  text: string;
  status: ActionStatus;
  comments: { seq: number; actor: string; stance: "comment" | "approve" | "object"; text: string }[];
  committed: { seq: number; actor: string; authority: ActionAuthority } | null;
  resolved: { seq: number; outcome: "applied" | "refused" | "no-effect";
              batchIds: string[]; refusalCode: string | null } | null;
}
```

Transitions (anything else counts `ignoredTransitions` and leaves the action unchanged):

| Event | Allowed from | To |
|---|---|---|
| `action.declared` | (no action with this id) | `declared` |
| `action.commented` | `declared`, `discussed` | `discussed` (comment appended) |
| `action.committed` | `declared`, `discussed` | `committed` |
| `action.resolved` | `committed` | `resolved` |
| `action.withdrawn` | `declared`, `discussed` | `withdrawn` (terminal; added by 029 `proposal-events.md`, "Action withdrawal") |

A comment on a committed or resolved action is kept in the transcript only. `actions` is
ordered by `declaredSeq`. Committed actions that wait for resolution stay `committed` in
log order (decision-0016 concurrency).

### Table mode

`tableMode` starts `{ mode: "free" }`. `table-mode.changed` sets it to `after`. When
`before` differs from the projected mode, `beforeMismatches` increments and `after` still
applies.

### Scene

`scene` starts `null`. `scene.changed` sets it to `after` (with the same `before` check).

### Party

```ts
export interface PartyMemberView extends PartyMember {
  combatant: {
    hp: { current: number; max: number; temp: number };
    lifeState: "conscious" | "unconscious" | "stable" | "dead";
    deathSaves: { successes: number; failures: number };
    conditions: ConditionInstance[];
    ac: number | null;
  } | null;                                      // null when combatantId is null or not in engine state
}
```

`party.member.changed` adds (`before` null), replaces, or removes (`after` null) the member,
with the same `before` check. `party` is ordered by the seq of each member's join. Each
member's `combatant` is read from `engine.combatants[combatantId]`; it is recomputed after
every event that changes either side.

### Encounter

```ts
export interface EncounterView {
  round: number;
  turnIndex: number;
  activeCombatantId: string;
  order: {
    combatantId: string;
    name: string;
    initiative: number;                          // the entry's total
    hp: { current: number; max: number; temp: number };
    lifeState: "conscious" | "unconscious" | "stable" | "dead";
    conditions: ConditionInstance[];
    characterId: string | null;                  // the party member linked to this combatant
  }[];
}
```

`encounter` is `null` whenever `engine.encounter` is `null`; otherwise it is built from
`engine.encounter` and `engine.combatants`. An order entry whose combatant is missing from
the viewer's engine state is omitted.

### Engine state

`engine` starts at the engine's `emptyState()`. Each visible, decoded mechanics event folds
with the engine's `evolve(engine, payload.event)`. When `evolve` throws, `engine` keeps its
value and `engineRejected` increments. The projection never recomputes a rule (FR-012).
`incompleteBatches` tracks, per `batchId`, how many envelopes were seen against `count`. It
is a defensive check only: the server writes every batch atomically (`appendMechanicsBatch`,
spec FR-021), so a stream written through the seam never yields a non-empty list. The fold
keeps the check because it must be total over any stream (rows written by M0 `append`
directly, or a hand-built stream). The database suite proves the list is empty for every
fixture appended through the seam. Because `appendMechanicsBatch` applies one visibility to
the whole batch, a viewer sees all of a batch or none of it.

### Journal

```ts
export interface JournalEntryView {
  seq: number; ts: string; actor: string; visibility: string;
  entryId: string; title: string; body: string; sourceActionIds: string[];
}
```

### Ledger (AC #6)

```ts
export type LedgerRow =
  | { kind: "roll"; seq: number; actor: string; visibility: string; reason: string;
      batchId: string; index: number; actionId: string | null;
      roll: DiceRolledEvent }                     // the engine event: expression, mode, terms (faces), total, natural
  | { kind: "outcome"; seq: number; actor: string; visibility: string; reason: string;
      batchId: string; index: number; actionId: string | null;
      outcome: AttackResolvedEvent | CheckResolvedEvent | RestCompletedEvent }
  | { kind: "change"; seq: number; actor: string; visibility: string; reason: string;
      type: string;                               // engine or session state-change type
      subject: string | null;                     // combatantId, characterId, trackerId, or null
      before: unknown; after: unknown;
      batchId: string | null; index: number | null; actionId: string | null };
```

- One `roll` row per visible `dice.rolled`; one `outcome` row per visible
  `attack.resolved`, `check.resolved` and `rest.completed`; one `change` row per visible
  state-change event, engine or session.
- For a player viewer, no `change` row has `type: "tracker.changed"` (rule 2 above).
- Rows are appended even when the engine rejected the event (the ledger shows what the log
  says); `diagnostics.engineRejected` flags the inconsistency.

## Invariants (each one has a test)

1. **Talk isolation (AC #2).** For any projections `p` and talk event `t`, every field of
   `applyEvent(p, t)` except `transcript`, `throughSeq` and `diagnostics` deep-equals `p`'s.
2. **Replay identity (AC #7).** `project(events, viewer)` deep-equals itself on a second call,
   and deep-equals the incremental fold `events.reduce(applyEvent, emptyProjections(viewer))`.
   The database test proves it for a log stored and read back through `readFrom`.
3. **Tolerance (AC #8).** For any array of `StoredEvent`, `project` returns; unknown and
   invalid events change only `throughSeq` and their diagnostics counter.
4. **Secrecy (AC #5).** For every fixture and every player viewer, `JSON.stringify` of the
   projections contains no tracker id, tracker name or tracker note from that fixture, and
   `trackers` is `[]`.
5. **Purity.** `applyEvent` does not mutate its input (tests deep-freeze it).

> Extended by specs/029-proposal-gate/contracts/proposal-events.md and policy-and-authority.md: the `gate` and `proposals` projection fields, `pendingProposals`, `findProposal`, and `commitAuthority`.
