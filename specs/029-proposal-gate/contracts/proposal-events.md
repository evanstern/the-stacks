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
