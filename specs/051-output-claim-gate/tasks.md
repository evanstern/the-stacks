---
description: "Task list for the output claim gate (TASK-0143, decision-0025 U3)"
---

# Tasks: Output claim gate — actor-aware checks over shipped narration

**Input**: `specs/051-output-claim-gate/` (spec.md, plan.md, research.md, data-model.md,
contracts/claim-gate.md, quickstart.md). Binding: decision-0025 (D17) §3.4. The operator rulings
of 2026-10-27 (OQ-1 to OQ-6, all (a); card commit b7be35d) are quoted in spec.md "Operator
rulings". The roll-reason follow-up is TASK-0161.

**Tests**: required and written first. Each test task precedes its implementation task. Phase 1
proves every evidence refusal fails on today's code before any checker exists.

**Dispatch unit**: each phase is one sonnet implementer dispatch. Run the phases in order 1, 2,
3, 4, 5, 6. No two phases run at once: Phases 2 to 5 all touch `apps/server/src/dm/`.

**Gate for every code phase** (run before the phase's last commit):
`pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries`.
- Phase 4 also runs the DB suites.
- Phase 5 also runs `pnpm ci:check` and `pnpm playtest run` in CI mode (fake gateway).

**Database suites** (Phase 4 and Phase 5): run them on the worktree's own stack.
1. Run `pnpm env:up`.
2. Migrate both databases by hand (fresh stacks come up unmigrated, TASK-0098).
3. Restart the app.
4. Export only `TEST_DATABASE_URL` from the worktree `.env`. Never `source` the whole file.
5. Run the suites with `REQUIRE_DATABASE=1`.
6. Leave the stack up. The orchestrator runs `pnpm env:down`.

**Known flakes**: the WebSocket gateway integration tests flake. DB scene and playtest tests can
hit the 5 s timeout under full-suite load (TASK-0154). Re-run once. Do not fix them. Record each
re-run in the phase's commit message.

**Rules for every phase**:
- Follow spec.md, plan.md and contracts/claim-gate.md exactly. A needed deviation is a STOP:
  report it.
- Add no event type, event version, proposal kind, engine command, refusal code, ws frame,
  migration or dependency. Do not change `AuditRecord`, `AuditAttempt`, `RecordedIssue`,
  `AuditModelOutput`, `AUDIT_ISSUE_KINDS` or `MAX_NARRATION_ATTEMPTS`.
- Do not touch `apps/server/src/dm/prompts/audit.ts`; TASK-0146 owns it.
- Do not touch dice lines or `renderDiceLines`; TASK-0161 owns roll reasons.
- Never edit `docs/design/m2-demo/**` or `specs/034-narration-quality/evidence/**`. Tests read
  the records in place.
- Tests use the fake gateway and scripted dice. No paid run.
- Never use the backlog MCP tools. Touch no file under `backlog/`.
- No "for now" without a card (decision-0020). Report any deferral as an open question.

**Commits**: one or more per phase. Each message starts with `TASK-0143:` and ends with the
Co-Authored-By trailer. Stage and commit in separate Bash calls with
`git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0143`. Push after each phase.

## Phase 1: Evidence fixtures and failing evidence tests (card AC #1, #3, #6 evidence)

**Goal**: The recorded runs become fixtures. Every evidence refusal is proven to fail on today's
code. Every control is proven to pass on today's code, except the seq 216 control, which today's
anonymous check refuses.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/claim-evidence.test.ts test/dm/seed-npc-presence.test.ts`.

- [x] T001 Create `apps/server/test/dm/claim-fixtures.ts` (plan D9). Move `loadLog` and
      `foldThrough` from `apps/server/test/dm/seed-npc-presence.test.ts` into it, with the log
      path as an argument. Import them back in `seed-npc-presence.test.ts` and keep it green.
- [x] T002 In `apps/server/test/dm/claim-fixtures.ts`, export the following:
      - `M2_LOG`: `docs/design/m2-demo/demo-session/transcript.jsonl`.
      - `RUN_192319Z_LOG`: `specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/transcript.jsonl`.
      - `stateAt(log, s0Seq, s1Seq)`: builds `buildSnapshot(projections, loadSeed("greyhollow-ford"))`
        at each seq and `diffSnapshots`.
      - `withPresence(log, seq, rows)`: applies synthetic `scene-presence.changed` rows (actor id,
        `after`, reason `fled`) before the build.
      - `narrationAt(log, seq)`: returns the shipped `narration` text with the dice lines removed.
      - The rebuilt row 162 sentences as named constants. Comment each with its source: the
        journal body at seq 162 and `jobs.json` job `ab5ba4ae…`, attempts 2 and 3.
        - `ROW162_ACTING = "Tamsin's hand twitches toward her sword, her fingers curling around the hilt."`
        - `ROW162_STATE = "Tamsin lies where she fell, her breath shallow against the night air."`
        - `SEQ201_NEGATED = "Tamsin cannot speak."`
        - `SEQ216_UNCONSCIOUS = "Tamsin lies unconscious in the mud."`
- [x] T003 Create `apps/server/src/dm/claims.ts` as a typed seam only. Export the
      `data-model.md` types and `checkClaims` returning `{ pass: true, issues: [] }`. Add a
      header comment saying Phase 2 implements it.
- [x] T004 [US1] [US3] Create `apps/server/test/dm/claim-evidence.test.ts`. Write the refusal
      cases below with `it.fails` (they fail on the seam), each naming its source seq:
      - M2 seq 225 (`stateAt(M2_LOG, 220, 224)`, `narrationAt(M2_LOG, 225)`): a `count` issue
        quoting "Two down" (US3.1).
      - F52 (`stateAt(M2_LOG, 306, 306)`, `narrationAt(M2_LOG, 307)`): a `count` issue quoting
        "No goblins left" (US3.2).
      - Row 162 (`stateAt(RUN_192319Z_LOG, 155, 160)`, `ROW162_ACTING`): an `act` issue naming
        Tamsin Vale (US1.1).
      - The seq 225 alias variant ("The goblin lookout shrieks at Snag.") against the seq 224
        state: a `speech` issue naming goblin-3 (US1.5).
      - Snag `absent` (`withPresence(M2_LOG, 306, [snag])`, "Snag laughs from the reeds."): an
        `act` issue (US1.6).
- [x] T005 [US1] [US2] [US3] In the same file, write the controls with plain `it`. They expect
      `pass: true` and must pass on the seam:
      - F52 with goblin-2, goblin-4 and Snag `absent` (US3.3);
      - `ROW162_STATE` (US1.2) and `SEQ201_NEGATED` (US1.3);
      - the shipped seq 225 prose checked for acts only (US1.4): assert no `act` or `speech` issue;
      - M2 seq 220 (`stateAt(M2_LOG, 213, 219)`, `narrationAt(M2_LOG, 220)`) (US2.2).
- [x] T006 [US2] In the same file, add the seq 216 control
      (`stateAt(RUN_192319Z_LOG, 205, 215)`, `SEQ216_UNCONSCIOUS`). Assert two things: today's
      `deterministicChecks` refuses it with "The prose says a character is unconscious", and
      `checkClaims` passes it. Write the first assertion as a plain `it` that expects today's
      refusal, with a comment that Phase 3 flips it to expect a pass.
- [x] T007 Run the independent test. Confirm the fold of both logs parses every row. If the run
      192319Z fold fails, STOP and report.

**Checkpoint**: the evidence is executable; every refusal is red behind `it.fails`.

## Phase 2: The claim checker (card AC #1, #2, #3)

**Goal**: `checkClaims` implements contracts/claim-gate.md rules 1 to 8. The Phase 1 refusals
turn green.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/claims.test.ts test/dm/claim-evidence.test.ts`.

### Tests first

- [x] T008 [P] [US1] Create `apps/server/test/dm/claims.test.ts` with unit cases for references
      and acts (contract rules 1 to 3). Build each snapshot by hand with
      `apps/server/test/dm/snapshot-fixtures.ts`.
      - Unique versus group terms: "goblin" is shared by four actors.
      - Possessive attribution: "Tamsin's hand reaches" refers to Tamsin. "Snag's goblins flee"
        does not refer to Snag.
      - Negations and involuntary verbs.
      - Quoted speech attributed before and after the quote.
      - `stable` counts as downed; `yielded` may act (US1.7).
      - FR-004a: an actor that dies this turn ("The goblin lookout lunges, then drops") and an
        actor that flees this turn ("Snag flees into the reeds") pass. "Tamsin moves next" with
        Tamsin unconscious passes.
- [x] T009 [P] [US2] In the same file, add cases for contract rules 4 to 6:
      - "Snag falls dead" with goblin-3 dying refuses (US2.1);
      - "Snag drops the clapper" passes (no down attribution);
      - "the dead lookout" with goblin-3 dead earlier passes (US2.4);
      - an omitted drop for Kestrel refuses (US2.5);
      - an unattributed "someone dies" with no dead actor refuses.
- [x] T010 [P] [US3] In the same file, add cases for contract rule 7:
      - "two goblins lie dead" with two dead passes (US3.4);
      - "both down" with two downed party members passes;
      - "his last goblin" with three goblin-group actors standing refuses;
      - "all the goblins are dead" with one standing refuses;
      - a `yielded` goblin counts as left.
- [x] T011 [P] In the same file, pin the lexicons: `ACT_VERBS`, `SPEECH_VERBS` and
      `INVOLUNTARY_VERBS` are pairwise disjoint, and every issue's `matched` is at most 60
      characters.

### Implementation

- [x] T012 Add the plan D2 lexicons to `apps/server/src/dm/audit-words.ts` (data-model.md
      "Lexicons"). Keep every existing export unchanged.
- [x] T013 [US1] [US2] [US3] Implement `checkClaims` in `apps/server/src/dm/claims.ts` per plan D1
      and contracts/claim-gate.md. Import snapshot types only (`import type`). The narrate import
      boundary must hold.
- [x] T014 Flip every `it.fails` in `apps/server/test/dm/claim-evidence.test.ts` to `it`. Leave
      the T006 `deterministicChecks` assertion alone; Phase 3 flips it.

**Checkpoint**: the checker decides every card evidence case; no control is refused.

## Phase 3: Audit wiring; the anonymous checks replaced; the fallback passes (card AC #2, #5, #6)

**Goal**: Every narration attempt runs the checker as blocking issues. The four actor-anonymous
checks are gone. The fallback passes the checker.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/audit.test.ts test/dm/fallback.test.ts test/dm/narration-quality-repro.test.ts test/dm/claim-evidence.test.ts`.

### Tests first

- [x] T015 [US2] Rewrite the tests that assert on the four replaced checks (plan D8) in
      `apps/server/test/dm/audit.test.ts`. Give the `check()` helper (line 74) a `ClaimState`
      argument, defaulting to a snapshot with one living "Guard".
      - Replace "fails on an unrecorded death and on an omitted one" (lines 96–113) and "fails on
        an unrecorded or omitted unconscious state" (lines 115–128) with keyed cases:
        - an attributed death on a living Guard fails;
        - an earlier death in S1 passes;
        - a diff death on Guard with prose that never kills him fails;
        - the drop equivalents.
      - Replace the exact detail at lines 170–174 with the `Actor state:` detail.
- [x] T016 [US2] In `apps/server/test/dm/audit.test.ts`, assert each claim issue is
      `ledger-mismatch` with a detail starting `Actor state:` (OQ-4).
- [x] T017 [P] [US4] Extend the 400-iteration property loop in
      `apps/server/test/dm/fallback.test.ts` (around line 478):
      - derive a `ClaimState` from each random fact set (one actor per name, life states from
        the changes, a diff for this turn's changes);
      - pass it to `factualSummary(f, state)` and `deterministicChecks`;
      - assert `checkClaims(state, prose).pass`.
      Add a case where a roll reason says "shouting that two kin have fallen" with one dead
      (M2 seq 221). Assert the fallback does not voice that reason (US4.4).
- [x] T018 [P] Give the call at `apps/server/test/dm/narration-quality-repro.test.ts:366` an
      empty-diff `ClaimState` built from `EMPTY_RESOLVE_SNAPSHOT`. Keep its assertion unchanged.
- [x] T019 [US2] Flip the T006 assertion in `apps/server/test/dm/claim-evidence.test.ts`.
      `deterministicChecks` must now pass `SEQ216_UNCONSCIOUS` against the seq 215 state.

### Implementation

- [x] T020 [US2] In `apps/server/src/dm/nodes/audit.ts`, apply plan D3:
      - add the required `state: ClaimState` argument;
      - delete the four anonymous checks and `lifeStateFacts`;
      - append `checkClaims` issues as blocking `ledger-mismatch` with the `Actor state: ` prefix;
      - in the `audit` node, pass `{ snapshot: resolved.snapshot, diff: resolved.diff }`.
- [x] T021 [US4] In `apps/server/src/dm/fallback.ts`, add the optional `state` argument to
      `factualSummary` and the `checkClaims` test in `reasonUsable` (plan D5). In
      `apps/server/src/dm/nodes/audit.ts` `fallback()`, call `factualSummary(facts, state)`.
- [x] T022 Run `pnpm typecheck` and fix every caller of `deterministicChecks` the compiler
      names, without changing what the tests assert.

**Checkpoint**: claim refusals block; the run 192319Z seq 216 false positive is gone; the
fallback passes by construction.

## Phase 4: Ruling and `goalNote`; the regenerate loop end to end (card AC #4, #5)

**Goal**: A refused ruling or `goalNote` never reaches the narrator. A refused narration
regenerates three times, then the fallback ships.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/narrate.test.ts`,
then `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/dm/audit.integration.test.ts`.

### Tests first

- [ ] T023 [US4] In `apps/server/test/dm/narrate.test.ts`, add unit cases for the narrate node's
      input check (plan D4):
      - A ruling "The goblin lookout rallies the others" with goblin-3 dead is removed from the
        facts the prompt receives (US4.1).
      - A `goalNote` "Two goblins are down; press the survivors" with one dead becomes `""`, and
        the prompt reads "Private note: " (US4.2).
      - `NarrateOutput.withheld` holds one `ledger-mismatch` issue each, with details starting
        `Actor state: withheld`.
      - A clean ruling and note pass through unchanged, and `withheld` is `[]`.
- [ ] T024 [US4] Create `apps/server/test/dm/scripts/audit-claim-fallback.json` in the
      `audit-fallback.json` shape. Script three `dm.narrate` responses, each showing a downed
      Tamsin acting. Add a `note` on each response naming the rule it breaks.
- [ ] T025 [US4] In `apps/server/test/dm/audit.integration.test.ts`, add a case for that script
      (plan D10, US4.3). Assert the following:
      - three attempts, each with a blocking "Actor state:" issue;
      - `llm: { skipped: true }` on each attempt;
      - `final: "fallback"` and the DM journal flag;
      - the shipped prose passes `checkClaims`.
- [ ] T026 [US4] In the same file, add a refused-`goalNote` case (plan D10). Assert two things:
      the attempt-1 record holds the withheld issue with `blocking: false`, and the shipped
      narration is not a fallback.

### Implementation

- [ ] T027 [US4] In `apps/server/src/dm/nodes/narrate.ts`, apply plan D4: check rulings and
      `goalNote` once after `buildNarrationFacts`, filter the facts, and add `withheld` to
      `NarrateOutput` (always present).
- [ ] T028 [US4] In `apps/server/src/dm/nodes/audit.ts`, record `narration.withheld` on attempt 1
      as `blocking: false` issues (plan D3). Keep `det.pass` counting blocking issues only. Keep
      withheld issues out of `issuesSoFar`. Prefix them `[advisory]` in the fallback journal body.
- [ ] T029 Run the DB suites per the header. Record any flake re-run.

**Checkpoint**: AC #4 and #5 hold through a real turn on the fake gateway.

## Phase 5: Narrate prompt v5 and the contracts (card AC #1, #2, #3, #6; OQ-3; FR-017, FR-020)

**Goal**: The narrator is told the rules the gate enforces, and the contracts are binding.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/narrate.test.ts test/dm/player-facing-prompts.test.ts`,
then `pnpm ci:check` and `pnpm playtest run` (CI mode).

### Tests first

- [ ] T030 [US1] In `apps/server/test/dm/narrate.test.ts:310`, expect `dm.narrate-v5`. Assert the
      system prompt holds the two plan D6 rule lines verbatim and no longer holds "only when a
      fact says so;".

### Implementation

- [ ] T031 [US1] In `apps/server/src/dm/prompts/narrate.ts`, set `PROMPT_VERSION` to
      `dm.narrate-v5` and apply the two `RULES` edits of plan D6. Change nothing else in the
      builder.
- [ ] T032 Check every other consumer in the plan D6 table. Confirm that none needs an edit.
      Grep for `dm.narrate-v4` outside recorded evidence and specs. The only hits allowed are in
      `specs/040-actor-snapshot/**`, `specs/051-output-claim-gate/**`, `backlog/**` and
      `docs/wiki/dm-narration-quality.md`; Phase 6 updates the wiki note.
- [ ] T033 [P] Amend `specs/034-narration-quality/contracts/audit-criteria.md`. Add a section
      "Deterministic checks (amendment, spec 051)" that covers:
      - the four retired checks;
      - the claim checks, which block as `ledger-mismatch` "Actor state:";
      - the withheld-input record on attempt 1 (`blocking: false`).
      Add the line "Amended 2026-10-27 (TASK-0143, operator ruling OQ-2, OQ-4, OQ-6)" with the
      ruling quoted.
- [ ] T034 [P] Amend `specs/040-actor-snapshot/contracts/actor-snapshot.md` consumers. State that
      `checkClaims` (spec 051) reads `aliases`, `kind`, `lifeState`, `presence` and the diff.
      Add the amendment line.
- [ ] T035 Run `pnpm ci:check`, the DB suites and `pnpm playtest run` in CI mode. Compare the
      playtest's fallback-turn count with an `origin/main` run of the same command. A rise is a
      STOP: report the turns and the claim issues that caused it.

**Checkpoint**: every gate is green; the prompt and the contracts match the code.

## Phase 6: Wiki re-ground

**Goal**: The grounding wiki describes the merged behaviour, with honest re-pins.

**Independent test**: the freshness gate prints `OK`, and the spec-bridge check exits 0.

- [ ] T036 Run the `grounding-wiki:wiki-update` plan. Classify each note whose sources changed as
      RE-PIN-ONLY or NEEDS-REVIEW against `git diff <old-pin>..HEAD -- <sources>`.
- [ ] T037 NEEDS-REVIEW `docs/wiki/dm-narration-quality.md`. Cover:
      - the "Audit" section: the claim checks replace the four anonymous checks;
      - the withheld ruling and `goalNote`;
      - the fallback's reason filter;
      - "Prompt versions": `dm.narrate-v5`.
      Add `apps/server/src/dm/claims.ts` and `apps/server/src/dm/audit-words.ts` to its sources.
      Re-pin it.
- [ ] T038 NEEDS-REVIEW `docs/wiki/dm-runtime.md`: the audit step (step 7) and "Narration and
      audit" name the claim gate against S1. Re-pin it.
- [ ] T039 NEEDS-REVIEW `docs/wiki/actor-snapshot.md` "Extension points": state that TASK-0143
      built the alias matcher (`checkClaims`), which TASK-0144 and TASK-0161 reuse. Re-pin it.
- [ ] T040 Review `docs/wiki/seed-npc-presence.md` (it lists `nodes/narrate.ts`),
      `docs/wiki/dm-failure-and-gates.md` and `docs/wiki/playtest-harness.md` (it reads the
      `audit-words.ts` lexicons). Re-pin each note whose sources changed. Where behaviour
      changed, amend the prose before re-pinning.
- [ ] T041 Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed. Add one sentence
      for the output claim gate to the `docs/wiki/INDEX.md` state paragraph.
- [ ] T042 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
      (it must print `OK`). Run
      `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
      (it must exit 0).

**Checkpoint**: the wiki is fresh, and the bridge is clean.

## Dependencies

- Phase 1 → Phase 2. The evidence tests and the seam must exist before the checker.
- Phase 2 → Phase 3. `deterministicChecks` calls `checkClaims`.
- Phase 3 → Phase 4. The audit node's new signature and the `withheld` record build on Phase 3.
- Phase 4 → Phase 5. The prompt bump is last among code phases, so the Phase 5 playtest
  comparison measures the whole gate.
- Phases 1 to 5 → Phase 6.
- Within a phase, `[P]` tasks touch different files and can be written in any order. Every test
  must fail before its implementation task, except the Phase 1 controls, which pass on the seam
  by design.

## Story map

| Story | Card AC | Phases |
|---|---|---|
| US1 downed, dead or absent actor never acts or speaks | #1 | 1, 2, 5 |
| US2 deaths and drops on the right actor | #2, #6 | 1, 2, 3 |
| US3 counts and quantifiers | #3 | 1, 2 |
| US4 ruling, `goalNote`, regenerate loop, fallback | #4, #5 | 3, 4 |

## Implementation strategy

The MVP is Phases 1 to 3: the checker blocks bad narration in the existing loop, and AC #1,
#2, #3, #5 and #6 hold. Phase 4 adds AC #4 and the end-to-end proof. Phase 5 aligns the prompt
and the contracts. Phase 6 re-grounds the wiki. The demo gate (TASK-0053) needs all six.
