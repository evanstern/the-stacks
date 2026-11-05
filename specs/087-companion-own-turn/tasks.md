# Tasks: A companion acts in its own turn

**Input**: `specs/087-companion-own-turn/` (spec.md, plan.md). Plan research R1 to R6 and design D1
to D6 settle every choice; read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Before Phase 1**: merge `origin/main` into the branch. Read the current `dm.narrate` version on
main; "next version" means one past it.

**Sequencing**:
- Phase 1 touches no `facts.ts` and may start now.
- **Phase 2 edits `facts.ts` and starts only after TASK-0242 has merged** (runbook spine #1). Confirm
  with `git merge-base --is-ancestor bef9c4d5 HEAD` after merging `origin/main`. If it fails, stop
  and report.
- TASK-0238 follows this task on `plan-gate.ts`, `resolve.ts` and `facts.ts`. Do not start it here.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first.
`pnpm ci:check` is green before the phase commits. Phase 3 needs `pnpm env:up` and
`TEST_DATABASE_URL="$(sed -n 's/^TEST_DATABASE_URL=//p' .env)"`; never `export $(grep ...)`. No paid
model run.

**Scope rule**: do not edit `fallback.ts`, `floor-state.ts`, `floor.ts`, `enqueue.ts`,
`companion.ts`, `prompts/audit.ts`, `packages/session-model` or `packages/dnd5e-engine`. If a task
seems to need one, stop and report.

## Phase 1: Hold or refuse in the plan gate and resolve (US1; FR-001 to FR-005)

**Goal**: a party group whose only step actor is an off-turn AI companion is held; a mixed group is
refused; the held group is released on the companion's turn.

**Independent test**: `plan-gate.test.ts` passes with the new cases; existing resolve tests pass.

- [x] T001 [US1] In `apps/server/src/dm/gates/plan-gate.ts`, apply plan D1: `off-turn` reason,
      `TURN_HELD_CODE`, the held `PlanVerdict` variant, exported `stepActors`, the held/refused
      check in `checkPlan` after `foreignActor`, and the `ponytail:` comment.
- [x] T002 [US1] In `apps/server/src/dm/nodes/resolve.ts`, apply plan D2: the `held` outcome,
      `heldFor` and `stepActors` on action results, and the early return in `resolveAction`.
- [x] T003 [US1] In `apps/server/src/dm/nodes/resolve.ts`, apply plan D3: the `held` exclusion and
      the release clause in the turn-advance test, the `held` next job, and both `ponytail:`
      comments.
- [x] T004 [US1] In `apps/server/src/dm/jobs.ts`, add the `held` trigger (plan D4). In
      `apps/server/src/dm/worker.ts`, enqueue `next.trigger`.
- [x] T005 [US1] In `apps/server/test/dm/plan-gate.test.ts`, add a `describe("checkPlan turn hold
      (TASK-0244)")` with: held for an off-turn companion caster; held when the companion is active
      but has its own character group; not held for the active companion with no own group; not
      held in free mode; not held for a downed companion; refused `STEP_ACTOR_MISMATCH` reason
      `off-turn` for a companion plus another actor; human-only party group unchanged.

**Checkpoint**: `pnpm ci:check` green. Commit `TASK-0244 phase 1: hold a party action for the
companion's turn`.

## Phase 2: Facts and the waiting line (US1, US2; FR-006 to FR-010)

**Starts after TASK-0242 has merged into the branch (see Sequencing).**

**Goal**: an actor whose step ran is never off turn; a held group is a waiting line, never an Action
line.

**Independent test**: `facts.test.ts` and `narrate.test.ts` pass with the new cases.

- [ ] T006 [US2] In `apps/server/src/dm/facts.ts`, apply plan D5: `NarrationFacts.held`, the held
      branch in the actions loop, and the step actors in `onTurn`.
- [ ] T007 [US1] In `apps/server/src/dm/prompts/narrate.ts`, apply plan D6: the `Waiting:` line in
      `factEntries`, bump `PROMPT_VERSION`.
- [ ] T008 [US2] In `apps/server/test/dm/facts.test.ts`, add the AC #2 cases (spec US2 scenarios
      1-3): a party group with caster Odo and a healing roll on Tamsin leaves Brother Odo off
      `turn.offTurn`; a held group keeps Odo on it and yields one `held` entry and no action; a
      plan-refused group adds no step actor.
- [ ] T009 [US1] In `apps/server/test/dm/narrate.test.ts`, update the version pin and assert the
      `Waiting:` line for a held entry.

**Checkpoint**: `pnpm ci:check` green. Commit `TASK-0244 phase 2: step actors on turn, held
waiting line`.

## Phase 3: Replay seq 206-230 and contracts (US1; card AC #1, FR-011)

**Goal**: the run 1 path replays with Odo acting once in round 2.

**Independent test**: `companion-own-turn.integration.test.ts` passes against the test database.

- [ ] T010 [US1] Create `apps/server/test/dm/companion-own-turn.integration.test.ts` per the plan
      "Replay" table (steps 1-7 and the R3 case). Header names finding 40, seq 206-230, session
      `729a6c5c`, seed `greyhollow-ford`, and that rows are rebuilt from the log.
- [ ] T011 Amend the four contract files the plan "Contracts" section lists.

**Checkpoint**: `pnpm ci:check` green and the replay passes with `TEST_DATABASE_URL` set. Commit
`TASK-0244 phase 3: replay seq 206-230; contract amendments`.

## Phase 4: Wiki re-ground

**Goal**: the notes that pin the touched files describe the new behaviour and are re-pinned
honestly.

- [ ] T012 Run `/grounding-wiki:wiki-update`. Review, as NEEDS-REVIEW, `docs/wiki/turn-floor.md`,
      `docs/wiki/dm-failure-and-gates.md` and `docs/wiki/dm-runtime.md` (runbook list), plus
      `docs/wiki/dm-turn-jobs.md` (the `held` trigger, `worker.ts`) and
      `docs/wiki/dm-narration-quality.md` (`facts.ts`, `prompts/narrate.ts`).
- [ ] T013 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` for the held party action.
- [ ] T014 Run the grounding-wiki freshness gate and the spec-bridge check; both pass.

**Checkpoint**: `pnpm ci:check` green, freshness `OK`. Commit `TASK-0244 phase 4: wiki re-ground`.

## After merge (orchestrator, not a phase)

- Runbook B2 playtest row "Companion in a party action" measures SC-004.
- OQ-2 (a human PC named off turn): the orchestrator decides whether to card it.
