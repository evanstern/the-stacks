# Research: suggest proposals without an Approve control

No NEEDS CLARIFICATION remained in the Technical Context. Each item below records a decision taken from existing artifacts.

## R-1 — How Dismiss reaches the gate

- **Decision**: Dismiss sends the existing `proposal.reject` request with `reason: null`.
- **Rationale**: 029 `proposal-events.md` says a suggestion stays `pending` until rejected. 029 `gate-api.md` step 4 checks the DM seat, existence and `pending` status, not policy. `apps/server/src/gate/gate.ts` (`case "proposal.reject"`) matches. A rejected suggestion leaves `pendingProposals`.
- **Alternatives considered**: a new `proposal.dismiss` request kind or `proposal.dismissed` event. Rejected: it changes frozen 029 contracts for no new behaviour, and the log already records the policy on `proposal.created`.

## R-2 — Where the policy comes from

- **Decision**: copy `ProposalView.policy` from the DM projection.
- **Rationale**: the gate decides approvability from the recorded policy (`view.policy !== "ask"`). The panel must agree with the gate, including after a later `gate.policy.changed`.
- **Alternatives considered**: derive from `DEFAULT_POLICIES` and `gate.policyOverrides`. Rejected: it shows the current policy, not the recorded one, and diverges after an override change.

## R-3 — Seam shape

- **Decision**: add `policy: "ask" | "suggest"` to `PendingProposalView`; keep `ProposalCommands` and component props unchanged (operator ruling R1 option A, 2026-10-27).
- **Alternatives considered**: an `onDismiss` prop (R1 option B); an `approvable` flag (R1 option C). Not chosen by the ruling.

## R-4 — Dismiss interaction

- **Decision**: one click, no reason field, no confirmation.
- **Rationale**: a suggestion applies nothing, so dismissing it loses nothing the DM cannot re-issue. The project uses no modals.
- **Alternatives considered**: reuse Reject's inline reason flow. Rejected: an extra step for a no-op decision.
