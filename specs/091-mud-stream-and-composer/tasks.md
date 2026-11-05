# Tasks: MUD stream and composer

**Input**: `specs/091-mud-stream-and-composer/` (spec.md, plan.md), `docs/design/mud-ux/decision.md`.
Plan research R1 to R5, R7, R8 and design D1 to D3, D5 to D10 settle every choice; read them before a phase.

**Prerequisites**: TASK-0199 (spec 066) is merged. Spec 090 (TASK-0236) is merged. R1 (a) and R2 (a)
were ruled by the operator on 2026-11-05. Phase 1 needs R1 (a). Under a (b) ruling, use the fallback the
plan names in D2. The `nodes/resolve.ts` lanes must be clear before Phase 1.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order. Tasks marked
**[orchestrator]** are run by the orchestrator. Each implementer phase ends with `pnpm ci:check`
green and one commit led by `TASK-0236:`. No DB and no paid model run is needed.

**Before Phase 1**: merge `origin/main` into the branch. Re-read `composer.tsx`, `transcript.tsx`,
`view-model.ts` and `table-view.tsx` as 066 and spec 090 merged them. Run `pnpm install --frozen-lockfile`.

**UI rules for every phase**: no modals (inline, autocomplete dropdowns or the shared `Panel` only).
Daylight tokens only. `narrow:` CSS, no `matchMedia`. No `localStorage` or `sessionStorage`.
Browser checks use Brave.

## Phase 1: Scene fields and seed ways (US5, US6; FR-008, FR-017; R1)

**Goal**: a scene start logs a player-facing description, ways on and cast.

**Independent test**: `seed.test.ts`, `duo-views.test.ts` and the session-model schema tests pass
with the new cases.

- [ ] T001 [US5] In `packages/session-model/src/events/scene.ts`, add `WaySchema`, `CastEntrySchema`
      and the three optional `SceneSchema` fields (plan D1). Export them and their types from
      `packages/session-model/src/index.ts`.
- [ ] T002 [P] [US5] Extend the session-model scene parse test in `packages/session-model/test/`:
      an old `scene.changed` row parses; a row with all three fields parses; seven ways fail.
- [ ] T003 [US5] In `apps/server/src/dm/seed/schema.ts`, add `location.ways` with default `[]`. In
      `apps/server/src/dm/seed/views.ts`, add `ways` to `PlayerSeedView.location` and add
      `openingScene(view)` (plan D2).
- [ ] T004 [US5] In `apps/server/src/dm/nodes/resolve.ts` `directorOpening`, set the scene-start
      `after` to `openingScene(playerFacingSeed(seed))`. Change no other line in the file.
- [ ] T005 [P] [US5] Add the three ways (plan D2) to each `apps/server/seeds/greyhollow-ford*.json`.
- [ ] T006 [P] [US5] Extend `apps/server/test/dm/seed.test.ts` and `apps/server/test/dm/duo-views.test.ts`
      per plan D8, including the `dmOnlySeedText` exclusion. Commit as
      `TASK-0247 phase 1: scene description, ways on and cast`.


## Phase 2: Stream items, roll rows, rules lines, room blocks, chips (US3, US6; FR-006 to FR-011)


**Goal**: one filtered stream carries rolls and every margin fact as text.

**Independent test**: `stream.test.mjs` passes, including the parity test (SC-002) and the
`dm`-visibility test (SC-006).

- [ ] T007 [US3] In `apps/web/app/play/ledger-format.ts`, export the dice and outcome wording helpers
      `stream.ts` needs. `toLedgerItems` output is unchanged.
- [ ] T008 [US3] Create `apps/web/app/play/stream.ts` with `streamItems` (plan D3): categories,
      `pinned`, roll grouping by `batchId`, rules lines, room items. Add the `ponytail:` comment.
- [ ] T009 [US3] Create `apps/web/app/play/components/room-block.tsx`, `roll-row.tsx` and
      `filter-chips.tsx` (plan D5). Ways on render as text in this phase; Phase 4 wires `draft`.
- [ ] T010 [US3] Update `apps/web/app/play/components/transcript.tsx` to render `StreamItem[]` in a
      `role="log"` list named "Table stream". In `table-view.tsx`, hold the chip and filter items.
- [ ] T011 [P] [US6] Create `apps/web/test/play/stream.test.mjs`: US3 scenarios 1–5 and US6
      scenarios 1–5; for each margin and status-strip fact in `turn-mode-combat`, a matching stream
      text; a `dm`-visibility ledger row yields no item for a player viewer.
- [ ] T012 [P] [US3] Create `apps/web/test/play/roll-row.test.tsx`, `room-block.test.tsx` and
      `filter-chips.test.tsx`. Commit as `TASK-0247 phase 2: one stream with rolls and parity lines`.


## Phase 3: Composer, glossary, nouns and the draft path (US4, US5; FR-012 to FR-020)


**Goal**: history, commands, Tab completion and nouns work; a way click drafts and never sends.

**Independent test**: `history`, `glossary`, `noun-text` and `composer` tests pass; a draft click
appends no event (SC-004).

- [ ] T013 [US4] Create `apps/web/app/play/history.ts` and `apps/web/app/play/commands.ts` (plan D6).
- [ ] T014 [US5] Create `apps/web/app/play/glossary.ts` with `glossaryOf`, `matchNouns` and
      `completions` (plan D7).
- [ ] T015 [US4] Extend `apps/web/app/play/components/composer.tsx` (plan D6): one listbox state,
      Up/Down history, `/` commands, Tab completion, the inline `/help` block, and the `draft`
      handle. Keep every 066 behaviour.
- [ ] T016 [US5] Create `apps/web/app/play/components/noun-text.tsx`. Use it for narration and talk
      text in `transcript.tsx`.
- [ ] T017 [US5] In `apps/web/app/play/table-view.tsx`, create `draft` from the composer handle (FR-019)
      and pass it to `room-block.tsx`, which renders ways on as buttons for a viewer with a character.
- [ ] T018 [P] [US4] Create `apps/web/test/play/history.test.mjs` and extend
      `apps/web/test/play/composer.test.tsx`: US4 scenarios 1–6, and 066's composer tests unchanged.
- [ ] T019 [P] [US5] Create `apps/web/test/play/glossary.test.mjs` and `noun-text.test.tsx`: US5
      scenarios 1–2, the case rule, longest-first, the NPC mention gate, no monster HP or AC.
- [ ] T020 [US5] Extend `apps/web/test/play/table-view.test.tsx`: US5 scenarios 3–5; a way click puts
      the draft in the composer, focuses it, and the fixture source receives no command call. Commit
      as `TASK-0247 phase 3: input history, completion, nouns and click-to-draft`.


## Phase 4: Contrast, contracts and wiki (FR-021, FR-022; SC-003, SC-007)

**Goal**: AA holds in both themes; the contracts and the wiki match the code.

**Independent test**: `contrast.test.mjs`, `no-dialog.test.mjs`, `play-surfaces.test.mjs` and the
wiki freshness gate pass.

- [ ] T021 Add every new token pair to `apps/web/test/contrast.test.mjs` (plan D9). Fix any failing
      pair in `apps/web/app/app.css`, keeping both dark blocks byte-identical. List the pairs in the
      commit message.
- [ ] T022 Confirm `apps/web/test/no-dialog.test.mjs` and `play-surfaces.test.mjs` scan the new files;
      extend their globs if they do not.
- [ ] T023 Append the five amendment blocks in plan "Contract amendments" to their contract files.
- [ ] T024 Run `/grounding-wiki:wiki-update` for the notes in plan "Files", and add one sentence for
      TASK-0247 (spec 091) to `docs/wiki/CAPSULES.md` and the `docs/wiki/INDEX.md` state paragraph.
- [ ] T025 Run the wiki freshness gate (`OK`) and `pnpm ci:check`. Commit as
      `TASK-0247 phase 4: contrast, contract amendments and wiki`.

## Phase 5: Verification **[orchestrator]**

- [ ] T026 **[orchestrator]** Run the plan D10 live check in two Brave windows on a worktree stack
      (`pnpm env:up`). Record each listed state at 1280 and 390 px, light and dark. Confirm no modal in
      any shot and no event appended by a draft click (debug page event list).
- [ ] T027 **[orchestrator]** Read the Brave accessibility tree once: one "Table stream" log region,
      parity lines present, margin not live. Commit shots and notes under
      `specs/091-mud-stream-and-composer/evidence/`.
- [ ] T028 **[orchestrator]** Record the dispatch lines on the card, run the spec-bridge check
      (exit 0) and `pnpm ci:check`.

## Dependencies

- Phase 1 before Phase 2 (room blocks read the new fields) and Phase 3 (the glossary reads `cast`).
  Under R1 (b), Phase 1 is skipped and Phases 2 and 3 use the D2 fallback.
- Phase 2 before Phase 3: Phase 3 edits `transcript.tsx` and `room-block.tsx` from Phase 2.
- Phase 4 after Phase 3. Phase 5 after Phase 4.
- `[P]` tasks inside a phase touch different files and may run in any order within that phase.

## Implementation strategy

- MVP is Phases 1–2: the parity stream (US3, US6, both P1).
- Phase 3 adds the input baseline and the draft path the map spec reuses.
- The map is a later spec on this layout (TASK-0070, TASK-0071); it calls `draft` from Phase 3.
