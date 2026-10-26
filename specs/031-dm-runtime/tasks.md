---
description: "Task list for the DM runtime (TASK-0046)"
---

# Tasks: First Scene — DM runtime (turn jobs, pipeline nodes, Director, companions)

**Input**: `specs/031-dm-runtime/` — spec.md, plan.md, research.md, data-model.md,
quickstart.md, data/greyhollow-ford.seed.json, contracts/ (node-seam, nodes, resolve,
director, audit, turn-jobs, companions, purposes, scene-seed, fake-gateway-script, doctrine,
dm-api).

**Tests**: required. Every card AC is proven by a named test below. Write each phase's tests
with its code. A phase is not done until they pass.

**Dispatch unit**: each phase is one implementer dispatch. Run phases in order; each builds
on the previous phase's files. Re-ground each dispatch from this spec dir and the branch's
commits.

**Gate for every phase** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/server test && pnpm check:boundaries`.
The server test run includes the database suites (below). Phase 6 runs `pnpm ci:check`.

**Database suites**: run on the worktree's own stack. Run `pnpm env:up`. Run
`pnpm --filter @the-stacks/server db:migrate` (TASK-0098: a fresh stack may come up
unmigrated; re-run it after Phase 1 adds `0004`). Run the suites with `REQUIRE_DATABASE=1`.
Leave the stack up between phases; the orchestrator runs `pnpm env:down` before removing the
worktree.

**Known flake**: the WebSocket gateway integration tests flake. On a WebSocket failure
unrelated to the phase's change, re-run the suite. Do not fix the flake. Record each re-run in
the phase's commit message.

**Model calls**: tests use the fake gateway only. A real-provider run is an operator
checkpoint (cost): stop and report with the provider, model list and an estimate. Never set,
read or commit an API key.

**Commit rule**: one or more commits per phase, message led by `TASK-0046:`, ending with the
`Co-Authored-By` trailer. Tick each task here (`- [x]`) in the commit that completes it. Use
the `backlog` CLI inside the worktree for any card change; never the backlog MCP tools.

**Out of scope** (do not touch): `apps/web` (TASK-0047); `packages/session-model` and
`packages/dnd5e-engine` (contracts are fixed; a needed change is a STOP); the gate's
behaviour in `apps/server/src/gate/`; the `events` table.

**STOP conditions**: a new npm dependency; a change to a session-model, gate or engine
contract (a new event type, proposal kind or refusal code); a frame-shape change; any
deferral not listed in plan.md "Deferrals". Stop and report.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 honest turn, US2 audit, US3 Director, US4 beat queue, US5 companions, US6
  adjudicate, US7 chronicle, US8 reclaim (spec.md).

## AC coverage map

| Card AC | Proving test (phase) |
|---|---|
| #1 turn job on the queue; claim, lease, fencing | `test/dm/jobs.integration.test.ts` (P1); `test/dm/reclaim.integration.test.ts` (P6) |
| #2 node order | `test/dm/runner.test.ts` (P3); `test/dm/full-turn.integration.test.ts` (P6) |
| #3 plain async nodes | `test/dm/runner.test.ts` seam assertions (P3) |
| #4 one purpose per call | `test/dm/full-turn.integration.test.ts` purpose assertion (P6) |
| #5 resolve is the only writer | `test/dm/boundary.test.ts` (P5); `test/write-boundary.test.ts` (P5); `test/dm/resolve.integration.test.ts` (P4) |
| #6 narrate gets facts only | `test/dm/narrate.test.ts` import and input assertions (P4) |
| #7 audit regenerates and flags | `test/dm/audit.test.ts`, `test/dm/audit.integration.test.ts` (P4) |
| #8 Director | `test/dm/resolve.integration.test.ts` Director group (P4); `test/dm/scene.integration.test.ts` (P6) |
| #9 commits wait for the next beat | `test/dm/jobs.integration.test.ts` (P1); `test/dm/beat.integration.test.ts` (P6) |
| #10 companions through the gate | `test/dm/companion.integration.test.ts` (P5) |
| #11 cited ruling | `test/dm/adjudicate.integration.test.ts` (P3) |
| #12 chronicle off the hot path | `test/dm/chronicle.integration.test.ts` (P5) |
| #13 Zod-validated seed | `test/dm/seed.test.ts` (P2) |
| #14 doctrine MIT notice | `test/dm/doctrine.test.ts` (P2) |
| #15 full turn, fake gateway, scripted dice | `test/dm/full-turn.integration.test.ts` (P6, merge condition) |

All test paths are under `apps/server/`.

## Phase 1: The jobs queue for DM jobs (US4, US8; AC #1, #9)

**Goal**: the queue holds, claims and fences turn, companion and chronicle jobs, one acting
job per session, without disturbing ingestion. Contract: contracts/turn-jobs.md.

- [x] T001 Update `apps/server/src/schema/jobs.ts`: kinds, stages, nullable `book` with its CHECK, `session_id` with its CHECK, `jobs_active_book_key` scoped to `ingest`, the three partial unique indexes and `jobs_dm_session_idx`.
- [x] T002 Generate migration `0004` with `pnpm --filter @the-stacks/server db:generate`; review the SQL; apply it to the worktree stack.
- [x] T003 Create `apps/server/src/jobs/queue.ts` with kind-generic fenced `heartbeat`, `setStage`, `saveResult` and `finishJob` (filter on `id` and `claim_token`).
- [x] T004 Update `apps/server/src/library/ingest/jobs.ts`: add `kind = 'ingest'` to `claimJob`, `listJobs` and `getJob`; delegate fenced writes to `jobs/queue.ts`; keep every exported name and signature.
- [x] T005 Create `apps/server/src/dm/jobs.ts`: the input schemas, `claimDmJob` (priority, per-session `NOT EXISTS`, unique-violation → null, abandoned after `MAX_ATTEMPTS`), `enqueueTurn`, `enqueueTurnForced`, `enqueueCompanion`, `enqueueChronicle`, `saveCheckpoint`, `loadCheckpoint`, `reconcileTurnJobs`, `listDmJobs`.
- [x] T006 [P] Write `test/dm/jobs.integration.test.ts`: one queued turn per session under 20 concurrent commits; a queued turn is not claimable while a turn or companion job runs for its session; priority order; a lease expiry reclaims with a new token and attempts+1; a stale token's writes return false; attempts > 3 fails the job; `enqueueTurnForced` inserts or flips the flag; reconcile enqueues only sessions with an unanswered commit.
- [x] T007 [P] Extend `test/library/jobs.integration.test.ts`: the ingest claim never returns a DM job; `listJobs` and `getJob` never return one.
- [x] T008 Run the ingestion suites (`library/jobs`, `library/worker`, `library/uploads`) unchanged and green.

**Checkpoint**: the queue is ready; no DM code runs yet.

## Phase 2: Seed, doctrine, purposes and scripts (US1, US3; AC #4, #13, #14, #15)

**Goal**: the data and the test harness every node needs. Contracts: scene-seed.md,
doctrine.md, purposes.md, fake-gateway-script.md.

- [x] T010 Add `"@the-stacks/srd": "workspace:*"` to `apps/server/package.json` and the project reference in `apps/server/tsconfig.json`; run `pnpm install`.
- [x] T011 Create `apps/server/src/dm/seed/schema.ts` and `load.ts` per scene-seed.md, including every cross-check and the `SeedError` issue list.
- [x] T012 Create `apps/server/src/dm/seed/combatants.ts` (`combatantFromSrd`).
- [x] T013 Copy `specs/031-dm-runtime/data/greyhollow-ford.seed.json` to `apps/server/seeds/greyhollow-ford.json` unchanged.
- [x] T014 [P] Write `test/dm/seed.test.ts`: the shipped seed loads; each cross-check fails with a named issue on a mutated copy; the `combatantFromSrd` snapshots for `goblin-warrior` and `goblin-minion`; the seed header says original plus SRD.
- [x] T015 Create `apps/server/src/dm/doctrine/doctrine.ts` (the 24 pairs, `DOCTRINE_NOTICE`, header) and `NOTICE.md` (the sentence plus the full MIT text with `Copyright (c) 2026 Brad Bush`).
- [x] T016 [P] Write `test/dm/doctrine.test.ts` per doctrine.md's four guard rules (rule 3 runs over `dm/prompts/` once Phase 3 adds it; write it now so it passes vacuously and binds later).
- [x] T017 Create `apps/server/src/dm/purposes.ts`.
- [x] T018 Extend `apps/server/src/ai/adapters/fake.ts` with `scriptChatFor` and `strict`; add tests to `test/ai.gateway.test.ts` (purpose queue precedence, strict failure, existing behaviour unchanged).
- [x] T019 Create `apps/server/src/dm/script/schema.ts` and `load.ts` (`DmScriptSchema`, `loadDmScript`, `createScriptedDm`, `remaining()`); write `test/dm/script.test.ts`.
- [x] T020 [P] Update `.env.example` with a commented `AI_PURPOSES` example naming the seven `dm.*` purposes; update the `Dockerfile` to copy `apps/server/seeds/` and `dm/doctrine/NOTICE.md` into the runtime stage.

**Checkpoint**: seed, doctrine and scripts load and are guarded.

## Phase 3: Node seam and the planning nodes (US1, US3, US6; AC #2, #3, #11)

**Goal**: the runner and every node before resolve. Contracts: node-seam.md, nodes.md,
director.md.

- [x] T030 Create `apps/server/src/dm/pipeline/context.ts`, `runner.ts`, `call.ts` (`TurnContext`, `NodeResult`, `runTurn`, `callJson`, `callText`) per node-seam.md, including the throwing gate stub for non-resolve nodes.
- [x] T031 Create the prompt builders in `apps/server/src/dm/prompts/` (one per purpose, each with a `PROMPT_VERSION`, the notice header where doctrine is used, and the token caps from nodes.md).
- [x] T032 Create `apps/server/src/dm/nodes/schemas.ts` (`DirectorOutput`, `InterpretOutput`, `StepSchema`, `Effect`, `AdjudicateModelOutput`).
- [x] T033 Create `nodes/assemble.ts` (beat freeze, checkpoint beat, twice-rejected skip, state-derived `npcTurn`, SRD compact selection, `priorSteps`).
- [x] T034 Create `nodes/director.ts` and the legality rules from director.md (overrides recorded).
- [x] T035 Create `nodes/interpret.ts` (one reading per beat item; mismatch → `invalid-output`).
- [x] T036 Create `nodes/adjudicate.ts` (one `retrieve` per adjudicated action, `isRelevant`, numbered passages, `locateQuote` verification, SRD citation checks, `improvised`).
- [x] T037 [P] Write `test/dm/runner.test.ts`: node order; adjudicate skipped without a flagged reading; checkpoint reuse skips calls; fence `false` stops before the next node; a thrown node becomes `internal`; `empty-beat` makes no call; each node is a plain async function of one argument.
- [x] T038 [P] Write `test/dm/call.test.ts`: fenced JSON parsed; one repair re-ask; second failure → `invalid-output`; gateway error kinds pass through.
- [x] T039 [P] Write `test/dm/assemble.test.ts` over session-model fixtures (pure `project`): beat order by commit seq; resolved-but-unnarrated included; frozen beat on attempt 2; `npcTurn` derivation; prompt parts under their caps.
- [x] T040 [P] Write `test/dm/director.test.ts`: each illegal decision is overridden as director.md states; `forceResolve` overrides a hold.
- [x] T041 Write `test/dm/adjudicate.integration.test.ts` (DB): ingest a fixture book, script `dm.adjudicate`, assert a verified library citation with its anchor; an unverifiable quote is dropped and the ruling is `improvised`; an SRD citation carries its page; retrieval called once per adjudicated action.

**Checkpoint**: a turn can plan; nothing writes yet.

## Phase 4: Resolve, narrate and audit (US1, US2, US3, US8; AC #5, #6, #7, #8)

**Goal**: the writing node, the facts, the narration and its audit. Contracts: resolve.md,
audit.md, director.md, nodes.md.

- [x] T050 Create `nodes/resolve.ts`: the Director group (scene start, trackers, turn mode with SRD combatants and initiative, free mode, scene end), ruling entries, action groups in commit order with step chains branching on engine events, the NPC group, the turn-advance group with the active-actor rule, gate outcome handling (`CONFLICT` retries, `pending`/`suggested` → `awaiting-dm`), reason markers, fence checks, checkpoint saves and replay, `submitNarration`, the failure notice.
- [x] T051 Create `apps/server/src/dm/facts.ts` (`NarrationFacts` from appended rows and `priorSteps`; the dice-line and damage-line renderer).
- [x] T052 Create `nodes/narrate.ts` (digit-free prose via `callText`; regeneration input with prior text and issues).
- [x] T053 Create `apps/server/src/dm/audit-words.ts`, `nodes/audit.ts` (deterministic checks, `dm.audit`, the loop, `AuditRecord`) and `apps/server/src/dm/fallback.ts` (`factualSummary`).
- [x] T054 [P] Write `test/dm/facts.test.ts`: renderer snapshots for a check, an attack hit with damage, a critical hit, a miss, an engine refusal, an auto-fail.
- [x] T055 [P] Write `test/dm/narrate.test.ts`: narrate's module imports no engine value, no RNG and nothing from `gate/` (TypeScript import graph over `dm/nodes/narrate.ts` and its closure); its prompt contains the facts and no command; the shipped text is prose plus rendered dice lines.
- [x] T056 [P] Write `test/dm/audit.test.ts`: each deterministic check fails on its case and passes on a clean case; `factualSummary` passes the checks over generated facts (property test); the loop stops at three; an audit gateway error ships the fallback.
- [x] T057 Write `test/dm/resolve.integration.test.ts` (DB, AI seat, scripted dice): a check with success effects; an attack hit with damage and `critical` only on a critical hit; a miss with no damage; an engine refusal → `refused` with the engine's code; actions resolved in commit order; the Director group's rows (scene, party, combatants, `dm` trackers, initiative and turn mode, encounter end); every reason ends with its marker; resolve never reads a model.
- [x] T058 Write `test/dm/resolve.human-seat.integration.test.ts` (DB): with a human seat and default policies, mechanics come back `pending`; the action stays committed; approving enqueues a turn job whose interpret sees the applied batch in `priorSteps`.
- [x] T059 Write `test/dm/audit.integration.test.ts` (DB): `audit-regenerate.json` → one narration with the second text and a record with one failed attempt; `audit-fallback.json` → the factual summary plus the `dm` journal flag `audit-<jobId>`.

**Checkpoint**: a full pipeline runs when invoked directly.

## Phase 5: Worker, actors and routes (US4, US5, US7; AC #1, #5, #10, #12)

**Goal**: the runtime runs by itself in the server. Contracts: turn-jobs.md, companions.md,
dm-api.md.

- [x] T070 Create `apps/server/src/dm/worker.ts` (`startDmWorker`: poll and `nudge`, claim, heartbeat with abort on fence loss, build `TurnContext`, run turn/companion/chronicle jobs, finish fenced, queue after-turn jobs per turn-jobs.md, reconcile at start, `stop()`).
- [x] T071 Create `apps/server/src/dm/enqueue.ts` (`createDmEnqueuer`).
- [x] T072 Create `apps/server/src/dm/companion.ts` and `apps/server/src/dm/chronicle.ts` per companions.md.
- [x] T073 Create `apps/server/src/routes/dm.ts` and mount it in `app.ts`; wire `startDmWorker` and `gate.onAppended(enqueuer.onAppended)` in `index.ts`; log unconfigured `dm.*` purposes at boot by name.
- [x] T074 Add the `apps/server/src/dm/**` Biome override (plan: Constitution Check III) and the violating fixture `fixtures/boundary-violations/apps/server/src/dm/bad.ts`; confirm `pnpm check:boundaries` fails without the rule.
- [x] T075 [P] Write `test/dm/boundary.test.ts`: under `dm/`, only `nodes/resolve.ts`, `companion.ts` and `chronicle.ts` reference `gate.submit`; no file under `dm/` imports a log writer (reuse `test/helpers/import-graph.ts`); confirm `test/write-boundary.test.ts` still passes with `dm/` present.
- [x] T076 Write `test/dm/companion.integration.test.ts` (DB): an active companion in turn mode talks, declares and commits with authority `active-player` as `ai:companion:<id>`; a non-active companion's commit is refused `COMMIT_NOT_ALLOWED` and recorded; a null act in turn mode is replaced and committed; a `hold` companion job ends by forcing the queued turn.
- [x] T077 Write `test/dm/chronicle.integration.test.ts` (DB): a finished turn queues one chronicle job; no turn job waits for it; entries land as `journal` rows with `sourceActionIds`; a second run with nothing new writes nothing.
- [x] T078 Write `test/dm/routes.integration.test.ts` (DB): start → 202 and a `scene-start` job; a second start → 409; a bad seed id → 400 with issues; `turn` → 202; `turns` lists records without prose; 401 and 403 for no session and a player.

**Checkpoint**: committing an action in a running server produces a DM turn.

## Phase 6: Merge condition and the full gate (all stories; AC #1, #2, #4, #8, #9, #15)

**Goal**: prove the whole runtime end to end and land green. Contract:
fake-gateway-script.md.

- [x] T090 Write the fixture scripts in `apps/server/test/dm/scripts/`: `scene-start.json`, `exploration-check.json`, `social-adjudicated.json`, `fight-round.json`, `audit-regenerate.json`, `audit-fallback.json`, `greyhollow-ford-full.json`.
- [x] T091 Write `test/dm/full-turn.integration.test.ts` (DB, the merge condition): start the seed, commit Tamsin's search, run the worker until idle; assert the node order from the job record, every call's purpose against its node (AC #4), the ledger rows, the narration's dice line equal to the renderer's output, audit `passed`, `remaining()` all zero. When `DM_EVIDENCE_OUT` is set, write the ledger (DM view), the narration and the audit record to that path.
- [x] T092 Write `test/dm/reclaim.integration.test.ts` (DB): inject a crash after each resolve submission in turn; expire the lease; reclaim; assert the log equals an uninterrupted run (SC-005); a stale worker's next submit is stopped by the fence.
- [x] T093 Write `test/dm/beat.integration.test.ts` (DB): hold a turn inside resolve; commit two more actions; release; assert one queued turn and commit-order resolution in the next beat.
- [x] T094 Write `test/dm/scene.integration.test.ts` (DB): run `greyhollow-ford-full.json` to the scene's end through exploration, social and fight, with one human seat and both companions; assert `scene.changed` to null at the end, `dm`-only trackers, mode switches, and zero digits in every narration's prose.
- [x] T095 Run the merge-condition test with `DM_EVIDENCE_OUT=specs/031-dm-runtime/evidence/full-turn.json`; commit the evidence file.
- [x] T096 Run `pnpm ci:check` green in the worktree; save its tail to `specs/031-dm-runtime/ci-evidence.txt`.
- [x] T097 Update contract pointer notes: add a one-line "Extended by specs/031-dm-runtime/contracts/turn-jobs.md" note to `specs/017-ingestion-pipeline/contracts/ingest-modules.md` (the jobs queue) and to `specs/011-ai-gateway/contracts/gateway.md` (the fake adapter); do not edit their bodies.

**Checkpoint**: merge-ready. The PR body quotes the evidence file's ledger and audit result.

## Deviations

- Phase 2: `SeedCharacter` uses `z.partialRecord(AbilitySchema, ...)` for `abilityMods` and `saves` where scene-seed.md writes `z.record(AbilitySchema, ...)`. Zod 4's `z.record` over an enum demands every key; the shipped seed lists only proficient saves.
- Phase 2: `apps/server/seeds/` is added to `biome.json` ignores so the formatter cannot rewrite the seed; the copy stays byte-identical to `data/greyhollow-ford.seed.json` (a test asserts it).
- Phase 2: the engine does not export `CombatantInitSchema`; `dm/seed/schema.ts` takes it from the `combatant.add` variant of `EngineCommandSchema`.
- Phase 3: `NodeDeps` gains `setStage` (the runner's fenced stage write, step 2.2) and `minSimilarity` (the `ASK_MIN_SIMILARITY` floor adjudicate passes to `isRelevant`); `SrdLookup` is `{ getById, getByName, compact }` (assemble matches spell and condition names with `getByName`).
- Phase 3: the director node's output is `DirectorOutput & { overrides }` (`DirectorNodeOutput`), so the legality overrides ride the checkpoint into the turn record; `Ruling.actionId` is `string | null` (null for a monster-turn reading).
- Phase 3: prompt builders exist for `dm.director`, `dm.interpret` and `dm.adjudicate`. The `dm.narrate`/`dm.audit` builders land with their nodes in Phase 4 and the `dm.chronicle`/`dm.companion` builders in Phase 5, because they depend on `NarrationFacts` and the audit contract. `ResolveOutput`, `NarrateOutput` and `AuditOutput` are open records in `pipeline/context.ts` until Phase 4 narrows them.
- Phase 3: `presentNpcIds` is every NPC id named by any seed beat (assemble cannot know the beat in play before the Director picks `pacing.beatId`); later nodes narrow by `pacing.beatId`. An interpret call is skipped when the beat is empty and no monster acts (scene start).
- Phase 3: on `scene-start` the Director keeps only `pacing`; every other decision is reset to its default and recorded as an override when the model chose otherwise.

- Phase 4: `Submission` gains a `key` (semantic id) and an `outcome` (the engine outcome read from the appended events). Replay matches on `key`, not on position, so state-based guards (a monster already in the engine, a tracker already advanced) cannot misalign a reclaim.
- Phase 4: `ResolveOutput` gains `npcTurn` (the monster turn's batches) and `lastSeq`. `NarrateOutput` gains `skipped` and `facts`; `AuditOutput` is `{ record, shipped }`. Narrate and audit make no call and ship nothing when the beat holds no narratable action (all `awaiting-dm`), no NPC turn and no clarification, outside scene start.
- Phase 4: `TurnJobRef` gains an optional `start` (seed id and seats) because resolve needs the seats at scene start. The Phase 5 worker fills it from the job input.
- Phase 4: `submitNarration` and `submitFailureNotice` are exported from `nodes/resolve.ts`. The runner calls `submitNarration` as its final step and sets `resolve.chronicle` when it ships. The Phase 5 worker calls `submitFailureNotice` on a `failed` outcome.
- Phase 4: on a reclaim the narration text is not reused; only `checkpoint.narration.shipped` is. A reclaim after audit but before the narration landed re-runs narrate and audit.
- Phase 4: damage lines name a damage type only for rows appended this turn (read from the `hp.changed` event). A row replayed from `priorSteps` has no type in the ledger and reads "takes N (before→after HP)".
- Phase 4: T058 asserts the approved batch appears in `priorSteps`; the "approving enqueues a turn job" half waits for `createDmEnqueuer` in Phase 5 (T071) and is covered there.
- Phase 4: T059's scripts `audit-regenerate.json` and `audit-fallback.json` were written now (T090 lists them for Phase 6). The audit name check matches the full name, its first word or its last word.
- Phase 5: `claimDmJob` takes an optional `onAbandoned` callback; the worker passes it to append the FR-012 failure notice for a job abandoned past `MAX_ATTEMPTS`. `LEASE_MS`, `HEARTBEAT_MS`, `POLL_MS` and `MAX_ATTEMPTS` moved to `jobs/queue.ts` (re-exported by `library/ingest/jobs.ts`) and `dm/jobs.ts` takes `DbClient` from `auth/session.ts`, so `dm/` imports nothing the new Biome rule forbids.
- Phase 5: `createDmWorker` returns `{ processOne, drain, reconcile, nudge, stop }`; `startDmWorker` wraps it with the polling loop. Tests drive `drain()` instead of the loop. `createDmEnqueuer` takes a `loadProjections` dep to learn who proposed a decided proposal (no direct log read).
- Phase 5: for the active companion in turn mode, an `invalid-output` result (not only a null `act`) is replaced by the hold-position act and committed, so the table cannot stall. In turn mode a non-null `act` with `commit: false` is also forced to commit.
- Phase 5: a failed turn job stores `error: "stopped at <node>: <kind>"` (no `result`), and the `/dm` list reports `outcome: "failed"` from the job status. A companion or chronicle job that throws is failed with a fixed message and appends no notice; a failed `hold` companion job still forces the queued turn.
- Phase 5: chronicle's "already chronicled" bound is the highest created seq of a non-rejected `chron-` journal proposal, or the seq of a directly applied `chron-` journal row, so a pending proposal also counts. Entry ids are `chron-<sessionShort>-<lastNarrationSeq>` with `-<i>` for later entries.
- Phase 5: `T058`'s deferred half (an approval enqueues a turn) is covered in `test/dm/worker.integration.test.ts` with a stubbed proposal lookup over the real jobs table.
- Phase 6: the fixture scripts are generated as segments (`scene-start`, `exploration-check`, `social-adjudicated`, `fight-round`); `greyhollow-ford-full.json` is their concatenation plus six `dm.chronicle` responses (a test pins the equality). The number of chronicle passes depends on worker idle timing, so the scene test requires every other purpose and all dice to be spent but not the chronicle queue.
- Phase 6: `workerFor` takes optional `retrieve` and `nodes`; `drainAll` drains until a drain finds nothing after a settle pause (gate listeners enqueue asynchronously).
- Phase 6 fix (found by T092): a tracker advance carried no marker, so a crash between its landing and its checkpoint save made the reclaim advance the tracker twice. The tracker `reason` now carries the step marker and `findLanded` matches it in the ledger.
- Phase 6 finding, fixed: a crash inside `submitNarration` after the narration row landed but before the checkpoint save made the reclaim re-run narrate and audit and append a second narration. The runner now checks, on a reclaim, for an `ai:dm` narration row after the job's last appended seq (`findLandedNarration`); when found it skips narrate, audit and the gate call, synthesizes a passed audit record with no attempts, and sets `resolve.chronicle`. `reclaim.integration.test.ts` crashes after the narration submission and asserts one narration and the uninterrupted log.

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6, strictly.
- Within a phase, `[P]` tasks touch different files and may run together after the
  non-`[P]` tasks they test exist.
- After any `origin/main` merge that brings a migration, regenerate `0004` (do not hand-merge
  `meta/_journal.json`) and re-run every database suite.

## Implementation Strategy

Build bottom-up: the queue first (it is the riskiest shared surface), then data, then the
read-only nodes, then the one writer, then the process wiring. Each phase lands green on its
own, so a stopped sweep resumes from the last ticked task.

## Notes

- The orchestrator re-seeds the card's phase ACs from this file before the first
  implementation dispatch (`spec-bridge:link`).
- The wiki re-pin (runbook: `ingestion`, `ai-gateway`, `configuration`, `rules-answerer`,
  `database-schema`, `migrations`, new `dm-runtime`) is a separate dispatch after merge.
