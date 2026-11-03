# Tasks: Combat audit pass rate

**Input**: `specs/085-combat-audit-pass-rate/` (spec.md, plan.md). Plan research R1 to R7 and
design D1 to D8 settle every choice; read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Before Phase 1**: merge `origin/main` into the branch. Confirm TASK-0204 and TASK-0171 have
merged (spine #17, #18). Read the current `dm.narrate`, `dm.audit` and `dm.director` versions on
main; "next version" means one past each.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first.
`pnpm ci:check` is green before the phase commits. No DB is needed: every test here uses pure
functions or the scripted fake gateway. No paid model run.

**Scope rule**: do not edit `fallback.ts`, `nodes/resolve.ts`, `gates/plan-gate.ts`,
`prompts/interpret.ts`, `prompts/adjudicate.ts`, `prompts/step-grammar.ts` or the playtest
auditor. If a task seems to need one, stop and report.

## Phase 1: Only the on-turn actor acts (US1; FR-001 to FR-004)

**Goal**: the facts name who is off turn; narrate and audit share one turn rule; code blocks an
off-turn turn action before the `dm.audit` call.

**Independent test**: `facts.test.ts`, `claims.test.ts`, `audit.test.ts`, `narrate.test.ts` and
`npc-turn-narration.test.ts` pass with the new cases.

- [ ] T001 [US1] In `apps/server/src/dm/facts.ts`, apply plan D1: the optional `offTurn` field on
      `NarrationFacts.turn` and its computation in the `turn` block of `buildNarrationFacts`.
- [ ] T002 [US1] In `apps/server/src/dm/audit-words.ts`, add `TURN_ACT_VERBS` (plan D4) beside the
      claim-gate lexicons.
- [ ] T003 [US1] In `apps/server/src/dm/claims.ts`, add and export `offTurnActs` (plan D5), reusing
      `Context`, `maskQuotes`, `clausesOf`, `tokenize`, `isSubject` and `NEGATION_RE`. Add the
      `ponytail:` comment.
- [ ] T004 [US1] In `apps/server/src/dm/nodes/audit.ts`, call `offTurnActs` in
      `deterministicChecks` after the `checkClaims` loop (plan D6, first bullet three).
- [ ] T005 [US1] In `apps/server/src/dm/prompts/narrate.ts`, apply plan D2: export `TURN_RULE`,
      replace RULES lines 36, 42 and 47, push the `Off turn:` fact line, bump `PROMPT_VERSION`.
- [ ] T006 [US1] In `apps/server/src/dm/prompts/audit.ts`, replace rule 6 with the plan D3 text
      built on `TURN_RULE`. Bump `PROMPT_VERSION`.
- [ ] T007 [P] [US1] Extend `apps/server/test/dm/facts.test.ts`: `offTurn` lists present standing
      combatants in order; excludes the Turn actor, Action characters and roll names (a reaction
      roller included); excludes dead, unconscious and absent actors; includes Next unless on
      turn; absent in free mode.
- [ ] T008 [P] [US1] Extend `apps/server/test/dm/claims.test.ts`: spec US1 scenarios 3–6, plus a
      quoted "Charge!", a negated act, a shared group noun (skipped) and a barred actor (skipped).
- [ ] T009 [P] [US1] Extend `apps/server/test/dm/audit.test.ts`: an off-turn act blocks as
      `invented-mechanics` and skips the `dm.audit` call; no `turn` means no check.
- [ ] T010 [US1] Update `apps/server/test/dm/narrate.test.ts` (narrate and audit version pins, the
      rule-6 string, the `Off turn:` line) and `apps/server/test/dm/npc-turn-narration.test.ts`
      (the pinned Turn rule and rule-6 strings). Commit as
      `TASK-0214 phase 1: off-turn actors take no turn action`.

## Phase 2: Feelings, endings and the goal note (US2–US4; FR-005 to FR-010)

**Goal**: an NPC's feelings never block; the stock ending costs no regenerate; the goal note
leaks no count.

**Independent test**: `audit.test.ts`, `narrate.test.ts` and `assemble.test.ts` pass with the new
cases.

- [ ] T011 [US2] In `apps/server/src/dm/nodes/audit.ts`, apply plan D6: `AuditIssue.actor`, the
      schema field, and the `llmIssueBlocksFor` rule.
- [ ] T012 [US2] In `apps/server/src/dm/prompts/audit.ts`, apply plan D3 rule 1 and the
      `OUTPUT_SHAPE` `actor` field. Keep the Phase 1 version: one bump per task.
- [ ] T013 [US3] In `apps/server/src/dm/audit-words.ts`, add `STOCK_ENDING` and `hasCountClaim`
      (plan D4). In `nodes/audit.ts`, replace the inline stock-ending regex with `STOCK_ENDING`.
- [ ] T014 [US3] [US4] In `apps/server/src/dm/nodes/narrate.ts`, apply plan D7:
      `dropStockEnding` in `narrateAttempt`, and the count rule in `withholdRefusedInputs`.
- [ ] T015 [US4] In `apps/server/src/dm/prompts/director.ts`, apply plan D8. Bump
      `PROMPT_VERSION`.
- [ ] T016 [P] [US2] Extend `apps/server/test/dm/audit.test.ts`: spec US2 scenarios 1–3; a reply
      with `actor` parses and one without still parses.
- [ ] T017 [P] [US3] [US4] Extend `apps/server/test/dm/narrate.test.ts`: spec US3 scenarios 1–3
      and US4 scenarios 1–2; the existing refuted-goalNote case still passes.
- [ ] T018 [P] [US4] Extend `apps/server/test/dm/assemble.test.ts`: the director version pin and
      the `goalNote` restriction text (spec US4 scenario 3). Commit as
      `TASK-0214 phase 2: NPC feelings, stock ending, goal-note counts`.

## Phase 3: Replay run 1 (US5; card AC #2, FR-011, FR-013)

**Goal**: the five run 1 refusals replay against the change.

**Independent test**: `combat-audit-replay.test.ts` passes.

- [ ] T019 [US5] Write `apps/server/test/dm/combat-audit-replay.test.ts` per plan "Replay": one
      `describe` per seq (103, 126, 131, 161, 196), every case in the table. Name the source and
      the rebuilt status in the header. Mark each rebuilt prose string with a `// rebuilt` comment.
- [ ] T020 Amend the four contracts plan "Contracts" names, each with a dated
      `## Amendment (specs/085-combat-audit-pass-rate, TASK-0214)` section. Commit as
      `TASK-0214 phase 3: run 1 refusal replay and contract amendments`.

## Phase 4: Wiki re-ground

**Goal**: every note citing a changed file is re-verified and re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T021 Run `/grounding-wiki:wiki-update`. Review `dm-narration-quality.md` (NEEDS-REVIEW):
      the new narrate, audit and director versions with one sentence each; `turn.offTurn` and the
      `Off turn:` line; the off-turn check; the issue `actor` rule; `dropStockEnding`; the
      count-withheld goal note.
- [ ] T022 Review `dm-runtime.md` (NEEDS-REVIEW): the turn rule and the director version.
- [ ] T023 Review `output-claim-gate.md` (NEEDS-REVIEW): `offTurnActs` and its caller.
- [ ] T024 Re-pin `presence.md` and `seed-npc-presence.md` after checking their claims (the
      director version, the narrate node) against the diff.
- [ ] T025 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` for every changed note summary,
      and add one TASK-0214 sentence to the INDEX state paragraph.
- [ ] T026 Run the freshness gate, the spec-bridge check and `pnpm ci:check`. Commit as
      `TASK-0214 phase 4: wiki re-ground`.

## After merge (orchestrator, not a phase)

- Card AC #1 ticks at the runbook B playtest, measured per plan "Measuring AC #1".
- Card the OQ-2 revisit task if OQ-2 stays (a).
