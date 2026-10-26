---
description: "Task list for the proposal gate (TASK-0045)"
---

# Tasks: First Scene — proposal gate (autonomy policies and commit authority)

**Input**: `specs/029-proposal-gate/` — spec.md, plan.md, research.md, data-model.md,
quickstart.md, contracts/ (proposals, policy-and-authority, proposal-events, gate-api,
ws-delivery, fixtures, write-boundary).

**Tests**: required. AC #1 and AC #9 each demand a test; every other AC is proven by a named
test below. Write each phase's tests with its code. A phase is not done until they pass.

**Dispatch unit**: each phase is one implementer dispatch. Run phases in order; each builds
on the previous phase's files.

**Gate for every phase** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/session-model test && pnpm check:boundaries`.
Phases 4 and 5 add the database suites (see each phase). Phase 6 runs `pnpm ci:check`.

**Database suites**: run on the worktree's own stack. Run `pnpm env:up`. Run
`pnpm --filter @the-stacks/server db:migrate` (TASK-0098: a fresh stack may come up
unmigrated). Run the suites with `REQUIRE_DATABASE=1`. Leave the stack up between phases; the
orchestrator runs `pnpm env:down` before removing the worktree.

**Known flake**: the WebSocket gateway integration tests are known to flake (owned by another
session). On a WebSocket failure unrelated to this phase's change, re-run the suite. Do not
fix the flake. Record each re-run in the phase's commit message.

**Commit rule**: one or more commits per phase, message led by `TASK-0045:`, ending with the
`Co-Authored-By` trailer. Tick each task here (`- [x]`) in the commit that completes it. Use
the `backlog` CLI inside the worktree for any card change; never the backlog MCP tools.

**Out of scope** (do not touch): `apps/web` (TASK-0047), `apps/server/src/dm/` and the jobs
queue (TASK-0046), the `events` table schema and migrations (unchanged), the replay/live
duplicate logic in `subscribe.ts` beyond swapping the visibility rule (TASK-0095's floor
stays as is).

**STOP conditions**: a need for a new runtime dependency, a migration, or a frame-shape
change beyond `error.code` is an operator checkpoint. Stop and report.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 AI DM auto, US2 human DM ask/suggest, US3 DM direct command, US4 commit
  authority, US5 restart, US6 write boundary, US7 play-route fixtures (spec.md).

## AC coverage map

| Card AC | Proving test (phase) |
|---|---|
| #1 LLM output only through a typed proposal | `apps/server/test/write-boundary.test.ts` (P6); entry parsing in `apps/server/test/gate.integration.test.ts` (P4) |
| #2 per-kind policy table | `packages/session-model/test/gate-policy.test.ts` (P1, P2) |
| #3 auto applies immediately | `gate.integration.test.ts` "auto" (P4) |
| #4 ask: DM-only `proposal.created`, apply on approval | `gate.integration.test.ts` "ask" (P4); DM-only delivery in `ws.integration.test.ts` (P5) |
| #5 suggest shows, applies nothing | `gate.integration.test.ts` "suggest" (P4) |
| #6 commit authority by table mode | `packages/session-model/test/gate-authority.test.ts` (P2, P3); `gate.integration.test.ts` "commit" (P4) |
| #7 DM command through the same engine path | `packages/session-model/test/gate-plan.test.ts` equivalence (P2); `gate.integration.test.ts` "direct" (P4) |
| #8 refuse before write, engine code returned | `gate-plan.test.ts` (P2); `gate.integration.test.ts` "refusals" (P4) |
| #9 restart keeps pending proposals | `apps/server/test/gate.restart.integration.test.ts` (P5) |

---

## Phase 1: Setup and foundational — proposal contracts in code (US2, US7; AC #2)

**Purpose**: the binding vocabulary of contracts/proposals.md and contracts/proposal-events.md.
Every later phase imports it.

### Tests

- [x] T001 [P] [US2] Write `packages/session-model/test/gate-schemas.test.ts`: every kind in `ProposalKindSchema` has a `ProposalSchema` option; `GATE_REQUEST_KINDS` has 16 entries; defaults fill (`summary`, `rationale`, `visibility`, `actionId`); `mechanics.command` accepts any JSON; `tracker` rejects a non-`dm` visibility shape; `table-mode`/`scene`/`party`/`tracker` carry no `before`.
- [x] T002 [P] [US2] Write `packages/session-model/test/gate-policy.test.ts` (table part): `DEFAULT_POLICIES` keys equal `DmProposalKindSchema.options`; values match contracts/policy-and-authority.md.
- [x] T003 [P] [US2] Extend `packages/session-model/test/catalog.test.ts`: the five new types are catalogued at version 1 with the kinds and visibility rules in contracts/proposal-events.md; the session and engine type sets stay disjoint.
- [x] T004 [P] [US2] Write `packages/session-model/test/proposals-projection.test.ts`: `proposal.created`/`approved`/`rejected` transitions and ignored transitions (duplicate id, approving a `suggest`, deciding twice); `dm.seat.changed` and `gate.policy.changed` set `gate` and write ledger change rows with the `before` check; a player viewer's `proposals` is `[]`.
- [x] T005 [P] [US2] Extend `packages/session-model/test/talk-isolation.test.ts` and `packages/session-model/test/secrecy.test.ts` so `gate` and `proposals` join the compared fields and the player-secrecy scan covers proposal ids.

### Implementation

- [x] T006 [P] [US2] Create `packages/session-model/src/gate/proposals.ts` with `ProposalKindSchema`, `DmProposalKindSchema`, `ProposalSchema`, `GateRequestSchema`, `GATE_REQUEST_KINDS`, `GATE_REQUEST_VERSION`, `mechanicsProposal`, `Proposer` and `actorOf` per contracts/proposals.md.
- [x] T007 [P] [US2] Create `packages/session-model/src/gate/seat.ts` (`DmSeatSchema`) and `packages/session-model/src/gate/policy.ts` (`PolicySchema`, `Policy`, `PolicyTable`, `DEFAULT_POLICIES`, `effectivePolicy`) per contracts/policy-and-authority.md.
- [x] T008 [P] [US2] Create `packages/session-model/src/gate/refusals.ts` with `GateRefusalCodeSchema`, `GateRefusalSource` and `GateRefusal` per contracts/gate-api.md section 2.
- [x] T009 [US2] Create `packages/session-model/src/events/proposals.ts` (`ProposalCreatedV1`, `ProposalApprovedV1`, `ProposalRejectedV1`) and `packages/session-model/src/events/gate-config.ts` (`DmSeatChangedV1`, `GatePolicyChangedV1`) per contracts/proposal-events.md.
- [x] T010 [US2] Add the five catalog entries and `EventKind "proposal"` to `packages/session-model/src/catalog.ts`, with the typed payloads in `SessionPayloads`.
- [x] T011 [US2] Add `GateView`, `ProposalStatus`, `ProposalView`, and the `gate` and `proposals` fields to `packages/session-model/src/projections/types.ts`; initialize them in `emptyProjections`.
- [x] T012 [US2] Create `packages/session-model/src/projections/proposals.ts` (transitions, `pendingProposals`, `findProposal`) and dispatch the five types from `applyKnown` in `packages/session-model/src/projections/apply.ts`; add the two change-row cases to `packages/session-model/src/projections/ledger.ts`.
- [x] T013 [US7] Retype the last row of `packages/session-model/src/fixtures/unknown-and-invalid.ts` to `x-test.future-type` and update its description, per contracts/fixtures.md; confirm its counters are unchanged.
- [x] T014 [US2] Export the new names from `packages/session-model/src/index.ts` and extend `packages/session-model/test/exports.test.ts`.
- [x] T015 [US2] Add `CATALOG_TYPE_REQUIRES_GATE` to `AppendRefusalCode` in `apps/server/src/session/events.ts` (type only; Phase 4 uses it), so the server typechecks against the grown catalog.

**Checkpoint**: package builds; every existing package test and the new tests pass; server
typechecks.

---

## Phase 2: Pure decision core — permissions, routing, commit authority, planner (US1, US3, US4; AC #2, #6, #7, #8)

**Purpose**: everything the gate decides, as pure functions over projections.

### Tests

- [x] T016 [P] [US4] Write `packages/session-model/test/gate-authority.test.ts`: an allowed and a forbidden case for every row of decision-0016's table (free/declarer, turn/active-player, party/group with one human, party with two humans → `GROUP_SIGNOFF_REQUIRED`, DM always), plus `UNKNOWN_ACTION`, `ACTION_NOT_OPEN`, companion party commit refused, and the `{ actor }` form.
- [x] T017 [P] [US4] Add the SC-006 replay check to `gate-authority.test.ts`: every `action.committed` in every fixture re-derives its recorded authority (contracts/policy-and-authority.md).
- [x] T018 [P] [US1] Extend `packages/session-model/test/gate-policy.test.ts`: `effectivePolicy` is `auto` for every kind under an AI seat; under a human seat, overrides win over defaults; `routeProposal` routes humans and companions `direct`, `ai:dm` by policy, and refuses `ai:dm` `action.declare`.
- [x] T019 [P] [US3] Write `packages/session-model/test/gate-permissions.test.ts`: every cell of the permission matrix in contracts/proposals.md, including IC talk control and operator-only `dm.seat`.
- [x] T020 [P] [US1] Write `packages/session-model/test/gate-plan.test.ts`: per kind, the planned rows match contracts/gate-api.md section 1 (types, actors, visibility, filled `before`); every planned payload validates against its catalog schema; `mechanics` returns engine refusals with source `engine` and the engine's code for at least five codes (`TARGET_DEAD`, `UNKNOWN_COMBATANT`, `INVALID_COMMAND`, `D20_TERM_REQUIRED`, `NO_ACTIVE_ENCOUNTER`) and draws no die; the AC #7 equivalence (direct vs approved plan of one `mechanics` proposal with equal scripted dice → deeply equal engine events, `proposalId` differing only on envelopes); `planProposal` reads no clock and mutates no input (deep-freeze).

### Implementation

- [x] T021 [P] [US3] Create `packages/session-model/src/gate/permissions.ts` implementing the permission matrix and derived roles in contracts/proposals.md.
- [x] T022 [P] [US4] Create `packages/session-model/src/gate/authority.ts` with `commitAuthority` per contracts/policy-and-authority.md.
- [x] T023 [US1] Add `routeProposal` to `packages/session-model/src/gate/policy.ts`.
- [x] T024 [US1] Create `packages/session-model/src/gate/plan.ts` with `planProposal`, `PlannedRow`, `PlanIds`, `PlanResult` and `mechanicsRows` per contracts/gate-api.md section 1; validate each planned payload against `catalogEntry(type, currentVersion(type)).schema`.
- [x] T025 [US1] Export the Phase 2 names from `packages/session-model/src/index.ts` and extend `exports.test.ts`.

**Checkpoint**: every decision the gate makes is tested without a server.

---

## Phase 3: Fixtures for the play route and the gate (US7; TASK-0047 contract)

**Purpose**: contracts/fixtures.md. TASK-0047 builds its approval panel and commit control on
these.

### Tests

- [x] T026 [US7] Extend `packages/session-model/test/fixtures.test.ts` with every fact and guarantee in contracts/fixtures.md for `dm-approvals`, `commit-authority` and `proposalExamples`, including the P1 re-plan guarantee and both `commit-authority` tables.

### Implementation

- [x] T027 [P] [US7] Add `dmUserId` to `fixtureIds` in `packages/session-model/src/fixtures/build.ts`.
- [x] T028 [P] [US7] Create `packages/session-model/src/fixtures/dm-approvals.ts` (session id `00000000-0000-4000-8000-000000000106`) and add its `check.roll` recipe to `packages/session-model/src/fixtures/recipes.ts`; generate the batch through `planProposal`/`execute` with scripted faces, then freeze the rows as plain data.
- [x] T029 [P] [US7] Create `packages/session-model/src/fixtures/commit-authority.ts` (session id `00000000-0000-4000-8000-000000000107`).
- [x] T030 [P] [US7] Create `packages/session-model/src/fixtures/proposal-examples.ts` (`proposalExamples`, one per kind).
- [x] T031 [US7] Register the new fixtures and `proposalExamples` in `packages/session-model/src/fixtures/index.ts`; confirm the secrecy, replay and tolerance tests run over them.
- [x] T032 [P] [US7] Add a pointer note "Extended by specs/029-proposal-gate/contracts/…" to `specs/028-session-model/contracts/session-events.md`, `projections.md`, `fixtures.md` and `package-api.md`, naming the additions.

**Checkpoint**: TASK-0047 can import every fixture and example it needs.

---

## Phase 4: Server gate and seam (US1, US2, US3, US4; AC #3, #4, #5, #6, #7, #8)

**Purpose**: contracts/gate-api.md sections 3–4. Database suite required.

### Tests

- [x] T033 [US1] Extend `apps/server/test/events.integration.test.ts`: `appendBatch` with a matching `expectedLastSeq` appends; a mismatch throws `SeqConflictError` and lands zero rows; the empty session expects 0; `readLatestOfType` returns the latest row or null.
- [x] T034 [US2] Write `apps/server/test/gate.integration.test.ts` with an injected `scriptedRng` and `newId`, covering: "auto" (AI seat; one atomic batch; no `proposal.*`); "ask" (human seat; exactly one `dm` `proposal.created`; approval appends effects then `proposal.approved` in consecutive seqs; reject appends `proposal.rejected`); "suggest" (one `proposal.created` with policy `suggest`; approve → `PROPOSAL_NOT_APPROVABLE`); "direct" (seated human DM `mechanics` applies with no `proposal.*`; a player's `mechanics` → `NOT_AUTHORIZED`); "commit" (free, turn, party, DM rows end to end); "refusals" (engine code returned, row count unchanged, for creation and for an approval that became illegal, which stays pending; `NOT_DM`, `UNKNOWN_PROPOSAL`, `PROPOSAL_NOT_PENDING`); "entry parsing" (raw string, missing `kind`, unknown `kind` → `INVALID_PROPOSAL`, zero seam calls); "seat and policy" (operator-only `dm.seat`; `gate.policy` changes the effective policy); "conflict" (an injected seam that throws `SeqConflictError` twice then succeeds → success; three times → `CONFLICT`, zero rows); "race" (two concurrent approvals of one proposal → exactly one applied, the other `PROPOSAL_NOT_PENDING`); "onAppended" (listener receives the stored rows in order; a throwing listener does not change the result).

### Implementation

- [x] T035 [US1] Add `SeqConflictError`, the `expectedLastSeq` option on `appendBatch`, and `readLatestOfType` to `apps/server/src/events/log.ts` per contracts/gate-api.md section 4; keep `append` and `readFrom` unchanged.
- [x] T036 [US1] Add `appendSessionEvents`, `appendUncataloguedEvent` and `loadDmSeat` to `apps/server/src/session/events.ts`; rebuild `appendMechanicsBatch` on the package's `mechanicsRows` and `appendSessionEvents`, keeping its signature and behaviour (`apps/server/test/session.integration.test.ts` must still pass unchanged).
- [x] T037 [US2] Create `apps/server/src/gate/gate.ts` and `apps/server/src/gate/index.ts` with `createGate`, `Gate`, `GateDeps` and `GateResult`, implementing the algorithm in contracts/gate-api.md section 3 with no module-level mutable state.
- [x] T038 [US2] Run the database suites on the worktree stack: `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test -- gate events session`. Record the pass counts in the commit message.

**Checkpoint**: the gate works end to end on a real log; nothing is wired to the WebSocket yet.

---

## Phase 5: WebSocket delivery, send path and restart (US2, US5; AC #4, #9)

**Purpose**: contracts/ws-delivery.md and the AC #9 merge condition.

### Tests

- [ ] T039 [US2] Update `apps/server/test/ws.integration.test.ts`: replace raw sends of catalogued types (`narration`) with uncatalogued types so the M0 visibility tests keep their meaning; add: a raw catalogued type (`dice.rolled`) → `forbidden` error with code `CATALOG_TYPE_REQUIRES_GATE`, zero rows; a gate request over `send` (`talk`) is appended and broadcast; a refused gate request returns an `error` frame with `code`; with a human DM seated, an `ask` proposal submitted through the gate reaches the DM's connection and not a player's, live and on replay; with an AI seat, a `dm` event reaches no connection; a `dm.seat.changed` broadcast switches later delivery.
- [ ] T040 [US5] Write `apps/server/test/gate.restart.integration.test.ts`: build server A (app, gate, gateway, fresh pool) on port 0; seat an operator user as DM; submit two `ask` proposals from `ai:dm`; close server A and end its pool; build server B with a fresh pool and fresh gate and gateway; connect as the DM, subscribe from 0, and assert both `proposal.created` events arrive and `loadProjections` (DM) lists both pending; approve one over `send` and assert its effects and `proposal.approved` arrive; assert a player connection on server B received neither proposal.

### Implementation

- [ ] T041 [US2] In `apps/server/src/ws/registry.ts`: add `viewerFor`, the per-session seat cache (`setSeat`, `seatOf`, deleted with the session's last subscriber), filter `broadcast` with `canSee`, update the seat after delivering a `dm.seat.changed`, and remove `isVisible`.
- [ ] T042 [US2] In `apps/server/src/ws/subscribe.ts`: load the seat with `loadDmSeat` when the registry has none for the session, and filter replay with the same `canSee(viewerFor(…))` rule; leave the replay floor logic unchanged.
- [ ] T043 [US2] In `apps/server/src/ws/protocol.ts`: add the optional `code` to `ErrorFrame`.
- [ ] T044 [US2] In `apps/server/src/ws/gateway.ts`: accept `gate` in `CreateGatewayOptions`; classify `send` per contracts/ws-delivery.md (gate request → `gate.handle`; other catalogued type → `forbidden` with code; else `appendUncataloguedEvent` and broadcast); map refusals to error frames; add `publish(sessionId, events)`.
- [ ] T045 [US2] In `apps/server/src/index.ts`: create the gate, pass it to `createGateway`, and wire `gate.onAppended` to `gateway.publish`.
- [ ] T046 [US5] Run the database suites: `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test -- gate ws session events`. Re-run on a known WebSocket flake (see header). Record the pass counts and the restart test result in the commit message.

**Checkpoint**: AC #4 and AC #9 hold on the worktree stack; the runbook's TASK-0045 merge
condition is met.

---

## Phase 6: Write boundary and full gate (US6; AC #1)

**Purpose**: contracts/write-boundary.md, contract pointers, and `pnpm ci:check`.

### Tests

- [ ] T047 [US6] Write `apps/server/test/write-boundary.test.ts`: run `checkWriteBoundary` on `apps/server/src` (expect zero violations) and on `apps/server/test/fixtures/write-boundary/src` (expect exactly the three seeded violations, by file and rule).

### Implementation

- [ ] T048 [P] [US6] Create `apps/server/test/helpers/import-graph.ts` exporting `checkWriteBoundary(root)` per contracts/write-boundary.md, using the TypeScript compiler API.
- [ ] T049 [P] [US6] Create the violation tree `apps/server/test/fixtures/write-boundary/src/ai/leak.ts`, `dm/raw.ts` and `gate/model.ts`; add `"exclude": ["fixtures/write-boundary"]` to `apps/server/test/tsconfig.json` and `"!apps/server/test/fixtures/write-boundary"` to `biome.json` `files.includes`.
- [ ] T050 [P] Add pointer notes naming this spec's additions to `specs/006-ws-gateway/contracts/ws-protocol.md` (send classification, `error.code`, `canSee` delivery) and `specs/004-event-log/contracts/event-log.md` (`expectedLastSeq`, `readLatestOfType`).
- [ ] T051 Confirm the board card "Retire the uncatalogued WebSocket send path" exists (`backlog task list --plain`), ordered after TASK-0047. If it is missing, STOP and report to the orchestrator; do not create it.
- [ ] T052 Run `pnpm ci:check` in the worktree and fix any failure.
- [ ] T053 Save the `pnpm ci:check` tail and the Phase 4 and 5 database-suite counts to `specs/029-proposal-gate/ci-evidence.txt` and commit it.
- [ ] T054 Walk quickstart.md and confirm each expected outcome; tick any remaining task here.

**Checkpoint**: `pnpm ci:check` green. The orchestrator then runs the wiki re-ground (runbook:
`event-log`, `server-entrypoint-and-app`, `websocket-gateway`, `error-contract`, plus
`subscriber-registry`, `ws-protocol`, `session-model`, and a new note for the gate) and the
spec-bridge sync before the PR.

---

## Dependencies & Execution Order

- Phase 1 → 2 → 3 → 4 → 5 → 6, one dispatch each.
- Phase 3 needs Phase 2 (`planProposal` generates and re-plans the `dm-approvals` batch).
- Phase 4 needs Phases 1–2 (the planner); it does not need Phase 3.
- Phase 5 needs Phase 4 (the gate and `loadDmSeat`).
- Phase 6's write-boundary test needs Phases 4–5 (the final writer layout).
- Within a phase, `[P]` tasks touch different files; test tasks precede their implementation.

### Parallel examples

- Phase 1: T001–T005 are separate test files; T006–T008 are separate source files.
- Phase 2: T016–T020 are separate test files; T021 and T022 are separate modules.
- Phase 3: T027–T030 are separate files after T026's expectations are written.
- Phase 3 can run beside Phase 4 if the orchestrator wants a second lane; both touch only
  their own files apart from `packages/session-model/src/index.ts` (Phase 3 does not edit it).

## Implementation Strategy

MVP is Phases 1–2: every gate decision exists as a tested pure function. Phase 3 unblocks
TASK-0047's fixture work. Phase 4 gives TASK-0046 its entry point (`gate.submit`). Phase 5
meets the runbook's merge condition. Phase 6 proves AC #1 and closes the gate.

## Notes

- No migration and no new runtime dependency (plan.md). If an implementer finds a need for
  either, STOP and report; it is an operator checkpoint.
- No "for now": the one deferral (the legacy send path) names a card the orchestrator creates
  before merge (T051); group sign-off is TASK-0049.

## Deviations

- Phase 1, T006: the `tracker` proposal carries `visibility: z.literal("dm").default("dm")`.
  The contract says "tracker is always dm" and T001 requires the schema to reject a non-dm
  shape; Zod objects strip unknown keys, so the literal field is the smallest faithful way.
- Phase 1, T007: `PolicySchema` lives in `gate/policy.ts` (per T007), not `proposals.ts`;
  `policy.ts` imports proposal kinds as types only, which avoids an import cycle.
- Phase 1, T012: `applyUnsafe` drops any `proposal.*` row for a player viewer (as it does
  `tracker.changed`), so a mislabelled public proposal row never reaches a player.
- Phase 1, T014: `exports.test.ts` also asserts the Phase 1 names; `decode.test.ts` now uses
  `x-test.future-type` for its unknown-type case (`proposal.created` is catalogued).
- Phase 2, T021/T022: shared role helpers (`isSeatedDm`, `isAiDm`, `controls`, `isPartyMember`)
  live in `packages/session-model/src/gate/roles.ts`, used by permissions, authority and the
  planner. `action.commit` passes the permission matrix for every table member; commit
  authority refuses non-controllers at plan time, as the matrix says ("per commit authority").
- Phase 2, T024: the planner re-checks IC-talk control and `action.declare` control (the
  table lists both as planner checks), so an approved proposal cannot bypass them.
- Phase 3, T028: `dm-approvals` also holds the two `combatant.add` batches (`b-add-ana`,
  `b-add-bram`, actor `dmUserId`) before the party joins. The P1 `check.roll` needs Ana's engine
  combatant, so the contract's list implies them. Recipes for both batches sit in `recipes.ts`.
- Phase 3, T028: `mechanicsBatch` in `fixtures/build.ts` takes an optional `proposalId`. The
  recipe tests in `fixtures.test.ts` skip `proposal.*` rows when they collect a batch, because
  `proposal.approved` carries the same `batchId`.
- Phase 3, T029: `commit-authority` party members carry `combatantId: null`; the fixture
  needs no engine state. Bram's turn names `activeCharacterId: "bram"`.
- Phase 3, T026: guarantee 3 re-plans P1 against the fold through the `proposal.created` row
  (the state at approval time, before the effects append), with the recipe's faces.
- Phase 4, T038: a fresh stack came up unmigrated (TASK-0098); migrated by hand with
  `pnpm --filter @the-stacks/server db:migrate` and the worktree's `.env` exported.
- Phase 4, T037: `proposal.approve` plans as `ai:dm` (the only proposer a pending proposal can
  hold) and stamps the approving DM on the `proposal.approved` row; `appendSessionEvents`
  refusals map to gate refusals with source `append`.
