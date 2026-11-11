# Implementation Plan: Gate accepts Intents

**Branch**: `task-0268-gate-intents` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)
**Upstream plans authored against**: spec 092 `06d7ca13`, spec 097 `a34d5d39`, spec 100 `16ae6147`
(main via `34e13e12`), spec 099 `58fc1fd4`, spec 101 `02b96689`. Main at `fb396882`.

## Summary

Add the `intent` gate request to session-model, plan it with `@the-stacks/planner` inside the
existing pure `planProposal`, and record each accepted Intent in one `intent.recorded` carrier row.
The server gate supplies seed-derived planner inputs, writes a `proposal.created` row for a ruling
under a human seat, and closes it on the answer. The DM enqueuer queues a `ruling` turn; the AI turn
answers open requests first with one `dm.adjudicate` call. `action.declare` gains a pure envelope.

## Technical Context

**Language/Version**: TypeScript, Node 22, as the repo.
**Primary Dependencies**: existing only. session-model gains `@the-stacks/intent` and
`@the-stacks/planner` (`workspace:*`). The server gains `@the-stacks/intent` (`workspace:*`).
**New runtime dependencies: none** (no third-party package; C5 does not trigger).
**Storage**: no table change. **Migrations: none** (ruling work rides `turn` jobs, spec OQ-3).
**Testing**: Vitest. session-model unit tests; server DB integration tests with `REQUIRE_DATABASE=1`
and the fake gateway.
**Constraints**: session-model stays pure (biome override unchanged; the planner is pure).
**Prompt versions**: adds `dm.ruling-v1` (new prompt file). No existing prompt bumps.

## Constitution Check

Against `.specify/memory/constitution.md` 3.0.0.

- [x] **I. Agent-operable**: AI DM, companions and humans send the same `intent` request; the AI DM
  rules with the same `ruling` Intent a human sends.
- [x] **II. One Intent vocabulary**: the gate plans every served kind through the planner; no
  surface calls the planner (the gate is its only caller). `action.declare` validates as an Intent.
- [x] **III. Server authority**: refuse-before-write holds; one atomic batch per Intent; model output
  reaches the log only as a `ruling` Intent; fog rule applies to every planned row.
- [x] **IV. Three planes**: session plane only.
- [x] **V. Many views**: `intents` is a projection of `intent.recorded`; per-viewer via `canSee`.
- [x] **VI. Engine owns the numbers**: planner and engine choose every number; `MODEL_NUMBER` holds
  at schema and for `ai:dm` amend bodies.
- [x] **VII. Narration around facts**: carrier rows store `PlanFact[]` for TASK-0272's "why" rows.
- [x] **IX. UX**: no added I/O on the attack path; TASK-0300 times `handle` → `onAppended` (OQ-13).
- [x] **XII. Self-hostable**: no new purpose, so no hosted config change (OQ-2).
- [x] **XIII. Plan just-in-time**: every deferral is an open question with a recommended card.
- VIII, X, XI: not applicable.

**Quality gate "Intent contract tests"**: gate test per outcome (`settled`, `needs_ruling`,
refusal) for each kind group touched; the declare envelope gets schema and round-trip tests.
**Complexity Tracking**: none.

## Data model

```ts
// packages/session-model/src/events/intents.ts (new)
IntentRecordedV1 = z.object({
  intent: IntentSchema,
  schemaVersion: z.literal(INTENT_SCHEMA_VERSION),       // carrier stores the major (contract §10)
  outcome: z.enum(["declared", "settled", "needs_ruling"]),
  batchId: RefIdSchema.nullable(),                       // engine batch, else null
  facts: z.array(PlanFactSchema),                        // [] for gate-handled kinds
  request: RulingRequestSchema.nullable(),               // outcome needs_ruling only
  answers: RefIdSchema.nullable(),                       // the requestId a ruling / set_dc closed
  stopped: z.object({ code: z.string(), message: z.string() }).nullable(), // rule 4 stop
});

// projections/intents.ts (new)
IntentView = { id, seq, actor: string, intent, status: "declared" | "settled" | "needs_ruling" | "answered",
               request: RulingRequest | null, proposalId: string | null };
SessionProjections.intents: IntentView[];               // [] initially; v stays 1 (additive)
openRulings(p): Record<string, RulingRequest & { proposalId: string | null }>;
```

`proposalId` is filled when a `proposal.created` with `proposal.kind === "intent"` names the same
Intent id. An answer row (`answers` set) moves the answered view to `answered`.

## Design

1. **Request** (`gate/proposals.ts`): `{ kind: "intent", ...ProposalNote, intent: IntentSchema }`.
   `DmProposalKindSchema` includes `intent`; `DEFAULT_POLICIES.intent = "ask"`.
2. **Permission** (`gate/permissions.ts`): `intent` passes the matrix for any table member; the
   intent checks in step 3 decide (as `action.commit` does with commit authority).
3. **Plan** (`gate/intents.ts`, new; called from `plan.ts` `case "intent"`): checks FR-005 → FR-012 in
   order; then routes by `PLAN_KINDS[kind].class`: not-planned → gate rows (FR-018/019);
   `end_turn` → shared floor-end code extracted from `planFloor` (FR-020); otherwise build
   `PlanState` (`gate/plan-state.ts`, new) and call `plan(state, spatialFor(p, viewer), intent)`;
   execute per contract §3 with the existing `step` pattern; wrap events with `mechanicsRows`;
   append the carrier row. `planProposal`'s fog + validate pass stays the single exit.
4. **Planner inputs**: `PlanContext` gains `planner?: PlannerInputs` =
   `{ casters, srdSpellIds, inits, tableRules, npcIds }`. Absent → empty inputs and default rules.
   The server builds it per call from the scene seed (`apps/server/src/gate/planner-inputs.ts`, new):
   casters from seed characters (level, spells, by combatant id), `srdSpellIds` from `@the-stacks/srd`
   `list("spell")`, inits via `combatantFromSrd` for seed NPCs not in the engine (side `hostile` when
   an encounter names them, else `neutral`, zone per spec 100 FR-023), `tableRules` from the seed.
   `createGate` takes `plannerInputs?: (p) => PlannerInputs` (index.ts wires it with `loadSeed`).
5. **Declare envelope** (`gate/declare.ts`, new): `declareIntent(action, proposer, p)`; the
   `action.declare` case calls it and refuses `INVALID_PROPOSAL` on a schema failure, else unchanged.
6. **Server gate** (`apps/server/src/gate/gate.ts`): for an `intent` whose planned carrier row has
   `outcome: "needs_ruling"` under a human seat, append `proposal.created` (`ask`) after the carrier.
   For an answer row whose request has a `proposalId`, append `proposal.approved` (with `batchId`) or
   `proposal.rejected`. `proposal.approve`/`reject` on an `intent` proposal plan a `ruling` Intent
   from the seated DM (FR-025) instead of re-planning the stored proposal.
7. **AI ruling** (`apps/server/src/dm/`): `TurnTriggerSchema` gains `ruling`; `enqueue.ts` rule 8
   queues it for a `needs_ruling` carrier row under the AI seat; `dm/rulings.ts` (new) runs before
   assemble in every AI-seat turn job: for each `openRulings` entry, one `callJson` on
   `PURPOSE_OF.adjudicate` with prompt `dm/prompts/ruling.ts` (`dm.ruling-v1`), output
   `{ decision, difficulty?, reason? }`, then `gate.submit` a `ruling` Intent from `ai:dm`. A
   `ruling`-trigger job with nothing else to do ends `empty-beat` after answering.
8. **Delivery** (`apps/server/src/ws/gateway.ts`): `FORBIDDEN_GATE_CODES` gains `NOT_YOUR_ACTOR`,
   `DM_SEAT_REQUIRED`, `NOT_YOUR_TURN`. No frame change.
9. **Web** (`apps/web/app/play/proposals.ts`): `detailsOf` and `actionIdOf` gain an `intent` case
   (`toText(intent)`, the ask). Needs `@the-stacks/intent` in `apps/web/package.json`
   (`workspace:*`, already a planned edge in target-architecture §8).

## Files touched

| File | Change |
|---|---|
| `packages/session-model/package.json`, `tsconfig.json` | deps and references: intent, planner |
| `packages/session-model/src/gate/proposals.ts` | `intent` kind and request member |
| `packages/session-model/src/gate/policy.ts` | `DEFAULT_POLICIES.intent` |
| `packages/session-model/src/gate/permissions.ts` | `intent` row |
| `packages/session-model/src/gate/plan.ts` | `case "intent"`; `PlanContext.planner`; floor-end extract |
| `packages/session-model/src/gate/intents.ts` (new) | checks, routing, execution, carrier row |
| `packages/session-model/src/gate/plan-state.ts` (new) | `buildPlanState`, `PlannerInputs` |
| `packages/session-model/src/gate/declare.ts` (new) | `declareIntent` |
| `packages/session-model/src/events/intents.ts` (new) | `IntentRecordedV1` |
| `packages/session-model/src/catalog.ts` | `intent.recorded` entry |
| `packages/session-model/src/projections/{intents.ts (new),apply.ts,types.ts}` | `intents`, `openRulings` |
| `packages/session-model/src/fixtures/proposal-examples.ts` | `intent` example |
| `packages/session-model/src/index.ts` | exports: `declareIntent`, `openRulings`, `IntentRecordedV1`, `PlannerInputs`, `buildPlanState` |
| `packages/session-model/test/gate-intents.test.ts`, `gate-declare.test.ts`, `intents-projection.test.ts` (new); `gate-schemas.test.ts` (count 20), `exports.test.ts` | tests |
| `apps/server/package.json` | `@the-stacks/intent` |
| `apps/server/src/gate/gate.ts`, `gate/planner-inputs.ts` (new), `src/index.ts` | inputs, ruling proposal rows |
| `apps/server/src/ws/gateway.ts` | forbidden codes |
| `apps/server/src/dm/{jobs.ts,enqueue.ts,worker.ts or pipeline/runner.ts,rulings.ts (new),prompts/ruling.ts (new)}` | ruling trigger and answer |
| `apps/server/test/gate.intent.integration.test.ts`, `test/dm/rulings.integration.test.ts` (new) | AC #1, #2 |
| `apps/web/package.json`, `apps/web/app/play/proposals.ts` | `intent` proposal rendering |
| `docs/wiki/*` | phase 5 |

## C-GATE: frozen contract amendments

The operator rules on this section before implementation. All changes are additive.

| Frozen file | Before → after | Why |
|---|---|---|
| `specs/029-proposal-gate/contracts/proposals.md` | 17 kinds / 14 DM kinds / 21 request literals → 18 / 15 / 22 (code today: 15 → 16 kinds, 19 → 20 literals; OQ-14), adding `z.object({ kind: z.literal("intent"), ...ProposalNote, intent: IntentSchema })`; matrix row `intent`: every role passes, `planIntent` decides (FR-005–FR-012) | AC #1–#4; spec 092 migration 1 |
| `specs/029-proposal-gate/contracts/policy-and-authority.md` | policy table without `intent` → `intent: "ask"` | `ai:dm` Intents under a human seat route by policy (FR-011) |
| `specs/029-proposal-gate/contracts/proposal-events.md` | catalog without carrier → `intent.recorded` v1 (`lifecycle`, any visibility, `IntentRecordedV1`); projection gains `intents: IntentView[]` and helper `openRulings` | contract §7 rule 8: outcomes live in carrier events; spec 097 §4 facts seam |
| `specs/029-proposal-gate/contracts/gate-api.md` | `PlanContext { present? }` → `{ present?, planner?: PlannerInputs }`; plan table gains the `intent` row (rows: engine batch, then carrier; human-seat ruling adds `proposal.created`; answers add `proposal.approved`/`rejected`); refusal codes gain the Intent gate codes under source `gate`; `proposal.approve`/`reject` on an `intent` proposal plan a `ruling` Intent | FR-013–FR-025 |
| `specs/029-proposal-gate/contracts/ws-delivery.md` | `forbidden` codes `NOT_AUTHORIZED, NOT_DM, COMMIT_NOT_ALLOWED, GROUP_SIGNOFF_REQUIRED` → plus `NOT_YOUR_ACTOR, DM_SEAT_REQUIRED, NOT_YOUR_TURN` | FR-028 |
| `specs/029-proposal-gate/contracts/fixtures.md` | `proposalExamples` per 15 kinds → per 16, adding an `intent` example | the fixture test is total over kinds |
| `docs/wiki/ws-protocol.md` / `apps/server/src/ws/protocol.ts` frame shapes | unchanged → unchanged (`send` with `eventType: "intent"`, `payloadVersion: 1`) | no frame change needed |
| `specs/030-play-route/contracts/proposal-seam.md` | unchanged → unchanged (`PendingProposalView` holds; `detailsOf` gains a case) | view shape is kind-agnostic |

## Migration notes

- No database migration. A plan that later needs one regenerates after merging `origin/main`.
- Stored `action.declared` keeps v1. `IntentRecordedV1` is new at v1.
- `GATE_REQUEST_VERSION` stays 1 (additive member).

## Concurrency

Hotspots (runbook): `gate/proposals.ts` and `gate/plan.ts` (0268, 0199, 0276), `ws/protocol.ts`
(untouched here). `dm/{jobs,enqueue}.ts` overlap TASK-0199 and 0272: develop-ahead only while those
are not in implementation; otherwise draft-hold per runbook "Rule at dispatch".
