# Implementation Plan: Actor snapshot — one code-built state view for every DM node

**Branch**: `task-0140-actor-snapshot` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: `specs/040-actor-snapshot/spec.md`; contract
[`contracts/actor-snapshot.md`](contracts/actor-snapshot.md); decision-0025 (D17) §1 and §4;
`docs/design/actor-state-gate.md` §4.1 and §5.3 U1 (both on branch `task-0135-actor-state-gate`).

## Summary

Add a pure `snapshot/` module under `apps/server/src/dm/` that builds an `ActorSnapshot` from
the DM projections and the scene seed, diffs two snapshots, and renders one in three views
under a cap that compresses dead and absent actors and otherwise fails loudly. Wire it in:
`assemble` builds S0, `resolve` builds S1 and the diff, and the seven `dm.*` prompts render
from it. Delete `projectionEntries` and `NarrationFacts.npcNames`. Bump seven prompt versions.
Change no model call count, no engine, no event, no migration.

## Technical Context

**Language/Version**: TypeScript (Node 22), the server package's existing `tsc -b` build.

**Primary Dependencies**: none new. `@the-stacks/session-model` (projection types),
`@the-stacks/dnd5e-engine` (types only), `@the-stacks/srd` (`estimateTokens`), `zod` is not
needed (the snapshot is code-built, never parsed).

**Storage**: none. The snapshot is derived in memory and never persisted.

**Testing**: vitest. Unit tests for build, aliases, diff and render; prompt tests per node; the
existing integration suites (`resolve`, `full-turn`, `companion`, `chronicle`, `worker`) and the
CI playtest with `REQUIRE_DATABASE=1` on the worktree's own stack.

**Target Platform**: the one Node server process.

**Project Type**: web service (server package only; no web change).

**Performance Goals**: one extra `loadProjections` read at the end of `resolve` and one bounded
fold in the chronicle job. Both are the same full-log read the runtime already does several
times per turn.

**Constraints**: the narrate import closure holds no engine value and nothing from `gate/`
(`test/dm/boundary.test.ts`); player-facing prompts hold no DM-only seed text
(`test/dm/player-facing-prompts.test.ts`); model call count and order are unchanged.

**Scale/Scope**: the seed schema caps a scene at 6 characters, 20 NPCs, 6 encounters of up to
12 monsters. The render caps are sized so the 6/12/20 shape fits every view uncompressed.

## Constitution Check

*Gate run against `.specify/memory/constitution.md` 2.0.0, before Phase 0 and again after
Phase 1 design. Both runs pass.*

- [x] **I. Agent-operable** — the snapshot is the state interface the DM agent nodes read. It
      is derived from the same projections the play route folds for a human. No human-only path.
- [x] **II. Content contract** — no new codex entity. The seed schema is untouched. The
      snapshot copies seed names and sheet numbers only.
- [x] **III. Data planes** — no new state. The snapshot is a session-plane projection plus seed
      reads, inside `apps/server/src/dm/`. No cross-plane import is added.
- [x] **IV. Event sourcing** — no new event, nothing written. The snapshot is a projection of
      the log. Trackers (DM-only) never reach a `seat` or `fiction` render.
- [x] **V. Citations** — no library-derived claim; adjudicate's citation path is unchanged.
- [x] **VI. 5e engine boundary** — the snapshot copies engine numbers and computes none. The
      module imports engine types only. No engine change, so no new scripted-dice test is due;
      resolve's existing scripted-dice tests cover S1.
- [x] **VII. Structured first** — not applicable beyond this: the snapshot is typed data before
      it is prompt text, and rendering is deterministic.
- [x] **VIII. Operator-owned content** — ships no rulebook content. No SRD data change.
- [x] **IX. Self-hostable** — no service, container or dependency. Model calls stay behind the
      gateway.

**Stack conformance**: within the Architecture Constraints table. No amendment.

## Project Structure

### Documentation (this feature)

```text
specs/040-actor-snapshot/
├── spec.md
├── plan.md                    # this file
├── research.md                # decisions R1–R8
├── data-model.md              # points at the contract
├── quickstart.md              # verification steps
├── contracts/
│   └── actor-snapshot.md      # the binding type, build, diff, render, cap (Track C base)
├── checklists/requirements.md
└── tasks.md
```

### Source code: files this card touches

**New files**

| File | Purpose |
|---|---|
| `apps/server/src/dm/snapshot/types.ts` | `ActorSnapshot`, `SnapshotActor`, `SnapshotStage`, `SnapshotDiff`, the error classes (contract §2, §5, §6). Engine and session-model imports are `import type` only |
| `apps/server/src/dm/snapshot/aliases.ts` | `TITLE_WORDS`, `nameTerms(name, ids)` (contract §4) |
| `apps/server/src/dm/snapshot/build.ts` | `buildSnapshot(projections, seed)` (contract §3) |
| `apps/server/src/dm/snapshot/diff.ts` | `diffSnapshots(s0, s1)` (contract §5) |
| `apps/server/src/dm/snapshot/render.ts` | `renderSnapshot`, `snapshotSection`, the three views, compression, `SnapshotOverflowError` (contract §6) |
| `apps/server/src/dm/snapshot/index.ts` | re-exports |
| `apps/server/test/dm/snapshot.test.ts` | build and alias tests |
| `apps/server/test/dm/snapshot-diff.test.ts` | diff tests |
| `apps/server/test/dm/snapshot-render.test.ts` | view, cap, compression, overflow, no-digit, no-DM-text tests |
| `docs/wiki/actor-snapshot.md` | new wiki note (Phase 4) |

**Changed files**

| File | Change |
|---|---|
| `apps/server/src/dm/nodes/assemble.ts` | `AssembleOutput.snapshot` (S0) |
| `apps/server/src/dm/nodes/resolve.ts` | after the last write: reload projections, `ResolveOutput.snapshot` (S1) and `.diff` |
| `apps/server/src/dm/pipeline/context.ts` | `NodeErrorKind` gains `"state-overflow"` |
| `apps/server/src/dm/pipeline/runner.ts` | `safeRun` maps `SnapshotOverflowError` to `state-overflow`, logs `dm.node.state-overflow` |
| `apps/server/src/dm/prompts/common.ts` | delete `projectionEntries`; replace `CAPS.projections` with `snapshotDm`, `snapshotSeat`, `snapshotFiction` |
| `apps/server/src/dm/prompts/director.ts` | State from S0 `dm` view with trackers; `dm.director-v3` |
| `apps/server/src/dm/prompts/interpret.ts` | State from S0 `dm` view; `dm.interpret-v3` |
| `apps/server/src/dm/prompts/adjudicate.ts` | State from S0 `dm` view; `dm.adjudicate-v3` |
| `apps/server/src/dm/prompts/narrate.ts` | `characterSections(snapshot)` from S1 `fiction` view; input gains `snapshot`; `dm.narrate-v4` |
| `apps/server/src/dm/prompts/audit.ts` | the same sections from S1; input gains `snapshot`; `dm.audit-v3` |
| `apps/server/src/dm/prompts/companion.ts` | State from a `seat` view snapshot; input takes `snapshot` and `self` instead of `projections` for state; `dm.companion-v3` |
| `apps/server/src/dm/prompts/chronicle.ts` | new `## State at the end of this transcript` section, `fiction` view; `dm.chronicle-v3` |
| `apps/server/src/dm/nodes/narrate.ts` | passes `resolve.snapshot` to the prompt |
| `apps/server/src/dm/nodes/audit.ts` | passes `resolve.snapshot` to the audit and regenerate prompts; `partyNameTerms` calls `nameTerms` with identical output |
| `apps/server/src/dm/facts.ts` | delete `npcNames` from `NarrationFacts` and `buildNarrationFacts` |
| `apps/server/src/dm/companion.ts` | builds the snapshot per companion from the loaded projections and the full seed; overflow → play `status: "error"`, log `dm.companion.state-overflow` |
| `apps/server/src/dm/chronicle.ts` | `ChronicleDeps` gains `loadSeed` and `loadProjectionsThrough`; builds the snapshot at `throughSeq`; overflow → `entries: 0`, log `dm.chronicle.failed` kind `state-overflow` |
| `apps/server/src/dm/worker.ts` | wires the two new chronicle deps |
| `apps/server/src/session/projections.ts` | `loadProjections` gains an optional `{ throughSeq }` bound: stop reading after that seq |
| `apps/server/src/index.ts` | builds `loadProjectionsThrough` for the worker deps |
| `apps/server/test/dm/*.test.ts`, `apps/server/test/playtest/checks.test.ts` | fixtures drop `npcNames`; prompt-version assertions move to the new versions; `## State` and world-section assertions follow the new renders |
| `docs/wiki/dm-runtime.md`, `dm-narration-quality.md`, `session-model.md`, `dm-failure-and-gates.md`, `CAPSULES.md`, `INDEX.md` | Phase 4 |

**Not touched**: `packages/dnd5e-engine`, `packages/session-model`, `packages/srd`, the gate,
the event catalog, `nodes/schemas.ts` (`StepSchema`), `audit-words.ts`, `fallback.ts`, any
frozen contract, any migration, `apps/web`.

**Migrations**: none. **New runtime dependencies**: none.

**Structure Decision**: a new `dm/snapshot/` directory keeps the type importable by every node
and by later gate cards without pulling prompt code. `prompts/common.ts` keeps the generic
section helpers and the caps.

## Design notes

1. **Render returns lines; the section helper throws.** `renderSnapshot` is total and returns
   `{ ok: true; lines } | { ok: false; detail }`. `snapshotSection` throws
   `SnapshotOverflowError` on `ok: false`. Prompt builders call `snapshotSection` and stay
   `{ system, user }`-returning. The runner is the one place that turns the throw into a
   `NodeError`, so no node grows its own catch. Audit's regenerate call to `narrateAttempt` runs
   inside the audit node's `safeRun`, so it is covered.
2. **The cap is measured per section.** The section's token total uses `estimateTokens` per
   line plus one per line break, the same arithmetic as `capEntries`.
3. **S1 timing.** `resolve` reads projections once after its last `run.submit` and before it
   returns, on every exit path that returns `ok: true` (including `awaiting-dm` and hold
   paths). `narrate` keeps its own `loadProjections` for NarrationFacts; it reads the same log.
4. **Chronicle fold.** `loadProjections(db, sessionId, viewer, { throughSeq })` stops reading
   once a batch passes `throughSeq` and folds only rows with `seq <= throughSeq`. The chronicle
   keeps its existing current read for `chronicledThrough` and the journal ids.
5. **Companion state.** The companion prompt input changes from `projections` to `snapshot`
   plus the projections fields it still needs (scene, actions, transcript). `self` is the
   companion's actor id.
6. **Tests that move.** `narrate.test.ts` (version and world section), `audit.test.ts`,
   `fallback.test.ts`, `facts.test.ts` (npcNames cases become snapshot cases in
   `snapshot.test.ts`), `interpret-prompt.test.ts`, `assemble.test.ts` (director version),
   `checks.test.ts` fixture, `chronicle.integration.test.ts` and `companion.integration.test.ts`
   deps. Capture fixtures (`test/dm/fixtures/*capture*.json`) and `call.test.ts` literals are
   historic data and stay unchanged.

## Risks and conflicts

- **Track C hotspots.** `nodes/resolve.ts` (TASK-0110 next in order), `facts.ts` and the narrate
  and audit prompts (TASK-0111, TASK-0113), `companion.ts` (TASK-0114, TASK-0052),
  `worker.ts` (TASK-0116). This card lands first in its order; later branches merge
  `origin/main` and keep its shapes.
- **Prompt drift on paid runs.** The prompt text changes for all seven purposes. No paid run is
  in scope (rulings in force); the scripted playtest is content-agnostic, so it proves wiring,
  not prose quality. TASK-0053's demo runs measure prose.
- **Token growth.** The planning prompts' state section grows (more fields, monster conditions
  and AC). The caps bound it; contract §6.2 sizes them.

## Complexity Tracking

No constitution violation. Nothing to justify.
