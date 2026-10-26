---
description: "Task list for the session model (TASK-0044)"
---

# Tasks: First Scene — session model (talk, actions, table modes, ledger, projections)

**Input**: `specs/028-session-model/` — spec.md, plan.md, research.md, data-model.md,
quickstart.md, contracts/ (session-events, projections, fixtures, package-api,
boundary-rule).

**Amended 2026-10-26** (orchestrator ruling on plan Open Question 3): Phase 5 gained the
atomic `appendBatch` and the mid-batch failure-injection tests; Phase 5 and 6 task ids were
renumbered (T041–T054).

**Tests**: required. AC #5, AC #7 and AC #8 each demand a test, and the fixtures are a
contract for TASK-0045 and TASK-0047. Write each phase's tests with its code; a phase is not
done until they pass.

**Dispatch unit**: each phase is one implementer dispatch. Phases run in order; each builds on
the previous phase's files.

**Gate for every phase** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/session-model test && pnpm check:boundaries`.
Phase 5 adds the database suite (see Phase 5). Phase 6 runs `pnpm ci:check`.

**Commit rule**: one or more commits per phase, message led by `TASK-0044:`, ending with the
`Co-Authored-By` trailer. Tick each task here (`- [x]`) in the same commit that completes it.
Use the `backlog` CLI inside the worktree for any card change; never the backlog MCP tools.

**Out of scope** (owned elsewhere; do not touch): `apps/server/src/ws/*` (TASK-0045 adopts
`canSee`; TASK-0095 fixes the replay/live duplicate), proposal events (TASK-0045), `apps/web`
(TASK-0047), the `events` table schema and its migration (unchanged), and `append`/`readFrom`
in `apps/server/src/events/log.ts` (unchanged; Phase 5 only adds `appendBatch` beside them).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 talk and actions, US2 table modes, US3 projections and replay, US4 secret
  trackers, US5 ledger, US6 fixtures (spec.md).

## AC coverage map

| Card AC | Proving test (phase) |
|---|---|
| #1 typed, versioned talk and action events | `test/catalog.test.ts` (P2), `test/actions.test.ts` (P3) |
| #2 talk changes only the transcript | `test/talk-isolation.test.ts` (P3, extended over fixtures in P4) |
| #3 table modes and active player | `test/table-mode.test.ts` (P3) |
| #4 projections from the log alone | `test/projections.test.ts` (P3), `test/fixtures.test.ts` (P4) |
| #5 secret trackers never in player projections | `test/secrecy.test.ts` (P3, every fixture in P4); refusal in `apps/server/test/session.integration.test.ts` (P5) |
| #6 rolls carry reasons; state changes carry before/after | `test/catalog.test.ts` meta-test (P2), `test/ledger.test.ts` (P3); atomic batches in `apps/server/test/session.integration.test.ts` (P5: a roll never lands without its state change) |
| #7 replay from seq 0 rebuilds identical projections | `test/replay.test.ts` (P3, P4); `apps/server/test/session.integration.test.ts` (P5, real database; mid-batch failure leaves zero rows) |
| #8 unknown event types skipped without failing | `test/decode.test.ts` (P2), `test/tolerance.test.ts` (P3, P4) |

---

## Phase 1: Setup — package scaffold and boundary rule

**Purpose**: an empty, buildable `@the-stacks/session-model` with its purity rule proven.

- [x] T001 Create `packages/session-model/package.json` per contracts/package-api.md (name, `"type": "module"`, `exports` for `.` and `./fixtures`, scripts `build`/`typecheck` = `tsc -b`, `test` = `vitest run`, dependencies `@the-stacks/dnd5e-engine: workspace:*` and `zod: ^4.6.5`, devDependency `vitest: ^5.0.1`).
- [x] T002 Create `packages/session-model/tsconfig.json` (extends `../../tsconfig.base.json`, `outDir: dist`, `rootDir: src`, `lib: ["ES2022"]`, `types: []`, reference `../dnd5e-engine`) and `packages/session-model/test/tsconfig.json` (copy the shape of `packages/dnd5e-engine/test/tsconfig.json`).
- [x] T003 Create `packages/session-model/src/index.ts` exporting a `SESSION_MODEL_VERSION = 1` constant and `packages/session-model/src/fixtures/index.ts` exporting an empty `fixtures` array, so both entry points build.
- [x] T004 Add `packages/session-model` and `packages/session-model/test` to the root `tsconfig.json` references (after the engine's entries); run `pnpm install` so the workspace links; commit the updated `pnpm-lock.yaml`.
- [x] T005 Add the session-model override to `biome.json` per contracts/boundary-rule.md, and add `@the-stacks/session-model` to the engine override's denied `paths`.
- [x] T006 [P] Create the violating fixtures `fixtures/boundary-violations/packages/session-model/src/bad-server.ts`, `bad-clock.ts`, `bad-database.ts`, and `fixtures/boundary-violations/packages/dnd5e-engine/src/bad-session-model.ts` per contracts/boundary-rule.md.
- [x] T007 Run `pnpm check:boundaries` and confirm every fixture is flagged; temporarily remove the new override, confirm the check fails, restore it.

**Checkpoint**: `pnpm build` builds the new package; `pnpm check:boundaries` green.

---

## Phase 2: Foundational — event schemas, catalog, decoding, visibility (US1, US2, US4, US5; AC #1, #6, #8)

**Purpose**: the binding vocabulary of contracts/session-events.md. Every later phase imports
it.

### Tests

- [x] T008 [P] [US1] Write `packages/session-model/test/catalog.test.ts`: one valid and at least one invalid payload per catalog type (including each refine in session-events.md); session-native and engine type sets are disjoint; every `(type, version)` is unique; exactly one `current` entry per type.
- [x] T009 [P] [US5] In `packages/session-model/test/catalog.test.ts`, add the AC #6 meta-test: for every entry of kind `state-change`, a valid example payload with `reason`, `before` or `after` removed fails its schema; for every `marker`, removing `reason` fails; for mechanics entries, the check applies to the wrapped engine event.
- [x] T010 [P] [US3] Write `packages/session-model/test/decode.test.ts`: `decodeEvent` returns `known` with the right kind for valid rows, `unknown-type`, `unknown-version`, and `invalid` for a bad payload and for a mechanics row whose `type` differs from `payload.event.type`; it never throws (try a `null` payload, a number payload, a deeply nested junk payload).
- [x] T011 [P] [US4] Write `packages/session-model/test/visibility.test.ts` covering every cell of the `canSee` table in session-events.md.

### Implementation

- [x] T012 [P] Implement `packages/session-model/src/ids.ts` (`RefIdSchema`, `ActorIdSchema`, `VisibilitySchema`, `PUBLIC`, `DM_ONLY`) and `packages/session-model/src/stored-event.ts` (`StoredEventSchema`, `StoredEvent`). Reuse the engine's `CombatantIdSchema` regex by value; the engine does not export it, so define `CombatantIdSchema` locally with the identical regex and a comment naming engine-api.md.
- [x] T013 [P] [US4] Implement `packages/session-model/src/visibility.ts` (`Viewer`, `canSee`).
- [x] T014 [P] [US1] Implement `packages/session-model/src/events/talk.ts` (`TalkV1`, `NarrationV1`) and `packages/session-model/src/events/actions.ts` (the four action schemas with their refines; `refusalCode` uses the engine's `RefusalCodeSchema`).
- [x] T015 [P] [US2] Implement `packages/session-model/src/events/table-mode.ts` (`TableModeSchema`, `TableModeChangedV1`).
- [x] T016 [P] [US3] Implement `packages/session-model/src/events/scene.ts`, `party.ts` and `journal.ts` per session-events.md.
- [x] T017 [P] [US4] Implement `packages/session-model/src/events/tracker.ts` (`TrackerSchema` with `filled <= segments`, `TrackerChangedV1`).
- [x] T018 [P] [US5] Implement `packages/session-model/src/events/mechanics.ts` (`MechanicsEnvelopeV1` over the engine's `EngineEventSchema`, `index < count`).
- [x] T019 Implement `packages/session-model/src/catalog.ts`: `catalog` (11 session entries plus 18 mechanics entries, each with kind, visibility rule, schema, `current`), `catalogEntry`, `currentVersion`, `SESSION_EVENT_TYPES`, `MECHANICS_EVENT_TYPES` (derived from the engine schema's discriminator options, not hand-listed), `decodeEvent` and the `SessionEvent`/`DecodeResult` types.
- [x] T020 Export the Phase 2 surface from `packages/session-model/src/index.ts` per contracts/package-api.md; run the phase gate.

**Checkpoint**: the vocabulary is binding; T008–T011 green.

---

## Phase 3: User Stories 1–5 — the fold and every projection (AC #2, #3, #4, #5, #6, #7, #8)

**Purpose**: `emptyProjections`, `applyEvent`, `project` per contracts/projections.md, tested
over small hand-built streams (fixtures arrive in Phase 4). Add a test helper
`packages/session-model/test/helpers.ts` that builds `StoredEvent` rows with ascending `seq`
and fixed ISO `ts`, and produces engine events by calling the engine's `execute` with
`scriptedRng`.

### Tests

- [ ] T021 [P] [US1] Write `packages/session-model/test/talk-isolation.test.ts`: for several non-trivial projection states (after a scene, party, encounter, tracker and actions exist), applying a talk event leaves every field except `transcript`, `throughSeq` and `diagnostics` deeply equal (AC #2).
- [ ] T022 [P] [US1] Write `packages/session-model/test/actions.test.ts`: declared → discussed → committed → resolved; every disallowed transition in the projections.md table counts `ignoredTransitions`, leaves the action unchanged, and still appends a transcript entry; two committed actions keep log order (AC #1).
- [ ] T023 [P] [US2] Write `packages/session-model/test/table-mode.test.ts`: initial free mode; free → turn with an active actor; turn → turn with a new active actor; turn → free; a mismatched `before` counts `beforeMismatches` and `after` still applies (AC #3).
- [ ] T024 [P] [US3] Write `packages/session-model/test/projections.test.ts`: scene, party (joined to engine HP, life state, conditions), encounter (order, round, active combatant, linked character), and journal from a hand-built stream; party members whose combatant is absent show `combatant: null` (AC #4).
- [ ] T025 [P] [US4] Write `packages/session-model/test/secrecy.test.ts`: for a stream with `dm` trackers, a `dm` roll and a `dm` journal entry, the DM sees all of them; each player viewer has `trackers: []` and its `JSON.stringify` contains no tracker id, name or note, no hidden roll reason and no DM journal title; a `tracker.changed` mislabelled `public` is still absent for players; player diagnostics do not change when hidden events are added (AC #5).
- [ ] T026 [P] [US5] Write `packages/session-model/test/ledger.test.ts`: one `roll` row per `dice.rolled` with its reason and faces; one `outcome` row per resolved marker; one `change` row per engine and session state change with `reason`, `before` and `after`; rows are in `seq` order (AC #6).
- [ ] T027 [P] [US3] Write `packages/session-model/test/replay.test.ts`: `project(events, v)` called twice is deeply equal, and equals the incremental `reduce(applyEvent)`; `applyEvent` does not mutate a deep-frozen input; a duplicated `seq` counts `outOfOrder` and changes nothing else (AC #7, in memory).
- [ ] T028 [P] [US3] Write `packages/session-model/test/tolerance.test.ts`: unknown type, unknown version, invalid payload, type mismatch and an engine event naming an unknown combatant each fold without throwing and bump the right counter (`engineRejected` for the last); a hand-built stream missing one row of a batch folds and names the batch in `incompleteBatches` (the defensive check of projections.md; the server path never produces it, Phase 5 proves) (AC #8).

### Implementation

- [ ] T029 [US3] Implement `packages/session-model/src/projections/types.ts` (every type in projections.md) and `packages/session-model/src/projections/apply.ts` (`emptyProjections`, `applyEvent`, `project`): visibility drop, player tracker drop, `seq` ordering, decode, per-kind dispatch, diagnostics. `project` may use a private mutable accumulator only if its result deep-equals the `reduce(applyEvent)` result.
- [ ] T030 [P] [US1] Implement `packages/session-model/src/projections/actions.ts` (the transition table) and the transcript entries for `talk`, `narration` and lifecycle events.
- [ ] T031 [P] [US3] Implement `packages/session-model/src/projections/party.ts` and `packages/session-model/src/projections/encounter.ts` (views joined from `engine`; engine folding through the engine's `evolve`, catching throws as `engineRejected`; defensive `incompleteBatches` tracking).
- [ ] T032 [P] [US5] Implement `packages/session-model/src/projections/ledger.ts` (roll, outcome and change rows).
- [ ] T033 Export the projection surface from `packages/session-model/src/index.ts`; run the phase gate.

**Checkpoint**: AC #2–#8 hold in memory; T021–T028 green.

---

## Phase 4: User Story 6 — the fixtures contract

**Purpose**: the five committed streams of contracts/fixtures.md, consumed by TASK-0045 and
TASK-0047.

- [ ] T034 [US6] Implement `packages/session-model/src/fixtures/build.ts`: plain helpers that number rows from `seq` 1 and stamp `ts` from `2026-10-26T18:00:00.000Z` plus one second per `seq`; export `fixtureIds` (fixtures.md table). No engine call and no clock.
- [ ] T035 [US6] Write the five fixture modules in `packages/session-model/src/fixtures/` (`talk-only.ts`, `free-mode-action.ts`, `turn-mode-combat.ts`, `secret-tracker.ts`, `unknown-and-invalid.ts`) and `recipes.ts`, exactly as fixtures.md describes. Produce each mechanics batch's engine events once by running its recipe through the engine in a scratch script or test, then commit the resulting events as literal data.
- [ ] T036 [US6] Export `fixtures`, `recipes`, `fixtureIds` and the `SessionFixture`/`MechanicsRecipe` types from `packages/session-model/src/fixtures/index.ts`.
- [ ] T037 [US6] Write `packages/session-model/test/fixtures.test.ts`: fixture guarantees 1–5 of fixtures.md, including recipe regeneration (DM fold before the batch → `execute` with `scriptedRng(faces)` → equal events, all faces consumed; the refused recipe returns the recorded code) and every fact in the fixtures table.
- [ ] T038 [P] [US4] Extend `packages/session-model/test/secrecy.test.ts` to run its player assertions over every fixture and every player viewer in it (AC #5).
- [ ] T039 [P] [US3] Extend `packages/session-model/test/replay.test.ts`, `test/tolerance.test.ts` and `test/talk-isolation.test.ts` to run over every fixture for the DM and each player viewer (AC #2, #7, #8).
- [ ] T040 Confirm a module outside the package can import `@the-stacks/session-model/fixtures` with types: add `packages/session-model/test/exports.test.ts` that imports both entry points by package name; run the phase gate.

**Checkpoint**: TASK-0047 can render every fixture; TASK-0045 can build tests on them.

---

## Phase 5: User Stories 3 and 5 — atomic batch append, server seam, database suite (AC #5, #6, #7)

**Purpose**: the atomic `appendBatch`, the session-plane seam of contracts/package-api.md,
and the real-log proofs (identical rebuild; zero rows after a mid-batch failure).

**Stack**: run `pnpm env:up` in the worktree before the tests and `pnpm env:down` when the
phase is done. The database suite runs with `REQUIRE_DATABASE=1`; a skip is a failure.

- [ ] T041 Add `@the-stacks/session-model` and `@the-stacks/dnd5e-engine` (`workspace:*`) to `apps/server/package.json` dependencies and both packages to `apps/server/tsconfig.json` references; run `pnpm install`; commit the lockfile.
- [ ] T042 [US5] Add `appendBatch(db, inputs)` to `apps/server/src/events/log.ts` per contracts/package-api.md and research R10: guards before the transaction (non-empty, one `sessionId`, no `seq`/`ts` key); one `db.transaction` whose first statement is the same `pg_advisory_xact_lock(EVENT_LOG_LOCK_NAMESPACE, hashtext(sessionId))`; `MAX(seq)` read once inside the lock; rows inserted in input order with consecutive `seq`; return the recorded rows in order. Do not change `append` or `readFrom`.
- [ ] T043 [US3] Implement `apps/server/src/session/events.ts`: `SessionEventRefused`, `appendSessionEvent` (decode against the current catalog version, visibility rule, then M0 `append`; refusal writes nothing), `appendMechanicsBatch(db, input, deps = { appendBatch })` (`randomUUID` batch id, envelopes with `index` and `count`, every envelope validated before any write, then one `deps.appendBatch` call), `toStoredEvent` (Drizzle `Date` → ISO string).
- [ ] T044 [US3] Implement `apps/server/src/session/projections.ts`: `loadProjections(db, sessionId, viewer)` reading from `seq` 0 with `readFrom` in batches of 200 until a short batch, folding with `project`.
- [ ] T045 [US3] Write `apps/server/test/session.integration.test.ts` using the loud-skip harness of `apps/server/test/events.integration.test.ts` (throws under `REQUIRE_DATABASE=1` when no database). For each fixture except `unknown-and-invalid`, in a fresh session id: append every event through the seam (mechanics rows grouped back into their batches through `appendMechanicsBatch`), fold each returned row incrementally, call `loadProjections` twice, and assert the three results are deeply equal for the DM and every player viewer (AC #7). Also assert each batch's rows have consecutive `seq` and that `diagnostics.incompleteBatches` is `[]` for every viewer (FR-022: the defensive check is unreachable through the seam).
- [ ] T046 [US4] In the same suite, assert `appendSessionEvent` refuses a `tracker.changed` with visibility `public` (`VISIBILITY_NOT_ALLOWED`), an invalid payload (`INVALID_PAYLOAD`) and an unknown type (`UNKNOWN_EVENT_TYPE`), and that `readFrom` shows no new row after each refusal (AC #5, FR-004).
- [ ] T047 [US5] In the same suite, inject a database failure mid-batch through `appendBatch` directly: five valid rows whose third has `payloadVersion: 0` (violates `events_payload_version_positive` after rows one and two were inserted). Assert the call rejects, `readFrom` returns no row of the batch, and the session's next `append` receives the next gapless `seq`. Also assert the pre-transaction guards throw for an empty list, mixed session ids, and an input carrying `seq` (AC #6, AC #7, FR-021, FR-022).
- [ ] T048 [US5] In the same suite, inject the failure through `appendMechanicsBatch` with a `deps.appendBatch` that forwards the real `appendBatch` after setting the third row's `payloadVersion` to 0; assert zero rows of the batch land and `loadProjections` equals its value before the attempt. Then pass an engine event list whose third event fails `EngineEventSchema`; assert `SessionEventRefused` (`INVALID_PAYLOAD`) and zero rows (AC #6, AC #7, FR-022).
- [ ] T049 [US3] In the same suite, append the `unknown-and-invalid` rows directly through M0 `append` (bypassing the seam, as a future writer or an old row would), then assert `loadProjections` returns with the fixture's expected counters, except `outOfOrder`, which the database cannot produce (AC #8 on a real log).
- [ ] T050 Update the TASK-0044 consumer note in `specs/026-dnd5e-engine/contracts/engine-api.md`: the payload is the mechanics envelope (version 1) of `specs/028-session-model/contracts/session-events.md`, the engine `v` travels inside it, and one `execute` result is appended atomically through `appendMechanicsBatch`.
- [ ] T051 Run `pnpm env:up`, then `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test`, then `pnpm env:down`; record the pass counts in the phase commit message.

**Checkpoint**: AC #7 proven on Postgres; refusals and mid-batch failures write nothing.

---

## Phase 6: Polish — full gate

- [ ] T052 Run `pnpm ci:check` in the worktree and fix any failure (lint, typecheck, build, tests, boundaries, hooks, scripts, host scripts).
- [ ] T053 Save the `pnpm ci:check` tail and the Phase 5 database-suite counts to `specs/028-session-model/ci-evidence.txt` (as TASK-0042 did) and commit it.
- [ ] T054 Walk quickstart.md end to end and confirm each expected outcome; tick any remaining task here.

**Checkpoint**: `pnpm ci:check` green. The orchestrator then runs the wiki re-ground (runbook:
`event-log`, `ws-protocol`, `replay-live-boundary`, `overview`, plus a new `session-model`
note) and the spec-bridge sync before the PR.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6, one dispatch each.
- Phase 5 needs Phase 4 (the database suite replays the fixtures). Within Phase 5, T042
  precedes T043 (the seam calls `appendBatch`).
- Within a phase, `[P]` tasks touch different files and can be written in any order; test
  tasks precede their implementation tasks.

### Parallel examples

- Phase 2: T012–T018 are separate files; T019 joins them.
- Phase 3: T021–T028 are separate test files; T030–T032 are separate projection modules
  after T029's types and dispatcher exist.

## Implementation Strategy

MVP is Phases 1–3: the vocabulary and an in-memory fold satisfy AC #1–#6 and #8, and AC #7
in memory. Phase 4 unblocks TASK-0047 (it may start against fixtures once Phase 4 merges with
this card). Phase 5 completes AC #7 on a real log and gives TASK-0045 and TASK-0046 their
server seam.

## Notes

- No migration and no new external dependency (plan.md, research R11). If an implementer
  finds a need for either, STOP and report; it is an operator checkpoint.
- No "for now": deferrals in plan.md's Open Questions each name their owning card.
