# Tasks: Reveal waits for the dice

**Input**: `specs/089-reveal-waits-for-dice/` (spec.md, plan.md). Plan research R1 to R6 and design
D1 to D8 settle every choice; read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Before Phase 1**: confirm TASK-0244, TASK-0238, TASK-0203, TASK-0240 and TASK-0246 have merged
(runbook B2 spine #2b to #5). Merge `origin/main` into the branch.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first.
`pnpm ci:check` is green before the phase commits. No paid model run: every replay uses the
scripted fake gateway and scripted dice. Phase 2's integration test needs `pnpm env:up`; read the
URL with `TEST_DATABASE_URL="$(sed -n 's/^TEST_DATABASE_URL=//p' .env)"`. Never `export $(grep ...)`.

**Scope rule**: do not edit `fallback.ts`, `prompts/interpret.ts`, `prompts/narrate.ts`,
`gates/plan-gate.ts`, `prompts/step-grammar.ts` or the engine. If a task seems to need one, stop and
report.

## Phase 1: Seam check (no source edit)

**Goal**: plan.md and tasks.md match the code the earlier spine merges left.

**Independent test**: plan.md's "Seam check log" has a row per merged task, or "no seam moved".

- [x] T001 Re-read the merged diffs of TASK-0244 and TASK-0238 in `apps/server/src/dm/nodes/resolve.ts`:
      the arrivals loop, `directorOpening`'s signature, the plan-gate `arriving` input, the order of
      the action and NPC groups. Record whether 0238 routes encounter monsters through `arrivals`
      (spec OQ-4).
- [x] T002 Re-read the merged diffs of TASK-0203 in `apps/server/src/dm/prompts/director.ts` and
      `nodes/director.ts` (goalNote coercion), and of TASK-0240 and TASK-0203 in
      `prompts/audit.ts` and `nodes/audit.ts` (rule numbering, `deterministicChecks`). Note the
      current `dm.director` and `dm.audit` versions; "next version" means one past each.
- [x] T003 Re-read the merged diffs of TASK-0246 in `apps/server/src/dm/claims.ts` and
      `audit-words.ts`, and of TASK-0242, 0244 and 0238 in `facts.ts` (`FactRoll`, `collectFacts`).
- [x] T004 Amend plan.md D3 to D8 and the Files table where a seam moved; log each amendment in
      "Seam check log". Amend this file's later tasks to match. Commit as
      `TASK-0237 phase 1: seam check against merged spine`.

## Phase 2: Dependent arrivals wait for the band (US1; FR-001 to FR-005, FR-012)

**Goal**: an arrival a check names lands only when its band's texts name the NPC.

**Independent test**: `stakes.test.ts`, `claims.test.ts`, `reveal-waits.test.ts` and
`reveal-waits.integration.test.ts` pass; `revealed-npc.integration.test.ts` passes unchanged.

- [x] T005 [US1] In `apps/server/src/dm/claims.ts`, add and export `namedActorIds` (plan D1), with
      its `ponytail:` comment.
- [x] T006 [US1] In `apps/server/src/dm/stakes.ts`, add and export `bandTexts` (plan D2).
- [x] T007 [US1] In `apps/server/src/dm/nodes/resolve.ts`, apply plan D3: export `splitArrivals`;
      feed `unconditional` to the plan gate's `arriving` and to `directorOpening`; add
      `landHeldArrivals` after the NPC group, before `directorClosing`.
- [x] T008 [P] [US1] Extend `apps/server/test/dm/stakes.test.ts`: `bandTexts` for each band, a null
      severe, an unknown band, null stakes.
- [x] T009 [P] [US1] Extend `apps/server/test/dm/claims.test.ts`: `namedActorIds` finds "Pell" and
      "the boy", skips a shared noun, returns `[]` for "a small figure".
- [x] T010 [US1] Create `apps/server/test/dm/reveal-waits.test.ts` with `splitArrivals` cases: a
      success text naming Pell (dependent), no check (unconditional), a hold beat (unconditional),
      a ruling's check (dependent).
- [x] T011 [US1] Create `apps/server/test/dm/scripts/reveal-pell.json` and
      `apps/server/test/dm/reveal-waits.integration.test.ts`, replaying seq 43-51 per plan
      "Replays": severe failure writes no Pell `scene-presence` row and logs `dm.arrival.held`;
      success writes one public `arrived` row after `check.resolved`; a failure text naming Pell
      lands it on `failure`; an unconditional arrival lands first as spec 078.
- [x] T012 [US1] Append the resolve and director amendments to
      `specs/031-dm-runtime/contracts/resolve.md` and `director.md` (held arrivals). Commit as
      `TASK-0237 phase 2: dependent arrivals wait for the band`.

## Phase 3: The goal note promises no dice result (US2; FR-006, FR-007)

**Goal**: the Director is told not to state a dice result, and narrate drops the note when a check
failed.

**Independent test**: `reveal-waits.test.ts`, `narrate.test.ts`, `assemble.test.ts` and
`director.test.ts` pass with the new cases.

- [x] T013 [US2] In `apps/server/src/dm/prompts/director.ts`, apply plan D4 and bump
      `PROMPT_VERSION` to the next version.
- [x] T014 [US2] In `apps/server/src/dm/nodes/narrate.ts`, apply plan D5 in `withholdRefusedInputs`.
- [x] T015 [US2] Extend `apps/server/test/dm/reveal-waits.test.ts`: replay seq 63-72 (plan
      "Replays"), the note withheld with the doctrine advisory; a success beat keeps the note;
      seq 43-51's note "Reward the scan with one true thing: Pell alive at the post" is withheld on
      the severe failure.
- [x] T016 [US2] Update the director version pin in `apps/server/test/dm/assemble.test.ts`, and any
      pinned prompt text in `apps/server/test/dm/director.test.ts`. Assert the new goalNote and
      arrivals sentences are in the built prompt.
- [x] T017 [US2] Append the goalNote amendment to `specs/031-dm-runtime/contracts/director.md`.
      Commit as `TASK-0237 phase 3: the goal note promises no dice result`.

## Phase 4: The audit flags a success told on a failure band (US3; FR-008 to FR-011)

**Goal**: a failed band's success text never ships unflagged.

**Independent test**: `facts.test.ts`, `claims.test.ts`, `audit.test.ts`, `narrate.test.ts` and
`reveal-waits.test.ts` pass with the new cases.

- [ ] T018 [US3] In `apps/server/src/dm/facts.ts`, apply plan D6 (`unmetSuccess`, both
      `collectFacts` sites).
- [ ] T019 [US3] In `apps/server/src/dm/claims.ts`, apply plan D7: the `"reveal"` kind and
      `unmetReveals`, with its `ponytail:` comment.
- [ ] T020 [US3] In `apps/server/src/dm/nodes/audit.ts`, call `unmetReveals` in
      `deterministicChecks` (plan D8).
- [ ] T021 [US3] In `apps/server/src/dm/prompts/audit.ts`, add the unmet section and the rule 7
      sentence (plan D8). Bump `PROMPT_VERSION` to the next version.
- [ ] T022 [P] [US3] Extend `apps/server/test/dm/facts.test.ts`: `unmetSuccess` set on `failure`
      and `severe-failure`, null on `success` and `success-at-cost`.
- [ ] T023 [P] [US3] Extend `apps/server/test/dm/claims.test.ts`: `unmetReveals` reports the seq 51
      prose; passes "no sign of Pell", "Where is Pell?", a quoted "Pell!", and Pell present in S1.
- [ ] T024 [US3] Extend `apps/server/test/dm/audit.test.ts`: the seq 51 prose blocks as
      `ledger-mismatch` and skips the `dm.audit` call. Extend `reveal-waits.test.ts`: the seq 63-72
      audit prompt lists the unmet success.
- [ ] T025 [US3] Update the audit version pin and the rule 7 string in
      `apps/server/test/dm/narrate.test.ts`. Append the audit amendment to
      `specs/031-dm-runtime/contracts/audit.md`. Commit as
      `TASK-0237 phase 4: the audit flags a success told on a failure band`.

## Phase 5: Wiki re-pin

**Goal**: the grounding wiki describes the merged behavior and passes the freshness gate.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs freshness . docs/wiki`
prints `OK`.

- [ ] T026 Review `docs/wiki/dm-runtime.md` (NEEDS-REVIEW): held arrivals in the resolve order, the
      goalNote rule and the new `dm.director` version.
- [ ] T027 Review `docs/wiki/seed-npc-presence.md` (NEEDS-REVIEW): the Director's arrivals split into
      unconditional and dependent.
- [ ] T028 Review `docs/wiki/dm-narration-quality.md` (NEEDS-REVIEW): `unmetSuccess`, the `reveal`
      claim, the goal-note withhold, the new `dm.audit` version.
- [ ] T029 Re-pin every other note that lists a touched file as a source (expected:
      `output-claim-gate`, `dm-turn-jobs`, `turn-floor`, `party-panel`), honestly: review the diff
      against each note first.
- [ ] T030 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` (the state paragraph and the
      changed note lines). Run the freshness gate. Commit as `TASK-0237 phase 5: wiki re-pin`.
