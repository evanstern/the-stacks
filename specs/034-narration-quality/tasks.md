---
description: "Task list for narration quality (TASK-0106)"
---

# Tasks: First Scene — narration stays in fiction, keeps DM secrets and matches the ledger

**Input**: `specs/034-narration-quality/` — spec.md, plan.md, research.md, quickstart.md,
contracts/player-facing-context.md, contracts/narration-facts.md,
contracts/fallback-summary.md, contracts/audit-criteria.md.

**Tests**: required. Every card AC is proven by a named test or a recorded run.

**Dispatch unit**: Phases 1, 2, 3, 4, 4b and 6 (T040–T044) are implementer dispatches
(sonnet). Phases 5 and 5b and T045–T047 are **orchestrator-run**. Never dispatch them. Run
phases in order: 1, 2, 3, 4, 5, 4b, 5b, 6.

**Gate for every dispatched phase** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/server test && pnpm check:boundaries`.
Phase 6 also runs `pnpm ci:check`.

**Database suites**: run on the worktree's own stack. Run `pnpm env:up`. Migrate with the app
database URL passed as `TEST_DATABASE_URL` (`apps/server/scripts/migrate.ts` prefers it). Run
the suites with `REQUIRE_DATABASE=1`.

**Known flake**: the WebSocket gateway integration tests flake. Re-run on an unrelated
WebSocket failure. Do not fix them. Record each re-run in the phase's commit message.

**Rules for every phase**: never coerce or invent a number. Keep `MAX_NARRATION_ATTEMPTS` at 3.
Add no dependency. Add no migration. Never edit `.env`. Bump `PROMPT_VERSION` for every prompt
whose text changes. Update every test that asserts a current version. Leave historic fixture
metadata unchanged.

**Commits**: one or more per phase, each message led by `TASK-0106:`.

## Format: `[ID] [P?] [Story] Description`

## AC coverage map

| Card AC | Proven by |
|---|---|
| #1 no DM-only seed fact in companion or narrate prompts; a test | T013 (repro), T020, T021 |
| #2 in-fiction fallback stating every ledger change; tests | T012 (repro), T026, T027 |
| #3 causes classified from evidence; each selected cause fixed with a test | research.md (done), T010–T015 (repro), T018–T021 (A1/L1–L5), T024–T027 (F17, F23), T030–T035 (A1–A4), T048–T052 (E2, E3) |
| #4 paid run: fallback ≤10%, zero leak and contradiction fails | T036–T039 (run, failed), T053–T057 |
| #5 existing dm tests and scripted CI playtest green | every phase gate, T040, T045 |

## Cause → task map

| Cause (research.md) | Fix task | Test task |
|---|---|---|
| A1 no party roster | T030, T031 | T034 |
| A2 `no-effect` undefined | T024, T030, T031 | T034 |
| A3 clarify relayed as a menu | T030, T032 | T033 |
| A4 craft judgments block | T032 | T033 |
| A5 narrator decides party members | T030 | T034 |
| L1 doctrine example | T018 | T020 |
| L2, L3, L5 seed overlap | T017 | T020, T021 |
| L4 / F76 transcript lines | T019 | T022 |
| F17 roll reasons missing | T024 | T026 |
| F23 fallback | T025 | T026, T027 |
| F81 companion state | T030 | T034 |
| E1 narrate truncation | operator config (`dm.narrate` maxTokens 1500) | T057 (rerun) |
| E2 world characters filed as `player-agency` | T048 | T049 |
| E3 hero wounded or moved on a foe's failed attack | T050 | T051 |

---

## Phase 1: Reproduce the run-5 defects (AC #3) — DISPATCH (sonnet)

**Goal**: each selected defect has a test that passes on the unfixed code and pins the defect.

- [x] T010 Write `apps/server/test/dm/fixtures/run5-narration-quality.json`. Copy, unchanged,
  these rows from `specs/034-narration-quality/evidence/run5-20261026T171359Z-greyhollow-ford-provider/transcript.jsonl`:
  seqs 1–7, 37–64 and 81–88, 187–195, 211–216. Copy the `ledger.json` rows for the same seqs.
  Add `"source"` naming the run id.
- [x] T011 Add `apps/server/test/dm/narration-quality-repro.test.ts`. Use the fixture with the
  existing world helpers in `test/dm/helpers.ts` and `world.ts`.
- [x] T012 [P] In T011's file, test F23: facts for seq 88 (Kestrel `no-effect`, encounter ended,
  mode to free) give exactly "Kestrel acts, and nothing changes. The fight is over.". Test seq 53:
  the output holds "One action needs a clearer description.".
- [x] T013 [P] In T011's file, test the leaks: the narrate system prompt holds "river things";
  the narrate prompt for the `reed-camp` beat holds Snag's `want` with "river-things"; Odo's
  companion prompt holds "wards".
- [x] T014 [P] In T011's file, test F17: `factEntries` for the Goblin-3 NPC turn (rows 60–61)
  does not hold "jabs". Test F76: `transcriptEntries` for row 187 holds the seat's user id and not
  "Tamsin".
- [x] T015 [P] In T011's file, test A3 and A4: the narrate prompt for a clarify with the run-5
  question "Walk past the standoff to the ferry, or do something about Snag's terms first?" holds
  that question verbatim; prose ending with it fails `deterministicChecks` with the option-menu
  issue; a scripted `dm.audit` reply with only `doctrine` issues three times ships the fallback.
- [x] T016 Run the phase gate and the database suites. Commit "reproduce run-5 defects". Push.

**Checkpoint**: every defect reproduced on the unfixed code. Later phases flip these tests.

---

## Phase 2: Player-facing context (US1; AC #1, #3) — DISPATCH (sonnet)

Contract: `contracts/player-facing-context.md`.

- [x] T017 [US1] Apply the four seed edits to `apps/server/seeds/greyhollow-ford.json`. Confirm
  the seed loads (`seed.test.ts`).
- [x] T018 [US1] Set the `villains-believe` example in `apps/server/src/dm/doctrine/doctrine.ts`.
  Set `dm.director-v2` in `prompts/director.ts`. Update `doctrine.test.ts` and every director
  version assertion.
- [x] T019 [US1] Add `transcriptEntries(tail, roster?)` naming and public filtering in
  `prompts/common.ts`. Pass the roster from narrate, companion and chronicle. Set
  `dm.chronicle-v2`. Director and interpret call it without a roster.
- [x] T020 [US1] Add `apps/server/src/dm/seed/views.ts`. Make `buildNarratePrompt`,
  `buildNarrationFacts` (`presentNpcs`) and `buildCompanionPrompt` take `PlayerSeedView`. Set
  `dm.companion-v2`. Add `apps/server/test/dm/player-facing-prompts.test.ts` (contract tests
  1–7).
- [x] T021 [P] [US1] In `seed.test.ts`, add the authoring-rule test (no player-facing field
  matches `/river[- ]things?/i` or `/\bwards?\b/i`). Add `dmOnlySeedText` unit tests.
- [x] T022 [P] [US1] Flip T013 and T014's F76 part to the fixed behaviour. Test chronicle,
  companion and narrate lines name "Tamsin Vale" and drop a `dm` entry.
- [x] T023 Run the phase gate and the database suites. Commit. Push.

**Checkpoint**: AC #1 met offline.

---

## Phase 3: Facts and fallback (US2; AC #2, #3) — DISPATCH (sonnet)

Contracts: `contracts/narration-facts.md` (facts part), `contracts/fallback-summary.md`.

- [x] T024 [US2] In `apps/server/src/dm/facts.ts`, add `party`, `npcNames`, `events`,
  `setting` and `FactRoll.target`. Build events from public appended rows only. Render rolls,
  events, "no rules effect" and "on hold" in `factEntries`.
- [x] T025 [US2] Rewrite `apps/server/src/dm/fallback.ts` per the contract. Keep the signature.
- [x] T026 [US2] Add `apps/server/test/dm/fallback.test.ts` (contract tests 1–4). Move the old
  `factualSummary` cases out of `audit.test.ts`. Flip T012 and T014's F17 part.
- [x] T027 [P] [US2] In `facts.test.ts`, add the facts tests from `contracts/narration-facts.md`.
- [x] T028 Run the phase gate and the database suites. Commit. Push.

**Checkpoint**: AC #2 met.

---

## Phase 4: Narrate and audit v2 (US3; AC #3) — DISPATCH (sonnet)

Contracts: `contracts/narration-facts.md` (prompt part), `contracts/audit-criteria.md`.

- [x] T030 [US3] In `prompts/narrate.ts`, apply narrate prompt v2. Set `dm.narrate-v2`.
- [x] T031 [US3] In `prompts/audit.ts`, apply audit prompt v2. Set `dm.audit-v2`.
- [x] T032 [US3] In `nodes/audit.ts` and `audit-words.ts`: blocking and advisory issues, the
  code-derived result, blocking-only regeneration, the clarify check, quoted details, `words`
  per attempt, the `[advisory]` journal marker.
- [x] T033 [US3] In `audit.test.ts` and `audit.integration.test.ts`, add the contract tests.
  Flip T015. Check every script under `test/dm/scripts/` still matches its call sequence.
- [x] T034 [P] [US3] In `narrate.test.ts`, add the prompt v2 tests. Add an audit prompt test for
  the party section and the five statements.
- [x] T035 Run the phase gate and the database suites. Commit. Push the branch.

**Checkpoint**: AC #3 met offline. The branch is ready for the paid run.

---

## Phase 5: Verification run (US4; AC #4) — ORCHESTRATOR-RUN, PAID — RUN, FAILED, SUPERSEDED BY 5b

Run 2026-10-26 as `20261026T183818Z-greyhollow-ford-provider` (evidence commit `ed46cec`). The
run failed AC #4: rate 0.35, 3 `ledger-contradiction` fails. Phase 5b supersedes it. The ticks
below record what ran, not a pass.

- [x] T036 Orchestrator: build the composite worktree (quickstart A) and run the pre-run checks
  (quickstart B). Record the seat-fallback selector on the card.
- [x] T037 Orchestrator: get the operator's spend ceiling. Record it on the card. ($22.)
- [x] T038 Orchestrator: run the verification (quickstart C). Commit the evidence directory.
  Record the rate, fail counts, spend and pass or fail on the card. (FAIL.)
- [x] T039 Orchestrator: on a fail, or on a fail of another kind, write the classification
  (quickstart C11), commit it, and stop for an operator ruling. Do not start Phase 6.
  (`classification.md`; operator approved E2 and E3 on 2026-10-26.)

**Checkpoint**: AC #4 NOT met. Continue at Phase 4b.

---

## Phase 4b: Party-name filter and narrate v3 (US3; AC #3) — DISPATCH (sonnet)

Contracts: `contracts/audit-criteria.md` ("The party-name filter"),
`contracts/narration-facts.md` ("Narrate prompt v3"). Evidence: research.md R7.2, R7.3.

- [x] T048 [US3] In `nodes/audit.ts`, add the party-name filter. A `dm.audit` `player-agency`
  issue blocks only when its detail holds a party-name term from `facts.party`. Keep every other
  kind's blocking rule. Keep `dm.audit-v2`. Put the term builder and matcher in one exported
  function so tests call it directly.
- [x] T049 [P] [US3] In `audit.test.ts`, add the filter's unit-test table and node tests from
  `contracts/audit-criteria.md`. Quote the verify-run details verbatim.
- [x] T050 [US3] In `prompts/narrate.ts`, add the narrate v3 rule after the "No rules effect"
  rule. Set `dm.narrate-v3`.
- [x] T051 [P] [US3] In `narrate.test.ts`, add the narrate v3 tests from
  `contracts/narration-facts.md`. Update the `dm.narrate-v2` assertion to `dm.narrate-v3`.
- [x] T052 Check every script under `test/dm/scripts/` still matches its call sequence. Run the
  phase gate and the database suites. Commit. Push the branch.

**Checkpoint**: E2 and E3 met offline. The branch is ready for the Phase 5b rerun.

---

## Phase 5b: Verification rerun (US4; AC #4) — ORCHESTRATOR-RUN, PAID

Ceiling: pending operator approval. The estimate's upper bound is $23.40 with narrate
maxTokens 1500, so a $22 ceiling refuses to start.

- [ ] T053 Orchestrator: confirm `dm.narrate` maxTokens is 1500 in the provider configuration
  (research.md R7.1). Record it on the card.
- [ ] T054 Orchestrator: get the operator's rulings on F4, F32 and F54 (research.md R7.5) and on
  the E2 residual (R7.2). Record each ruling on the card.
- [ ] T055 Orchestrator: get the operator's spend ceiling. Record it on the card.
- [ ] T056 Orchestrator: rebuild the composite worktree from the Phase 4b tip (quickstart A5,
  B, C12). Record the composite commit and the selector on the card.
- [ ] T057 Orchestrator: run the verification (quickstart C with C12). Commit the evidence
  directory. Record the rate, fail counts, spend and pass or fail on the card. On a fail, write
  the classification (quickstart C11), commit it, and stop for an operator ruling. Do not start
  Phase 6.

**Checkpoint**: AC #4 met.

---

## Phase 6: Full gate (US5; AC #5) — after Phase 5b passes

- [ ] T040 [US5] DISPATCH: run `pnpm ci:check` and the database suites with
  `REQUIRE_DATABASE=1`. Fix any regression without loosening a test.
- [ ] T041 [P] [US5] DISPATCH: add "Amended by specs/034-narration-quality/contracts/audit-criteria.md."
  under "The loop", "Deterministic checks", "The audit call (`dm.audit`)" and "The audit record"
  in `specs/031-dm-runtime/contracts/audit.md`.
- [ ] T042 [P] [US5] DISPATCH: add "Amended by specs/034-narration-quality/contracts/fallback-summary.md."
  under "The factual summary (fallback)" in `specs/031-dm-runtime/contracts/audit.md`.
- [ ] T043 [P] [US5] DISPATCH: add "Amended by specs/034-narration-quality/contracts/narration-facts.md."
  under "narrate (`dm.narrate`)" in `specs/031-dm-runtime/contracts/nodes.md`.
- [ ] T044 [P] [US5] DISPATCH: add "Amended by specs/034-narration-quality/contracts/player-facing-context.md."
  under "Schema" and "The shipped seed" in `specs/031-dm-runtime/contracts/scene-seed.md`, under
  "One companion's play" and "Chronicle" in `companions.md`, and under the `villains-believe` row
  in `doctrine.md`. Commit.
- [ ] T045 Orchestrator: run the scripted CI playtest in the composite worktree (quickstart D).
  Record it on the card.
- [ ] T046 Orchestrator: tear down the composite worktree (quickstart E).
- [ ] T047 Orchestrator: after merge, re-ground `docs/wiki/dm-runtime.md` and
  `dm-failure-and-gates.md` (`/grounding-wiki:wiki-update`).

**Checkpoint**: AC #5 met. The task is ready for PR.

---

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5 (failed) → 4b → 5b → 6. No phase overlaps. Phase 3 needs Phase 2's
view (`setting`, `presentNpcs`). Phase 4 needs Phase 3's facts. Phase 4b needs Phase 4's audit
node and narrate v2. Phases 5 and 5b each need their own operator-approved ceiling. Phase 6
needs a Phase 5b pass.
Within a phase, `[P]` tasks touch separate files.

## Notes

- `AuditModelOutput` does not change. The audit record gains `words` and per-issue `blocking`.
- Interpret and adjudicate prompts do not change. Audit stays `dm.audit-v2` through Phase 4b.
- The playtest auditor (TASK-0048) does not change. F77 is recorded as its observation.
- No migration. No new dependency.
