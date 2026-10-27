# Contract: the proposal seam (approval panel and commit control vs TASK-0045)

TASK-0045 (the proposal gate) is specified in parallel; its proposal event types and gate interface
are not visible to this task. This contract freezes what the play route's components need, so they
build and test against fixtures now. The final phase of `tasks.md` (gated on TASK-0045's merge)
implements the adapters below against TASK-0045's real types. **Components never import TASK-0045
types**; only `play/proposals.ts` and `play/use-live-table.ts` do, and only in the gated phase.

Module: `apps/web/app/play/proposals.ts`.

## View shape

```ts
export interface PendingProposalView {
  proposalId: string;
  /** The proposal kind as the gate names it (for example "narration", "damage.apply"). */
  kind: string;
  /** One line the DM reads first: what approving would do. */
  summary: string;
  /** The proposing actor id ("ai:dm", "ai:companion:<id>", or a user id). */
  proposer: string;
  /** Display name for the proposer, resolved from the party where possible. */
  proposerLabel: string;
  /** The player action this proposal serves, when any. */
  actionId: string | null;
  /** Ordered label/value rows rendered under the summary. Values are display strings. */
  details: readonly { label: string; value: string }[];
  /** The seq of the event that raised it; the list is ordered by this, oldest first. */
  createdSeq: number;
  ts: string;
}
```

## Commands

```ts
export interface ProposalCommands {
  /** Returns true when the decision left (live) or applied (fixture). */
  approve(proposalId: string): boolean;
  reject(proposalId: string, reason: string | null): boolean;
}
```

A decided proposal leaves the list only when the source drops it: live, when the decision event
arrives; fixture, immediately.

## Adapter (selection)

```ts
import type { StoredEvent, Viewer } from "@the-stacks/session-model";

/** Pending proposals visible to `viewer`, oldest first. Always [] for a player viewer. */
export type SelectPendingProposals = (
  events: readonly StoredEvent[],
  viewer: Viewer,
) => PendingProposalView[];
```

| Phase | `selectPendingProposals` | Live `approve` / `reject` |
|---|---|---|
| Before TASK-0045 merges | `liveProposals` returns `[]` (no proposal event type exists, and the M0 registry withholds `dm` rows from every connection) | return `false`; the panel shows "No pending proposals" |
| Gated phase (after TASK-0045 merges) | maps TASK-0045's `proposal.created` / decision events, or its projection if it ships one, to `PendingProposalView` | call TASK-0045's documented approve and reject interface (a WS frame or an HTTP route, whichever it binds) |

Fixture mode before the gated phase uses `play/fixtures/proposals.ts`: at least two example
`PendingProposalView` values per fixture that has actions (`free-mode-action`, `turn-mode-combat`),
original content only, shown to the DM viewer only. If TASK-0045 commits proposal event fixtures,
the gated phase derives fixture proposals through the same `selectPendingProposals` and deletes the
web-local file.

## Commit-control seam

The commit control depends only on `CommitAuthority` (data-model.md), produced by
`commitAuthorityFor` in `play/authority.ts` (research R6), and on `TableCommands.commit`. Gated
phase obligations:

- If TASK-0045 exports its commit-authority rule from a client-importable package, replace the body
  of `commitAuthorityFor` with a call to it; the existing tests must still pass or be amended with a
  note citing TASK-0045's table.
- If TASK-0045 changes how a player action reaches the gate (for example a new frame type), change
  only `play/frames.ts` and `play/use-live-table.ts`.

## What the gated phase must not change

`PendingProposalView`, `ProposalCommands`, `CommitAuthority`, and every component's props. A needed
change to any of them is a spec amendment recorded in `spec.md`, not an implementer decision.

**Amendment (TASK-0049, operator ruling 2026-10-27, Q4):** the sign-off props on the action card (`ActionCardView.signoff` and the `present` argument of `commitAuthorityFor`) are additive; `CommitAuthority` is unchanged.

**Amendment (TASK-0100, operator ruling 2026-10-27, R1 option A):** `PendingProposalView` gains `policy: "ask" | "suggest"`, copied from the projection; a `suggest` row offers Dismiss (`onReject(id, null)`) and no Approve. `ProposalCommands` and component props are unchanged. See `specs/047-suggest-no-approve/contracts/pending-proposal-policy.md`.
