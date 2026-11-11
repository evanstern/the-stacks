---
description: "Tasks for spec 102: gate accepts Intents (TASK-0268)"
---

# Tasks: Gate accepts Intents

**Input**: `specs/102-gate-intents/` (spec.md, plan.md)

**Gate**: no phase starts before the operator rules on plan.md "C-GATE".

**Tests**: required. Constitution II: a gate test per outcome for each kind group touched.

**Dispatch**: one phase is one sonnet implementer dispatch. Run phases in order. Each phase ends
with `pnpm ci:check` green and one commit led by `TASK-0268`. DB phases run `REQUIRE_DATABASE=1`
on the worktree stack.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Request kind, carrier event, projection and declare envelope (US3, AC #3)

**Goal**: the `intent` request parses, `intent.recorded` folds, `action.declare` validates as an Intent.

- [ ] T001 Add `@the-stacks/intent` and `@the-stacks/planner` (`workspace:*`) to `packages/session-model/package.json` and its `tsconfig.json` references. Run `pnpm install`.
- [ ] T002 Add the `intent` member to `ProposalSchema`, `ProposalKindSchema` and `DmProposalKindSchema` in `gate/proposals.ts`. Set `DEFAULT_POLICIES.intent = "ask"` in `gate/policy.ts`. Add the `intent` row to `gate/permissions.ts`.
- [ ] T003 Write `src/events/intents.ts` (`IntentRecordedV1`, plan "Data model") and add `intent.recorded` to `catalog.ts`.
- [ ] T004 Write `src/projections/intents.ts` (`IntentView`, `openRulings`); wire `apply.ts` and `types.ts`.
- [ ] T005 Write `src/gate/declare.ts` (`declareIntent`, FR-026). Call it from the `action.declare` case in `plan.ts`; a schema failure refuses `INVALID_PROPOSAL` (FR-027).
- [ ] T006 Add the `intent` example to `fixtures/proposal-examples.ts`. Export the new names from `src/index.ts`.
- [ ] T007 Tests: `gate-declare.test.ts` (every declare fixture maps to a schema-valid `attempt`; round trip; party scope with null character), `intents-projection.test.ts` (fold, `openRulings`, answered), count 20 in `gate-schemas.test.ts`, `exports.test.ts`. Every existing `action.declare` test passes unchanged.

## Phase 2: Pure Intent planning in session-model (US1, US4, AC #1, AC #4)

**Goal**: `planProposal` plans an `intent` end to end with no server code.

- [ ] T008 Write `src/gate/plan-state.ts`: `PlannerInputs` and `buildPlanState(p, viewer, inputs)` (FR-013, FR-014: `seen` from `targetStatus`, `space` from `spatialFor`).
- [ ] T009 Extend `PlanContext` with `planner?: PlannerInputs` in `plan.ts`. Extract the floor `end` body of `planFloor` into a shared function.
- [ ] T010 Write `src/gate/intents.ts` `planIntent`: checks FR-005–FR-012 in order (`DRAFT_NOT_ACCEPTED`, seats from `KIND_RULES`, `NOT_YOUR_ACTOR`, `INTENT_EXISTS`, declared-then-confirmed, `NOT_YOUR_TURN`, `MODEL_NUMBER` in amend bodies).
- [ ] T011 In `planIntent`, route not-planned kinds to rows (FR-018), `reveal` zone to `revealRows` (FR-019), `end_turn` to the shared floor-end code (FR-020).
- [ ] T012 In `planIntent`, call `plan()`, run commands per planner contract §3 (FR-015), map refusals (FR-016), wrap events with `mechanicsRows` (FR-017), and append the carrier row (FR-003, spec OQ-12 visibility).
- [ ] T013 Add `case "intent"` to `plan.ts` calling `planIntent`.
- [ ] T014 Tests `gate-intents.test.ts`: confirmed attack settles with engine rows then carrier; each refusal code above; `TARGET_UNSEEN` from fog; zone reveal writes `zone.revealed` and flips `seen`; not-planned kinds; `end_turn`; rule-4 stop keeps earlier events; declared then confirmed; `needs_ruling` carrier for `attempt` and a no-DC player `check`; `ruling` accept, reject, amend and `set_dc` close the request.

## Phase 3: Server gate wiring (US1, US2 human seat, AC #1, AC #2)

**Goal**: the live gate plans Intents with seed inputs and opens a proposal row under a human seat.

- [ ] T015 Add `@the-stacks/intent` to `apps/server/package.json`. Write `apps/server/src/gate/planner-inputs.ts` (plan "Design" 4). Add `plannerInputs?` to `GateDeps`; wire it in `src/index.ts` with `loadSeed`.
- [ ] T016 In `gate.ts`, pass `planner` in the plan context; append `proposal.created` after a human-seat `needs_ruling` carrier (FR-021); append `proposal.approved`/`proposal.rejected` with an answer row (FR-024).
- [ ] T017 In `gate.ts`, make `proposal.approve`/`proposal.reject` on an `intent` proposal plan a `ruling` Intent from the seated DM (FR-025).
- [ ] T018 Add `NOT_YOUR_ACTOR`, `DM_SEAT_REQUIRED`, `NOT_YOUR_TURN` to `FORBIDDEN_GATE_CODES` in `ws/gateway.ts` (FR-028).
- [ ] T019 Add the `intent` case to `detailsOf` and `actionIdOf` in `apps/web/app/play/proposals.ts`; add `@the-stacks/intent` to `apps/web/package.json`.
- [ ] T020 Test `apps/server/test/gate.intent.integration.test.ts`: a confirmed player attack over WebSocket appends engine rows and the carrier with a fake gateway that throws on any call (AC #1); human-seat `attempt` writes `proposal.created`; approve and a difficulty `ruling` close it.

## Phase 4: AI-seat ruling job (US2 AI seat, AC #2)

**Goal**: under the AI seat a `needs_ruling` result queues a turn that answers it with one model call.

- [ ] T021 Add trigger `ruling` to `TurnTriggerSchema` in `dm/jobs.ts`. Add rule 8 to `dm/enqueue.ts`: a `needs_ruling` carrier row under the AI seat queues `enqueueTurn(…, "ruling", seq)` (FR-022).
- [ ] T022 Write `dm/prompts/ruling.ts` (`dm.ruling-v1`: the request, the Intent text form, the ask; output `{ decision, difficulty?, reason? }`, no numbers).
- [ ] T023 Write `dm/rulings.ts`: answer each `openRulings` entry oldest first with one `callJson` on `PURPOSE_OF.adjudicate` and `gate.submit` a `ruling` Intent from `ai:dm` (FR-023). Call it at the start of every AI-seat turn job; a `ruling` job with no beat ends `empty-beat`.
- [ ] T024 Test `apps/server/test/dm/rulings.integration.test.ts` with the fake gateway: `attempt` → queued `ruling` turn → accept → carrier with fact `no-roll`, request closed; a scripted `ai:dm` amend with a literal `dc` refuses `MODEL_NUMBER`.

## Phase 5: Wiki re-ground

- [ ] T025 Review and re-pin (NEEDS-REVIEW): `proposal-gate`, `session-model`, `dm-failure-and-gates`, `dm-runtime`, `ws-protocol`. Also re-pin every other note whose sources this PR touched (`dm-turn-jobs`, `turn-floor`, `zone-fog`, `planner`, `intent-contract`, `play-route`, `websocket-gateway`, `server-entrypoint-and-app`, `presence`, `seed-npc-presence`, `debug-view`, `dm-talk-triggers`, `dm-plan-gate`) through the wiki-update plan loop, amending prose before bumping.
- [ ] T026 Update `docs/wiki/INDEX.md` (state line: TASK-0268 gate accepts Intents) and `docs/wiki/CAPSULES.md` (proposal-gate, session-model capsules). Record the session-model → planner edge (spec OQ-1).
- [ ] T027 Run the freshness gate (`OK`) and the spec-bridge check (exit 0).

## Dependencies & Execution Order

Phase 1 → 2 → 3 → 4 → 5. Phases 3 and 4 touch disjoint files but phase 4's test needs phase 3's
gate wiring; run serially.
