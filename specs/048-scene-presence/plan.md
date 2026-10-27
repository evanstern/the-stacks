# Implementation Plan: Scene presence as tracked actor state, with a producer

**Branch**: `task-0141-scene-presence` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: `specs/048-scene-presence/spec.md` (operator rulings OQ-1 to OQ-4, all (a), recorded
there); decision-0025 (D17) Terms, §1.2, §2.1, §3.1, §3.2; spec 040 (actor snapshot, merged);
spec 045 (resolve order, merged); spec 046 (TASK-0112, PR #71, not merged); contracts
`specs/029-proposal-gate/contracts/proposals.md`, `policy-and-authority.md`, `gate-api.md`,
`specs/028-session-model/contracts/session-events.md` and `projections.md`,
`specs/026-dnd5e-engine/contracts/commands.md`, `specs/031-dm-runtime/contracts/resolve.md`,
`specs/040-actor-snapshot/contracts/actor-snapshot.md`.

## Summary

Five changes, each in its own layer. Each layer has its own test.

1. **Engine.** Add the command `initiative.leave`. It takes a combatant out of the active
   encounter's order, keeps its state, and emits the existing `encounter.changed` event.
2. **Session model.** Catalogue `scene-presence.changed` v1. Fold it into a new
   `scenePresence` projection. Add the DM proposal kind `scene-presence` (policy `ask`). Its
   planner writes the presence row, plus the engine order rows, in one atomic batch. The
   declare gate refuses an absent character (`CHARACTER_UNABLE`, `reason: "absent"`).
3. **Snapshot and plan gate.** `buildSnapshot` reads presence from the projection.
   `checkPlan` fails an id whose S0 actor is absent, with reason `absent`, under
   `UNKNOWN_COMBATANT`.
4. **DM step grammar and resolve.** Add the presence effect. Resolve submits it as a
   `scene-presence` proposal. Resolve skips its own turn advance when the active combatant
   left the order this turn. Narration facts carry each landed change.
5. **Web.** The DM approvals panel renders the new kind with the existing field-list renderer.

The ruled frozen-contract amendments land in the phase that changes the code they describe.
Each is its own task.

Nothing else changes: no migration, runtime dependency, ws frame, purpose or engine event type.

## Technical Context

**Language/Version**: TypeScript (Node 22). Existing `tsc -b` builds.

**Primary Dependencies**: none new. `zod` covers the event, proposal and effect schemas.

**Storage**: none new. No migration. The presence row is one more `events` row through
`appendBatch`.

**Testing**: vitest, fake gateway, scripted dice. No paid run.
- Engine: new `packages/dnd5e-engine/test/commands/initiative-leave.test.ts` (unit,
  `scriptedRng`, `calls()` is 0 on a refusal). `test/coverage.test.ts` must see the command.
- Session model: `packages/session-model/test/catalog.test.ts`, `test/gate-plan.test.ts`, a
  projection test beside the existing fold tests (unit, hand-built streams).
- Server gate: `apps/server/test/gate.integration.test.ts` (DB; declare refusal and the
  atomic presence batch through `gate.submit`).
- Snapshot: `apps/server/test/dm/snapshot*.test.ts` (unit, fixture projections).
- Plan gate: `apps/server/test/dm/plan-gate.test.ts` (unit, from TASK-0112).
- Schemas and grammar: `apps/server/test/dm/schemas.test.ts` or its sibling (unit).
- Resolve: `apps/server/test/dm/resolve.integration.test.ts` (real Postgres, real gate,
  scripted dice, fake gateway). Needs `REQUIRE_DATABASE=1` on the worktree's own stack.
- Facts: `apps/server/test/dm/facts.test.ts` (unit).
- Web: the proposals renderer test beside `apps/web/app/play/proposals.ts`, if one exists;
  else a new unit test.

**Target Platform**: the one Node server process, the two pure packages and the web client.

**Project Type**: web service and libraries.

**Performance Goals**: unchanged. The projection fold gains one map update per presence row.

**Constraints**:
- The engine stays pure (biome override, `check:boundaries`, `purity.test.ts`). It gains no
  presence concept (CR-003).
- `resolve.ts` stays the only DM gate writer. The write-boundary test pins the set.
- The narrate import closure (`test/dm/boundary.test.ts`) must not gain an engine value import.
- S1 is still built after the last gate write (spec 040).
- Spec 045's group order holds. TASK-0112's plan gate runs before the opening moves, and its
  settling runs inside the turn advance.
- `SNAPSHOT_VERSION` stays 1.

**Scale/Scope**: about 16 source files, 9 contract or doc files, 9 test files, 4 wiki notes.

## Constitution Check

*Run against `.specify/memory/constitution.md` 2.0.0 before design and again after design.
Both runs pass.*

- [x] **I. Agent-operable** — the AI DM produces presence through `gate.submit`. A seated human
      DM approves or rejects the same proposal in the approvals panel. The declare refusal
      reaches a human, a companion and the scripted seat through one path with one code.
- [x] **II. Content contract** — no codex entity and no seed schema change (seed presence is
      TASK-0142).
- [x] **III. Data planes** — session plane only. The new projection is folded from the log. The
      snapshot reads it through the existing projection seam.
- [x] **IV. Event sourcing, server authority** — the change is a typed, versioned, public
      state-change event, written only through the gate. Every refusal appends nothing. The
      presence row and its engine rows land in one `appendBatch`. Old logs fold with every
      actor `present`. LLM output reaches the log only as a typed `scene-presence` proposal.
- [x] **V. Citations** — no library claim.
- [x] **VI. 5e engine boundary** — the initiative order changes only through engine commands
      (`initiative.leave`, `initiative.join`). An arrival's initiative is an engine roll. The
      new command ships scripted-dice tests, and the coverage meta-test names it.
- [x] **VII. Structured first** — the effect, the proposal and the event are closed Zod
      schemas. The reason list is closed, and code derives the new value.
- [x] **VIII. Operator-owned content** — no rulebook text.
- [x] **IX. Self-hostable** — no new container, dependency or service.

**Stack conformance** — within the Architecture Constraints table. No departure.

## Research

The operator rulings settle the four one-way doors. These decisions settle the rest.

- **R1. Projection key.** Decision: key `scenePresence` by the id named in the event, as
  written. Party actors match by character id, NPC actors by NPC id, monster actors by
  combatant id (FR-019). Rationale: the snapshot already uses these as actor ids. Alternative:
  key by combatant id. Rejected: party members and seed NPCs may have none.
- **R2. Actor existence at the gate.** Decision: the planner does not check that `actorId`
  names an actor. The plan gate checks every presence effect target against S0 before resolve
  submits it (FR-012). The snapshot ignores an entry that matches no actor (User Story 4,
  scenario 5). Rationale: the pure planner has no seed, so it cannot see a seed NPC with no
  combatant. A planner check would refuse the case the spec allows ("Edge Cases", seed NPC).
  Alternative: pass the seed into the planner. Rejected: it widens the pure gate core's input
  for one check.
- **R3. `initiative.leave` refusals.** Decision: reuse existing codes; no engine enum change.
  - No encounter: `NO_ACTIVE_ENCOUNTER`.
  - Unknown id: `UNKNOWN_COMBATANT`.
  - Not in the order: `UNKNOWN_COMBATANT` with `details: { combatantId, reason: "not-in-order" }`.
  - The order would be left with no entry: `NO_ELIGIBLE_COMBATANT`.

  Rationale: an engine code is a one-way door, and these four are reachable only by a direct
  command. The planner calls the leave only for a combatant in the order (FR-017). Alternative:
  a new `NOT_IN_ENCOUNTER` code. Rejected: no caller needs to tell it apart.
- **R4. The active combatant leaves.** Decision: `initiative.leave` removes the entry at
  `turnIndex`. The leave is the turn transition and mirrors `turn.advance`. It runs the
  turn-end condition expiry for the outgoing combatant. It skips dead entries, expiring their
  turn-start and turn-end conditions. When the index falls past the end, it wraps to 0 and the
  round increments. It runs the incoming combatant's turn-start expiry after `encounter.changed`.
  It refuses with `NO_ELIGIBLE_COMBATANT` when every remaining entry is dead.
  Rationale: the next combatant is then active exactly once (SC-003). Resolve detects the leave
  and skips its own `turn.advance` (D5). Alternative: refuse a leave by the active combatant,
  and make resolve advance first. Rejected: that splits the presence row and the order change
  into two batches.
- **R5. The arrival rejoin.** Decision: the planner runs `initiative.join` with
  `mode: "normal"` when the reason is `arrived`, an encounter is active, and the actor's
  combatant is not in the order. The roll is the engine's. Alternative: rejoin only on a
  Director encounter start. Rejected: an arrival mid-fight would never act.
- **R6. Presence effect target ids.** Decision: `targetId` uses `RefIdSchema`, not
  `CombatantIdSchema`, because a party actor id is a character id. Confirm both schemas accept
  the same character set before choosing. If they do, keep `CombatantIdSchema` for one
  grammar.

## Design

### D1. Engine: `initiative.leave` (FR-014 to FR-016, FR-018)

- `src/schema/commands.ts`: add `{ type: "initiative.leave", combatantId: Id, reason: Reason }`.
- `src/commands/encounter.ts`: add `handleInitiativeLeave`, with the checks of R3 in order, all
  before any event is built. It draws no die. It emits the turn-end expiry events when the
  leaver is active (R4), then `encounter.changed` (`combatantId`, `before`, `after`).
- `src/execute.ts`: register it in the handler map.
- `README.md` lists the command.
- No change to `combatant.remove` or `COMBATANT_IN_ENCOUNTER`.

### D2. Session model: event, projection, proposal kind (FR-001 to FR-005)

- New `src/events/scene-presence.ts`: `ScenePresenceSchema`, `PresenceReasonSchema`, the
  `REASON_TO_PRESENCE` map, and `ScenePresenceChangedV1`. The schema refines: `after` equals
  `REASON_TO_PRESENCE[reason]`, and `before !== after`.
- `src/catalog.ts`: `session("scene-presence.changed", "state-change", ScenePresenceChangedV1)`.
- `src/projections/types.ts`: `scenePresence: Record<string, { presence, reason, seq }>`.
  `apply.ts`: empty `{}`, and a `case "scene-presence.changed"` that records a `before`
  mismatch diagnostic and applies the row.
- `src/gate/proposals.ts`: add `scene-presence` to `ProposalKindSchema` (14 kinds), with
  `{ kind, ...ProposalNote, actorId: RefIdSchema, reason: PresenceReasonSchema, actionId: RefIdSchema.nullable() }`.
  `DmProposalKindSchema` grows to 12. Fix the stale "eleven" comment.
- `src/gate/permissions.ts`: DM-only kind, like `tracker`.
- `src/gate/policy.ts`: `"scene-presence": "ask"`.
- `src/gate/plan.ts`, `case "scene-presence"`:
  1. `UNKNOWN_ACTION` when `actionId` names no action.
  2. No actor-existence check (R2).
  3. `before` = the projection value, else `present`. `after` = `REASON_TO_PRESENCE[reason]`.
     `INVALID_PROPOSAL` when they are equal.
  4. Engine rows (FR-017). Let `cid` be the actor's combatant: for a party member, its
     `combatantId`; otherwise the actor id when it is an engine combatant.
     - `after === "absent"` and `cid` in the order: `execute(engine, initiative.leave)`.
     - `reason === "arrived"`, an encounter is active, and `cid` is not in the order:
       `execute(engine, initiative.join)`.
     - An engine refusal returns as source `engine`, as the `mechanics` case does.
  5. Rows: the `scene-presence.changed` row (public, actor `ai:dm` or the seated DM), then the
     `mechanicsRows` for the engine events, in one plan. The gate appends them atomically.
- `src/index.ts`: export the new schemas and the reason list.

### D3. Declare gate: absent (FR-022 to FR-024)

- `src/gate/refusals.ts`: `CHARACTER_UNABLE_REASONS = ["life-state", "absent"]`.
- `src/gate/plan.ts`, `action.declare`, beside TASK-0112's life-state check:
  - `absent(m)` = `p.scenePresence[m.characterId]?.presence === "absent"`.
  - Character scope: refuse when the member is absent (`reason: "absent"`), else apply the
    life-state rule.
  - Party scope: refuse when every controlled member is absent or unable. `reason` is `absent`
    when any member is absent, else `life-state`.
  - `details`: `{ characterId, reason: "absent" }` for an absent refusal.

### D4. Snapshot and plan gate (FR-012, FR-019, FR-020, FR-025, FR-026)

- `apps/server/src/dm/snapshot/build.ts`: replace the three `presence: "present"` literals
  with `presenceOf(projections, id)`, defaulting to `present`. An entry that matches no actor
  is ignored.
- `apps/server/src/dm/gates/plan-gate.ts` (TASK-0112):
  - `PlanFailureReason` gains `"absent"`.
  - Build `absentIds` from S0: for each absent actor, its `id` and its `combatantId`.
  - For ordinary step ids, fail with `absent` when the id is in `absentIds`. Check this after
    the existing validity checks, so an unknown id still reports `not-in-snapshot`.
  - For a presence effect, check `targetId` against the S0 actor ids. It passes for any S0
    actor, combatant or not. It fails with `absent` when the actor is absent, unless the reason
    is `arrived`.
  - The verdict code stays `UNKNOWN_COMBATANT` (OQ-4).
- `stepIds` gains the presence effect's field name, so the failure names `effects[j].targetId`
  or `onSuccess[j].targetId`.

### D5. Step grammar, resolve and facts (FR-008 to FR-011, FR-013, FR-016, FR-021)

- `apps/server/src/dm/nodes/schemas.ts`: `EffectSchema` gains
  `{ effect: "presence", targetId, reason: PresenceReasonSchema }`. The reason enum is imported
  from the session model, not hand-typed.
- `apps/server/src/dm/prompts/step-grammar.ts`: render the effect line and the reason list.
  Add two rules:
  - Another actor's presence change goes in `onSuccess`, `onFailure` or `onHit` of a roll
    against that actor.
  - The acting actor's own change may stand in an `effect` step.
- Bump `dm.interpret` and `dm.adjudicate` prompt versions. Update scripted DM fixtures only
  where a test asserts the version.
- `apps/server/src/dm/nodes/resolve.ts`:
  - `effectCommand` handles mechanics only. Add a branch in the effect runner: a presence effect
    calls `run.submit` with the `scene-presence` proposal (`actorId: targetId`, `reason`,
    `actionId`). Its result enters the submissions as any effect does. A refusal becomes a
    recorded result.
  - **Skip the second advance.** Record the active combatant id at the start of the turn. In
    the turn-advance group, when that combatant is no longer in the order, skip
    `turn.advance`. Still run TASK-0112 settling and the table-mode submit for the new active
    combatant.
- `apps/server/src/dm/facts.ts`: map a landed `scene-presence.changed` row to a fact
  `{ kind: "presence", name, presence, reason }`. Render it in the narration facts and in the
  code fallback line. Keep the edit additive (hotspot).
- **No Director field.** `DirectorOutput` is unchanged. New test: walk the schema's keys and
  assert that none matches `/presence/i`. Resolve test: across the Director fixtures, assert
  that no submission has kind `scene-presence`. Extend the write-boundary test: only
  `nodes/resolve.ts` builds a `scene-presence` proposal.

### D6. Web: approvals renderer (FR-006)

- `apps/web/app/play/proposals.ts`: `case "scene-presence"` returns the field list: actor (the
  `who()` helper or the id), reason, new value, visibility "Everyone". It needs no new
  component and no modal.

### Contract and doc edits (all ruled; FR-007, FR-018, FR-020, FR-024, FR-027)

| File | Edit | Phase |
|---|---|---|
| `specs/026-dnd5e-engine/contracts/commands.md` | Add `initiative.leave`, with its refusals (R3) and the active-leaver rule (R4) | 1 |
| `specs/028-session-model/contracts/session-events.md` | Add `scene-presence.changed` v1 (payload, reason-to-value rule, visibility `any`, kind state-change) | 2 |
| `specs/028-session-model/contracts/projections.md` | Add the `scenePresence` view and its fold rule | 2 |
| `specs/029-proposal-gate/contracts/proposals.md` (frozen) | Add the `scene-presence` kind and schema; 13 to 14 kinds; DM kinds 11 to 12; the gate fills `before` and `after`; the permission matrix row for DM kinds | 2 |
| `specs/029-proposal-gate/contracts/policy-and-authority.md` (frozen) | Add the `"scene-presence": "ask"` policy row | 2 |
| `specs/029-proposal-gate/contracts/gate-api.md` §1 (frozen) | Add a `scene-presence` rows-table row (presence row plus engine order rows; checks `UNKNOWN_ACTION`, and `INVALID_PROPOSAL` for no change). Add `reason: "absent"` to the `action.declare` row | 2 |
| `specs/040-actor-snapshot/contracts/actor-snapshot.md` | Rule 7: presence comes from the log. Extension table: TASK-0141 built; the plan gate's absent reason | 3 |
| `specs/031-dm-runtime/contracts/resolve.md` | The presence effect, the skipped second advance, the absent plan-gate reason | 4 |

Each frozen-contract edit carries a line "Amended 2026-10-27 (TASK-0141, operator ruling
OQ-n)", with the ruling quoted.

## Files touched

**Source**
- `packages/dnd5e-engine/src/schema/commands.ts`, `src/commands/encounter.ts`,
  `src/execute.ts`, `README.md`
- `packages/session-model/src/events/scene-presence.ts` (new), `src/catalog.ts`,
  `src/projections/types.ts`, `src/projections/apply.ts`, `src/gate/proposals.ts`,
  `src/gate/permissions.ts`, `src/gate/policy.ts`, `src/gate/plan.ts`, `src/gate/refusals.ts`,
  `src/index.ts`
- `apps/server/src/dm/snapshot/build.ts`
- `apps/server/src/dm/gates/plan-gate.ts`
- `apps/server/src/dm/nodes/schemas.ts`, `src/dm/prompts/step-grammar.ts`, the interpret and
  adjudicate prompt-version constants
- `apps/server/src/dm/nodes/resolve.ts`
- `apps/server/src/dm/facts.ts` (and `src/dm/fallback.ts` if the fallback renders facts
  itself)
- `apps/web/app/play/proposals.ts`

**Tests**
- `packages/dnd5e-engine/test/commands/initiative-leave.test.ts` (new)
- `packages/session-model/test/catalog.test.ts`, `test/gate-plan.test.ts`, and a projection
  fold test
- `apps/server/test/gate.integration.test.ts`
- `apps/server/test/dm/snapshot` build and diff tests
- `apps/server/test/dm/plan-gate.test.ts`
- `apps/server/test/dm/schemas.test.ts` (or the director schema test), plus the step-grammar
  prompt test
- `apps/server/test/dm/resolve.integration.test.ts`
- `apps/server/test/dm/facts.test.ts`
- `apps/server/test/write-boundary.test.ts`
- the web proposals renderer test

**Contracts and docs**: the table above, plus the wiki notes in the last phase.

**Migrations**: none. **New runtime dependencies**: none.

## Quickstart (validation)

1. `pnpm install --frozen-lockfile`, then `pnpm ci:check`.
2. `pnpm env:up`. Migrate both databases by hand. Export only `TEST_DATABASE_URL` from the
   worktree `.env`. Run `REQUIRE_DATABASE=1 pnpm --filter server test`.
3. Expect these outcomes:
   - A scripted Intimidation success against `goblin-1` lands `scene-presence.changed` and an
     `encounter.changed` row in one batch. S1 shows `goblin-1` absent.
   - A scripted failure lands neither.
   - The goblin takes no later turn.
   - A declare for an absent character is refused with `CHARACTER_UNABLE` (`reason: "absent"`).
   - An attack on an S0-absent goblin resolves `refused` with `UNKNOWN_COMBATANT`. The job
     result's plan-gate verdict says `absent`.

## Phases (one implementer dispatch each)

1. **Engine `initiative.leave`.** It is independent of PR #71, so it may start now.
2. **Session model.** Merge `origin/main` after PR #71. Then the event, projection, proposal
   kind, planner, declare-gate absent check, the 028 and 029 amendments, and the web renderer.
3. **Snapshot and plan gate.** Presence from the log, the plan-gate absent reason, and the
   040 contract.
4. **DM step grammar and resolve.** The effect, prompts, resolve submit, the skipped second
   advance, facts, the Director no-field tests, write-boundary, and the 031 contract.
5. **Wiki re-ground.**

## Risks

- **PR #71 is not merged.** Phases 2 to 4 build on its interfaces. If review changes
  `checkPlan`, `CHARACTER_UNABLE_REASONS` or settling, phase 2's merge absorbs it.
- **Hotspots** (runbook): `resolve.ts`, `facts.ts`, `packages/dnd5e-engine`,
  `packages/session-model/src/gate/plan.ts`, `proposals.ts`. Each phase merges `origin/main`
  first when main has moved.
- **The skipped second advance** interacts with TASK-0112 settling. Phase 4 tests a fled
  active NPC followed by a downed party member, so both rules run in one turn.
- **R2, no actor check in the planner.** A seated human DM could propose a change for an
  id that names no actor. The row lands, and the snapshot ignores it. The approvals panel shows
  the id, so the DM sees it before approving.

## Complexity Tracking

No Constitution Check gate fails. Nothing to justify.
