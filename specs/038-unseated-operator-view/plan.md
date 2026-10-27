# Implementation Plan: An unseated operator views the table as a player

**Branch**: `task-0118-unseated-operator-view` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/038-unseated-operator-view/spec.md`

**Skill notes**: `setup-plan.sh` and the agent-context script were not run. The branch name is
not `NNN-` shaped, and the agent-context script would edit `CLAUDE.md`, which this card does
not own. `.specify/feature.json` points at this spec dir. Research and design are inline below
(small bug card). No `contracts/` and no `data-model.md`: no interface or entity changes.

## Summary

Collapse the `/play` client's viewer rule to the server's rule. `viewerFor(user, projections)`
returns the DM viewer only when the user holds the human DM seat. It returns the player viewer
with the user's id otherwise. The account-role fallback goes. An unseated operator then gets
the existing spectator player view: no approvals trigger, no character picker, "Action"
unavailable with the existing hint.

## Technical Context

**Language/Version**: TypeScript, Node 22

**Primary Dependencies**: React 19, React Router 8 (existing); `@the-stacks/session-model`
(`Viewer`, `project`, `SessionProjections`)

**Storage**: N/A (no migration)

**Testing**: `node --test` (`apps/web/test/play/viewer.test.mjs`) and Vitest
(`apps/web/test/play/table-view.test.tsx`), both under `pnpm --filter @the-stacks/web test`

**Target Platform**: browser, `/play/:sessionId`

**Project Type**: web app (monorepo `apps/web`)

**Performance Goals**: N/A (one pure function)

**Constraints**: no change to `apps/server`, socket frames, or frozen contracts; no modals

**Scale/Scope**: two source files, two test files, one wiki note

## Research (inline)

### R1 — what an unseated operator sees

- **Decision**: the spectator player view, `{ role: "player", userId: user.id }`. It is the
  view an unseated player already gets.
- **Rationale**: the server sends this operator player-filtered events
  (`apps/server/src/ws/registry.ts` `viewerFor`, TASK-0045). A DM viewer over those events
  shows DM controls with no DM data behind them. The player viewer matches what arrives. It
  needs no new UI. The debug view (TASK-0117) is where an operator reads DM-only data
  (`docs/design/debug-view.md`).
- **Alternatives considered**:
  - Keep the DM viewer and hide only the approvals trigger. Rejected: `isDm` also drives the
    composer hint and the commit control's DM branch (`authority.ts`), so a half-DM view would
    still claim authority the gate refuses.
  - A distinct "spectator" viewer role. Rejected: `Viewer` lives in `session-model` and is
    shared with the server's `canSee`. Adding a role widens a hotspot package for no
    behaviour the player viewer lacks.
  - Change the server to give an operator the DM view. Rejected: reverses the TASK-0045
    ruling and is out of this card's scope.

### R2 — does `viewerFor` still need the character-controller branch?

- **Decision**: no. With the fallback gone, branch 2 and branch 3 both return the same player
  viewer. The function reduces to the seat check. Keep the `LiveUser` and `ViewerProjections`
  signature so callers do not change.
- **Rationale**: one rule, mirrored from the server, cannot drift between branches. The
  character-controller case keeps its result (card AC #2) because the result was always the
  player viewer.
- **Alternatives considered**: keep the branch for readability. Rejected: dead code that reads
  as if it decides something.

### R3 — the seed fold in `useLiveTable`

- **Decision**: seed the fold with the player viewer for every user, not by account role.
- **Rationale**: the seed fold exists only to read `gate.seat` and `party`, which are public
  rows. Seeding by role is the last account-role branch on the live viewer path. A player
  seed gives the same seat and party for every user.
- **Alternatives considered**: leave the seed. Rejected: its comment ("the seed fold uses the
  account-role fallback") becomes false, and the role branch invites the old bug back.

## Design

### `apps/web/app/play/viewer.ts`

- `viewerFor(user, projections)`: return `{ role: "dm" }` when
  `projections.gate.seat` is `{ kind: "human", userId: user.id }`; else return
  `{ role: "player", userId: user.id }`.
- Rewrite the doc comment: the client mirrors `ws/registry.ts` `viewerFor` (TASK-0045); the
  account role does not decide the viewer (TASK-0118); an unseated user, operator included, is
  a spectator player.
- `LiveUser` keeps `role` (callers pass the root loader's user). `ViewerProjections` may
  narrow to `Pick<SessionProjections, "gate">`. Keep `"party"` in the `Pick` if narrowing
  breaks a caller's type; either is acceptable.

### `apps/web/app/play/use-live-table.ts`

- Seed `project(events, …)` with `{ role: "player", userId: user.id }` for every user.
- Update the comment above the `useMemo`.

### Tests

- `apps/web/test/play/viewer.test.mjs`:
  - Change the "unseated operator" row to expect `{ role: "player", userId: "op-1" }`.
  - Add: unseated operator, AI seat, empty party → player viewer.
  - Add: unseated operator, human seat held by `"dm-2"` → player viewer.
  - Add: operator controlling a character while `"dm-2"` holds the human seat → player viewer.
  - Keep the seat-holder, character-controller and player rows unchanged.
  - Add a view-model assertion: for the unseated operator's viewer, `toTableViewModel` gives
    `isDm === false`, `proposals` empty even when the input carries proposals, and
    `composer.actionAvailable === false`.
- `apps/web/test/play/table-view.test.tsx`:
  - Add: render the `dm-approvals` fixture with the viewer `viewerFor` derives for an unseated
    operator. Assert no "Pending proposals" and no modal markup.

### Files touched

| File | Change |
|---|---|
| `apps/web/app/play/viewer.ts` | rule collapsed to the seat check; doc comment |
| `apps/web/app/play/use-live-table.ts` | player seed fold; comment |
| `apps/web/test/play/viewer.test.mjs` | updated and new rows; view-model assertion |
| `apps/web/test/play/table-view.test.tsx` | unseated-operator render test |
| `docs/wiki/play-route.md` | viewer prose; re-pin |
| `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md` | only if `play-route`'s `description:` or the state paragraph changes |

**Migrations**: none. **New runtime dependencies**: none.

## Constitution Check (constitution 2.0.0)

| Principle | Result |
|---|---|
| I. Agent-Operable | PASS. The viewer is a pure function over projections. An agent at the table gets the same rule as a human. No human-only path. |
| II. Content Is a Contract | N/A. No codex entity. |
| III. Three Data Planes | PASS. Session plane only; no new cross-plane import. |
| IV. Event-Sourced Play, Server Authority | PASS, and improved. Client state stays a projection of the log. The client's viewer now matches the server's per-viewer filter instead of claiming DM authority the server does not grant. |
| V. Grounded Claims | N/A. |
| VI. 5e Engine Boundary | N/A. |
| VII. Structured Before Styled | N/A. |
| VIII. Operator-Owned Content | N/A. |
| IX. Self-Hostable | PASS. No service, dependency or config added. |
| Architecture Constraints | PASS. No stack change. |
| Workflow gates | PASS. One task, one PR; dispatched phases; wiki re-pin phase in `tasks.md`. |

Post-design re-check: unchanged. No Complexity Tracking entries.

## Project Structure

```text
specs/038-unseated-operator-view/
├── spec.md
├── plan.md
├── quickstart.md
├── tasks.md
└── checklists/requirements.md
```

## Complexity Tracking

None.
