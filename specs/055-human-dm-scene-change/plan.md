# Implementation Plan: Human DM carries out a scene change from the table

**Branch**: `task-0159-human-dm-scene-change` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: `specs/055-human-dm-scene-change/spec.md`, ruled 2026-10-28 (D-1 to D-7 = option A).

## Summary

The play route gains a `scene` gate request and a DM-only "Change scene" slide-out. The panel
lists scene proposals from the AI DM as seeds. A seed fills a form: title, summary, location and
reason, with the seed's `sceneId` read-only, or "Clear the scene". Apply sends one `scene` request.
When the seed is a pending proposal, Apply then sends `proposal.reject` (`reason: null`) on it, which
re-queues an AI DM turn. The gate, the proposal kinds, the event catalog and the server are
unchanged. One shipped DM script and one DB regression test prove that the AI DM's next turn loads
the seed once the human DM carries out the scene-start suggestion.

## Technical Context

**Language/Version**: TypeScript 5.x (erasable syntax in `apps/web/app/play/`), Node 24.
**Primary Dependencies**: React Router 8, React, `@the-stacks/session-model` (`SceneSchema`,
`ReasonSchema`, `RefIdSchema`, `GATE_REQUEST_VERSION`, `project`, `pendingProposals`). No new
runtime dependency.
**Storage**: none new. No migration. The session event log is read, not changed.
**Testing**: vitest. Web tests run in Node with `renderToStaticMarkup` and no DOM library
(`apps/web/test/play/`). Server DB tests are environment-gated (`REQUIRE_DATABASE=1`); the
orchestrator runs them.
**Target Platform**: the existing one-process server and the SSR web app.
**Project Type**: web app (monorepo: `apps/web`, `apps/server`, `packages/session-model`).
**Performance Goals**: none beyond the existing table. The seed list reads at most ten proposals.
**Constraints**: no modals (slide-out `Panel` only). No frozen contract changes beyond the ruled
030 `TableHeader` amendment. No provider spend: the live check uses `DM_FAKE_SCRIPT`.
**Scale/Scope**: about 8 web modules touched or added, one shipped JSON script, one server test.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable** — the control sends the existing `scene` and `proposal.reject` gate
      requests over the WebSocket `send` frame. An agent drives the same two requests (the
      playtest harness and the evidence scripts send them). No human-only path.
- [x] **II. Content contract** — no codex entity. N/A.
- [x] **III. Data planes** — all new state is UI state (draft fields) or session-plane reads. The
      write is a session-plane gate request. No cross-plane access.
- [x] **IV. Event sourcing** — the change is one `scene.changed` row and one `proposal.rejected`
      row, written by the gate after validation. No optimistic append in live mode. The seed list
      reads pending proposals only from the DM viewer's projection (`dm`-visible rows).
- [x] **V. Citations** — no library claim. N/A.
- [x] **VI. 5e engine boundary** — no mechanics. The scene change rolls and computes nothing.
- [x] **VII. Structured first** — the scene is a `SceneSchema`-validated object before it is sent.
- [x] **VIII. Operator-owned content** — the shipped DM script holds original text only (reused
      from the existing original greyhollow test scripts). No rulebook text.
- [x] **IX. Self-hostable** — no new container or service. The model seam is untouched.

**Stack conformance**: TypeScript, React Router 8, Zod via session-model. No departure.

## Research (Phase 0)

- **R1 — The gate needs no change.** Decision: reuse `scene` (029 `proposals.md`). A seated human
  DM's request is applied directly (matrix row "applied directly"); `plan.ts` fills `before`.
  Alternatives: a new "carry out suggestion" request (rejected: a 029 change for no gain; the gate
  refuses Approve on `suggest` by design, decision-0015).
- **R2 — Seeds come from the projection, not `PendingProposalView`.** Decision: a new pure module
  reads `ProposalView.proposal` from `project(events, viewer).proposals`. `PendingProposalView`
  details carry only display strings. Alternative: add `after` to `PendingProposalView`
  (rejected: amends the frozen 030 seam).
- **R3 — Pending versus decided in both sources.** Decision: a seed is "pending" when its id is in
  `source.proposals`; every other scene proposal from `ai:dm` is "earlier". Reason: fixture mode
  drops a decided proposal from `source.proposals` (`decided` list in `use-fixture-table.ts`) but
  does not append `proposal.rejected`, so the projection status alone would disagree between
  sources and break equivalence (030 `table-source.md` rule 5).
- **R4 — Close the seed after the scene request.** Decision: `changeScene` sends `sceneFrame`, and
  only when that returns true sends `rejectFrame(closeProposalId, null)`. The gate orders a
  session's writes in arrival order (TASK-0157, spec 052). Alternative C (wait for the row) was
  not chosen (D-3).
- **R5 — The AI DM's next turn.** `currentSeed` (`apps/server/src/dm/worker.ts`) loads the seed by
  `p.scene.sceneId`. With no scene it finishes the job with outcome `empty-beat`. A
  `proposal.rejected` row on an `ai:dm` proposal enqueues an `approval` turn
  (`apps/server/src/dm/enqueue.ts`, rule 2). So "reject only" gives `empty-beat`, and "scene then
  reject" gives a turn that loads `greyhollow-ford`. This is the SC-002 proof.
- **R6 — The scripted provider matches by purpose queue** (`apps/server/src/dm/script/load.ts`,
  "purpose queues"). A new shipped script lists the calls for a human-seat scene start, its
  chronicle call if any, and one approval turn. Its exact call list is found red-first from the DB
  test (Phase 4).
- **R7 — TASK-0163 merged (PR #79, `6d6982e`).** It added `onStartScene` and `startQueued` to
  `TableHeader`, `role` and `startScene?` to `TableSource`/`TableCommands`, and
  `components/start-scene-panel.tsx`. This branch merges `origin/main` first (Phase 1, T001) and
  builds beside them.

## Data model (Phase 1)

Web-local types. No event, schema or table changes.

```ts
// apps/web/app/play/source.ts (additive)
export interface SceneInput {
  reason: string;                          // trimmed; 1..500 (ReasonSchema)
  after: {                                 // null = clear the scene
    sceneId: string;                       // from the seed; never typed by the DM
    title: string;                         // trimmed; 1..200
    summary: string;                       // trimmed; 0..4000
    location: string | null;               // trimmed; blank -> null; 0..200
  } | null;
  /** The pending proposal this change carries out, or null. */
  closeProposalId: string | null;
}
// TableCommands gains:
changeScene(input: SceneInput): boolean;   // true when the scene request left (live) or applied (fixture)

// apps/web/app/play/scene-seeds.ts (new)
export interface SceneSeedView {
  key: string;                             // proposalId, or "current"
  proposalId: string | null;               // null for the current scene
  origin: "pending" | "earlier" | "current";
  policy: "ask" | "suggest" | null;        // null for the current scene
  label: string;                           // the proposal summary, or "Current scene"
  reason: string;                          // the proposal reason, or "" for the current scene
  clear: boolean;                          // after === null
  scene: { sceneId: string; title: string; summary: string; location: string | null } | null;
}
export interface SceneChangeView {
  current: SceneSeedView | null;           // null when p.scene is null
  pending: SceneSeedView[];                // oldest first
  earlier: SceneSeedView[];                // newest first; together with pending, the last ten scene proposals
  turnMode: boolean;                       // shows "The table stays in turn mode."
  empty: boolean;                          // no current scene and no seed: the D-7 line, no form
}
export function sceneChangeView(
  p: SessionProjections,
  pendingIds: ReadonlySet<string>,
): SceneChangeView;

// apps/web/app/play/view-model.ts: TableViewModel gains
sceneChange: SceneChangeView | null;       // null unless isDm
```

Rules:

- Seeds are `scene` proposals whose `proposer` is `ai:dm`, any recorded policy (D-4).
- Take the last ten scene proposals by `createdSeq`. Split them by `pendingIds`.
- Drop a clear seed (`after: null`) when `p.scene` is null: the gate would refuse
  `INVALID_PROPOSAL`.
- `earlier` seeds never set `closeProposalId`: only a pending seed is closed (D-3).
- The form's initial seed is the oldest pending seed, else the current scene.

## Contracts (Phase 1)

- New: [contracts/scene-change.md](contracts/scene-change.md) — the frame, the command, the seed
  rules and the panel's accessible names.
- Amended, additive, tagged TASK-0159:
  - `specs/030-play-route/contracts/ui-surfaces.md` — `TableHeader` props gain `sceneOpen` and
    `onScene`; a `ScenePanel` row; accessible names (ruled, D-1).
  - `specs/030-play-route/contracts/live-frames.md` — a `changeScene` row (`eventType: "scene"`).
  - `specs/030-play-route/contracts/table-source.md` — `TableCommands.changeScene`.
- Unchanged: `specs/030-play-route/contracts/proposal-seam.md` (`PendingProposalView`,
  `ProposalCommands`, `ProposalList` props), every `specs/029-proposal-gate/contracts/` file,
  `docs/wiki/ws-protocol.md` frame shapes.

## Quickstart (Phase 1)

[quickstart.md](quickstart.md): the live check on the worktree stack in script mode.

## Project Structure

### Documentation (this feature)

```text
specs/055-human-dm-scene-change/
├── spec.md
├── plan.md                 # this file (research and data model inline)
├── quickstart.md           # the live check
├── contracts/scene-change.md
├── checklists/requirements.md
├── tasks.md
└── evidence/               # created by Phase 5: live-run.md, mutation-guard.md, shots/, scripts
```

### Source code touched

| File | Change | Phase |
|---|---|---|
| `apps/web/app/play/frames.ts` | add `sceneFrame`, `sceneSummary` | 1 |
| `apps/web/app/play/source.ts` | add `SceneInput`, `TableCommands.changeScene` | 1 |
| `apps/web/app/play/use-live-table.ts` | `changeScene`: scene frame, then the reject frame | 1 |
| `apps/web/app/play/local-log.ts` | add `localSceneEvents` | 1 |
| `apps/web/app/play/use-fixture-table.ts` | `changeScene`: append the row, then decide the seed | 1 |
| `apps/web/app/play/scene-seeds.ts` | new: `sceneChangeView` | 2 |
| `apps/web/app/play/view-model.ts` | `TableViewModel.sceneChange` | 2 |
| `apps/web/app/play/components/scene-panel.tsx` | new: `ScenePanel`, `SCENE_PANEL_ID` | 3 |
| `apps/web/app/play/components/table-header.tsx` | `sceneOpen`, `onScene`; "Change scene" trigger | 3 |
| `apps/web/app/play/table-view.tsx` | scene panel state; mount `ScenePanel` in `Panel` | 3 |
| `specs/030-play-route/contracts/{ui-surfaces,live-frames,table-source}.md` | additive TASK-0159 blocks | 3 |
| `apps/web/test/play/frames.test.mjs`, `local-log.test.mjs`, `use-fixture-table.test.mjs` | new cases | 1 |
| `apps/web/test/play/scene-seeds.test.mjs` (new), `view-model.test.mjs` | new cases | 2 |
| `apps/web/test/play/scene-panel.test.tsx` (new), `table-view.test.tsx`, `equivalence.test.tsx` | new cases | 3 |
| `apps/server/test/dm/human-dm-scene.integration.test.ts` (new) | DB regression for SC-002 | 4 |
| `apps/server/test/dm/scripts/human-dm-approval.json` (new) | test script for the approval turn | 4 |
| `apps/server/dm-scripts/greyhollow-human-dm.json` (new) | shipped script for the live check | 4 |
| `apps/server/test/dm/dm-scripts.test.ts` | assert the new script's purpose list | 4 |
| `specs/055-human-dm-scene-change/evidence/*` | live check scripts, records, shots | 5 |
| `docs/wiki/play-route.md` (+ notes the gate flags), `docs/wiki/INDEX.md`, `docs/wiki/CAPSULES.md` | re-ground | 6 |
| `docs/design/m3-table-sweep-runbook.md` | TASK-0163 row filled; TASK-0159 row | 6 |

No migration. No new runtime dependency. No server source file changes.

**Structure Decision**: the existing monorepo layout; the play route's pure-module-plus-component
pattern (`frames.ts`, `local-log.ts`, a pure view module, a component, `TableView` state).

## Test and run notes for the orchestrator

- Implementers run web tests and non-DB server tests: `pnpm --filter @the-stacks/web test`,
  `pnpm --filter @the-stacks/server exec vitest run test/dm/dm-scripts.test.ts`, and `pnpm ci:check`
  without `REQUIRE_DATABASE`.
- The orchestrator runs the DB suite and its mutation check (tasks marked "(orchestrator)"):
  export only `TEST_DATABASE_URL` from the worktree `.env`, then
  `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/dm/human-dm-scene.integration.test.ts`,
  then `REQUIRE_DATABASE=1 pnpm ci:check`. Never `source` the whole `.env`.
- DB scene tests can hit the 5 s vitest timeout under full-suite load (TASK-0154). Re-run once and
  report.

## Complexity Tracking

No constitution violations. Nothing to justify.
