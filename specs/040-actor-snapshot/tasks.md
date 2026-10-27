---
description: "Task list for the actor snapshot (TASK-0140, decision-0025 U1)"
---

# Tasks: Actor snapshot — one code-built state view for every DM node

**Input**: `specs/040-actor-snapshot/` — spec.md, plan.md, research.md, data-model.md,
quickstart.md, contracts/actor-snapshot.md (binding).

**Tests**: required. Every card AC is proven by a named test (spec.md "Card acceptance
criteria map").

**Dispatch unit**: each phase is one implementer dispatch (sonnet). Run phases in order:
1, 2, 3, 4. Phases 2 and 3 both edit `prompts/common.ts`; never run them in parallel.

**Gate for every phase** (run before the phase's last commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/server test && pnpm check:boundaries`.
Phases 2 and 3 also run the DB suites. Phase 3 also runs `pnpm ci:check`.

**Database suites**: run on the worktree's own stack. Run `pnpm env:up`. Migrate both
databases by hand (fresh stacks come up unmigrated, TASK-0098). Restart the app. Run the
suites with `REQUIRE_DATABASE=1`. Leave the stack up; the orchestrator runs `pnpm env:down`.

**Known flake**: the WebSocket gateway integration tests flake. Re-run once on an unrelated
WebSocket failure. Do not fix them. Record each re-run in the phase's commit message.

**Rules for every phase**:
- Follow `contracts/actor-snapshot.md` exactly. A needed deviation is a STOP: report it.
- Compute no number. The snapshot copies engine numbers.
- Import engine and session-model types with `import type` only in `dm/snapshot/`.
- Change no model call count or order.
- Add no dependency and no migration. Touch no package under `packages/`.
- Bump `PROMPT_VERSION` for every prompt whose text changes. Update every test that asserts a
  current version. Leave historic capture fixtures and `call.test.ts` literals unchanged.
- No "for now" without a card (decision-0020). Report any deferral as an open question.

**Commits**: one or more per phase, each message led by `TASK-0140:` and ending with the
Co-Authored-By trailer.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: The snapshot module (US1, US2 diff, US4 render)

**Goal**: a pure, tested `dm/snapshot/` module: type, build, aliases, diff, render, cap and
overflow. Nothing calls it yet.

**Independent test**: the three new test files pass with no other code changed.

- [x] T001 [US1] Create the types of contract §2, §5 and §6 (`ActorSnapshot`, `SnapshotActor`, `SnapshotStage`, `ActorChange`, `StageChange`, `SnapshotDiff`, `RenderOptions`, `SnapshotOverflowError`, `SnapshotBuildError`) in `apps/server/src/dm/snapshot/types.ts`, and re-export the module in `apps/server/src/dm/snapshot/index.ts`
- [x] T002 [US1] Move `TITLE_WORDS` and the term rule into `nameTerms` in `apps/server/src/dm/snapshot/aliases.ts` (contract §4); make `partyNameTerms` in `apps/server/src/dm/nodes/audit.ts` call it with byte-identical output (existing `test/dm/audit.test.ts` must pass unchanged)
- [x] T003 [US1] Implement `buildSnapshot(projections, seed)` per contract §3 rules 1–9 in `apps/server/src/dm/snapshot/build.ts`
- [x] T004 [P] [US1] Build tests in `apps/server/test/dm/snapshot.test.ts`: turn-mode combat fixture plus the Greyhollow Ford seed gives nine actors with Snag joined once; every contract §2 field set; actor order per rule 5; stage active actor for `ai:dm` and for a companion; party member with no combatant; no seed (rule 8); id collision throws `ACTOR_ID_COLLISION`
- [x] T005 [P] [US1] Alias tests in `apps/server/test/dm/snapshot.test.ts`: "Brother Odo" gives "Odo"; Snag carries its engine name; ids join aliases only when they differ from the name
- [x] T006 [P] [US1] Determinism and secrecy tests in `apps/server/test/dm/snapshot.test.ts`: two builds deep-equal; `JSON.stringify(snapshot)` holds no `dmOnlySeedText(seed)` string
- [x] T007 [US2] Implement `diffSnapshots` per contract §5 in `apps/server/src/dm/snapshot/diff.ts`, with tests in `apps/server/test/dm/snapshot-diff.test.ts`: empty on identical input; a kill gives one `hp` and one `life-state`; a condition applied and one removed by `instanceId`; `joined` and `left`; `encounter-started`, `encounter-ended`, `table-mode`, `round`, `active-actor`, `tracker`; max-HP-only change gives nothing
- [x] T008 [US4] Implement `renderSnapshot` and `snapshotSection` with the `dm`, `seat` and `fiction` views (contract §6.1) and the cap sequence (contract §6.2) in `apps/server/src/dm/snapshot/render.ts`; read caps from new `CAPS.snapshotDm`, `CAPS.snapshotSeat`, `CAPS.snapshotFiction` in `apps/server/src/dm/prompts/common.ts` (leave `CAPS.projections` until Phase 3)
- [x] T009 [P] [US4] Render tests in `apps/server/test/dm/snapshot-render.test.ts`: the schema-maximum shape (6 party, 12 monsters, 20 NPCs, all alive) fits every view uncompressed (measure it; raise a cap if needed and record the numbers in the commit message); a 6-party, 24-combatant, 20-NPC snapshot with dead goblins over the cap compresses only the dead and shows all 50 actors exactly once; `fiction` view of the shipped seed holds no digit, no actor id and no DM-only seed text; `seat` view shows no AC, resources or sheet for a non-party actor; trackers render only in the `dm` view when asked
- [x] T010 [P] [US4] Overflow tests in `apps/server/test/dm/snapshot-render.test.ts`: a snapshot that exceeds the cap after compression returns `ok: false` from `renderSnapshot` and throws `SnapshotOverflowError` (code `SNAPSHOT_OVERFLOW`, detail with view, tokens, cap, actors, compressed) from `snapshotSection`
- [x] T011 Run the phase gate and commit

**Checkpoint**: the contract exists as code. TASK-0141 and later cards may now cite real names.

---

## Phase 2: S0, S1 and the planning prompts (US2, US3, US4)

**Goal**: `assemble` builds S0, `resolve` builds S1 and the diff, the runner fails loudly on
overflow, and director, interpret and adjudicate render state from S0.

**Independent test**: `assemble.test.ts`, `runner.test.ts`, `interpret-prompt.test.ts` and
`resolve.integration.test.ts` pass with the new assertions.

- [ ] T012 [US2] Add `snapshot: ActorSnapshot` (S0) to `AssembleOutput`, built with `buildSnapshot(projections, ctx.seed)`, in `apps/server/src/dm/nodes/assemble.ts`; assert it in `apps/server/test/dm/assemble.test.ts`
- [ ] T013 [US2] Add `snapshot` (S1) and `diff` to `ResolveOutput` in `apps/server/src/dm/nodes/resolve.ts`: reload projections after the last gate write on every `ok: true` return and diff against `ctx.results.assemble.snapshot`; in `apps/server/test/dm/resolve.integration.test.ts` assert a scripted-dice kill gives S1 dead and the exact diff, an encounter start gives `joined` and stage entries, a no-op turn gives an empty diff, and a reclaim rebuilds an equal S1
- [ ] T014 [US4] Add `"state-overflow"` to `NodeErrorKind` in `apps/server/src/dm/pipeline/context.ts`; map `SnapshotOverflowError` in `safeRun` to that kind with the error detail plus the node name, logging `dm.node.state-overflow`, in `apps/server/src/dm/pipeline/runner.ts`; test in `apps/server/test/dm/runner.test.ts` that an overflowing interpret fails the turn with `state-overflow`, records the detail, and makes no model call
- [ ] T015 [US3] Render `## State` from S0 in the `dm` view with tracker lines (advance-when from `ctx.seed.trackers`) in `apps/server/src/dm/prompts/director.ts`; bump to `dm.director-v3`; update `apps/server/test/dm/assemble.test.ts` and `apps/server/test/dm/director.test.ts`
- [ ] T016 [P] [US3] Render `## State` from S0 in the `dm` view in `apps/server/src/dm/prompts/interpret.ts`; bump to `dm.interpret-v3`; in `apps/server/test/dm/interpret-prompt.test.ts` assert the version and that a frightened monster's condition and AC appear (G6)
- [ ] T017 [P] [US3] Render `## State` from S0 in the `dm` view in `apps/server/src/dm/prompts/adjudicate.ts`; bump to `dm.adjudicate-v3`; update the version assertion in `apps/server/test/dm/interpret-prompt.test.ts`
- [ ] T018 [US3] Confirm director, interpret and adjudicate no longer import `projectionEntries` (companion still does until Phase 3)
- [ ] T019 [US5] Run the phase gate and the DB suites (`REQUIRE_DATABASE=1`, including `test/playtest/playtest.integration.test.ts`); commit

**Checkpoint**: the planning nodes read the snapshot; the turn fails loudly on overflow.

---

## Phase 3: Player-facing prompts and retirement (US3, US4, US5)

**Goal**: narrate, audit, companion and chronicle render state from the snapshot;
`projectionEntries` and `npcNames` are gone; the full gate and the CI playtest are green.

**Independent test**: the retired-name scan is empty; `pnpm ci:check` and the DB suites pass.

- [ ] T020 [US3] Delete `npcNames` from `NarrationFacts` and `buildNarrationFacts` in `apps/server/src/dm/facts.ts`; remove it from fixtures in `apps/server/test/dm/facts.test.ts`, `audit.test.ts`, `fallback.test.ts`, `narrate.test.ts` and `apps/server/test/playtest/checks.test.ts`; move the Snag/dedupe cases of `facts.test.ts` into `apps/server/test/dm/snapshot.test.ts` as fiction-render cases
- [ ] T021 [US3] Change `characterSections` to take the snapshot and render the party section and the `## Other characters (the world)` section from S1 in the `fiction` view in `apps/server/src/dm/prompts/narrate.ts`; add `snapshot` to `NarratePromptInput`; pass `resolve.snapshot` from `apps/server/src/dm/nodes/narrate.ts`; bump to `dm.narrate-v4`; in `apps/server/test/dm/narrate.test.ts` assert the version and that a goblin dead since an earlier turn appears as dead
- [ ] T022 [US3] Render the same sections from S1 in `apps/server/src/dm/prompts/audit.ts`; add `snapshot` to its input; pass `resolve.snapshot` to the audit prompt and to `narrateAttempt` on regenerate in `apps/server/src/dm/nodes/audit.ts`; bump to `dm.audit-v3`; update `apps/server/test/dm/narrate.test.ts` and `apps/server/test/dm/audit.integration.test.ts`. Leave the deterministic checks and blocking derivation unchanged
- [ ] T023 [US3] Build the snapshot per companion from the loaded projections and the full seed in `apps/server/src/dm/companion.ts`; render `## State` in the `seat` view with `self` in `apps/server/src/dm/prompts/companion.ts`; bump to `dm.companion-v3`; on `SnapshotOverflowError` record the play as `status: "error"`, log `dm.companion.state-overflow`, and make no model call; test in `apps/server/test/dm/companion.integration.test.ts`
- [ ] T024 [US3] Add the optional `{ throughSeq }` bound to `loadProjections` in `apps/server/src/session/projections.ts`; build a `loadProjectionsThrough` dep in `apps/server/src/index.ts`; wire it and `loadSeed` into the chronicle deps in `apps/server/src/dm/worker.ts`
- [ ] T025 [US3] Add `loadSeed` and `loadProjectionsThrough` to `ChronicleDeps`; build the snapshot from projections through the job's `throughSeq` and the scene's seed (null seed when it fails to load) in `apps/server/src/dm/chronicle.ts`; render `## State at the end of this transcript` in the `fiction` view in `apps/server/src/dm/prompts/chronicle.ts`; bump to `dm.chronicle-v3`; on overflow write nothing, return `entries: 0`, log `dm.chronicle.failed` with `kind: "state-overflow"`; test the state-at-seq read and the overflow in `apps/server/test/dm/chronicle.integration.test.ts`
- [ ] T026 [US3] Delete `projectionEntries` and `CAPS.projections` from `apps/server/src/dm/prompts/common.ts`; add a source-scan test in `apps/server/test/dm/snapshot.test.ts` that no file under `apps/server/src` contains `projectionEntries` or `npcNames`
- [ ] T027 [US4] Confirm the companion and chronicle overflow tests of T023 and T025 assert no model call (the fake gateway's call log is empty for that job)
- [ ] T028 [US3] Extend `apps/server/test/dm/player-facing-prompts.test.ts`: the narrate, audit, companion and chronicle prompts built for the shipped seed hold no DM-only seed string with the snapshot sections present; `test/dm/boundary.test.ts` still passes (narrate's import closure holds no engine value and nothing from `gate/`)
- [ ] T029 [US5] Run `pnpm ci:check` and the DB suites with `REQUIRE_DATABASE=1`; confirm `test/playtest/playtest.integration.test.ts` passes with the same model call count per purpose as `main`; commit

**Checkpoint**: card AC #1–#6 hold in code.

---

## Phase 4: Wiki re-ground

**Goal**: the grounding wiki describes the snapshot and every staled pin is honest.

Classify each staled pin against `git diff <old-pin>..HEAD -- <sources>` as RE-PIN-ONLY or
NEEDS-REVIEW. Amend prose before bumping a NEEDS-REVIEW pin.

- [ ] T030 [P] NEEDS-REVIEW `docs/wiki/dm-runtime.md`: S0 in assemble, S1 and the diff in resolve, the `state-overflow` failure, which prompt renders which view, chronicle state at `throughSeq`; add `apps/server/src/dm/snapshot/*.ts` and `pipeline/runner.ts` to sources if not listed
- [ ] T031 [P] NEEDS-REVIEW `docs/wiki/dm-narration-quality.md`: facts without `npcNames`; the party and world sections now from S1 in the `fiction` view; the `nameTerms` move behind `partyNameTerms`; update the `description:` (it names `npcNames`)
- [ ] T032 [P] NEEDS-REVIEW `docs/wiki/session-model.md`: the `{ throughSeq }` bound on `loadProjections`
- [ ] T033 [P] Review `docs/wiki/dm-failure-and-gates.md`: the failure record's `kind` can now be `state-overflow`; re-pin RE-PIN-ONLY if its sources did not change, else amend
- [ ] T034 Create `docs/wiki/actor-snapshot.md` (kind `concept`): the type, build rules, the NPC-combatant join, aliases, diff, the three views, the cap and overflow, the readers table, and the Track C cards that extend it (contract §9); sources `apps/server/src/dm/snapshot/*.ts` and `specs/040-actor-snapshot/contracts/actor-snapshot.md`; pin to HEAD
- [ ] T035 Regenerate `docs/wiki/CAPSULES.md` for every changed `description:` and the new note; add `[[actor-snapshot]]` to `docs/wiki/INDEX.md` under the DM entries and update its state paragraph
- [ ] T036 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` (prints `OK`) and `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` (exits 0); commit

---

## Constitution Compliance (the-stacks)

- [ ] T037 Principle I: the snapshot is exercised through the agent nodes' prompts by tests (T015–T017, T021–T025), not only by unit tests
- [ ] T038 Principle IV: no event type added; trackers never reach a `seat` or `fiction` render (T009)
- [ ] T039 Principle VI: `dm/snapshot/` imports engine types only; resolve's scripted-dice tests cover S1 (T013)

## Dependencies & Execution Order

- Phase 1 has no dependency.
- Phase 2 depends on Phase 1 (the module).
- Phase 3 depends on Phase 2 (`ResolveOutput.snapshot`, the `state-overflow` kind, the caps).
- Phase 4 depends on Phase 3 (the final code to re-pin against).
- Within a phase, `[P]` tasks touch different files and may run in any order.

## Implementation Strategy

Phase 1 is the MVP for Track C: it lands the contract as code, which unblocks the specs of
TASK-0141 onward. Phases 2 and 3 make every node read it. Phase 4 re-grounds. The card's PR
opens only after Phase 4.
