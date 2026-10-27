# Contract: `policy` on `PendingProposalView` (TASK-0100, ruling R1 option A)

Amends `specs/030-play-route/contracts/proposal-seam.md` (FROZEN) by one additive field. Operator ruling 2026-10-27: "TASK-0100 R1 option A (policy on PendingProposalView, one amendment line in the frozen 030 proposal-seam.md, Dismiss via onReject(id, null))".

## View shape addition

```ts
export interface PendingProposalView {
  // …every proposal-seam.md field, unchanged…
  /** The policy recorded on the proposal's `proposal.created` row. `suggest` applies nothing. */
  policy: "ask" | "suggest";
}
```

## Unchanged

- `ProposalCommands` (`approve`, `reject`).
- `ProposalList` props (`proposals`, `onApprove`, `onReject`).
- `SelectPendingProposals` signature.
- Every 029 contract, gate request kind and event type.

## Behaviour

- A `suggest` row renders no Approve control and one Dismiss control.
- Dismiss calls `onReject(proposalId, null)`. Live, that sends `proposal.reject` with `reason: null`. Fixture, it drops the row locally.

## The amendment line for proposal-seam.md

Append exactly this line, after the TASK-0049 amendment line:

```markdown
**Amendment (TASK-0100, operator ruling 2026-10-27, R1 option A):** `PendingProposalView` gains `policy: "ask" | "suggest"`, copied from the projection; a `suggest` row offers Dismiss (`onReject(id, null)`) and no Approve. `ProposalCommands` and component props are unchanged. See `specs/047-suggest-no-approve/contracts/pending-proposal-policy.md`.
```
