# Tasks: Table margin and status strip

**Input**: `specs/090-table-margin/` (spec.md, plan.md), `docs/design/mud-ux/decision.md`.
Plan D4, D9 and D10 settle every choice; read them before a phase.

**Prerequisites**: R2 (a) was ruled by the operator on 2026-11-05. TASK-0199 (spec 066) is NOT a
prerequisite. TASK-0199 also edits `apps/web/app/play/table-view.tsx`, so whichever merges second merges
`origin/main` into its branch.

**Dispatch**: each implementer phase is one sonnet implementer dispatch. Phases run in order. Tasks
marked **[orchestrator]** are run by the orchestrator. Each implementer phase ends with `pnpm ci:check`
green and one commit led by `TASK-0236:`. No DB and no paid model run is needed.

**Before Phase 1**: merge `origin/main` into the branch. Run `pnpm install --frozen-lockfile`.

**UI rules for every phase**: no modals (inline, autocomplete dropdowns or the shared `Panel` only).
Daylight tokens only. `narrow:` CSS, no `matchMedia`. No `localStorage` or `sessionStorage`.
Browser checks use Brave.

## Phase 1: Margin, mini-strip, status strip (US1, US2; FR-001 to FR-005; R2)

**Goal**: party, turn order and conditions are visible at 1280 px and 390 px without a panel.

**Independent test**: `margin`, `status-strip` and `table-view` markup tests pass over the
`turn-mode-combat` and `free-mode-action` fixtures.

- [x] T001 [US1] Create `apps/web/app/play/conditions.ts` with `conditionText` (plan D4). Move
      `vitals` from `components/party-panel.tsx` to `apps/web/app/play/party.ts` and import it back.
- [x] T002 [US1] Create `apps/web/app/play/components/margin.tsx` and `mini-strip.tsx` (plan D4),
      reusing `TurnOrder` with label "Turn order".
- [x] T003 [US2] Create `apps/web/app/play/components/status-strip.tsx` (FR-003, US2 copy).
- [x] T004 [US1] In `apps/web/app/play/table-view.tsx`, lay out the stream column and the margin,
      remove the `TurnOrder` strip under the header, and render the mini-strip and the status strip
      above the composer.
- [x] T005 [P] [US1] Create `apps/web/test/play/conditions.test.mjs`, `margin.test.tsx` and
      `status-strip.test.tsx`: US1 scenarios 1–4 and US2 scenarios 1–3 as markup assertions.
- [x] T006 [US1] Update `apps/web/test/play/table-view.test.tsx` and `turn-order.test.tsx` for the
      moved strip; `party-panel.test.tsx` passes unchanged. Commit as
      `TASK-0236 phase 1: margin, mini-strip and status strip`.

## Phase 2: Contrast, no-dialog, contract amendments and wiki (FR-021, FR-022; SC-003, SC-007)

**Goal**: AA holds in both themes; the contracts and the wiki match the code.

**Independent test**: `contrast.test.mjs`, `no-dialog.test.mjs`, `play-surfaces.test.mjs` and the
wiki freshness gate pass.

- [x] T007 Add every new token pair to `apps/web/test/contrast.test.mjs` (plan D9). Fix any failing
      pair in `apps/web/app/app.css`, keeping both dark blocks byte-identical. List the pairs in the
      commit message.
- [x] T008 Confirm `apps/web/test/no-dialog.test.mjs` and `play-surfaces.test.mjs` scan the new files;
      extend their globs if they do not.
- [x] T009 Append the two amendment blocks in plan "Contract amendments" to their contract files.
- [x] T010 Run `/grounding-wiki:wiki-update` for the notes in plan "Files", and add one sentence for
      TASK-0236 (spec 090) to `docs/wiki/CAPSULES.md` and the `docs/wiki/INDEX.md` state paragraph.
- [x] T011 Run the wiki freshness gate (`OK`) and `pnpm ci:check`. Commit as
      `TASK-0236 phase 2: contrast, contract amendments and wiki`.

## Phase 3: Verification **[orchestrator]**

- [ ] T012 **[orchestrator]** Run the plan D10 live check in two Brave windows on a worktree stack
      (`pnpm env:up`). Record each listed state at 1280 and 390 px, light and dark. Confirm no modal in
      any shot.
- [ ] T013 **[orchestrator]** Commit shots and notes under `specs/090-table-margin/evidence/`.
- [ ] T014 **[orchestrator]** Record the dispatch lines on the card, run the spec-bridge check
      (exit 0) and `pnpm ci:check`.

## Dependencies

- Phase 2 after Phase 1. Phase 3 after Phase 2.
- `[P]` tasks inside a phase touch different files and may run in any order within that phase.

## Implementation strategy

- MVP is Phase 1: the margin and the status strip (US1, US2, both P1).
- Spec 091 (`specs/091-mud-stream-and-composer/`) builds the stream, the composer and the scene
  fields on this layout, after TASK-0199 and this spec merge.
