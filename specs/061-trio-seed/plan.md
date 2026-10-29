# Implementation Plan: Three-human seed for the M3 demo

**Branch**: `task-0176-trio-seed` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: `specs/061-trio-seed/spec.md`. Written against OQ-1 to OQ-6 (a). A ruling other than (a)
amends this plan and tasks.md before Phase 1 dispatches.

## Summary

Ship `apps/server/seeds/greyhollow-ford-trio.json`: greyhollow-ford-duo with `odo` seat `human`,
Odo's `voice` and `want` set to `Chosen by the player.`, a new `seedId` and the title
`Greyhollow Ford (three players)`. No source file changes: the loader, the start route, the
seeds route, resolve's scene-start opening, the companion enqueue rules, the Director legality
rules and the Start scene slide-out all handle three humans and zero companions already. The work
is the seed, the tests that prove each of those claims for three humans, and a `Seat three
players` subsection in `docs/ops/dev-vm-104.md`.

## Technical Context

**Language/Version**: TypeScript 5.x on Node 24 (repo toolchain, unchanged).
**Primary Dependencies**: unchanged. No new runtime dependency.
**Storage**: Postgres, unchanged. No migration.
**Testing**: vitest (server unit; `REQUIRE_DATABASE=1` integration, run by the orchestrator;
web `.tsx`), `node --test` (web `.mjs`, `no-dialog.test.mjs`).
**Target Platform**: the one Node process and the SSR web app; local compose stacks and vm-104 dev.
**Project Type**: web service plus SSR web app (pnpm monorepo).
**Performance Goals**: none.
**Constraints**: no modals; no provider spend (fake gateway; `DM_FAKE_SCRIPT=greyhollow-live` for
the live check); frozen contracts unchanged (`docs/wiki/ws-protocol.md` frames,
`specs/029-proposal-gate/contracts/`, `specs/030-play-route/contracts/proposal-seam.md`). No
contract under `specs/054-two-player-alpha-kit/contracts/` changes: `GET /dm/seeds` keeps its
shape and gains one row.
**Scale/Scope**: one seed file, two edited tests, three new test files, one fixture builder, one
runbook subsection.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable** — the trio seed is reached through `GET /dm/seeds` and
      `POST /dm/sessions/:sessionId/start`, the routes the slide-out calls. No human-only path.
- [x] **II. Content contract** — every trio character keeps identity, portrayal and hooks under
      the existing `SceneSeedSchema`. Odo's portrayal follows the duo's Kestrel (OQ-2 (a)).
- [x] **III. Data planes** — no new state. The seed is a shipped file read by the DM runtime.
- [x] **IV. Event sourcing** — scene start writes the same typed events through the gate. No new
      event type.
- [x] **V. Citations** — no library claim. N/A.
- [x] **VI. 5e engine boundary** — the trio reuses the duo's engine-checked combatants and SRD
      ids, cross-checked by the loader. No engine change.
- [x] **VII. Structured first** — the seed is Zod-validated JSON.
- [x] **VIII. Operator-owned content** — original greyhollow-ford content under its existing
      license block. No book text.
- [x] **IX. Self-hostable** — the Dockerfile copies `apps/server/seeds/` whole. No image change.

**Stack conformance**: within the Architecture Constraints table. No departure.

## Research (Phase 0)

- **R1 — No loader change.** `crossCheckSeed` requires at least one human with no maximum (spec
  054 Q2). `seed.test.ts` already loads an all-human mutated copy. Decision: data only.
- **R2 — Companion jobs cannot fire.** `enqueue.ts` rule 3 needs an `ai:companion:` action actor;
  rule 4 and resolve's `nextJob` need an `ai:companion:` turn-mode actor; the `prompt` job needs
  `director.companionPrompts`, which `legalizeDirector` filters to `aiCompanionIds(projections)`
  (empty). A Director hold naming a non-companion is overridden. Decision: no source change;
  `trio-views.test.ts` pins the legality overrides and the DB test pins "no companion job".
- **R3 — What the AI DM sees.** `section()` drops an empty "AI companions in the party" section;
  `fictionLine` labels each party member from its controller. Decision: no prompt change (OQ-5
  (a)); `trio-views.test.ts` asserts both.
- **R4 — Sign-off and floor count present humans.** `signoffState` and the floor job take the
  present set, not a fixed number. Decision: `trio.integration.test.ts` mirrors
  `duo.integration.test.ts` with three users (all-three sign-off, one absent, the floor passing an
  absent human).
- **R5 — The slide-out already offers N seats.** `StartSceneForm` maps `seed.humans`; the
  companion note needs `companions.length > 0`. Decision: no web source change. The new web test
  cannot fail before an implementation exists, because none is needed. It is seen to fail under
  the Phase 4 mutation guard instead (the form capped to two seats). This is recorded, not hidden.
- **R6 — Fake DM script.** `greyhollow-live` has no companion call and no seed id; the duo live run
  used it unchanged. Decision: reuse it; no new script, no `dm-scripts.test.ts` change.
- **R7 — Playtest harness and auditor.** `loadScenario` seats one human; `audit --session` is
  seat-agnostic. Decision: no harness change (spec F-2).
- **R8 — Seed-list tests.** Two exact-list assertions gain `greyhollow-ford-trio` (sorts last).
  The slide-out's default seed (`loaded[0]`) stays `greyhollow-ford`.

## Data model (Phase 1)

No new table, column, event type or migration. `greyhollow-ford-trio.json` is a copy of
`greyhollow-ford-duo.json` with these differences:

| Field | Value |
|-------|-------|
| `seedId` | `greyhollow-ford-trio` |
| `title` | `Greyhollow Ford (three players)` |
| `characters[odo].seat` | `human` (was `companion`) |
| `characters[odo].portrayal.voice` and `.want` | `Chosen by the player.` |

Every other field, including `tamsin` and `kestrel` (both already `human`), the hooks, beats, NPCs
and presence maps, encounters, trackers, opening and license, stays as in the duo. Character order
stays `tamsin`, `odo`, `kestrel`, so `GET /dm/seeds` returns humans in that order.

## Contracts

None changes. `specs/054-two-player-alpha-kit/contracts/dm-seeds.md` and
`contracts/scene-start-seats.md` cover the trio as written. No `contracts/` dir in this spec.

## Project Structure

### Documentation (this feature)

```text
specs/061-trio-seed/
├── spec.md
├── plan.md
├── quickstart.md
├── checklists/requirements.md
├── evidence/          # db-run.md, mutation-guard.md, live-run.md, shoot-live.mjs, shots/ (Phase 4)
└── tasks.md
```

### Files touched

Server:

- `apps/server/seeds/greyhollow-ford-trio.json` — new seed.
- `apps/server/test/dm/seed.test.ts` — trio load case; seed-list case gains the trio.
- `apps/server/test/dm/routes.integration.test.ts` — `GET /dm/seeds` list gains the trio with
  three humans and no companions; a trio start with three users returns 202; one user on two trio
  seats returns 400.
- `apps/server/test/dm/snapshot-fixtures.ts` — `THIRD_USER` and `greyhollowTrio()`, beside
  `greyhollowDuo()`.
- `apps/server/test/dm/trio-views.test.ts` — new (no database): fiction view, Director prompt,
  `legalizeDirector` overrides.
- `apps/server/test/dm/trio.integration.test.ts` — new (database): scene start, sign-off, floor.

Web:

- `apps/web/test/play/start-scene-panel.test.tsx` — trio-summary cases. No web source change.

Docs:

- `docs/ops/dev-vm-104.md` — `Seat three players` subsection (OQ-6 (a)).
- `docs/design/m3-table-sweep-runbook.md` — amendment row and TASK-0176 row (Phase 5).
- Wiki (Phase 5): `seed-npc-presence`, `dm-runtime`, `hosted-dev`, `scene-panels` (claim review),
  `CAPSULES.md`, `INDEX.md`.
- `specs/061-trio-seed/evidence/` — Phase 4 records and `shoot-live.mjs`.

No source file under `apps/server/src/` or `apps/web/app/` changes. **Migrations**: none.
**New runtime dependencies**: none.

## Phase sequencing

Phase 1 (seed and no-DB server tests) → Phase 2 (DB test file, written by the implementer, run by
the orchestrator) → Phase 3 (web test and runbook) → Phase 4 **[orchestrator]** (DB suites,
mutation guard, Brave live check) → Phase 5 (wiki and sweep runbook). Phase 3 needs only Phase 1's
seed id and may run beside Phase 2.

## Risks

- A test elsewhere enumerates the seed directory. Mitigation: `git grep listSeeds` finds only
  `routes/dm.ts` and `seed.test.ts`; Phase 1 runs the whole server suite.
- `legalizeDirector` overrides are logged on the turn job; an auditor might read them as faults.
  The fake script emits `companionPrompts: []`, so the live check logs none. A provider Director
  could; that is existing behaviour for any seed.

## Complexity Tracking

No constitution violations.
