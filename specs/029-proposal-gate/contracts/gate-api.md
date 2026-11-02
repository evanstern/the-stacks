# Contract: the gate API (pure planner, server gate, refusals, concurrency)

Binding for TASK-0046 (`resolve`, `director`, `chronicle` and companions call `gate.submit`)
and TASK-0047 (sends gate requests over the WebSocket; reads refusal codes from error frames).

## 1. Pure planner (`packages/session-model/src/gate/plan.ts`)

The planner turns one permitted proposal into the rows to append. It is pure: the engine is
pure, the RNG and ids are inputs, and the state is the DM projection.

```ts
export interface PlannedRow {
  actor: string;
  type: string;            // a catalog type
  payload: unknown;        // a valid payload for that type (version = current)
  visibility: string;
}

export interface PlanIds { batchId: string; }          // fresh per plan; used only by mechanics

export type PlanResult =
  | { ok: true; rows: PlannedRow[]; batchId: string | null }
  | { ok: false; refusal: GateRefusal };

/**
 * Plans a proposal against the DM projection `p`. Runs every gate check for the kind
 * (actions, commit authority, batch references), then, for `mechanics`, calls the engine's
 * `execute(p.engine, proposal.command, rng)` once. Writes nothing and reads no clock.
 * `proposalId` is stamped on mechanics envelopes (null for auto or direct).
 */
export function planProposal(
  p: SessionProjections, proposer: Proposer, proposal: Proposal,
  rng: Rng, ids: PlanIds, proposalId: string | null,
  context?: PlanContext,
): PlanResult;

/** Facts the planner cannot read from the projection (Amendment TASK-0049). */
export interface PlanContext { present?: readonly string[] }

/** Wraps one engine result in mechanics envelopes (moved here from the server seam). */
export function mechanicsRows(input: {
  actor: string; batchId: string; events: readonly EngineEvent[];
  actionId: string | null; proposalId: string | null; visibility: string;
}): PlannedRow[];
```

Rows per kind:

| Kind | Rows | Kind-specific checks (refusal code) |
|---|---|---|
| `talk` | one `talk` | IC character control (`NOT_AUTHORIZED`) |
| `action.declare` | one `action.declared` | id unused (`ACTION_EXISTS`); character control / party membership (`NOT_AUTHORIZED`); character able (`CHARACTER_UNABLE`: not conscious, `details.reason: "life-state"`). Amended 2026-10-27 (TASK-0112, operator ruling). Also `details.reason: "absent"` when the character is absent in `scenePresence`. Amended 2026-10-27 (TASK-0141, the TASK-0112 OQ-1 open-reason ruling: "the declare gate's code is `CHARACTER_UNABLE` (source `gate`), with an open `details.reason`") |
| `action.comment` | one `action.commented`; when the sign-off quorum is met by this `approve`, `action.commented`, a `presence.recorded` marker (`signoff`) and `action.committed` (`group`) | action exists (`UNKNOWN_ACTION`) and is open (`ACTION_NOT_OPEN`) |
| `action.commit` | one `action.committed` with the derived authority; for `group` authority with more than one party human, a `presence.recorded` marker (`signoff`) first | `commitAuthority` with `context.present` (policy-and-authority.md) |
| `action.withdraw` | one `action.withdrawn` | action exists (`UNKNOWN_ACTION`) and is open (`ACTION_NOT_OPEN`); permission in proposals.md (TASK-0114 amendment, W-A ruling) |
| `action.resolve` | one `action.resolved` | action is `committed` (`ACTION_NOT_COMMITTED`); every `batchId` names a batch in the DM ledger with this `actionId` (`UNKNOWN_BATCH`) |
| `mechanics` | the engine's events as one batch (`mechanicsRows`) | engine refusal (source `engine`, the engine's code); `actionId`, when set, names an existing action (`UNKNOWN_ACTION`) |
| `narration` | one `narration` | every `actionIds` entry exists (`UNKNOWN_ACTION`) |
| `table-mode` | one `table-mode.changed`, `before` = `p.tableMode` | none |
| `scene` | one `scene.changed`, `before` = `p.scene` | not both null (`INVALID_PROPOSAL`) |
| `party` | one `party.member.changed`, `before` from `p.party` | not both null (`INVALID_PROPOSAL`) |
| `tracker` | one `tracker.changed` (`dm`), `before` from `p.trackers` | not both null (`INVALID_PROPOSAL`) |
| `scene-presence` | one `scene-presence.changed` (visibility from the proposal: `public` by default, or `dm`), `before` from `p.scenePresence`, `after` from the reason; then, in the same batch, the engine `initiative.leave` rows (an absent value, actor in the order) or `initiative.join` rows (`arrived`, encounter active, actor not in the order) | `actionId`, when set, names an existing action (`UNKNOWN_ACTION`); not a no-change (`INVALID_PROPOSAL`); engine refusal (source `engine`) |
| `journal` | one `journal.entry.added` | `entryId` unused (`JOURNAL_ENTRY_EXISTS`) |
| `floor` `end` | one mechanics batch (`turn.advance`, then each settling step: `death-save.roll` for a dying combatant, `turn.advance` for a downed one, at most one lap), then one `table-mode.changed` (`public`) naming `activeActorFor(next)`; an `ai:dm` proposer prepends a `presence.recorded` row (`purpose: "floor"`, `present` from `PlanContext`) | in order: `NOT_TURN_MODE`; `TURN_MOVED` (`details: { expected, actual }`); proposer is the active actor or the seated DM, else `FLOOR_NOT_HELD` (`details: { holder }`); `ai:dm` only for an absent active human, else `NOT_AUTHORIZED`; engine refusal (source `engine`) |
| `floor` `take` | one `table-mode.changed` (`public`), `after` = `{ mode: "turn", activeActor: <DM user id>, activeCharacterId: null }`; the engine turn is unchanged | `NOT_TURN_MODE`; `TURN_MOVED`; not the seated DM (`NOT_DM`, `NOT_AUTHORIZED` for `ai:dm`); floor already held (`INVALID_PROPOSAL`) |
| `floor` `return` | one `table-mode.changed` (`public`), `after` = `activeActorFor(encounter.activeCombatantId)` | `NOT_TURN_MODE`; `TURN_MOVED`; not the seated DM (`NOT_DM`, `NOT_AUTHORIZED` for `ai:dm`); floor not held (`INVALID_PROPOSAL`) |

Amended 2026-10-27 (TASK-0050, operator ruling FT-1, FT-2): the three `floor` rows above.

> "TASK-0050: I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the
> frozen-contract amendments to 029, 031 and 044 and the one jobs migration."

Amended 2026-10-27 (TASK-0050, operator ruling FT-5): the stall override. An `action.commit` with
`override: "stall"` from `ai:dm` plans `presence.recorded` (`purpose: "signoff"`, `actionId`,
`present` from `PlanContext` without `ai:dm`) then `action.committed` (`dm`). It refuses
`INVALID_PROPOSAL` from any other proposer, for a character action, for fewer than two party
humans, or without `context.present`. It refuses `GROUP_SIGNOFF_REQUIRED` with
`details: { waiting, objecting }` while a present quorum member objects. This is the one
exception to "a `dm` commit writes no marker" (spec 044 FR-008). The time window belongs to the
`floor` job's stall check; the planner has no clock.

> "TASK-0050: I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the
> frozen-contract amendments to 029, 031 and 044 and the one jobs migration."

Amended 2026-10-27 (TASK-0141, operator ruling OQ-1): the `scene-presence` row above.

> "TASK-0141 OQ-1 (a) scene-presence.changed via a new scene-presence proposal kind including
> the frozen 029 and 028 amendments, OQ-2 (a)"

Amended 2026-10-27 (TASK-0142, operator ruling OQ-4): the `scene-presence` row above writes its
`scene-presence.changed` row with the proposal's `visibility` (`public` by default, or `dm`).
Engine rows planned in the same batch stay `public`.

> "TASK-0142: I accept the recommended defaults OQ-1 to OQ-6 (a), including the frozen 029 and
> 031 amendments" (OQ-4 (a): optional `visibility` on the `scene-presence` proposal)

The row's `actor` is `actorOf(proposer)` for direct and auto applications, and the original
proposer for an approved proposal (the approval row carries the DM). Each planned payload is
validated against its catalog schema inside the planner; a failure is `INVALID_PROPOSAL`.

> **Amendment (TASK-0049).** The operator ruled on 2026-10-27 ("I accept the defaults on the
> TASK-0099 and TASK-0049 cards, including the frozen-contract amendments to spec 029 and
> spec 006"). `planProposal` takes a trailing optional `PlanContext`. The signature, the
> `action.comment` and `action.commit` rows and the `GROUP_SIGNOFF_REQUIRED` details are
> defined in `specs/044-group-signoff/contracts/signoff.md`. Without `context.present`, a
> comment never commits.

## 2. Refusals

```ts
export type GateRefusalSource = "gate" | "engine" | "append";

export const GateRefusalCodeSchema = z.enum([
  "INVALID_PROPOSAL", "NOT_AUTHORIZED", "NOT_DM",
  "UNKNOWN_ACTION", "ACTION_EXISTS", "ACTION_NOT_OPEN", "ACTION_NOT_COMMITTED",
  "COMMIT_NOT_ALLOWED", "GROUP_SIGNOFF_REQUIRED",
  "UNKNOWN_BATCH", "JOURNAL_ENTRY_EXISTS",
  "UNKNOWN_PROPOSAL", "PROPOSAL_NOT_PENDING", "PROPOSAL_NOT_APPROVABLE",
  "CONFLICT", "CHARACTER_UNABLE",
  "FLOOR_NOT_HELD", "TURN_MOVED", "NOT_TURN_MODE",   // TASK-0050 amendment, FT-2
]);
// Amended 2026-10-27 (TASK-0050, operator ruling FT-2): FLOOR_NOT_HELD, TURN_MOVED and NOT_TURN_MODE join the list.
// CHARACTER_UNABLE details.reason is an open set: "life-state" (TASK-0112); "absent" is added (TASK-0141).
// Amended 2026-10-27 (TASK-0112, operator ruling): the list was 15 codes before CHARACTER_UNABLE.

export interface GateRefusal {
  source: GateRefusalSource;
  code: string;            // a GateRefusalCode, an engine RefusalCode, or an AppendRefusalCode
  message: string;         // for humans and logs; never parsed
  details?: Record<string, unknown>;
}
```

> **Amendment (TASK-0049).** A `GROUP_SIGNOFF_REQUIRED` refusal carries
> `details: { waiting: string[]; objecting: string[] }` (user ids, sorted).

| Source | Codes | When |
|---|---|---|
| `gate` | the list above | schema, permission, lifecycle and supervision checks; `CONFLICT` after three sequence conflicts |
| `engine` | the engine's 27 `RefusalCode`s, unchanged (refusals.md). Amended 2026-10-27 (TASK-0112, operator ruling): the count was 26 before `ACTOR_UNABLE` | `execute` returned `ok: false` (AC #8) |
| `append` | 028's `AppendRefusalCode`s | the session seam refused a planned row (a planner bug; tested as unreachable for every fixture) |

Every refusal leaves the log unchanged. The planner runs fully before the first write, and
the append is one transaction.

## 3. Server gate (`apps/server/src/gate/`)

```ts
export type GateResult =
  | { ok: true; outcome: "applied"; events: StoredEvent[]; batchId: string | null }
  | { ok: true; outcome: "pending"; proposalId: string; events: StoredEvent[] }    // ask
  | { ok: true; outcome: "suggested"; proposalId: string; events: StoredEvent[] }  // suggest
  | { ok: true; outcome: "decided"; events: StoredEvent[] }  // approve/reject/seat/policy
  | { ok: false; refusal: GateRefusal };

export interface GateDeps {
  db: DbClient;
  /** Engine RNG per plan. Default: seededRng(crypto randomInt(0, 2**32)). Tests inject scriptedRng. */
  rng?: () => Rng;
  /** Id source for batch and proposal ids. Default: crypto randomUUID. */
  newId?: () => string;
  /** Test seam: the session seam's batch append (failure injection, conflict injection). */
  appendSessionEvents?: typeof appendSessionEvents;
}

export interface Gate {
  /** A proposal from any proposer. The DM runtime's entry point. */
  submit(sessionId: string, proposer: Proposer, proposal: unknown): Promise<GateResult>;
  /** Any gate request (proposal or supervision). The WebSocket gateway's entry point. */
  handle(sessionId: string, proposer: Proposer, request: unknown): Promise<GateResult>;
  /** Called after every successful append with the stored rows, in seq order. */
  onAppended(listener: (sessionId: string, events: StoredEvent[]) => void): () => void;
}

export function createGate(deps: GateDeps): Gate;
```

`submit` parses with `ProposalSchema`; `handle` parses with `GateRequestSchema`. Both refuse
`INVALID_PROPOSAL` on a parse failure.

### Algorithm (one attempt)

1. Parse the input. Fold the DM projection: `loadProjections(db, sessionId, { role: "dm" })`.
   Let `lastSeq = p.throughSeq`.
2. **Proposal:** check the permission matrix (`NOT_AUTHORIZED`), then `routeProposal`.
   - `direct` or `policy: auto` → `planProposal(…, proposalId = null, context)`. Refusal → return it.
     Else append the rows.
   - `policy: ask | suggest` → `planProposal` with a throwaway `seededRng(0)` as the legality
     check (refuse-before-draw makes the verdict independent of dice). Refusal → return it.
     Else append one `proposal.created` row (`dm`, actor `ai:dm`, a new `proposalId`).
3. **`proposal.approve`:** the proposer must be the seated human DM (`NOT_DM`). The proposal
   must exist (`UNKNOWN_PROPOSAL`), have policy `ask` (`PROPOSAL_NOT_APPROVABLE`) and be
   `pending` (`PROPOSAL_NOT_PENDING`). Plan it as its original proposer with a live RNG and
   `proposalId` set. Refusal → return it (the proposal stays pending). Else append
   `[...rows, proposal.approved]` atomically.
4. **`proposal.reject`:** seated human DM (`NOT_DM`); exists; `pending`. Append
   `proposal.rejected`.
5. **`dm.seat`:** operator role (`NOT_AUTHORIZED`). Append `dm.seat.changed` with `before =
   p.gate.seat`.
6. **`gate.policy`:** seated human DM or operator (`NOT_AUTHORIZED`). Append
   `gate.policy.changed` with `before` = the current human-seat effective policy.
7. Every append calls the seam with `expectedLastSeq: lastSeq`. On `SeqConflictError`,
   wait, then restart from step 1. After the third conflict, refuse `CONFLICT`. See the
   TASK-0157 amendment ("Ordering and retry policy") below for the order, the wait and the
   bound.
8. On success, call every `onAppended` listener (a listener that throws is logged and does
   not affect the result or other listeners), then return the result.

The gate holds no proposal state in memory. Everything it decides is read from the log in
step 1, so a restart loses nothing (AC #9).

> **Amendment (TASK-0049).** Every `planProposal` call in this section passes `context =
> { present: presence.presentUsers(sessionId).map((e) => e.userId) }`, read from the live
> presence reader. Step 2's legality check and step 3's approval plan receive it too.

> **Amendment (TASK-0157, specs/052-talk-conflict-retry). Ordering and retry policy.**
>
> - **Per-session order.** The gate runs one session's writes one at a time, in arrival
>   order, inside the server process. A write is a `handle` call, a `submit` call or a
>   `recordPresence` call. The whole of each write runs in its turn: every attempt, every
>   wait and every `onAppended` call. Writes to different sessions never wait for each other.
> - **Parse first.** A request that fails `ProposalSchema` or `GateRequestSchema` is refused
>   `INVALID_PROPOSAL` at once. It never joins the order.
> - **Isolation.** A refusal or a thrown error ends that write only. The next write in the
>   session still runs.
> - **No re-entry.** Code that runs inside a write MUST NOT await another gate write for the
>   same session. `onAppended` listeners are synchronous for this reason.
> - **Retry bound.** At most 3 attempts per write. After a `SeqConflictError` on attempt 1 or
>   2, the gate waits a random 10–50 ms, then restarts from step 1. No wait follows attempt 3.
>   `GateDeps.retryDelayMs(attempt)` overrides the wait for tests.
> - **When `CONFLICT` can still occur.** In-process writes cannot conflict with one another.
>   A `CONFLICT` now means a writer outside this gate instance (another process, or a second
>   gate over the same database) appended to the session three times in a row.
> - **Safe to resend.** A `CONFLICT` writes zero rows. A caller may resend the same request
>   without risk of a duplicate.
> - **Wire unchanged.** `CONFLICT` keeps the `internal` error kind (ws-delivery.md).
>
> Amended 2026-10-27 (TASK-0157), operator ruling: "TASK-0157: I accept the recommended
> defaults Q1 to Q6, including the per-session gate queue, the jittered retry and the 029
> gate-api amendment."

### AC #7 equivalence

`direct` (a seated human DM's command) and an approval both call `planProposal`; the only
differences are `proposalId` on the mechanics envelopes and the trailing `proposal.approved`
row. A test plans the same `mechanics` proposal both ways with equal scripted dice and
asserts deeply equal engine events.

## 4. Session seam and event-log additions

`apps/server/src/events/log.ts` (event-log contract, additive):

```ts
export class SeqConflictError extends Error { readonly expected: number; readonly actual: number; }

/** Unchanged behaviour when `options` is omitted. With `expectedLastSeq`, compares it to the
 *  session's MAX(seq) (0 when empty) inside the locked transaction, before any insert, and
 *  throws SeqConflictError on a mismatch; nothing lands. */
export async function appendBatch(
  db: DbClient, inputs: readonly AppendInput[], options?: { expectedLastSeq?: number },
): Promise<RecordedEvent[]>;

/** The latest row of one type in a session, or null. One indexed read (primary key order). */
export async function readLatestOfType(
  db: DbClient, input: { sessionId: string; type: string },
): Promise<RecordedEvent | null>;
```

`apps/server/src/session/events.ts` (028 package-api.md "Server seam", additive):

```ts
/** Vets every input against the catalog (any refusal: nothing written), then appends all
 *  rows in one appendBatch, forwarding expectedLastSeq. */
export function appendSessionEvents(
  db: DbClient, inputs: readonly AppendSessionEventInput[], options?: { expectedLastSeq?: number },
): Promise<StoredEvent[]>;

/** The inert legacy path (ws-delivery.md). Refuses CATALOG_TYPE_REQUIRES_GATE for any
 *  catalogued type; otherwise calls M0 append unchanged. */
export function appendUncataloguedEvent(db: DbClient, input: AppendInput): Promise<StoredEvent>;

/** The session's DM seat: the latest dm.seat.changed row's `after`, else { kind: "ai" }. */
export function loadDmSeat(db: DbClient, sessionId: string): Promise<DmSeat>;
```

`appendMechanicsBatch` keeps its signature and behaviour; it now builds rows with the
package's `mechanicsRows` and appends through `appendSessionEvents`.
`AppendRefusalCode` gains `CATALOG_TYPE_REQUIRES_GATE`.

## 5. Wiring (`apps/server/src/index.ts`)

```ts
const gate = createGate({ db });
const gateway = createGateway({ db, validateSession: createValidateSession(db), gate });
gate.onAppended((sessionId, events) => gateway.publish(sessionId, events));
```

`gateway.publish` broadcasts each stored event as an `event` frame (ws-delivery.md). The DM
runtime (TASK-0046) receives the same `gate` instance from `index.ts`.

> **Amendment (TASK-0188).** Amended 2026-11-02 (decision-0028 §8; operator ruling 2026-11-02: "All (a), amend"). Spec `specs/066-one-chat-stream`.
> Rows per kind gain:
>
> | Kind | Rows | Kind-specific checks (refusal code) |
> |---|---|---|
> | `action.suggest` | one `action.suggested` (`public`) | `suggestionId` unused and no derived action id exists (`INVALID_PROPOSAL`); from `ai:dm`, no readable post newer than `readSeq` (`SUGGESTION_STALE`) |
> | `action.accept` | `action.declared` (actor the acceptor, id `<suggestionId>.<itemId>`, text the DM's wording plus " — <check>" when set, `suggestionId`) then `action.committed` (the accept authority), one batch, no sign-off marker | the accept rule in policy-and-authority.md (`SUGGESTION_NOT_FOUND`, `SUGGESTION_STALE`, `ACTION_EXISTS`, `NOT_AUTHORIZED`, `CHARACTER_UNABLE`, `COMMIT_NOT_ALLOWED`) |
>
> The `action.withdraw` row also accepts a `committed` action; `ACTION_NOT_OPEN` covers only
> `resolved` and `withdrawn`. An `action.declare` carrying `suggestionId` is `INVALID_PROPOSAL`.
> `GateRefusalCodeSchema` gains `SUGGESTION_STALE` and `SUGGESTION_NOT_FOUND` (21 codes).
