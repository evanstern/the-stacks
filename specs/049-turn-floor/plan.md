# Implementation Plan: Turn-mode floor passing between players

**Branch**: `task-0050-turn-floor` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: `specs/049-turn-floor/spec.md` (operator rulings FT-1 to FT-5 and Q1 to Q6, all
recommended defaults, recorded there); decision-0016, decision-0024, decision-0025; specs 044,
045, 046, 047 and 048 (all merged); frozen contracts `specs/029-proposal-gate/contracts/`,
`specs/030-play-route/contracts/proposal-seam.md`, `specs/031-dm-runtime/contracts/`. Code
read at `5cc34fb` (main with PR #73 merged).

## Summary

Four layers change; each has its own tests.

1. **Session model (pure).** A new proposal kind `floor` (`end`, `take`, `return`) planned as
   one atomic batch: the engine's `turn.advance`, spec 046 settling, and the `table-mode.changed`
   row for the next holder. Settling and `activeActorFor` become one pure rule in
   `gate/turn.ts`, shared with resolve. `action.commit` gains `override: "stall"` for `ai:dm`,
   with a `signoff` marker. Three refusal codes. A `turn-floor` fixture.
2. **Server.** Resolve uses the shared rules and one "turn moved" guard that folds in spec 048's
   skip. The enqueuer queues the AI follow-up after a human's floor row. A code-only `floor`
   job kind (one migration) runs the AI DM's absence pass and stall override, armed by the
   enqueuer, the presence reader and reconcile.
3. **Web.** Inline header controls (End turn; Pass, Take floor, Return floor), a turn-order
   strip, transcript floor lines, the card's "Commits on your turn" and "Suggest an
   alternative". No modal.
4. **Tests.** Pure tests, gate DB tests with two human seats, the full-round DB test with two
   humans and one AI companion (AC #6, the runbook merge condition), floor-job DB tests with
   injected clocks and presence.

No new event type, no WebSocket frame change, no new runtime dependency. One migration.

## Technical Context

**Language/Version**: TypeScript (Node 22); existing `tsc -b` builds.

**Primary Dependencies**: none new. `zod` covers the new proposal, job payload and result
schemas. `drizzle-kit` (installed) generates the migration.

**Storage**: Postgres `jobs` table: one migration (research R13). Floor changes are ordinary
`events` rows through `appendBatch`.

**Testing**: vitest; fake gateway; scripted dice; no paid run.
- Session model: `packages/session-model/test/gate-plan.test.ts`, `gate-permissions.test.ts`,
  `gate-policy.test.ts`, `gate-schemas.test.ts`, `gate-authority.test.ts` (replay check),
  `fixtures.test.ts`, new `gate-turn.test.ts` (settling rule, `activeActorFor`, `floorHeld`).
- Server gate: new `apps/server/test/gate.floor.integration.test.ts` (DB, two human seats).
- Resolve: `apps/server/test/dm/resolve.integration.test.ts` (the guard), new
  `apps/server/test/dm/turn-floor-round.integration.test.ts` (AC #6 full round through gate and
  worker on the fake gateway).
- Floor jobs: new `apps/server/test/dm/floor-jobs.integration.test.ts` (injected clock and
  presence reader), `apps/server/test/dm/jobs.integration.test.ts` (claim priority, uniqueness).
- Web: `apps/web/test/play/view-model.test.mjs`, `mode-badge.test.tsx`, `action-card.test.tsx`,
  `table-view.test.tsx`, `frames.test.mjs`, new `turn-order.test.tsx`; `no-dialog.test.mjs`
  must stay green.

**Target Platform**: the one Node server process, the pure packages, the web client.

**Project Type**: web service and libraries (monorepo).

**Performance Goals**: a human handoff is one gate append, no job hop; an AI handoff adds one
job claim (≤ `POLL_MS` 2 s), as today.

**Constraints**:
- `packages/session-model` stays pure (Biome override; no clock, no I/O). The stall window and
  absence wait live in the server; the planner has no clock.
- `resolve.ts` stays the only DM gate writer inside a turn; the floor job is a new `gate.submit`
  caller under `dm/`, pinned by a new write-boundary case (D5).
- The floor job makes no model call; the narrate boundary is untouched.
- Spec 045's group order and spec 046's settling semantics hold. Spec 048's leave skip holds.
- Never hand-merge `apps/server/drizzle/meta/_journal.json`.

**Scale/Scope**: about 20 source files, 8 contract files, 12 test files, 9 wiki notes.

## Constitution Check

*Run against `.specify/memory/constitution.md` 2.0.0 before research and again after design.
Both runs pass.*

- [x] **I. Agent-operable** — every floor move is a gate request (`floor`), the same for a
      human, a companion and `ai:dm`. The AI DM's waits submit through `gate.submit`.
- [x] **II. Content contract** — no codex entity.
- [x] **III. Data planes** — session plane only. The floor is a projection of the log; the job
      queue is the existing operational table.
- [x] **IV. Event sourcing, server authority** — floor changes are typed, catalogued, public
      rows written only by the gate, atomically; every refusal appends nothing. Presence that
      feeds an AI DM decision is logged in the same batch (`floor`, `signoff` markers). The
      client's controls are a display; the gate re-derives.
- [x] **V. Citations** — no library claim.
- [x] **VI. 5e engine boundary** — the turn order changes only through engine commands
      (`turn.advance`, `death-save.roll`); death saves are engine rolls; no model decides a pass
      or an override. No engine change, so no new scripted-dice engine test is owed; the
      planner's settling chain is tested with scripted dice.
- [x] **VII. Structured first** — closed Zod schemas for the proposal, the job payload and
      result.
- [x] **VIII. Operator-owned content** — no rulebook text.
- [x] **IX. Self-hostable** — no new container, dependency or service.

**Stack conformance** — within the Architecture Constraints table. No departure.

## Research

See [research.md](research.md): R1 shared settling rule, R2 `activeActorFor` moves, R3 batch
shape, R4 turn identity, R5 refusal order, R6 derived held floor, R7 one "turn moved" guard
with spec 048, R8 follow-ups, R9 the floor job, R10 arming, R11 stall override, R12 transcript
and labels, R13 the migration, R14 kind counts after 048.

## Design

Artifacts: [data-model.md](data-model.md), [contracts/floor-request.md](contracts/floor-request.md),
[contracts/floor-jobs.md](contracts/floor-jobs.md), [contracts/ui-floor.md](contracts/ui-floor.md),
[quickstart.md](quickstart.md).

### D1. Session model: the turn rules (FR-006, R1, R2, R6)

- New `packages/session-model/src/gate/turn.ts`: `activeActorFor`, `canAct`,
  `nextSettleStep`, `floorHeld`, `currentTurn(p)`. Exported from `src/index.ts`.
- `apps/server/src/dm/nodes/resolve.ts` and `settle.ts` import them; the local copies go.

### D2. Session model: the `floor` kind (FR-005 to FR-011, R3 to R5)

- `src/gate/proposals.ts`: the `floor` schema; kinds 14 → 15, DM kinds 12 → 13, request kinds
  18 → 19; fix the counting comments.
- `src/gate/permissions.ts`: the matrix in `contracts/floor-request.md`.
- `src/gate/policy.ts`: `floor: "ask"`.
- `src/gate/refusals.ts`: `FLOOR_NOT_HELD`, `TURN_MOVED`, `NOT_TURN_MODE`.
- `src/gate/plan.ts`: `case "floor"`: checks in R5 order; `end` runs `execute` +
  `evolve` for `turn.advance` and each `nextSettleStep`, builds one mechanics batch via
  `mechanicsRows`, then the `table-mode.changed` row; `ai:dm` prepends the `floor` marker from
  `PlanContext.present`.

### D3. Session model: stall override and fixture (FR-015, FR-016, FR-023, R11)

- `src/gate/proposals.ts`: `action.commit` `override?: "stall"`.
- `src/gate/plan.ts` `action.commit`: the override branch (R11).
- New `src/fixtures/turn-floor.ts`, registered in `src/fixtures/index.ts` (`turnFloor`).
- `test/gate-authority.test.ts`: replay-check additions (`contracts/floor-request.md`).

### D4. Server: gate wiring, resolve guard, enqueuer follow-up (FR-007, FR-012, R7, R8)

- `apps/server/src/gate/gate.ts`: the planner context already carries `present`; confirm it is
  filled for `floor` and `action.commit`.
- `resolve.ts` turn-advance group: `turnAtStart` with the round; the `moved` and `held` skips
  (R7).
- `apps/server/src/dm/enqueue.ts`: the human-actor `table-mode.changed` follow-ups.
- `apps/server/test/write-boundary.test.ts`: no change in this phase.

### D5. Server: the `floor` job (FR-013 to FR-018, R9, R10, R13)

- `apps/server/src/schema/jobs.ts`: CHECK, running index, `jobs_floor_queued_key`; generate
  `apps/server/drizzle/0007_*.sql` with `pnpm --filter server db:generate` (or the repo's
  generate script).
- `apps/server/src/dm/jobs.ts`: `FloorJobInput`, `FloorJobResult`, kind priority, the claim's
  `notBefore` filter for `floor`, `enqueueFloorCheck` (insert or move `notBefore`),
  `cancelFloorCheck`, reconcile.
- New `apps/server/src/dm/floor.ts`: `runFloorJob(deps, job)`.
- `apps/server/src/dm/worker.ts`: dispatch `floor` jobs; finish with the result.
- `apps/server/src/dm/enqueue.ts`: arming from rows (R10).
- `apps/server/src/index.ts`: subscribe `presence.reader.onChange` to the absence arming.
- `apps/server/test/write-boundary.test.ts`: add a case, like spec 048's scene-presence case,
  asserting that only `dm/floor.ts` builds a `floor` proposal or a `stall` override under
  `apps/server/src`.

### D6. Web (FR-003, FR-004, FR-019 to FR-022)

- `apps/web/app/play/view-model.ts`: `ModeView.held`, `order`, `FloorControls`, `floor`
  transcript items, card `commitsOnOwnTurn` and `suggest`.
- `apps/web/app/play/frames.ts`: `floorFrame`; `source.ts`: `floor(input)` on `TableSource`;
  `use-live-table.ts`, `use-fixture-table.ts` (`localEventOf` for `floor` in fixture mode).
- `apps/web/app/play/labels.ts`: refusal labels.
- `apps/web/app/play/proposals.ts`: `case "floor"` for the approvals list (field list).
- Components: `table-header.tsx` (controls), `mode-badge.tsx` (held), new `turn-order.tsx`,
  `transcript.tsx` (floor line), `action-card.tsx` (line and label).

### Contract and doc amendments (all ruled 2026-10-27)

| File | Edit | Ruling | Phase |
|---|---|---|---|
| `specs/029-proposal-gate/contracts/proposals.md` (frozen) | Add the `floor` kind and schema; kinds 14 → 15, DM kinds 12 → 13; `action.commit` `override: "stall"` | FT-1, FT-5 | 1, 2 |
| `specs/029-proposal-gate/contracts/policy-and-authority.md` (frozen) | `floor` permission rows and `floor: "ask"`; the stall override under step "Always" | FT-2, FT-5 | 1, 2 |
| `specs/029-proposal-gate/contracts/gate-api.md` (frozen) | Rows-table rows for `floor` (three ops) and the stall-override `action.commit`; §2 refusal codes; the spec 044 sentence "the DM commit path writes no marker" gains the stall exception | FT-1, FT-2, FT-5 | 1, 2 |
| `specs/029-proposal-gate/contracts/fixtures.md` (frozen) | `turn-floor` fixture row; replay-check additions | FT-4 | 2 |
| `specs/031-dm-runtime/contracts/turn-jobs.md` (frozen) | Kinds table with `floor`; enqueue-table rows; reconcile; constants | FT-3 | 3, 5 |
| `specs/031-dm-runtime/contracts/resolve.md` (frozen) | The one "turn moved" guard; shared settling and `activeActorFor` | FT-1, Q6 | 3 |
| `specs/030-play-route/contracts/ui-surfaces.md` | Floor controls, order strip, transcript line, card text (additive) | Q1, Q2 | 6 |
| `specs/044-group-signoff/contracts/signoff.md` | Note: the AI DM's stall override (spec 049) | FT-5 | 2 |

Each frozen-contract edit carries the line "Amended 2026-10-27 (TASK-0050, operator ruling
<item>)" with the operator's words quoted.

## Files touched

**Source**
- `packages/session-model/src/gate/turn.ts` (new), `src/gate/proposals.ts`,
  `src/gate/permissions.ts`, `src/gate/policy.ts`, `src/gate/refusals.ts`, `src/gate/plan.ts`,
  `src/fixtures/turn-floor.ts` (new), `src/fixtures/index.ts`, `src/index.ts`
- `apps/server/src/dm/nodes/resolve.ts`, `apps/server/src/dm/nodes/settle.ts`
- `apps/server/src/dm/enqueue.ts`, `apps/server/src/dm/jobs.ts`, `apps/server/src/dm/floor.ts`
  (new), `apps/server/src/dm/worker.ts`, `apps/server/src/index.ts`,
  `apps/server/src/schema/jobs.ts`, `apps/server/src/gate/gate.ts` (only if the context is not
  filled for `floor`)
- `apps/server/drizzle/0007_*.sql` (generated) and `meta/` (generated)
- `apps/web/app/play/view-model.ts`, `frames.ts`, `source.ts`, `use-live-table.ts`,
  `use-fixture-table.ts`, `local-log.ts` (if `localEventOf` lives there), `labels.ts`,
  `proposals.ts`, `components/table-header.tsx`, `components/mode-badge.tsx`,
  `components/turn-order.tsx` (new), `components/transcript.tsx`, `components/action-card.tsx`,
  `table-view.tsx`

**Tests**: listed under Technical Context.

**Migrations**: one, `0007` (research R13). **New runtime dependencies**: none.

## Phases (one sonnet implementer dispatch each)

1. Turn rules and the `floor` kind (session model) — AC #1, #3, #5.
2. Stall override and the `turn-floor` fixture (session model) — Q5 gate half, AC #6 fixture.
3. Server wiring: resolve guard, shared rules, enqueuer follow-up, gate DB tests — AC #3, #5.
4. Full-round DB test with two humans and one AI companion — AC #6.
5. The `floor` job kind and migration — Q5, decision-0024.
6. Play route — AC #2, #4, #5 UI.
7. Wiki re-ground.

## Risks

- **Hotspots** (runbook): `packages/session-model/src/gate/plan.ts`, `proposals.ts`,
  `apps/server/src/dm/nodes/resolve.ts`, `dm/worker.ts`, `apps/web/app/play/`,
  `apps/server/drizzle/`. Each phase merges `origin/main` first when main has moved; a later
  migration on main means regenerating 0007 after the merge.
- **Settling in two drivers.** Resolve checkpoints each settling step; the planner does not
  need to (one append). Phase 1 tests the rule; phase 3 tests that resolve's behaviour is
  unchanged (the spec 046 settle tests stay green).
- **Double follow-up.** R8's human-actor rule must not queue a second companion job for a row
  resolve wrote. Phase 3 tests both actors.
- **Presence flapping.** An absence check re-reads presence when it fires; a human who returns
  inside the wait is never passed (spec US 4 scenario 2).
- **TASK-0157** (gate `CONFLICT` on bursty concurrent talk): a floor request in a burst can be
  refused `CONFLICT`; the client shows it inline. No change here.

## Complexity Tracking

No Constitution Check gate fails. Nothing to justify.
