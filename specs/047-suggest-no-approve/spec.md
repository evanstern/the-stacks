# Feature Specification: Approval panel shows suggest proposals without an Approve control

**Feature Branch**: `task-0100-suggest-no-approve`

**Created**: 2026-10-27

**Status**: Ruled. R1 = option A (operator, 2026-10-27, in chat; recorded on TASK-0100 at ae15f31).

**Input**: TASK-0100. "The DM approval panel shows a suggest-policy proposal as a suggestion the DM can act on or dismiss. It offers no Approve button, which can only fail."

## Background

decision-0015 defines three gate policies. `suggest` means "show it; the DM issues their own command": a suggestion applies nothing. The gate enforces this: `proposal.approve` on a `suggest` proposal refuses `PROPOSAL_NOT_APPROVABLE` (`apps/server/src/gate/gate.ts`). `scene` is `suggest` by default (`specs/029-proposal-gate/contracts/policy-and-authority.md`), and the DM may set any DM proposal kind to `suggest`.

The play route's approvals panel (`apps/web/app/play/components/proposal-list.tsx`, TASK-0047) renders Approve and Reject on every pending proposal. On a suggestion, Approve can only fail. The panel cannot tell a suggestion from an `ask` proposal, because `PendingProposalView` (`specs/030-play-route/contracts/proposal-seam.md`, FROZEN) carries no policy. The projection already carries it: `ProposalView.policy` is `"ask" | "suggest"` (029 `proposal-events.md`).

### Dismiss reuses the existing reject path

Dismiss needs no gate change. The 029 contracts already cover it:

- `proposal-events.md`: `ProposalStatus` notes "a suggestion stays `pending` until rejected", and `proposal.rejected` moves `pending` to `rejected` with no policy condition.
- `gate-api.md` step 4: `proposal.reject` requires the seated human DM, an existing proposal, and status `pending`. It does not check policy.
- `gate.ts` `case "proposal.reject"` matches the contract: no policy check.

Dismiss therefore sends the existing `proposal.reject` request with `reason: null`. It writes one `proposal.rejected` row. No request kind, event type, payload or 029 contract changes. `ProposalCommands.reject(proposalId, reason)` already carries it, so `ProposalCommands` is unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The DM sees a suggestion as a suggestion (Priority: P1)

A human DM holds the seat. The AI DM suggests a scene change. The DM opens the approvals panel and sees the suggestion marked as a suggestion. It offers Dismiss and no Approve. The DM reads it, acts on it with their own command or not, and dismisses it.

**Why this priority**: it is the whole card. Today the panel offers a control that can only fail.

**Independent Test**: render the approvals list for the `dm-approvals` fixture's DM viewer. Its pending P3 is a `scene` proposal with policy `suggest`. Assert P3's row has a Dismiss control and no Approve control, and that P4 and P5 (`ask`) keep Approve and Reject.

**Acceptance Scenarios**:

1. **Given** a pending `suggest` proposal, **When** the DM opens the approvals panel, **Then** its row shows a "Suggestion" label, a Dismiss control, and no Approve control.
2. **Given** a pending `ask` proposal, **When** the DM opens the approvals panel, **Then** its row shows Approve and Reject exactly as before.
3. **Given** a pending `suggest` proposal, **When** the DM clicks Dismiss on the live table, **Then** the client sends `proposal.reject` with `reason: null`, and the row leaves the list when the `proposal.rejected` row arrives.
4. **Given** a pending `suggest` proposal in fixture mode, **When** the DM clicks Dismiss, **Then** the row leaves the list at once, as a fixture reject does today.

### Edge Cases

- A `suggest` proposal raised under an `ask` override still renders by its recorded policy. The view reads `ProposalView.policy` from the `proposal.created` row, never `DEFAULT_POLICIES` or the current override.
- A policy change after the proposal was raised does not change its row. The recorded policy wins, because the gate checks the recorded policy at approve time.
- A player viewer still gets `[]`. The panel mounts only for the DM. No policy reaches a player.
- An empty list still shows "No pending proposals".
- Dismiss of an already-decided suggestion refuses `PROPOSAL_NOT_PENDING`. The composer notice shows it, as for any refusal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `PendingProposalView` MUST carry the proposal's effective policy as `policy: "ask" | "suggest"`. *(Card AC #1. Frozen seam amendment, ruling R1 option A.)*
- **FR-002**: `selectPendingProposals` MUST copy `policy` from the projection's `ProposalView.policy`. It MUST NOT derive policy from the proposal kind or the current gate configuration.
- **FR-003**: A row whose `policy` is `suggest` MUST render a Dismiss control and MUST NOT render an Approve control. *(Card AC #2.)*
- **FR-004**: A row whose `policy` is `suggest` MUST show a visible "Suggestion" label, so the DM can tell it applies nothing.
- **FR-005**: Dismiss MUST call the panel's existing reject callback with `reason: null`. It MUST NOT add a request kind, frame, event type or gate path.
- **FR-006**: Dismiss MUST be one click. It opens no reason field, no confirmation step and no modal.
- **FR-007**: A row whose `policy` is `ask` MUST render Approve and Reject, with the inline optional-reason flow, unchanged.
- **FR-008**: The approvals panel's description text MUST name both actions, for example "Approve or reject each proposal. Dismiss a suggestion once you have acted on it."
- **FR-009**: A test MUST render the approvals list over a pending `suggest` proposal and assert that its row has no Approve control. *(Card AC #3.)*
- **FR-010**: A test MUST assert that `selectPendingProposals` returns `policy: "suggest"` for `dm-approvals` P3 and `policy: "ask"` for P4 and P5.
- **FR-011**: The UI MUST use no modal. Dismiss is an inline button inside the existing approvals slide-out.

### Card acceptance criteria mapping

| Card AC | Requirement | Proof |
|---|---|---|
| #1 PendingProposalView carries the effective policy | FR-001, FR-002, FR-010 | `proposals.test.mjs` |
| #2 A suggest proposal offers dismiss and no Approve | FR-003 to FR-008, FR-011 | `proposal-list.test.tsx`, live check |
| #3 A test proves no Approve renders for a suggest proposal | FR-009 | `proposal-list.test.tsx` |

### Key Entities

- **PendingProposalView** (seam, `apps/web/app/play/proposals.ts`): gains `policy`. No other field changes.
- **ProposalView** (session-model projection, 029): unchanged. It already carries `policy`.
- **ProposalCommands** (seam): unchanged. Dismiss is `reject(proposalId, null)`.
- **ProposalList props**: unchanged (ruling R1 option A). `onReject` serves both Reject and Dismiss.

## Frozen-contract changes and their rulings

### R1 — Amend the play-route proposal seam: add `policy` to `PendingProposalView`

**Context**: `specs/030-play-route/contracts/proposal-seam.md` says "`PendingProposalView`, `ProposalCommands`, `CommitAuthority`, and every component's props" must not change; "A needed change to any of them is a spec amendment recorded in `spec.md`, not an implementer decision." Card AC #1 requires the change.

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | Add one field, `policy: "ask" \| "suggest"`, to `PendingProposalView`. Keep `ProposalCommands` and `ProposalList`'s props unchanged; Dismiss calls `onReject(id, null)`. Append one amendment line to `proposal-seam.md`, beside TASK-0049's. | Additive. Every consumer still compiles once its fixtures carry the field. Matches the card's AC wording. Smallest frozen surface touched. |
| B | Option A plus a new `onDismiss(proposalId)` prop on `ProposalList`. | Names the intent in the props. Amends component props as well as the view, for no behavioural gain: `onDismiss` would call `reject(id, null)`. |
| C | Add `approvable: boolean` instead of `policy`. | Hides the policy behind a UI flag. Fails card AC #1 as worded ("carries the effective policy"). |

**Ruling (2026-10-27)**: option A. The operator's words: "TASK-0100 R1 option A (policy on PendingProposalView, one amendment line in the frozen 030 proposal-seam.md, Dismiss via onReject(id, null))".

### Not needed: no gate change

No 029 contract, request kind, event type or gate code changes. Dismiss reuses `proposal.reject` (see "Dismiss reuses the existing reject path"). This needs no ruling. It is recorded here so the ruling covers the whole frozen surface.

## Sibling work: TASK-0049 (PR #70, branch `task-0049-group-signoff`)

PR #70 merged on 2026-10-27; this branch merged `origin/main` at c78f901. TASK-0049 edited `apps/web/app/play/view-model.ts`, `apps/web/app/play/table-view.tsx`, `apps/web/app/play/components/action-card.tsx` and the end of `specs/030-play-route/contracts/proposal-seam.md`. This task edits `table-view.tsx` (the approvals panel description, one line) and appends one line to `proposal-seam.md` after TASK-0049's line. It does not touch `action-card.tsx`. It touches `view-model.ts` only in a test literal (`view-model.test.mjs`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a table with a pending suggestion, the DM sees zero controls that the gate is certain to refuse.
- **SC-002**: The DM clears a suggestion from the panel in one click.
- **SC-003**: Every `ask` proposal keeps both of its controls; no existing approvals test regresses.
- **SC-004**: The change adds zero gate request kinds, event types or server code paths.

## Assumptions

- "Act on" means the DM issues their own command (decision-0015). This card adds no control that turns a suggestion into a command.
- Dismiss records `proposal.rejected` with `reason: null`. The log distinguishes a dismissed suggestion from a rejected `ask` proposal by the policy on its `proposal.created` row; no new marker is needed.
- A decided `ai:dm` proposal re-queues a DM turn through `gate.onAppended` ([[dm-turn-jobs]]). Dismiss inherits this, exactly as reject does today. This card does not change it.
- `dm-approvals` P3 (`scene`, `suggest`, pending) is the test subject. No fixture changes, so `specs/029-proposal-gate/contracts/fixtures.md` is untouched.
- `speckit-clarify` is skipped. The only open point was the frozen-contract ruling R1, an operator decision, now ruled.

## Open questions (not rulings on this card)

- **OQ-1 (deferral candidate, needs a card)**: the play route gives a human DM no scene-change command. `frames.ts` builds no `scene` request. A human DM can read a scene suggestion but cannot issue it from the table. Any kind the DM sets to `suggest` without a matching table command has the same gap. This card does not close it. Carded as TASK-0159 (m-3).
