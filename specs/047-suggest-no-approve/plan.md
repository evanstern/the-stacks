# Implementation Plan: Approval panel shows suggest proposals without an Approve control

**Branch**: `task-0100-suggest-no-approve` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/047-suggest-no-approve/spec.md`. Ruling R1 = option A (operator, 2026-10-27).

## Summary

The DM approvals slide-out renders Approve on every pending proposal. On a `suggest` proposal the gate always refuses Approve with `PROPOSAL_NOT_APPROVABLE` (decision-0015). This plan adds `policy: "ask" | "suggest"` to `PendingProposalView`, copied from the projection's `ProposalView.policy`. `ProposalList` then renders a suggest row with a "Suggestion" label and a one-click Dismiss control, and no Approve control. Dismiss calls the existing `onReject(id, null)`. That sends the existing `proposal.reject` request live and drops the row locally in fixture mode. The change is web-only. No server, gate, session-model, event or 029 contract changes. One amendment line goes into the frozen `specs/030-play-route/contracts/proposal-seam.md` (ruling R1).

## Technical Context

**Language/Version**: TypeScript 5.9 (Node 22), React 19 with React Router 8.

**Primary Dependencies**: `@the-stacks/session-model` (projection `ProposalView.policy`, fixtures). No new runtime dependency.

**Storage**: N/A. No migration. No new event type.

**Testing**: vitest markup tests (`apps/web/test/play/*.test.tsx`) and `node:test` module tests (`apps/web/test/play/*.test.mjs`), run by `pnpm --filter @the-stacks/web test`. `pnpm ci:check` is the gate.

**Target Platform**: browser (the play route at `play/:sessionId` and `play/fixtures/:fixtureName`).

**Project Type**: web application in a pnpm monorepo. Only `apps/web` changes.

**Performance Goals**: N/A. One field copy per pending proposal.

**Constraints**: no modals (inline controls inside the existing `Panel` slide-out). Frozen seam: only the R1 amendment. Browser automation uses Brave.

**Scale/Scope**: 3 source files, 4 test files, 1 contract line, 2 wiki notes.

## Constitution Check

*GATE: checked against `.specify/memory/constitution.md` 2.0.0, before research and again after design.*

- [x] **I. Agent-operable** — the agent interface is unchanged and complete: a seated DM agent dismisses a suggestion by sending the `proposal.reject` gate request over the WebSocket `send` frame, the same request the Dismiss button sends. No human-only path is added.
- [x] **II. Content contract** — no codex entity. N/A.
- [x] **III. Data planes** — no new state. `policy` is read from the session plane's existing projection. The web client reaches it through the existing `@the-stacks/session-model` seam.
- [x] **IV. Event sourcing** — no new event. Dismiss appends the existing `proposal.rejected` row through the gate, `dm` visibility, versioned. A player viewer still gets `[]`, so pending proposals stay hidden.
- [x] **V. Citations** — no library claim. N/A.
- [x] **VI. 5e engine boundary** — no mechanics. N/A.
- [x] **VII. Structured first** — no generated artifact. N/A.
- [x] **VIII. Operator-owned content** — no rulebook content. The fixture text used is original (`dm-approvals`). NON-NEGOTIABLE gate passes.
- [x] **IX. Self-hostable** — no new service or container.

**Stack conformance** — inside the Architecture Constraints table (TypeScript, React Router 8, Zod-backed session-model). No departure.

Post-design re-check: unchanged. All gates pass. Complexity Tracking is empty.

## Design decisions

- **D1 — Policy source.** `toView` in `apps/web/app/play/proposals.ts` copies `view.policy` from `ProposalView`. It never reads `DEFAULT_POLICIES` or `gate.policyOverrides` (spec FR-002, edge cases). The gate checks the recorded policy at approve time, so the panel matches the gate.
- **D2 — Field placement.** `policy` is a required field on `PendingProposalView`, placed after `kind`. Every literal in tests gains it. Required, not optional, so a missing value fails typecheck.
- **D3 — Row shape.** `ProposalRow` branches on `proposal.policy`. For `ask` it renders today's Approve, Reject and inline reason flow unchanged. For `suggest` it renders a "Suggestion" badge next to the kind line and one Dismiss button (secondary style, `BUTTON`). Dismiss calls `onReject(proposal.proposalId, null)` directly. No reason input, no confirmation step (FR-006).
- **D4 — Props.** `ProposalList` and `ProposalRow` props are unchanged (ruling R1 option A). `ProposalCommands` is unchanged.
- **D5 — Panel text.** The approvals `Panel` description in `table-view.tsx` becomes "Approve or reject each proposal. Dismiss a suggestion once you have acted on it." (FR-008).
- **D6 — Fixture mode.** `use-fixture-table.ts`'s `reject` already drops a decided id locally. Dismiss inherits it. No change to `use-fixture-table.ts`.
- **D7 — Test subject.** `dm-approvals` P3 (`scene`, `suggest`, pending), P4 and P5 (`ask`). No fixture edit, so 029 `fixtures.md` stays untouched.

## Files touched

| File | Change |
|---|---|
| `apps/web/app/play/proposals.ts` | Add `policy: "ask" \| "suggest"` to `PendingProposalView`; copy it in `toView`. |
| `apps/web/app/play/components/proposal-list.tsx` | Branch the row on `policy`: Suggestion badge and Dismiss for `suggest`; unchanged controls for `ask`. |
| `apps/web/app/play/table-view.tsx` | Approvals panel description text (one line). |
| `apps/web/test/play/proposals.test.mjs` | Assert `policy` per proposal: P3 `suggest`, P4 and P5 `ask`. |
| `apps/web/test/play/proposal-list.test.tsx` | Assert the suggest row has Dismiss and no Approve; ask rows keep Approve and Reject (static markup; the Dismiss click is proven in the Brave live check). |
| `apps/web/test/play/view-model.test.mjs` | Add `policy: "ask"` to the `PendingProposalView` literal. |
| `apps/web/test/play/table-view.test.tsx` | Assert the DM's `dm-approvals` render carries exactly two Approve controls and one Dismiss, and the new description text. |
| `specs/030-play-route/contracts/proposal-seam.md` | Append one amendment line (TASK-0100, ruling R1 option A) after TASK-0049's line. |
| `specs/047-suggest-no-approve/evidence/live-check.md` | Brave live-check record and screenshots under `evidence/shots/`. |
| `docs/wiki/play-route.md`, `docs/wiki/proposal-gate.md`, `docs/wiki/INDEX.md`, `docs/wiki/CAPSULES.md` | Re-ground (final phase). |

**Migrations**: none. **New runtime dependencies**: none.

## Sibling overlap (TASK-0049, PR #70, merged)

PR #70 merged into `main` on 2026-10-27. This branch merged `origin/main` at c78f901, so no further merge is expected before implementation. Files both tasks touch:

- `apps/web/app/play/table-view.tsx` — TASK-0049 threads `source.presence` into the view model; this task changes only the approvals `Panel` description line.
- `specs/030-play-route/contracts/proposal-seam.md` — TASK-0049 appended its amendment line; this task appends its own line after it.
- `docs/wiki/play-route.md`, `docs/wiki/proposal-gate.md` — TASK-0049 re-pinned both; this task re-reviews them.
- `apps/web/app/play/view-model.ts` is not edited; only `view-model.test.mjs` gains the field in a literal. `action-card.tsx` is not touched.

Before each phase the implementer merges `origin/main` if `main` moved (never rebase), and keeps both amendment lines.

## Project Structure

### Documentation (this feature)

```text
specs/047-suggest-no-approve/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── pending-proposal-policy.md
├── checklists/requirements.md
├── evidence/            # live check (Phase 2)
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/app/play/
├── proposals.ts
├── table-view.tsx
└── components/proposal-list.tsx
apps/web/test/play/
├── proposals.test.mjs
├── proposal-list.test.tsx
├── table-view.test.tsx
└── view-model.test.mjs
specs/030-play-route/contracts/proposal-seam.md
```

**Structure Decision**: web-only change inside `apps/web/app/play/`, the play route's existing module layout ([[play-route]]).

## Complexity Tracking

None. No Constitution Check violation.
