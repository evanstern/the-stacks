# Implementation Plan: An encounter-ending action resolves before the encounter ends

**Branch**: `task-0110-encounter-end-resolves` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: `specs/045-encounter-end-resolves/spec.md`; decision-0025 (D17) §4 and §2.5;
`docs/design/actor-state-gate.md` G3 and §4.2; contracts `specs/031-dm-runtime/contracts/`
`turn-jobs.md`, `resolve.md`, `director.md`; spec 040 (the actor snapshot, merged).

## Summary

Reorder the groups inside the `resolve` node. Split today's `directorGroup` into opening moves
(scene-start setup, encounter start) and closing moves (tracker advances, free mode with
encounter end, scene end). Run: opening moves, rulings, action groups, NPC group, closing
moves, turn advance. Keep every submission's key, kind, marker and reason. Document the order
in the turn-jobs contract and align `resolve.md` and `director.md`. Prove it with resolve-level
row-order tests and an end-to-end reproduction of run 183818Z rows 260–265 through the real
worker, gate and engine with the fake gateway and scripted dice.

No prompt, prompt version, purpose, engine command, event type, frame, proposal kind,
migration or dependency changes.

## Technical Context

**Language/Version**: TypeScript (Node 22), the server package's existing `tsc -b` build.

**Primary Dependencies**: none new.

**Storage**: none new. Rows are the existing session events written through the gate.

**Testing**: vitest. `apps/server/test/dm/resolve.integration.test.ts` (real Postgres, real
gate, scripted dice, no model) and a new end-to-end test in the pattern of
`apps/server/test/dm/full-turn.integration.test.ts` (worker, queue, gate, engine, fake gateway
script under `apps/server/test/dm/scripts/`). Both need `REQUIRE_DATABASE=1` on the worktree's
own stack.

**Target Platform**: the one Node server process.

**Project Type**: web service; server package only.

**Performance Goals**: unchanged. The same submissions run; only their order changes. The
encounter-start branch's one `loadProjections` read stays where it is.

**Constraints**: the narrate import closure and the `dm/` boundary
(`test/dm/boundary.test.ts`) stay intact; `resolve.ts` stays the only gate writer; model call
count and order are unchanged; S1 is still built after the last gate write (spec 040).

**Scale/Scope**: one function body in one node file, three contract files, two test files,
one script fixture, four wiki notes.

## Constitution Check

*Gate run against `.specify/memory/constitution.md` 2.0.0, before design and again after
design. Both runs pass.*

- [x] **I. Agent-operable** — the change is inside the DM agent's own pipeline and is proven
      through the real worker with a scripted agent (fake gateway). No human-only path.
- [x] **II. Content contract** — no codex entity, no seed schema change.
- [x] **III. Data planes** — session plane only. No new table, no cross-plane import.
- [x] **IV. Event sourcing, server authority** — no new event type; the gate stays the only
      writer and `resolve` its only DM caller. The change makes the log causal: an action's
      resolution precedes the stage change it caused. Replay folds the same events.
- [x] **V. Citations** — rulings still land as `journal` rows with their citations, now
      before the action groups exactly as today.
- [x] **VI. 5e engine boundary** — no engine change. The engine still owns every number;
      scripted dice drive every test that asserts an outcome.
- [x] **VII. Structured first** — not applicable beyond this: no UI change.
- [x] **VIII. Operator-owned content** — ships no rulebook content.
- [x] **IX. Self-hostable** — no service, container or dependency. No paid model run.

**Stack conformance**: within the Architecture Constraints table. No amendment.

## Design

### Group order (FR-001 – FR-005)

| # | Group | Submissions (keys unchanged) | Runs when |
|---|---|---|---|
| 1 | Director opening | `director:scene`, `director:combatant:<id>`, `director:party:<id>`, `director:tracker:<id>:new` (scene start); `director:combatant:<id>`, `director:initiative`, `director:table-mode` (decision `turn`) | always, hold included |
| 2 | Rulings | `ruling:<n>` | not hold |
| 3 | Actions | `act:<actionId>:…`, `act:<actionId>:resolve` | not hold |
| 4 | NPC | `npc:…` | not hold, `npcTurn` set |
| 5 | Director closing | `director:tracker:<id>`, `director:encounter-end`, `director:table-mode` (decision `free`), `director:scene-end` | always, hold included |
| 6 | Turn advance | `advance`, `advance:table-mode` | not hold, mode `turn`, encounter active, mode not just started |
| — | (batch gate, TASK-0147) | — | slot between 5 and S1, empty here |

The `scene-start` branch keeps its early `return` inside the opening group: on scene start
the closing moves do not run, exactly as today. The `director:table-mode` key is used by
either the `turn` decision (opening) or the `free` decision (closing), never both in one job:
the Director yields one `tableMode` decision per turn. Scene end keeps its own conditional
`director:table-mode` submission; it runs only while `local.mode` is still `turn`, so after a
`free` decision it is skipped, as today.

### Code shape

In `apps/server/src/dm/nodes/resolve.ts`:

1. Replace `directorGroup` with `directorOpening(run, ctx, assembled, director, local)` and
   `directorClosing(run, ctx, assembled, director, local)`. Move code; change no submission
   body. `endEncounter` and `setMode` become helpers both can call (closing uses both; opening
   uses `setMode`).
2. In the node body: opening, then (unless hold) rulings, actions, NPC; then closing; then
   (unless hold) the turn advance block, unchanged.
3. Update the module doc comment and the `Local` comments to name the order and cite
   decision-0025 §4.

The turn advance block already checks `local.mode === "turn" && local.encounterActive &&
!local.modeJustStarted`, and the closing moves set `local.encounterActive = false` and
`local.mode = "free"`. So FR-004 needs no new condition; a test pins it.

The `nextJob` computation reads `local.newTableMode` and `local.mode` after all groups, so it
is unchanged.

### Contracts (FR-009, AC #2)

- `turn-jobs.md`: new section "Resolve order (decision-0025 §4)" after "Beats": the table
  above in prose, the encounter-start exception with its reason, hold, the batch-gate slot,
  the decision-0017 amendment, and the reclaim note of OQ-2 option (a).
- `resolve.md` "Order of work": renumber to the six groups; keep its group descriptions.
- `director.md` "Decision → proposals": add a column or note naming each decision's group
  (opening or closing); "Holding a beat" step 1 names both.

### Tests

- Resolve level (`resolve.integration.test.ts`), by row seq:
  1. Free decision plus a committed check: `action.resolved` < `encounter.ended` <
     `table-mode.changed` (free); no `turn.advanced`.
  2. Free mode, a committed attack on `goblin-2`, decision `turn` for `reed-camp`:
     `combatant.added` and `encounter.started` < the attack's rows; no `UNKNOWN_COMBATANT`;
     no turn advance.
  3. NPC turn plus a free decision: the NPC step rows < `encounter.ended`.
  4. Tracker advance plus scene end with a committed action: `action.resolved` <
     `tracker.changed` (advance) < `encounter.ended` < `scene.changed` (after null).
  5. Hold: opening then closing, no action group submissions.
  6. The refused shape: a reading whose first step names `pell` resolves `refused` with
     `UNKNOWN_COMBATANT`, and its `action.resolved` precedes `encounter.ended`.
  The existing tests (scene start, enter turn mode, end encounter, tracker and scene end,
  reclaim replay, in-flight marker, S1 cases) must pass unchanged, except where one asserts the
  old order: change that assertion and say so in the commit message.
- End to end (new `apps/server/test/dm/encounter-end-resolves.integration.test.ts`, with
  script `apps/server/test/dm/scripts/encounter-end-bargain.json`): start the scene; reach turn
  mode in `reed-camp` with Odo active (script the initiative dice so Odo is the active
  combatant, or drive turns to him); commit Odo's bargain as `act-odo-5` from
  `ai:companion:odo` with authority `active-player`; script director (`tableMode: free`, reason
  quoting row 262's), interpret (Persuasion check by `odo`, DC from the seed, empty effects),
  narrate, audit and chronicle; scripted d20 succeeds. Assert AC #1: `act-odo-5` resolved
  `applied` with a batch id; seq order `action.committed` < check rows < `action.resolved` <
  `encounter.ended` < `table-mode.changed` (free) < `narration`; no `turn.advanced` after
  `encounter.ended`; the shipped narration does not contain "cannot do that here"; free mode
  at the end. The file's doc comment cites the evidence path and rows 260–265.

## Files touched

| File | Change |
|---|---|
| `apps/server/src/dm/nodes/resolve.ts` | split `directorGroup`; reorder the node body; doc comments |
| `apps/server/test/dm/resolve.integration.test.ts` | six order tests; adjust any old-order assertion |
| `apps/server/test/dm/encounter-end-resolves.integration.test.ts` | new: the rows 260–265 reproduction |
| `apps/server/test/dm/scripts/encounter-end-bargain.json` | new: fake gateway script and dice |
| `apps/server/test/dm/world.ts` | only if a helper is needed to reach turn mode with a chosen active actor |
| `specs/031-dm-runtime/contracts/turn-jobs.md` | new "Resolve order" section |
| `specs/031-dm-runtime/contracts/resolve.md` | "Order of work" |
| `specs/031-dm-runtime/contracts/director.md` | group per decision; hold step 1 |
| `docs/wiki/dm-runtime.md`, `dm-turn-jobs.md`, `dm-failure-and-gates.md`, `dnd5e-engine.md` | review and re-pin (Phase 4) |
| `docs/wiki/INDEX.md`, `docs/wiki/CAPSULES.md` | state paragraph; regenerate on any `description:` change |

**Migrations**: none. **New runtime dependencies**: none.

## Project Structure

```text
specs/045-encounter-end-resolves/
├── spec.md
├── plan.md                    # this file
├── checklists/requirements.md
└── tasks.md
```

No `research.md`, `data-model.md` or `contracts/` of its own: the design has no open research
item, adds no entity, and amends the existing `specs/031-dm-runtime/contracts/` in place.

## Complexity Tracking

None. No constitution violation to justify.
