# Tasks: MUD stream (spec 091 part 1, TASK-0247)

**Input**: `specs/091-mud-stream-and-composer/` (spec.md, plan.md). Read plan.md "Design
(amendment)" DA1 to DA4 and the 2026-11-05 design D1 to D3, D5, D8 and D9 before a phase.

**Scope**: TASK-0247 only, ruled at C-AMD by the operator on 2026-11-13: "Approve all". TASK-0329
(Intent pills, part 2) builds plan.md "Part 2 (TASK-0329)" from its own task list. Do not build the
pill, `draft(seed)`, the verb dropdown, Tab, history, the glossary, noun expansions, way buttons or
keep-until-echo here. Do not edit `components/composer.tsx`.

**C-GATE ruling (quote in every brief)**: R1 (a), ruled 2026-11-05 and re-confirmed at C-AMD
2026-11-13 ("Approve all", OQ-A8), for the `SceneSchema` optional fields `description`, `ways` and
`cast`. No other frozen contract changes.

**Card AC map**: #1 roll rows (Phases 2, 3). #2 progress indicator (Phase 3, T019). #3 dialogue
rows and the 1024 px column (Phases 2, 3). #4 amendment and C-AMD (met). #5 fact rows from the
ledger at resolve time (Phases 2, 3).

**Prerequisites**: merge `origin/main` into the branch before Phase 1. Re-read `transcript.tsx`,
`view-model.ts`, `table-view.tsx` and `ledger-format.ts` as merged. Run
`pnpm install --frozen-lockfile`. The `nodes/resolve.ts` lanes must be clear before Phase 1.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order. Each phase ends
with `pnpm ci:check` green and one commit led by `TASK-0247`. No DB and no paid model run is
needed. Tasks marked **[orchestrator]** are not dispatched.

**UI rules (Phases 3 and 4)**: no modals; use slide-out panels or autocomplete dropdowns only.
`apps/web/test/no-dialog.test.mjs` stays green. Every surface works at 1280 px and 390 px with no
sideways scroll (`narrow:` CSS, no `matchMedia`). Test roles, accessible names and keyboard paths.
Use Daylight tokens only. Use no `localStorage` or `sessionStorage`. The orchestrator runs the live
Brave check; the implementer does not.

## Phase 1: Scene fields and seed ways (R1; FR-008 data; plan D1, D2, DA4, D8)

**Goal**: a scene start logs a player-facing description, ways on and cast.

**Independent test**: the session-model scene test, `seed.test.ts` and `duo-views.test.ts` pass with
the new cases.

- [x] T001 [US5] In `packages/session-model/src/events/scene.ts`, add `WaySchema`,
      `CastEntrySchema` and the three optional `SceneSchema` fields (plan D1). Export the schemas
      and types from `packages/session-model/src/index.ts`. Keep payload version 1.
- [x] T002 [P] [US5] Extend the scene parse test in `packages/session-model/test/`: an old
      `scene.changed` row parses; a row with all three fields parses; seven ways fail.
- [x] T003 [US5] In `apps/server/src/dm/seed/schema.ts`, add `location.ways` with default `[]`. Add
      the `superRefine` that parses each way `draft` and refuses a hidden-zone `/move` (plan DA4).
- [x] T004 [US5] In `apps/server/src/dm/seed/views.ts`, add `ways` to `PlayerSeedView.location` and
      add the pure `openingScene(view)` (plan D2).
- [x] T005 [US5] In `apps/server/src/dm/nodes/resolve.ts` `directorOpening`, set the scene-start
      `after` to `openingScene(playerFacingSeed(seed))`. Change no other line in the file.
- [x] T006 [P] [US5] Add the three duo ways as text forms (plan DA4) to each
      `apps/server/seeds/greyhollow-ford*.json`.
- [x] T007 [P] [US5] Extend `apps/server/test/dm/seed.test.ts` and `duo-views.test.ts` per plan D8.
      Add a refused-seed case for an unparsable way and for a hidden-zone `/move`. Keep the
      `dmOnlySeedText` exclusion. Commit as `TASK-0247 phase 1: scene description, ways on and cast`.

## Phase 2: Stream items and the narration filter (US3, US6; FR-006, FR-007, FR-026, FR-027, FR-029 data; plan D3, DA1, DA2)

**Goal**: pure modules turn the projection into stream items, with roll rows from the ledger and
narration split into prose, dialogue and kept rules lines.

**Independent test**: `stream.test.mjs` and `narration-rows.test.mjs` pass.

- [x] T008 [US3] In `apps/web/app/play/ledger-format.ts`, export the face and outcome wording helpers
      `stream.ts` needs. Keep `toLedgerItems` output unchanged.
- [x] T009 [US3] Create `apps/web/app/play/stream.ts` with `streamItems` (plan D3): categories,
      `pinned`, rules lines and room items.
- [x] T010 [US3] In `stream.ts`, build roll items from ledger `roll` and `outcome` rows grouped by
      `batchId`, at the roll's seq (plan DA1). Name the check and the mode in words. Carry both d20
      faces with the kept mask. Add the `ponytail:` comment naming OQ-A5 and TASK-0331.
- [x] T011 [US3] Create `apps/web/app/play/narration-rows.ts` with `narrationRows(text)` (plan DA2).
      Drop dice and change lines; keep `why`, refusal and `State:` lines. Tag quoted sentences as
      `dialogue`. Add the `ponytail:` comment on the copied auditor regexes.
- [x] T012 [P] [US3] Create `apps/web/test/play/stream.test.mjs`: US3 scenarios 1, 2 and 5; US6
      scenarios 1 to 5; mode words and both faces with the dropped face marked; a roll row's seq
      precedes its batch's narration seq; a batch with no outcome shows the total only.
- [x] T013 [P] [US6] In `stream.test.mjs`, add the parity test (SC-002): each margin and status-strip
      fact in the `turn-mode-combat` fixture has a matching stream text. Add the SC-006 test: a
      `dm`-visibility ledger row yields no item for a player viewer.
- [x] T014 [P] [US3] Create `apps/web/test/play/narration-rows.test.mjs`: a block of dice and change
      lines is dropped; `why`, refusal and `State:` lines are kept; straight and curly quotes make
      dialogue segments; text with no block renders whole. Commit as
      `TASK-0247 phase 2: stream items and the narration filter`.

## Phase 3: Stream rendering (US3, US6; FR-008 to FR-011, FR-026 to FR-030; plan DA3, D5)

**Goal**: one filtered `role="log"` stream renders roll rows, rules lines, room blocks, dialogue
rows and the streaming block, in a 1024 px column.

**Independent test**: the new component tests, `transcript-stream.test.tsx` and
`table-view.test.tsx` pass. UI rules above apply.

- [x] T015 [US3] Create `apps/web/app/play/components/roll-row.tsx` as `<details><summary>`. Strike
      the dropped face and give it the accessible name "<n>, dropped". Pair ✓/✗ with a word.
- [x] T016 [US3] Create `apps/web/app/play/components/room-block.tsx`: heading, description,
      "Ways on: …" as plain text, and the party with HP and AC. Show no "Ways on" line when `ways` is
      empty.
- [x] T017 [US3] Create `apps/web/app/play/components/filter-chips.tsx`: four buttons in a
      `role="group"` named "Filter the stream", single-select by `aria-pressed`.
- [x] T018 [US3] Update `apps/web/app/play/components/transcript.tsx` and `view-model.ts` to render
      `StreamItem[]`. Give the `<ol>` `role="log"`, `aria-live="polite"` and the name "Table
      stream" (FR-011). Render narration as `narrationRows` segments: prose italic muted, dialogue
      upright `text-foreground`, kept rules lines after the prose. Render `npc_say` talk as a named
      dialogue row.
- [x] T019 [US3] In `transcript.tsx`, filter the streaming block's `rows` part with `narrationRows`.
      Keep `aria-busy` on the block and drop its own `aria-live` (OQ-A14). Update the spec 108 line
      in `apps/web/test/play/transcript-stream.test.tsx`.
- [x] T020 [US3] In `apps/web/app/play/table-view.tsx`, hold the chip in `useState` and filter items
      by category or `pinned` (FR-009, FR-010). Give the stream column and the composer wrapper
      `mx-auto w-full max-w-5xl` (FR-030). Keep the column full width at 390 px.
- [x] T021 [P] [US3] Create `apps/web/test/play/roll-row.test.tsx`, `room-block.test.tsx` and
      `filter-chips.test.tsx`: markup, accessible names, `aria-pressed`, keyboard activation of a
      roll row, and US3 scenarios 3 and 4.
- [x] T022 [P] [US6] Extend `apps/web/test/play/transcript-stream.test.tsx`: the TASK-0325 test, one
      element with `role="log"` and accessible name "Table stream" (FR-011); the order test
      (FR-028): the batch's roll and rules rows, then the streaming block, then the settled
      narration; dice lines appear once; a dialogue row renders upright.
- [x] T023 [P] [US3] Extend `apps/web/test/play/table-view.test.tsx`: the column carries the
      `max-w-5xl` cap; the chip group filters and never removes a pinned confirm. Confirm
      `no-dialog.test.mjs` and `play-surfaces.test.mjs` scan the new files; extend their globs if
      they do not. Commit as `TASK-0247 phase 3: one stream with rolls, rules lines and dialogue`.

## Phase 4: Contrast and contract blocks (FR-021, FR-022; SC-003, SC-007; plan D9, "Contract amendments")

**Goal**: AA holds in both themes for TASK-0247 surfaces; the contracts match the code.

**Independent test**: `contrast.test.mjs`, `no-dialog.test.mjs` and `play-surfaces.test.mjs` pass.
UI rules above apply.

- [x] T024 Add every new token pair used by roll rows, rules lines, room blocks, chips and dialogue
      rows to `apps/web/test/contrast.test.mjs` (plan D9). Fix any failing pair in
      `apps/web/app/app.css`, keeping both dark blocks byte-identical. List the pairs in the commit.
- [x] T025 Append the four R1 amendment blocks (plan "Contract amendments") to
      `specs/028-session-model/contracts/session-events.md`,
      `specs/029-proposal-gate/contracts/proposals.md`, `specs/031-dm-runtime/contracts/scene-seed.md`
      and `specs/031-dm-runtime/contracts/director.md`. Quote the C-GATE ruling in each.
- [x] T026 Append the R2 block to `specs/030-play-route/contracts/ui-surfaces.md` for TASK-0247
      surfaces only: filter chips, room blocks, roll rows, parity lines, dialogue rows; names "Table
      stream" and "Filter the stream". Leave the pill, verb dropdown and noun expansions to
      TASK-0329. Commit as `TASK-0247 phase 4: contrast and contract amendments`.

## Phase 5: Wiki re-ground

**Goal**: the wiki matches the merged code with honest pins.

**Independent test**: the wiki freshness gate prints `OK`.

- [x] T027 Run `/grounding-wiki:wiki-update`. Re-verify each NEEDS-REVIEW note against the diff
      before re-pinning: `docs/wiki/play-route.md`, `chat-ui.md`, `session-model.md`,
      `dm-runtime.md` and `seed-npc-presence.md`. Re-pin only what you re-verified.
- [x] T028 Add one sentence for TASK-0247 (spec 091 part 1) to `docs/wiki/CAPSULES.md` and to the
      `docs/wiki/INDEX.md` state paragraph. Run the freshness gate (`OK`). Commit as
      `TASK-0247 phase 5: wiki re-ground`.

## Phase 6: Verify

**Goal**: every non-browser gate is green; the orchestrator owns the browser check.

- [ ] T029 Run `pnpm ci:check`, the wiki freshness gate and the spec-bridge check (exit 0). Report
      each exit code. Commit nothing unless a gate needs a fix.
- [ ] T030 **[orchestrator]** Run the live Brave check (plan D10, TASK-0247 states only): a room
      block with ways as text, a roll row expanded with both faces, dialogue rows, each chip, the
      streaming block, at 1280 px and 390 px, light and dark. Read the accessibility tree once for
      the "Table stream" log. Commit shots under `specs/091-mud-stream-and-composer/evidence/`.
      Record the dispatch lines on the card.

## Dependencies

- Phase 1 before Phase 2: room items read the new scene fields.
- Phase 2 before Phase 3: Phase 3 renders Phase 2 items and segments.
- Phase 4 after Phase 3. Phase 5 after Phase 4. Phase 6 last.
- `[P]` tasks inside a phase touch different files and may run in any order within that phase.
- TASK-0329 starts after TASK-0247 merges. TASK-0276 draft-holds until TASK-0247 merges.

## Implementation strategy

- MVP is Phases 1 to 3: the parity stream with roll rows from the ledger (US3, US6, both P1).
- Ways render as text here. TASK-0329 turns them into `draft(seed)` buttons.
