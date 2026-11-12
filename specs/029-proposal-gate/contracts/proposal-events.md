# Contract: proposal lifecycle events, gate configuration events and projection additions

Package: `@the-stacks/session-model`. This extends
`specs/028-session-model/contracts/session-events.md` and `projections.md` by catalog entries
and additive projection fields, as those contracts provide ("a future card adds a type by
adding a catalog entry"). Update both 028 contracts in the same PR with a pointer here.

**Amendment (TASK-0114).** Amended by the operator ruling "W-A: add withdraw" on TASK-0114 (checkpoint W, 2026-10-26; spec 036-companion-react, FR-017 to FR-019). One catalog entry is added, `action.withdrawn`; see
"Action withdrawal" at the end of this file.

## New event kind

```ts
export type EventKind = "talk" | "lifecycle" | "state-change" | "marker" | "record" | "proposal";
```

`proposal` — the proposals projection only.

## Catalog additions (all version 1)

| Type | Kind | Visibility rule | Payload schema |
|---|---|---|---|
| `proposal.created` | `proposal` | `dm` only | `ProposalCreatedV1` |
| `proposal.approved` | `proposal` | `dm` only | `ProposalApprovedV1` |
| `proposal.rejected` | `proposal` | `dm` only | `ProposalRejectedV1` |
| `dm.seat.changed` | `state-change` | any (gate writes `public`) | `DmSeatChangedV1` |
| `gate.policy.changed` | `state-change` | any (gate writes `public`) | `GatePolicyChangedV1` |

`appendSessionEvent` enforces the `dm`-only rule with `VISIBILITY_NOT_ALLOWED`, as for
`tracker.changed`. The name rule holds: none equals an engine event type.

```ts
export const ProposalCreatedV1 = z.object({
  proposalId: RefIdSchema,
  policy: z.enum(["ask", "suggest"]),
  proposal: ProposalSchema,            // proposals.md; `summary` and `rationale` ride inside
});
// The row's actor is the proposer ("ai:dm" in M2).

export const ProposalApprovedV1 = z.object({
  proposalId: RefIdSchema,
  batchId: RefIdSchema.nullable(),     // the mechanics batch it produced, else null
});
// The row's actor is the approving DM's user id. It lands in the SAME atomic append as the
// proposal's effects, immediately after them.

export const ProposalRejectedV1 = z.object({
  proposalId: RefIdSchema,
  reason: z.string().min(1).max(500).nullable(),
});

export const DmSeatChangedV1 = z.object({
  reason: ReasonSchema,
  before: DmSeatSchema,                // { kind: "ai" } when no seat event precedes it
  after: DmSeatSchema,
});

export const GatePolicyChangedV1 = z.object({
  reason: ReasonSchema,
  proposalKind: DmProposalKindSchema,
  before: PolicySchema,                // the effective human-seat policy before the change
  after: PolicySchema,
});
```

## Mechanics envelope `proposalId`

The envelope's existing `proposalId` (028 session-events.md, "opaque; TASK-0045 defines
proposals") is now defined: the id of the approved proposal that produced the batch, and
`null` for an `auto` or `direct` application.

## Projection additions

```ts
export interface GateView {
  seat: DmSeat;                                          // { kind: "ai" } initially
  policyOverrides: Partial<Record<DmProposalKind, Policy>>;  // {} initially
}

export type ProposalStatus = "pending" | "approved" | "rejected";

export interface ProposalView {
  proposalId: string;
  createdSeq: number;
  ts: string;
  proposer: string;                                      // the created row's actor
  policy: "ask" | "suggest";
  kind: ProposalKind;
  proposal: Proposal;
  status: ProposalStatus;                                // a suggestion stays "pending" until rejected
  decided: { seq: number; actor: string; batchId: string | null; reason: string | null } | null;
}

export interface SessionProjections {
  // …every 028 field, unchanged…
  gate: GateView;
  proposals: ProposalView[];                             // always [] for a player viewer
}
```

Rules:

- `dm.seat.changed` sets `gate.seat` to `after`; `gate.policy.changed` sets
  `gate.policyOverrides[proposalKind] = after`. Both write a ledger `change` row (subject:
  `null` for the seat, the proposal kind for a policy) and both run the `before` check
  (`beforeMismatches`).
- `proposal.created` appends a `pending` view (a duplicate `proposalId` counts
  `ignoredTransitions`).
- `proposal.approved` moves `pending` to `approved`; it is ignored (counted) on a `suggest`
  proposal or a non-pending one.
- `proposal.rejected` moves `pending` to `rejected`.
- A player viewer never sees `proposal.*` rows (their visibility is `dm`, so `canSee` drops
  them uncounted). `proposals` stays `[]`, and the serialized player projections contain no
  proposal id or body (secrecy invariant, extended).
- `v` stays `1`: the additions are new fields with initial values; no existing field changes.
- The talk-isolation invariant is unchanged; `gate` and `proposals` join the fields a talk
  event must leave equal.

## Helpers

```ts
export function pendingProposals(p: SessionProjections): ProposalView[];  // status "pending", log order
export function findProposal(p: SessionProjections, proposalId: string): ProposalView | undefined;
```

## Action withdrawal (TASK-0114 amendment)

Amended by the operator ruling "W-A: add withdraw" on TASK-0114 (checkpoint W, 2026-10-26; spec 036-companion-react, FR-017 to FR-019).

| Type | Kind | Visibility rule | Payload schema |
|---|---|---|---|
| `action.withdrawn` | `lifecycle` | any (gate writes `public`) | `ActionWithdrawnV1` |

```ts
export const ActionWithdrawnV1 = z.object({ actionId: RefIdSchema });   // version 1
```

The row's actor is the proposer (the declarer, or the seated human DM).

Projection rules:

- `ActionStatus` gains the terminal status `withdrawn`.
- `action.withdrawn` moves a `declared` or `discussed` action to `withdrawn`. It is ignored
  (counted in `ignoredTransitions`) on a `committed`, `resolved` or `withdrawn` action, and on
  an unknown id.
- A comment, commit or resolve on a `withdrawn` action is ignored (counted), as for a
  `resolved` action.
- The transcript gains the entry `{ kind: "action.withdrawn"; actionId: string }`.
- A `withdrawn` action never joins a beat, enqueues no turn and shows no commit control.
- The catalog grows from 34 to 35 entries (17 session entries, 18 mechanics entries).

## Suggestions and the read marker (TASK-0188 amendment)

**Amendment (TASK-0188).** Amended 2026-11-02 (decision-0028 §8; operator ruling 2026-11-02: "All (a), amend"). Spec `specs/066-one-chat-stream` (FR-028).

| Type | Kind | Visibility rule | Payload schema |
|---|---|---|---|
| `action.suggested` | `lifecycle` | any (gate writes `public`) | `ActionSuggestedV1` |

```ts
export const SuggestionItemV1 = z.object({
  itemId: z.string().regex(/^i[1-4]$/),
  characterId: RefIdSchema.nullable(),
  scope: z.enum(["character", "party"]),
  text: z.string().min(1).max(500),          // the DM's wording
  check: z.string().min(1).max(40).nullable(),
}).refine((i) => i.scope === "party" || i.characterId !== null);

export const ActionSuggestedV1 = z.object({   // version 1
  suggestionId: RefIdSchema,
  readSeq: z.number().int().min(0),           // the last post the read saw
  items: z.array(SuggestionItemV1).min(1).max(4),
});
```

The row's actor is the proposer (`ai:dm`, or the seated human DM).

Changed payloads, version unchanged:

- `ActionDeclaredV1` gains `suggestionId: RefIdSchema.optional()`. Rows without it parse as before.
- `PresenceRecordedV1.purpose` gains `"read"`. The DM worker writes it once per claimed `talk` turn.

Projection rules:

- `SessionProjections` gains `suggestions: { suggestionId, seq, ts, actor, readSeq, items }[]`,
  `[]` initially, in log order. A duplicate `suggestionId` counts `ignoredTransitions`.
- The transcript gains `{ kind: "action.suggested"; suggestionId; readSeq; items }`.
- `ActionView` gains `suggestionId: string | null`.
- `PresenceView.purpose` gains `"read"`.
- `action.withdrawn` also moves a `committed` action to `withdrawn`. It stays ignored (counted) on a
  `resolved` or `withdrawn` action. This narrows the "Action withdrawal" rule above.
- Staleness is not folded. It is derived from the transcript (`suggestionState`), so the
  talk-isolation invariant is unchanged.
- The catalog grows from 37 to 38 entries (20 session entries, 18 mechanics entries).

## Intent carrier (TASK-0268 amendment)

Amended 2026-11-11 (TASK-0268, C-GATE ruling "Approve all", spec `specs/102-gate-intents`).

> "Approve all" (operator, C-GATE ruling, 2026-11-11: approves spec 102 plan.md "C-GATE: frozen contract amendments" and OQ-1 to OQ-14 as recommended)

One catalog entry is added: `intent.recorded` v1, kind `lifecycle`, visibility any, payload
`IntentRecordedV1`.

```ts
export const IntentRecordedV1 = z.object({
  intent: IntentSchema,
  schemaVersion: z.literal(INTENT_SCHEMA_VERSION),
  outcome: z.enum(["declared", "settled", "needs_ruling"]),
  batchId: RefIdSchema.nullable(),                    // the engine batch, else null
  facts: z.array(PlanFactSchema),                     // [] for gate-handled kinds
  request: RulingRequestSchema.nullable(),            // outcome needs_ruling only
  answers: RefIdSchema.nullable(),                    // the requestId a ruling or set_dc closed
  stopped: z.object({ code: z.string(), message: z.string() }).nullable(),
});
```

Each accepted Intent appends exactly one carrier row, last in its batch. Projection rules:

- `SessionProjections` gains `intents: IntentView[]`, `[]` initially, one entry per id in log
  order. `v` stays 1.
- `IntentView` is `{ id, seq, actor, intent, status: "declared" | "settled" | "needs_ruling" | "answered", request, proposalId }`.
- A later row for the same id (a confirm) replaces the entry and keeps its first `seq`.
- A row with `answers` moves the entry whose request id matches to `answered`.
- A `proposal.created` row of kind `intent` sets `proposalId` on the entry with the same Intent id.
- The helper `openRulings(p)` returns the open requests by `requestId`, each with its `proposalId`.
- The catalog gains one session entry (`intent.recorded`).

**Amendment (TASK-0199).** Amended 2026-11-11 (spec `specs/066-one-chat-stream`, plan.md "Frozen-contract amendments", row C-4; P-04, decision-0030).

> "Approve all" (operator, C-GATE ruling, 2026-11-11: approves C-1 to C-9 as written in spec 066 plan.md)

`action.declared` does not gain `suggestionId`. `action.withdrawn` does not fold a committed
action. `ActionDeclaredV1` and the withdraw fold stay as before TASK-0188. `ActionSuggestedV1`
items carry Intents per C-1: `{ itemId, text, intent }`. `SuggestionItemV1.intent.commit` is
`declared`.

Dated note, 2026-11-11 (T043): the code matches. The pointer blocks in `specs/028-session-model/contracts/{session-events,projections}.md` below carry the same change.
