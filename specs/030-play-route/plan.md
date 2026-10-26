# Implementation Plan: First Scene — play route: composer, commit control, ledger, DM approvals

**Branch**: `task-0047-play-route` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/030-play-route/spec.md`

## Summary

Replace the M0 play route's event list with the First Scene table view: one composer for talk or
action, action cards with comments and a commit control for the authority holder, a table-mode
badge, a ledger panel, and a DM approval panel. Every view derives from TASK-0044's
`project(events, viewer)`. One `TableView` takes one `TableSource`; a live hook (WebSocket, via the
existing `useSession`) and a fixture hook (TASK-0044's committed fixtures, stepped and viewed as any
viewer) build that source, which is how AC #7 is proven. TASK-0045's proposal types are not visible
yet, so the approval panel and commit control build against a frozen seam
(contracts/proposal-seam.md); the final phase wires that seam to TASK-0045 after it merges.

## Technical Context

**Language/Version**: TypeScript 5 (erasable syntax for pure modules), React 19, Node 22.

**Primary Dependencies**: React Router 8 framework mode, Tailwind v4, shadcn/ui (`Sheet` via the
shared `Panel`), `@the-stacks/session-model` (workspace, new to `apps/web`), `zod` (transitively).
No new runtime dependency. Dev only: `vitest` `^5.0.1` added to `apps/web` (already in the lockfile).

**Storage**: none. The route reads the session log through the WebSocket protocol.

**Testing**: `node:test` for pure modules (`test/play/*.test.mjs`, importing `.ts` directly) and for
SSR and grep gates; `vitest` + `react-dom/server` for component markup (`test/play/*.test.tsx`).

**Target Platform**: evergreen browsers; Brave for evidence.

**Project Type**: web app (`apps/web`), client-only routes.

**Performance Goals**: a full fold of a 1,000-event log on each delivered event stays under one
frame on a laptop (R3); verified by a pure-module test with a timing bound of 50 ms.

**Constraints**: no modals; client-only; no optimistic rendering; no `localStorage`; AA contrast
in both themes; nothing scrolls sideways at 390 px.

**Scale/Scope**: one human player plus AI companions and a DM per table (M2); hundreds of events.

## Constitution Check

*Gate before Phase 0; re-checked after Phase 1 design: all pass.*

- [x] **I. Agent-operable** — every route action is a session-protocol `send` frame
      (contracts/live-frames.md) or, after TASK-0045, the gate's documented approve/reject
      interface. An agent drives the same frames; the UI adds no private path.
- [x] **II. Content contract** — no codex entity is created. N/A by scope.
- [x] **III. Data planes** — the route reads only the session plane. It imports no library or
      codex module; `apps/web` still never imports `apps/server` (Biome rule unchanged).
- [x] **IV. Event sourcing** — every view is `project(events, viewer)`; writes are typed events
      validated by session-model schemas client-side and recorded by the server; nothing renders
      before its event returns; DM-only rows stay filtered by the shared `canSee` rule.
- [x] **V. Citations** — no library claim is shown. N/A by scope.
- [x] **VI. 5e engine boundary** — the route displays engine events; it rolls nothing and computes
      no game number. Commit authority is a display rule, not mechanics.
- [x] **VII. Structured first** — no generated asset. N/A by scope.
- [x] **VIII. Operator-owned content** — no rulebook content; fixtures are original or SRD-named
      (TASK-0044); web-local example proposals are original text.
- [x] **IX. Self-hostable** — no CDN, no webfonts, inline SVG icons; no new container or service.

**Stack conformance**: React Router 8 framework mode with realtime routes client-only
(decision-0008, doc-0003 ruling 1); Tailwind v4; shadcn/ui without `Dialog`/`AlertDialog`
(doc-0003 ruling 3). No departure.

## Design

### Component structure

```
routes/play.tsx ─────────────── useLiveTable(sessionId, user) ──┐
routes/play-fixture.tsx ─ FixtureToolbar + useFixtureTable(…) ──┤
                                                                 ▼
                                               TableView({ source })
                       project(events, viewer) → toTableViewModel(…)
              ┌──────────────┬─────────────┬───────────────┬──────────────┐
         TableHeader      Transcript     Composer     Panel "Ledger"   Panel "Pending proposals"
         (ModeBadge,     (ActionCard →               (LedgerList)     (ProposalList; DM only)
          triggers)       CommitControl)
```

Full prop table: contracts/ui-surfaces.md.

### State

- **Play state**: none held. `TableView` memoises `project(source.events, source.viewer)` and
  `toTableViewModel` (research R3).
- **UI state** in `TableView`: which panel is open; composer type, channel, character, scope and
  draft; per-card comment drafts; the reject reason draft.
- **Live source state** in `useSession` (events, status, caughtUp) plus `notice` (last error frame).
- **Fixture source state** (data-model.md, Fixture table state): viewer key and `through` live in
  the URL query; local appends and decided proposals live in hook state and reset on change.

### Fixtures and live log through the same components (AC #7)

The two hooks differ only in where events come from and where commands go
(contracts/table-source.md). Proof:
1. Structural test: `routes/play.tsx` and `routes/play-fixture.tsx` both render `TableView` and
   import nothing else from `app/play/components/` except `FixtureToolbar` (fixture route only).
2. Equivalence test: for each fixture and viewer, feed the fixture events one at a time through the
   live hook's event reducer (the same `Math.max` and append path as `useSession`, extracted as a
   pure `reduceFrame`) and compare the resulting `TableViewModel` and markup with the fixture
   source's.
3. Brave screenshots of both modes, light and dark (merge condition).

### Pure modules (`apps/web/app/play/`, erasable TypeScript)

| Module | Exports |
|---|---|
| `source.ts` | `TableSource`, `TableCommands`, inputs (types only) |
| `proposals.ts` | `PendingProposalView`, `ProposalCommands`, `SelectPendingProposals`, `liveProposals` |
| `view-model.ts` | `toTableViewModel`, `ModeView`, `TranscriptItem`, `ActionCardView`, `ComposerView` |
| `authority.ts` | `commitAuthorityFor`, `CommitAuthority` |
| `ledger-format.ts` | `toLedgerItems`, `changedFields`, `LedgerItem` |
| `frames.ts` | `talkFrame`, `declareFrame`, `commentFrame`, `commitFrame` (schema-checked) |
| `local-log.ts` | `appendLocal` |
| `reduce-frame.ts` | `reduceFrame` (the event-frame path `useSession` uses, extracted) |
| `labels.ts` | `actorLabel`, `characterLabel` (party lookup; "DM" for `ai:dm`, "you" for the viewer) |
| `fixtures/proposals.ts` | example `PendingProposalView`s per fixture (until the gated phase) |

Hooks: `use-live-table.ts`, `use-fixture-table.ts`. Components: `table-view.tsx`,
`components/*.tsx`.

### Package wiring

- `apps/web/package.json`: add `"@the-stacks/session-model": "workspace:*"` (dependencies) and
  `"vitest": "^5.0.1"` (devDependencies); `test` script → `node --test && vitest run`.
- `apps/web/tsconfig.json`: add a reference to `../../packages/session-model`.
- `apps/web/vitest.config.ts`: include `test/**/*.test.tsx`, the `~` alias, JSX automatic runtime.
- The Dockerfile already builds `packages/dnd5e-engine` and `packages/session-model` (TASK-0044); the
  web build bundles them. Verify `docker build` still succeeds in Phase 5.
- No Biome boundary change: `apps/web` importing `@the-stacks/session-model` is allowed today; no
  new plane rule, so no new violating fixture.

### Dependencies

No new runtime dependency. One dev dependency, `vitest`, already resolved in `pnpm-lock.yaml` for
`apps/server`, `packages/dnd5e-engine`, `packages/srd` and `packages/session-model` (research R9).
Operator default: accept (spec Open Question 2). Evidence tooling (`playwright-core` driving Brave)
stays out of tree, as specs/024 did.

### No `<dialog>` / modal test

- Existing `apps/web/test/no-dialog.test.mjs` (unchanged) covers all of `app/`, so it covers
  `app/play/` automatically: no `<dialog`, `showModal`, `AlertDialog`, and `Dialog` only in
  `ui/sheet.tsx`.
- New `apps/web/test/play-surfaces.test.mjs`: only `components/panel.tsx` imports
  `components/ui/sheet`; no `fixed inset-0` under `app/play/`; no `localStorage`/`sessionStorage`
  under `app/play/`; both table routes export `clientLoader` and `HydrateFallback` and no `loader`;
  both render `TableView`.
- New vitest `test/play/table-view.test.tsx`: the rendered `TableView` for every fixture and viewer
  contains no `<dialog` and no `aria-modal`.

### Client-only (AC #8)

`routes/play.tsx`, `routes/play-fixtures.tsx` and `routes/play-fixture.tsx` export `clientLoader` and
`HydrateFallback`, never `loader`. `test/ssr.test.mjs` gains assertions for `/play/fixtures` and
`/play/fixtures/free-mode-action`: HTML holds the fallback and no `Message type` group.

### The TASK-0045 seam and the gated phase

contracts/proposal-seam.md defines `PendingProposalView`, `ProposalCommands`,
`SelectPendingProposals` and the commit-authority seam. Before TASK-0045: fixture examples for the DM,
`[]` live. The final phase (tasks.md Phase 6) is **gated on TASK-0045's merge** and changes only
`play/proposals.ts`, `play/frames.ts`, `play/use-live-table.ts`, `play/authority.ts` (if the gate's
rule is client-importable) and `play/fixtures/proposals.ts` (deleted if TASK-0045 ships proposal
fixtures). The PR stays draft until then (runbook, lane 3).

## Project Structure

### Documentation (this feature)

```text
specs/030-play-route/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── table-source.md
│   ├── proposal-seam.md
│   ├── live-frames.md
│   └── ui-surfaces.md
├── checklists/requirements.md
├── evidence/            # seed-live.mjs, shoot.mjs, shots/ (Phases 5 and 6)
└── tasks.md
```

### Source code

```text
apps/web/
├── app/
│   ├── routes.ts                      # + play/fixtures, play/fixtures/:fixtureName
│   ├── routes/
│   │   ├── play.tsx                   # rewritten: useLiveTable + TableView
│   │   ├── play-fixtures.tsx          # new: fixture list (operator-only)
│   │   ├── play-fixture.tsx           # new: FixtureToolbar + useFixtureTable + TableView
│   │   └── table.tsx                  # + operator-only "Preview fixtures" link
│   ├── ws/useSession.ts               # send(text) → sendEvent(frame); error → notice; uses reduceFrame
│   ├── components/icons.tsx           # + ledger, proposals, commit glyphs
│   └── play/
│       ├── source.ts  proposals.ts  view-model.ts  authority.ts  ledger-format.ts
│       ├── frames.ts  local-log.ts  reduce-frame.ts  labels.ts
│       ├── use-live-table.ts  use-fixture-table.ts  table-view.tsx
│       ├── fixtures/proposals.ts
│       └── components/
│           ├── table-header.tsx  mode-badge.tsx  transcript.tsx  action-card.tsx
│           ├── commit-control.tsx  composer.tsx  ledger-list.tsx  proposal-list.tsx
│           └── fixture-toolbar.tsx
├── test/
│   ├── play/*.test.mjs                # node:test, pure modules
│   ├── play/*.test.tsx                # vitest, markup
│   ├── play-surfaces.test.mjs         # grep/structure gates
│   └── ssr.test.mjs                   # + fixture routes
├── vitest.config.ts
├── package.json  tsconfig.json
```

**Structure Decision**: all code lives in `apps/web`; no package, server or migration change.
Server-side wiring of proposals is TASK-0045's.

## Wiki re-ground (orchestrator, after merge)

Expected reviews per the runbook: `chat-ui`, `react-router-app`, `client-session-hook`
(`useSession` gains `sendEvent` and the extracted `reduceFrame`); a new `play-route` note.

## Open Questions (operator defaults)

1. Fixture route ships in all builds, operator-only, loaded on demand — default yes.
2. `vitest` as an `apps/web` dev dependency for markup tests — default yes.

## Complexity Tracking

No constitution violation; nothing to justify.
