# Tasks: Fact sheet, code-rendered fact rows and State line

**Input**: `specs/098-fact-sheet/spec.md`, `plan.md`, `contracts/fact-sheet.md`.
**Prerequisites**: TASK-0273 merged (spine #4). Spec OQ-1 to OQ-10 as recommended.

**Rules for every phase**: one phase is one sonnet dispatch. Run `pnpm install --frozen-lockfile`
in a fresh worktree. Use the fake gateway; no paid model call. End each phase with `pnpm ci:check`
green and one commit, `TASK-0245 phase <n>: <title>`, staged and committed in separate calls with
the literal worktree path. No migration. No new dependency. Do not edit `dm/claims.ts`,
`ledger-format.ts` or any fake script JSON.

## Phase 1: Rows, State line and slots as pure code (US2, US4; FR-004 to FR-008, FR-011, FR-012; plan D1, D2)

**Goal**: `fact-sheet.ts` builds a sheet, renders every row and the State line, and parses and
composes slots. Nothing calls it yet.

**Independent test**: `fact-sheet.test.ts` and `facts.test.ts` pass.

- [x] T001 [US2] In `apps/server/src/dm/facts.ts`, extend `renderChangeLine` with `life-state`,
      `condition`, `spell-slot` and `assist` rows (contract §3.1). Keep `hp` and `death-saves` text.
- [x] T002 [US2] Create `apps/server/src/dm/fact-sheet.ts` with the contract §2 types,
      `REFUSAL_REASON` (§3.2), `renderRows` (§3.1 order plus refusal rows), and `renderDiceLines`
      re-expressed in `facts.ts` as the row texts.
- [x] T003 [US4] In `fact-sheet.ts`, write `buildFactSheet` and `renderStateLine` per contract §4:
      restate targets, resolutions (`partial` from submissions and followUps), slots, code ask,
      speakers, status and floor clauses.
- [x] T004 [US1] In `fact-sheet.ts`, write `parseSlots` and `composeReply` per contract §5.
- [x] T005 [P] [US2] In `apps/server/test/dm/facts.test.ts`, assert a row for every `FactChange`
      kind.
- [x] T006 [US4] Write `apps/server/test/dm/fact-sheet.test.ts`: one case per decision-tree branch
      (contract §4.1 to §4.3, including the five worked examples) asserting slots and the exact State
      line; a property over all branches that no State line holds `?` and each names a combatant,
      "Anyone" or "the DM"; refusal rows per code; `parseSlots` (untagged reply, digit restate,
      either-or ask, stock ask, code ask wins); `composeReply` order and empty-block omission.

**Checkpoint**: AC #1, #3 (rows), #6 provable in unit tests.

## Phase 2: Narrate builds and ships the sheet (US1, US3; FR-001 to FR-003, FR-009, FR-010, FR-013; plan D3, D4)

**Goal**: every narrate job builds a sheet, the prompt asks for slots, and the shipped text is the
template. The run 1 seq 15-20 replay passes.

**Independent test**: `narrate.test.ts`, `player-facing-prompts.test.ts` and
`fact-sheet-replay.test.ts` pass.

- [ ] T007 [US1] In `apps/server/src/dm/nodes/narrate.ts`, build the sheet after
      `withholdRefusedInputs`, pass it to `narrateAttempt`, run `parseSlots`, and set `sheet`,
      `slots`, `prose`, `diceLines` and `text` (contract §5.2). Replace `composeText` with
      `composeReply` at every caller.
- [ ] T008 [US1] In `apps/server/src/dm/prompts/narrate.ts`, apply plan D4 and bump to
      `dm.narrate-v22`.
- [ ] T009 [P] [US1] Extend `apps/server/test/dm/narrate.test.ts`: `output.sheet` on every non-skipped
      job; template order; the import-closure test still passes with `fact-sheet.ts` in it.
- [ ] T010 [P] [US1] Extend `apps/server/test/dm/player-facing-prompts.test.ts` for the Slots,
      Restate, Speakers and Settled question sections.
- [ ] T011 [US3] Create `apps/server/test/dm/fixtures/run1-seq15-20-clarify.json` (header cites
      `docs/playtests/2026-11-03-runbook-b-playtest.md` findings 2 and 6) and
      `apps/server/test/dm/fact-sheet-replay.test.ts`: the narrate node with the fake gateway ships
      the question as its own block, no row, and the exact clarify State line; a model `[ask]` is
      discarded.

**Checkpoint**: AC #2, #4, #5 proven.

## Phase 3: Audit, fallback, talk, auditor and transcript follow the template (FR-014, FR-015; plan D5 to D10)

**Goal**: the existing loop checks the slots and ships the template; the playtest auditor and the
web read the new text.

**Independent test**: `audit.test.ts`, `fallback.test.ts`, `checks.test.ts`, `table-view.test.tsx`
pass; DB integration tests pass with `REQUIRE_DATABASE=1`.

- [ ] T012 In `apps/server/src/dm/nodes/audit.ts`, filter claim `omission`, run agency checks on
      describe and ask, read clarify exemptions from `sheet.ask`, regenerate with the sheet, and ship
      `composeReply`. In `apps/server/src/dm/prompts/audit.ts`, add the restate note and bump to
      `dm.audit-v17`.
- [ ] T013 In `apps/server/src/dm/fallback.ts`, add the `forSheet` option; the audit fallback ships
      the template (plan D6).
- [ ] T014 In `apps/server/src/dm/talk-turn.ts`, append the floor-clause State line on an `escalate`
      that starts a fight.
- [ ] T015 In `apps/server/src/playtest/auditor/checks.ts`, accept the row forms and the State line,
      and widen `DICE_RELEVANT` (plan D8).
- [ ] T016 In `apps/web/app/play/components/transcript.tsx`, add `whitespace-pre-line` to the
      narration paragraph.
- [ ] T017 Amend `specs/034-narration-quality/contracts/narration-facts.md` with the pointer section
      (plan D10).
- [ ] T018 [P] Extend `audit.test.ts` (omission advisory; a restate quoting "I dodge" does not trip
      agency), `fallback.test.ts` (`forSheet`), `apps/server/test/playtest/checks.test.ts` (one case
      per row kind and the State line), `apps/web/test/play/table-view.test.tsx` (pre-line class).
- [ ] T019 Run the DB suites on the worktree stack. Update narration-text expectations in the
      integration tests to the template; change no behaviour assertion. Record any 5 s timeout re-run.

**Checkpoint**: SC-001 to SC-004 hold.

### Constitution Compliance (the-stacks)

- [ ] T020 Fact-sheet test: every digit in a shipped reply lies in a row or the State line
      (Principle VII). Add to `fact-sheet-replay.test.ts` over every scripted narrate reply it runs.
- [ ] T021 Accessibility: the narration paragraph keeps its text role and renders at 1280 px and
      390 px; `apps/web/test/no-dialog.test.mjs` green (Principle IX).

## Phase 4: Wiki re-ground

**Goal**: the notes the runbook lists for TASK-0245 match the merged code, re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`; the spec-bridge check exits 0.

- [ ] T022 NEEDS-REVIEW `docs/wiki/dm-narration-quality.md`: the fact sheet, rows per kind, State
      line, slots, prompt versions v22/v17, omission filter, fallback template. Add
      `apps/server/src/dm/fact-sheet.ts` to its sources.
- [ ] T023 NEEDS-REVIEW `docs/wiki/dm-runtime.md`: narrate's output shape and the template.
- [ ] T024 NEEDS-REVIEW `docs/wiki/output-claim-gate.md`: the audit no longer blocks `omission`.
- [ ] T025 NEEDS-REVIEW `docs/wiki/dm-talk-triggers.md` (escalate State line),
      `docs/wiki/playtest-harness.md` (row forms), `docs/wiki/seed-npc-presence.md` (re-read; re-pin
      only after the diff read).
- [ ] T026 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md` for the `dm-narration-quality`
      capsule. Run the freshness gate and the spec-bridge check.

## Dependencies

- Phase 1 before Phase 2 (sheet module). Phase 2 before Phase 3 (`NarrateOutput.sheet`).
- Phase 4 last.
- Merge after TASK-0273 (spine #4). TASK-0272 and TASK-0215 build on this merge.
