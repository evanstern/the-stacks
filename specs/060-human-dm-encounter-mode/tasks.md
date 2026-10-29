# Tasks: Human DM ends an encounter or changes table mode from the table

**Input**: `specs/060-human-dm-encounter-mode/` (spec.md, plan.md, contracts/table-mode-control.md,
quickstart.md)

**Board task**: TASK-0165. Card AC #1: an end-encounter control built from a gate request, no modal,
with a test. Card AC #2: a table-mode control built from a gate request, no modal, with a test.

**Prerequisites**: the operator rules OQ-1 to OQ-6 (spec.md). The tasks below implement (a) for
each. A different ruling amends the contract and these tasks before Phase 1 dispatches.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator. Work only in
`/Users/evanstern/projects/the-stacks/.worktrees/task-0165`. A fresh worktree runs
`pnpm install --frozen-lockfile` first. Each implementer phase ends with `pnpm ci:check` green (DB
suites skip without a database) and one commit led by `TASK-0165:`. No modal: slide-out panels or
autocomplete dropdowns only. Browser automation uses Brave. Do not change the `ws-protocol` frames,
`specs/029-proposal-gate/contracts/` or `specs/030-play-route/contracts/proposal-seam.md`. No
server source change. Tests are written first and seen to fail.

## Phase 1: Frames, commands and fixture rows (card AC #1, #2; OQ-2)

**Goal**: the play route can build and send both gate requests, live and fixture.

**Independent test**: `pnpm --filter @the-stacks/web exec vitest run test/play/frames.test.mjs test/play/local-log.test.mjs test/play/use-fixture-table.test.mjs`
(or `node --test` for the `.mjs` files, as each file's existing cases run).

- [x] T001 In `apps/web/test/play/frames.test.mjs`, add `encounterEndFrame` cases: a valid reason
      gives `eventType: "mechanics"`, `payloadVersion: GATE_REQUEST_VERSION` and the payload in
      `contracts/table-mode-control.md` (`command.type: "encounter.end"`, `actionId: null`,
      `visibility: "public"`, `summary: "End the encounter"`, `rationale: null`); a blank reason
      uses `tableModeReason("end")`; a 501-character reason gives null. Add `tableModeFrame` cases:
      `{ mode: "free" }` gives `summary: "Table mode: free"`; a turn `after` with `activeActor` and
      `activeCharacterId` passes; `{ mode: "turn" }` without `activeActor` gives null; an unknown
      mode gives null. See them fail.
- [x] T002 In `apps/web/app/play/frames.ts`, add `tableModeReason(action: "end" | "free" |
      "turn")` (the three defaults in the contract), `encounterEndFrame` and `tableModeFrame`.
      Parse with `ReasonSchema` and `TableModeSchema`. T001 passes.
- [x] T003 In `apps/web/app/play/source.ts`, add `EncounterEndInput`, `TableModeInput` and
      `TableCommands.endEncounter`, `setTableMode` per the contract.
- [x] T004 In `apps/web/test/play/local-log.test.mjs`, add cases on the `turn-mode-combat` DM
      projection at a step with an active encounter: `localEncounterEndEvents` gives one
      `encounter.ended` row whose `event.before` equals `p.engine.encounter` and `after` is null;
      with no encounter it gives null. `localTableModeEvents` gives one `table-mode.changed` row
      with `before` from `p.tableMode`. After appending both rows, `project` gives `encounter: null`
      and `tableMode.mode: "free"`. See them fail.
- [x] T005 In `apps/web/app/play/local-log.ts`, add `localEncounterEndEvents` and
      `localTableModeEvents`. T004 passes.
- [x] T006 In `apps/web/app/play/use-live-table.ts`, add `endEncounter` (send
      `encounterEndFrame`; only when it returned true and `thenFree` is set, send
      `tableModeFrame({ reason, after: { mode: "free" } })`; return the first result) and
      `setTableMode` (send one `tableModeFrame`).
- [x] T007 In `apps/web/test/play/use-fixture-table.test.mjs`, add cases for two pure helpers
      beside `planScene`: `planEncounterEnd(events, dmViewer, input)` with `thenFree: true` returns
      the encounter-end row and then the free row; with `thenFree: false` only the first; with no
      encounter, null. `planTableMode(events, dmViewer, input)` returns one row, or null when the
      frame builder refuses the input. See them fail.
- [x] T008 In `apps/web/app/play/use-fixture-table.ts`, add and export both helpers (validate with
      the frame builders first, then build rows from `project(events, dmViewer)` with the Phase 1
      `local-log.ts` builders), and the `endEncounter` and `setTableMode` commands that append their
      rows, as `changeScene` does with `planScene`. T007 passes.
- [x] T009 Add stub `endEncounter` and `setTableMode` to every test source that builds a
      `TableCommands` literal, so typecheck passes. Run `pnpm ci:check`.

## Phase 2: The view, the panel and the header (card AC #1, #2; OQ-1, OQ-3, OQ-4, OQ-5)

**Goal**: a seated human DM opens "Table mode" and uses the allowed buttons; a player sees nothing.

**Independent test**: `pnpm --filter @the-stacks/web exec vitest run test/play/table-mode.test.mjs test/play/table-mode-panel.test.tsx test/play/table-view.test.tsx test/play/equivalence.test.tsx`
and `node --test apps/web/test/no-dialog.test.mjs`.

- [x] T010 Create `apps/web/test/play/table-mode.test.mjs`. On `turn-mode-combat` DM projections:
      turn mode with an encounter → `canEnd`, `canFree`, `turnAfter: null`; after a local free row →
      `canEnd`, not `canFree`, `turnAfter` equals `{ mode: "turn", ...activeActorFor(p,
      p.encounter.activeCombatantId) }`; after the fixture's encounter end (last step) with free
      mode → nothing offered. See it fail (no module).
- [x] T011 Create `apps/web/app/play/table-mode.ts` with `TableModeView` and `tableModeView` per
      the contract. T010 passes.
- [x] T012 In `apps/web/test/play/view-model.test.mjs`, assert `tableMode` is set for a DM viewer
      and null for a player viewer. In `apps/web/app/play/view-model.ts`, add
      `TableViewModel.tableMode`.
- [x] T013 Create `apps/web/test/play/table-mode-panel.test.tsx` (`renderToStaticMarkup`). Cases:
      turn mode with an encounter shows "Turn mode", "Encounter active.", buttons "End encounter"
      and "Switch to free mode", the text "The encounter stays active.", and no "Switch to turn
      mode"; free mode with an encounter shows "Switch to turn mode" and "End encounter"; free with
      no encounter shows "No encounter." and "Turn mode needs an encounter. The AI DM starts one."
      and no action button; the markup has no `role="dialog"`. Export pure click helpers
      (`endInput(view, reason)`, `modeInput(view, target, reason)`) and assert they build
      `thenFree: true` in turn mode, `after: { mode: "free" }`, and `after` equal to
      `view.turnAfter`. See it fail.
- [x] T014 Create `apps/web/app/play/components/table-mode-panel.tsx`: `TABLE_MODE_PANEL_ID =
      "table-mode-panel"`, `TableModePanel({ view, onEndEncounter, onSetMode })`, the helpers from
      T013, one "Reason (optional)" field, the accessible names in the contract. A command that
      returns false keeps the draft. T013 passes.
- [x] T015 In `apps/web/test/play/table-view.test.tsx`, add: the `turn-mode-combat` DM viewer at
      an active-encounter step renders a "Table mode" button with `aria-controls="table-mode-panel"`;
      a player viewer renders none. See it fail.
- [x] T016 In `apps/web/app/play/components/table-header.tsx`, add `modeOpen` and `onMode?` and
      the "Table mode" trigger (shown when `model.isDm && onMode`), beside "Change scene". In
      `apps/web/app/play/table-view.tsx`, hold `modeOpen` state, pass `onMode` when
      `model.tableMode` is set, and mount `TableModePanel` in `Panel` (title "Table mode",
      description "End the encounter, or switch between free and turn mode.", id
      `TABLE_MODE_PANEL_ID`). Close the panel when a command returns true. T015 passes.
- [x] T017 Confirm `apps/web/test/play/equivalence.test.tsx` and `apps/web/test/no-dialog.test.mjs`
      pass unchanged. If equivalence fails, fix the source, not the test (plan.md "Risks").
- [x] T018 Amend `specs/030-play-route/contracts/ui-surfaces.md` (`TableHeader` props, the
      `TableModePanel` row, accessible names), `live-frames.md` (`endEncounter`, `setTableMode`
      rows) and `table-source.md` (the two commands). Each is a dated "Amendment, TASK-0165
      (additive, 2026-10-28)" block citing `specs/060-human-dm-encounter-mode/contracts/table-mode-control.md`
      and the operator's ruling words from the card. Do not rewrite earlier text.
- [x] T019 Run `pnpm ci:check`.
- [x] T019a Blank-reason default for the mode switches (found by the T028 live check): `modeInput` now sends `tableModeReason(target)` when the reason field is blank, so free and turn switches no longer fail ReasonSchema.

## Phase 3: The DB test (FR-016; OQ-6)

**Goal**: the real gate applies both requests directly and the enqueuer queues what R5 says.

**Independent test**: the file below, with `REQUIRE_DATABASE=1` **[orchestrator if no DB]**.

- [x] T020 Create `apps/server/test/dm/human-dm-encounter.integration.test.ts` on `world.ts` and
      `worker-world.ts` (as `human-dm-scene.integration.test.ts` does; `loudSkip`,
      `clearDmJobsBeforeEach`). Setup: `createWorld` with an empty script, `startScene(w)` under the
      AI seat, then `w.as(operator, { kind: "dm.seat", …, after: { kind: "human", userId: HUMAN_DM } })`.
      The human DM (`{ kind: "human", userId: HUMAN_DM, role: "operator" }`) sends `mechanics`
      `initiative.roll` for the party's combatants and `table-mode` turn naming the encounter's
      active actor (`activeActorFor`).
- [x] T021 Case (a): the human DM sends `mechanics` `{ type: "encounter.end", reason }` and then
      `table-mode` `{ mode: "free" }`. Both return `applied`. The rows are `encounter.ended`
      (actor `HUMAN_DM`, `public`) and `table-mode.changed` (`after.mode: "free"`). Projections give
      `encounter: null`, `tableMode.mode: "free"`. No turn job was queued by those rows.
- [x] T022 Case (b): from turn mode, the human DM sends `table-mode` `{ mode: "free" }`, then
      `{ mode: "turn", ...activeActorFor(p, p.encounter.activeCombatantId) }`. The encounter stays.
      When that actor is a companion, one companion `turn` job is queued (rule 4); when it is a
      human, none. Pick the case from the rolled order, or set dice so a companion is active.
- [x] T023 Case (c): a player (`player` proposer) sending either request is refused
      `NOT_AUTHORIZED`; a second encounter end is refused `NO_ACTIVE_ENCOUNTER` (source `engine`).
- [x] T024 Run `pnpm --filter @the-stacks/server exec vitest run test/dm/human-dm-encounter.integration.test.ts`
      without a database and confirm it skips loudly. Run `pnpm ci:check`.

## Phase 4: DB suites, mutation guard and live check **[orchestrator]**

- [x] T025 **[orchestrator]** On the worktree stack (`pnpm env:up`, migrate both databases, restart
      the app), with `REQUIRE_DATABASE=1` and only `TEST_DATABASE_URL` exported from the worktree
      `.env`, run `human-dm-encounter.integration`, `human-dm-scene.integration`,
      `human-dm-roll-resume`, `floor-jobs`, `enqueue-floor` and `scene` integration suites, then
      `REQUIRE_DATABASE=1 pnpm ci:check`. Record counts in `evidence/db-run.md`.
- [x] T026 **[orchestrator]** Mutation guard: (1) make `endEncounter` in `use-live-table.ts` and
      `use-fixture-table.ts` skip the free-mode follow-up; run `use-fixture-table.test.mjs` and
      confirm the `thenFree` case fails. (2) Make `tableModeView` return `turnAfter` with no
      encounter; confirm `table-mode.test.mjs` and `table-mode-panel.test.tsx` fail. (3) Make the
      header show "Table mode" for any viewer; confirm `table-view.test.tsx` fails. Restore; `git
      diff` is empty. Record in `evidence/mutation-guard.md`.
- [x] T027 **[orchestrator]** Write `specs/060-human-dm-encounter-mode/evidence/start-encounter.mjs`
      (quickstart step 6), modelled on `specs/055-human-dm-scene-change/evidence/start-human-dm.mjs`.
      Node built-ins only. It never prints a secret.
- [x] T028 **[orchestrator]** Live check in Brave, script mode, per `quickstart.md` steps 1 to 13
      (`DM_FAKE_SCRIPT=greyhollow-human-dm`: the shipped script fits, no new DM script). Shots at
      1280 px and 390 px, light and dark, in `evidence/shots/`. No shot shows a modal. Record
      everything in `evidence/live-run.md`. Remove the `DM_FAKE_SCRIPT` line and recreate the app
      container. Leave the stack up.

## Phase 5: Wiki re-ground

- [ ] T029 Re-verify and re-pin `docs/wiki/play-route.md`: `TableCommands` gains `endEncounter`
      and `setTableMode`; `frames.ts` builds `mechanics` and `table-mode`; the "Table mode"
      slide-out; add `table-mode.ts` and `components/table-mode-panel.tsx` to `sources:`.
- [ ] T030 Re-verify and re-pin `docs/wiki/turn-floor.md` (the human DM now leaves or resumes turn
      mode from the panel; floor controls unchanged) and `docs/wiki/scene-panels.md` (the "Change
      scene" turn-mode line now has a way out; re-pin only where it lists a touched source).
- [ ] T031 Re-pin every other note the freshness gate flags for a touched source (likely
      `chat-ui`, `test-suite`). Re-verify each claim that names a touched file; edit only what
      changed.
- [ ] T032 Regenerate `docs/wiki/CAPSULES.md` for every changed `description:`. Add one sentence on
      spec 060 to `docs/wiki/INDEX.md`'s state paragraph, and name the slide-out in its
      `[[play-route]]` line.
- [ ] T033 Add a TASK-0165 "(this PR)" row to the execution log in
      `docs/design/m3-table-sweep-runbook.md`, in the TASK-0167 row's shape: date, task, PR, —,
      dispatches (`spec (opus ×1), impl ×3 (sonnet)`), then the outcome, the amended contracts, the
      DB count, the mutation result and the live check with its shots.
- [ ] T034 Run the wiki freshness gate
      (`node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
      prints `OK`) and the spec-bridge check
      (`node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` exits 0).
      Run `pnpm ci:check`.

## Dependencies

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. Phase 2 needs Phase 1's commands. Phase 3 needs
no web code and may run beside Phase 2. Phase 4 needs Phases 1 to 3.
