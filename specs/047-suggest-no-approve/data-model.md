# Data model: suggest proposals without an Approve control

No persisted data changes. No event, migration or projection field is added.

## PendingProposalView (web seam, `apps/web/app/play/proposals.ts`)

| Field | Type | Change | Source |
|---|---|---|---|
| `policy` | `"ask" \| "suggest"` | **new, required** | `ProposalView.policy` (the `proposal.created` row's `policy`) |
| every other field | unchanged | none | unchanged |

Rules:

- `policy` is copied, never derived from `kind` or the current gate configuration.
- A player viewer still receives `[]`; no policy reaches a player.

## Row controls by policy (`ProposalList`)

| `policy` | Label | Controls | Callback |
|---|---|---|---|
| `ask` | none (as today) | Approve; Reject with inline optional reason | `onApprove(id)`; `onReject(id, reason \| null)` |
| `suggest` | "Suggestion" | Dismiss | `onReject(id, null)` |

## State transition (unchanged, 029)

`pending` → `rejected` on `proposal.rejected`. A dismissed suggestion ends `rejected`. Its `proposal.created` row records `policy: "suggest"`, which distinguishes it from a rejected `ask` proposal.
