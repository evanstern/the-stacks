---
description: "Task list for the encounter-ending action resolve order (TASK-0110, decision-0025 §4)"
---

# Tasks: An encounter-ending action resolves before the encounter ends

**Input**: `specs/045-encounter-end-resolves/` — spec.md, plan.md. Binding: decision-0025 §4;
the contracts in `specs/031-dm-runtime/contracts/` as amended by Phase 1.

**Tests**: required. Each card AC is proven by a named test or artifact (spec.md "Card
acceptance criteria mapping").

**Dispatch unit**: each phase is one implementer dispatch (sonnet). Run phases in order:
1, 2, 3, 4. Phases 2 and 3 both run the DB suites; never run them in parallel.

**Gate for every code phase** (run before the phase's last commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/server test && pnpm check:boundaries`.
Phases 2 and 3 also run the DB suites. Phase 3 also runs `pnpm ci:check`.

**Database suites**: run on the worktree's own stack. Run `pnpm env:up`. Migrate both
databases by hand (fresh stacks come up unmigrated, TASK-0098). Restart the app. Export only
`TEST_DATABASE_URL` from the worktree `.env`. Run the suites with `REQUIRE_DATABASE=1`. Leave
the stack up; the orchestrator runs `pnpm env:down`.

**Known flakes**: the WebSocket gateway integration tests flake; DB scene and playtest tests can
hit the 5 s timeout under full-suite load (TASK-0154). Re-run once. Do not fix them. Record each
re-run in the phase's commit message.

**Rules for every phase**:
- Follow the amended contracts exactly. A needed deviation is a STOP: report it.
- Change no submission key, proposal kind, proposer, marker form or reason text.
- Change no prompt, `PROMPT_VERSION`, gateway purpose, model call count or call order.
- Touch no package under `packages/`. Add no event type, frame, proposal kind, migration or
  dependency.
- Tests use the fake gateway and scripted dice. No paid run.
- No "for now" without a card (decision-0020). Report any deferral as an open question.

**Commits**: one or more per phase, each message led by `TASK-0110:` and ending with the
Co-Authored-By trailer.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: The resolve order in the contracts (US4, AC #2)

**Goal**: the turn-jobs, resolve and director contracts state one resolve order, citing
decision-0025 §4. No code changes.

**Independent test**: a reader of the three files finds the same six-group order and the same
encounter-start exception.

- [x] T001 [US4] Add the section "Resolve order (decision-0025 §4)" after "Beats" in `specs/031-dm-runtime/contracts/turn-jobs.md`: the six groups of plan.md "Group order" in order; why encounter start and scene-start setup are opening moves (actions name the combatants they add; D17 §2.5 passes encounter start); hold runs opening then closing moves only; the empty batch-gate slot between closing moves and S1 (TASK-0147); the amendment of decision-0017; the reclaim note of spec OQ-2 option (a) with the window stated
- [x] T002 [P] [US4] Rewrite "Order of work" in `specs/031-dm-runtime/contracts/resolve.md` to the six groups and the hold rule; link the turn-jobs section; update the "Proposal kinds resolve uses" row that names the Director group so it names opening and closing moves
- [x] T003 [P] [US4] In `specs/031-dm-runtime/contracts/director.md` "Decision → proposals", name each decision's group (scene start and `turn`: opening; tracker advance, `free`, scene `end`: closing); in "Holding a beat" step 1, say the runner applies the opening and then the closing moves
- [x] T004 Cross-read the three files for one order and one vocabulary ("opening moves", "closing moves"); commit

**Checkpoint**: AC #2's artifact exists. The code still runs the old order.

---

## Phase 2: Resolve runs the new order (US1, US2, US3)

**Goal**: `resolve` runs opening moves, rulings, actions, NPC, closing moves, turn advance,
with resolve-level tests that pin each order by row seq.

**Independent test**: the six new resolve tests pass; every existing DM test passes.

- [x] T005 [US1] In `apps/server/src/dm/nodes/resolve.ts`, split `directorGroup` into `directorOpening` (scene-start setup with its early return; the `turn` decision) and `directorClosing` (tracker advances; the `free` decision; scene end), sharing the `endEncounter` and `setMode` helpers; move code only
- [x] T006 [US1] In the `resolve` node body, call `directorOpening`, then (unless hold) the ruling, action and NPC groups, then `directorClosing`, then (unless hold) the unchanged turn advance block; on scene start skip the closing moves exactly as today; update the module and `Local` doc comments to name the order and cite decision-0025 §4
- [x] T007 [P] [US1] Test in `apps/server/test/dm/resolve.integration.test.ts`: in turn mode, a committed check plus a `free` decision gives `action.resolved` (applied) < `encounter.ended` < `table-mode.changed` (free) by seq, and no `turn.advanced`
- [x] T008 [P] [US2] Test: in free mode, a committed attack on `goblin-2` plus a `turn` decision for `reed-camp` gives `combatant.added` and `encounter.started` before the attack's rows, no `UNKNOWN_COMBATANT`, and no turn advance
- [x] T009 [P] [US3] Test: an `npc-turn` job plus a `free` decision gives the NPC step rows before `encounter.ended`
- [x] T010 [P] [US3] Test: a committed action plus a tracker advance and a scene end gives `action.resolved` < `tracker.changed` (advance) < `encounter.ended` < `scene.changed` (after null)
- [x] T011 [P] [US3] Test: hold runs the opening and closing moves only; no `act:` or `npc:` submission is recorded
- [x] T012 [P] [US1] Test: a reading whose first step names `pell` (no engine combatant) resolves `refused` with `UNKNOWN_COMBATANT`, and its `action.resolved` precedes `encounter.ended`; name TASK-0112 AC #5 in the test comment as the card that will refuse the plan
- [x] T013 Run every existing test in `resolve.integration.test.ts`, `resolve.human-seat.integration.test.ts`, `reclaim.integration.test.ts`, `beat.integration.test.ts`, `scene.integration.test.ts` and `full-turn.integration.test.ts`; change only an assertion that encodes the old order, and list each such change in the commit message
- [x] T014 Run the phase gate with the DB suites and commit

**Checkpoint**: the order is code. AC #1 still needs its end-to-end reproduction.

---

## Phase 3: Reproduce rows 260–265 end to end (US1, AC #1)

**Goal**: a test replays the F54 turn through the real worker, queue, gate and engine with the
fake gateway and scripted dice, and the bargain resolves `applied` before the encounter ends.

**Independent test**: the new test passes; it would fail on the pre-Phase-2 order (verify by reasoning
from the order, not by reverting).

- [x] T015 [US1] Create `apps/server/test/dm/scripts/encounter-end-bargain.json` in the format of `exploration-check.json`: dice that put Odo first to act in `reed-camp` (or a short scripted run of turns that reaches him) and a successful Persuasion d20; `dm.director` calls (the encounter start, then `tableMode: { to: "free" }` with row 262's reason text), `dm.interpret` (one reading for `act-odo-5`: intent `check`, a `check` step by `odo`, skill `persuasion`, ability `cha`, a DC, empty effect lists), `dm.narrate` digit-free prose that mentions no refusal, `dm.audit` pass, and `dm.chronicle` with empty entries
- [x] T016 [US1] Create `apps/server/test/dm/encounter-end-resolves.integration.test.ts` in the pattern of `full-turn.integration.test.ts`: start the scene; reach turn mode with Odo active; commit Odo's bargain as `act-odo-5` from `ai:companion:odo` with authority `active-player` (add a helper to `apps/server/test/dm/world.ts` only if none fits); drain the worker; the doc comment cites `specs/034-narration-quality/evidence/verify-20261026T183818Z-greyhollow-ford-provider/` rows 260–265 and F54
- [x] T017 [US1] Assert in that test: `act-odo-5` resolved `applied` with at least one batch id; seq order `action.committed` < the check rows < `action.resolved` < `encounter.ended` < `table-mode.changed` (free) < `narration`; no `turn.advanced` after `encounter.ended`; the shipped narration does not contain "cannot do that here"; the table ends in free mode; the turn job succeeded
- [x] T018 Run the phase gate with the DB suites and `pnpm ci:check`; commit

**Checkpoint**: AC #1's test exists and passes.

---

## Phase 4: Wiki re-ground

**Goal**: the grounding wiki describes the new resolve order and every staled pin is honest.

Classify each staled pin against `git diff <old-pin>..HEAD -- <sources>` as RE-PIN-ONLY or
NEEDS-REVIEW. Amend prose before bumping a NEEDS-REVIEW pin.

- [ ] T019 [P] NEEDS-REVIEW `docs/wiki/dm-runtime.md`: the resolve group order (opening moves, rulings, actions, NPC, closing moves, turn advance), why encounter start is an opening move, and the batch-gate slot for TASK-0147; cite decision-0025 §4; check the `description:` still holds
- [ ] T020 [P] NEEDS-REVIEW `docs/wiki/dm-turn-jobs.md`: the new "Resolve order" section of the turn-jobs contract and the reclaim note (marker count versus order across a deploy)
- [ ] T021 [P] Review `docs/wiki/dm-failure-and-gates.md`: a refused action now resolves before a Director stage change; the plan gate stays TASK-0112's; re-pin RE-PIN-ONLY if its sources did not change, else amend
- [ ] T022 [P] Review `docs/wiki/dnd5e-engine.md`: no engine change; record if useful that `encounter.end` keeps combatants (it is why the refusal in rows 260–265 was not the encounter end); re-pin RE-PIN-ONLY if its sources did not change
- [ ] T023 Update the state paragraph of `docs/wiki/INDEX.md` with one clause for TASK-0110; regenerate `docs/wiki/CAPSULES.md` if any `description:` changed
- [ ] T024 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` (prints `OK`) and `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` (exits 0); commit

---

## Constitution Compliance (the-stacks)

- [ ] T025 Principle I: the order is proven through the real worker with a scripted agent (T016–T017), not only at node level
- [ ] T026 Principle IV: no event type added; `resolve.ts` stays the only DM gate writer (`test/dm/boundary.test.ts` passes)
- [ ] T027 Principle VI: no engine change; every outcome assertion runs on scripted dice (T007–T012, T017)

## Dependencies & Execution Order

- Phase 1 has no dependency.
- Phase 2 depends on Phase 1 (the contract it implements).
- Phase 3 depends on Phase 2 (the order it reproduces).
- Phase 4 depends on Phase 3 (the final code to re-pin against).
- Within a phase, `[P]` tasks touch different files or independent test cases and may run in
  any order.

## Implementation Strategy

Phase 1 makes AC #2 true and gives Phase 2 a contract to follow. Phase 2 is the fix. Phase 3
is AC #1's artifact. Phase 4 re-grounds. The card's PR opens only after Phase 4.
