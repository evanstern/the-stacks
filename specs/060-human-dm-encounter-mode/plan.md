# Implementation Plan: Human DM ends an encounter or changes table mode from the table

**Branch**: `task-0165-human-dm-encounter-mode` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: `specs/060-human-dm-encounter-mode/spec.md`. Written against OQ-1 to OQ-6 (a). A ruling
other than (a) amends this plan, the contract and tasks.md before Phase 1 dispatches.

## Summary

The play route gains two gate request builders (`encounterEndFrame`, a `mechanics` request with the
engine's `encounter.end`; `tableModeFrame`, a `table-mode` request), two `TableCommands`
(`endEncounter`, `setTableMode`), and a DM-only "Table mode" header button that opens a `Panel`
slide-out. The panel shows the mode and the encounter state, one optional reason field, and only the
allowed buttons: "End encounter", "Switch to free mode", "Switch to turn mode". End encounter sends
the mechanics request and then, in turn mode, the free-mode request. The gate, the engine, the event
catalog and the server source are unchanged. One DB test proves the requests apply directly on the
real gate and what the enqueuer queues after them.

## Technical Context

**Language/Version**: TypeScript 5.x (erasable syntax in `apps/web/app/play/`), Node 24.
**Primary Dependencies**: React Router 8, React, `@the-stacks/session-model` (`ReasonSchema`,
`TableModeSchema`, `GATE_REQUEST_VERSION`, `activeActorFor`, `currentVersion`, `project`). No new
runtime dependency. `apps/web` does not import `@the-stacks/dnd5e-engine`; the engine command is a
plain object the gate's engine validates.
**Storage**: none new. No migration.
**Testing**: vitest and `node --test` in `apps/web` (Node, `renderToStaticMarkup`, no DOM library).
Server DB tests are environment-gated (`REQUIRE_DATABASE=1`); the orchestrator runs them.
**Target Platform**: the existing one-process server and the SSR web app.
**Project Type**: web app (monorepo: `apps/web`, `apps/server`, `packages/session-model`).
**Performance Goals**: none beyond the existing table.
**Constraints**: no modals (slide-out `Panel` only). No frozen contract change. No provider spend:
the live check uses `DM_FAKE_SCRIPT`.
**Scale/Scope**: about 9 web modules touched or added, one new server test, no server source.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable** — the controls send the existing `mechanics` and `table-mode` gate
      requests over the WebSocket `send` frame. An agent sends the same requests (the evidence
      script and the DB test do). No human-only path.
- [x] **II. Content contract** — no codex entity. N/A.
- [x] **III. Data planes** — new state is UI state (the reason draft) or session-plane reads. The
      writes are session-plane gate requests.
- [x] **IV. Event sourcing** — each click writes gate-validated rows (`encounter.ended`,
      `table-mode.changed`). No optimistic append in live mode.
- [x] **V. Citations** — no library claim. N/A.
- [x] **VI. 5e engine boundary** — the encounter end runs through the engine's `encounter.end`
      command inside the gate. The web builds the command object and computes no number. Fixture
      mode hand-builds one `encounter.ended` row for display only, as `localFloorEvents` already
      does for `turn.advanced`.
- [x] **VII. Structured first** — `after` is `TableModeSchema`-checked and `reason`
      `ReasonSchema`-checked before sending.
- [x] **VIII. Operator-owned content** — no rulebook text. The evidence script carries no prose.
- [x] **IX. Self-hostable** — no new container or service.

**Stack conformance**: TypeScript, React Router 8, Zod via session-model. No departure.

## Research (Phase 0)

- **R1 — The gate needs no change.** Decision: reuse `mechanics` (with `{ type: "encounter.end",
  reason }`) and `table-mode` (029 `proposals.md`). A seated human DM's request is applied directly.
  Alternatives: a new "end encounter" request kind (rejected: a frozen 029 change for no gain).
- **R2 — The order follows the AI DM.** `directorClosing` (`apps/server/src/dm/nodes/resolve.ts`)
  ends the encounter, then sets free mode. `endEncounter` does the same (OQ-2 (a)). The gate orders
  a session's writes in arrival order (TASK-0157, spec 052), so the two requests land in order.
- **R3 — Turn mode needs an encounter.** `currentTurn` is null with no encounter, and the floor
  planner refuses `NOT_TURN_MODE`. So `turnAfter` is offered only with an encounter, and names
  `activeActorFor(p, encounter.activeCombatantId)` (OQ-3 (a)). This is the actor the AI DM's
  `setActiveMode` writes.
- **R4 — Which projection the view reads.** `tableModeView` reads the viewer's projection
  (`project(events, viewer)` in `TableView`). `p.encounter` and `p.tableMode` come from public rows,
  so a DM viewer sees them. Fixture-mode builders read the DM projection
  (`project(events, fixture.viewers.dm)`), as `appendFloor` does.
- **R5 — What the server queues afterwards.** `enqueue.ts` rule 4 queues the AI follow-up only for
  a human-written turn-mode row. A free-mode row and a human mechanics batch queue nothing (OQ-6
  (a)). The DB test pins both facts.
- **R6 — Who sees the button.** `model.isDm` (live: `viewerFor` gives `{ role: "dm" }` only to the
  seated human DM). Same rule as spec 055 D-6 (OQ-5 (a)).
- **R7 — The live check needs no new DM script.** The shipped `greyhollow-human-dm` script runs the
  human-DM scene start. The human DM's own `mechanics` and `table-mode` requests make no model
  call. An evidence script starts the encounter with a human-DM `initiative.roll` whose only
  participant is Tamsin (the player's character), so the turn-mode row names a human and rule 4
  queues no model turn. Dice past the script's list fall back to the seeded RNG
  (`apps/server/src/dm/script/env.ts`).

## Data model (Phase 1)

Web-local types only. The full shapes are in
[contracts/table-mode-control.md](contracts/table-mode-control.md).

- `EncounterEndInput { reason; thenFree }`, `TableModeInput { reason; after: TableMode }`
  (`source.ts`).
- `TableModeView { mode; encounterActive; canEnd; canFree; turnAfter }` (`table-mode.ts`, new).
- `TableViewModel.tableMode: TableModeView | null` (null unless `isDm`).

Rules:

- `canEnd` = `p.encounter !== null`. `canFree` = `p.tableMode.mode === "turn"`.
- `turnAfter` = free mode and an encounter: `{ mode: "turn", ...activeActorFor(p,
  p.encounter.activeCombatantId) }`; else null.
- `endEncounter` passes `thenFree: view.mode === "turn"`.
- A blank reason becomes the action's default (`tableModeReason`).

## Contracts (Phase 1)

- New: [contracts/table-mode-control.md](contracts/table-mode-control.md) — frames, commands,
  fixture rows, the view, the panel's accessible names.
- Amended, additive, each a dated "Amendment, TASK-0165 (additive)" block:
  - `specs/030-play-route/contracts/ui-surfaces.md` — `TableHeader` gains `modeOpen` and `onMode`;
    a `TableModePanel` row; accessible names (OQ-1 (a)).
  - `specs/030-play-route/contracts/live-frames.md` — `endEncounter` and `setTableMode` rows
    (`eventType` `mechanics` and `table-mode`).
  - `specs/030-play-route/contracts/table-source.md` — `TableCommands.endEncounter` and
    `setTableMode`.
- Unchanged: `specs/030-play-route/contracts/proposal-seam.md`, every
  `specs/029-proposal-gate/contracts/` file, `docs/wiki/ws-protocol.md` frame shapes,
  `specs/031-dm-runtime/contracts/turn-jobs.md`.

## Quickstart (Phase 1)

[quickstart.md](quickstart.md): the live check on the worktree stack in script mode.

## Project Structure

### Documentation (this feature)

```text
specs/060-human-dm-encounter-mode/
├── spec.md
├── plan.md                         # this file (research and data model inline)
├── quickstart.md                   # the live check
├── contracts/table-mode-control.md
├── checklists/requirements.md
├── tasks.md
└── evidence/                       # created by Phase 4: db-run.md, mutation-guard.md, live-run.md, scripts, shots/
```

### Source code touched

| File | Change | Phase |
|---|---|---|
| `apps/web/app/play/frames.ts` | add `encounterEndFrame`, `tableModeFrame`, `tableModeReason` | 1 |
| `apps/web/app/play/source.ts` | add `EncounterEndInput`, `TableModeInput`; `TableCommands.endEncounter`, `setTableMode` | 1 |
| `apps/web/app/play/use-live-table.ts` | `endEncounter` (mechanics, then free when `thenFree`), `setTableMode` | 1 |
| `apps/web/app/play/local-log.ts` | add `localEncounterEndEvents`, `localTableModeEvents` | 1 |
| `apps/web/app/play/use-fixture-table.ts` | `endEncounter`, `setTableMode` append the local rows | 1 |
| `apps/web/app/play/table-mode.ts` | new: `TableModeView`, `tableModeView` | 2 |
| `apps/web/app/play/view-model.ts` | `TableViewModel.tableMode` | 2 |
| `apps/web/app/play/components/table-mode-panel.tsx` | new: `TableModePanel`, `TABLE_MODE_PANEL_ID` | 2 |
| `apps/web/app/play/components/table-header.tsx` | `modeOpen`, `onMode`; "Table mode" trigger | 2 |
| `apps/web/app/play/table-view.tsx` | panel state; mount `TableModePanel` in `Panel` | 2 |
| `specs/030-play-route/contracts/{ui-surfaces,live-frames,table-source}.md` | additive TASK-0165 blocks | 2 |
| `apps/web/test/play/frames.test.mjs`, `local-log.test.mjs`, `use-fixture-table.test.mjs` | new cases | 1 |
| `apps/web/test/play/table-mode.test.mjs` (new), `view-model.test.mjs` | new cases | 2 |
| `apps/web/test/play/table-mode-panel.test.tsx` (new), `table-view.test.tsx`, `equivalence.test.tsx` | new cases | 2 |
| `apps/server/test/dm/human-dm-encounter.integration.test.ts` (new) | DB test for FR-016 | 3 |
| `specs/060-human-dm-encounter-mode/evidence/*` | DB record, mutation guard, live check script, shots | 4 |
| `docs/wiki/play-route.md`, `docs/wiki/turn-floor.md`, `docs/wiki/INDEX.md`, `docs/wiki/CAPSULES.md` (+ notes the gate flags) | re-ground | 5 |
| `docs/design/m3-table-sweep-runbook.md` | TASK-0165 execution-log row | 5 |

No migration. No new runtime dependency. No server source file changes.

**Structure Decision**: the existing monorepo layout and the play route's
pure-module-plus-component pattern (`frames.ts`, `local-log.ts`, a pure view module, a component,
`TableView` state), as spec 055 used.

## Risks

- **`equivalence.test.tsx`** renders both sources for each fixture. The new header button shows for
  the DM viewer in both, so equivalence holds. If a fixture's DM projection differs between sources,
  fix the source, not the test.
- **`no-dialog.test.mjs`** scans the web app for dialog roles. The panel uses `Panel` only.
- **The AI DM and a stale encounter.** If an AI DM turn is in flight when the human DM ends the
  encounter, that turn's later mechanics may refuse `NO_ACTIVE_ENCOUNTER`. That is the gate working;
  the turn records its refusals. No fix in this card.

## Test and run notes for the orchestrator

- Implementers run `pnpm --filter @the-stacks/web test` and `pnpm ci:check` without
  `REQUIRE_DATABASE`.
- The orchestrator runs the DB test: export only `TEST_DATABASE_URL` from the worktree `.env`, then
  `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/dm/human-dm-encounter.integration.test.ts`,
  then `REQUIRE_DATABASE=1 pnpm ci:check`. Never `source` the whole `.env`.
- DB scene tests can hit the 5 s vitest timeout under full-suite load (TASK-0154). Re-run once and
  report.

## Complexity Tracking

No constitution violations. Nothing to justify.
