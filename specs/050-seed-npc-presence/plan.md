# Implementation Plan: Seed NPCs carry minimal scene presence

**Branch**: `task-0142-seed-npc-presence` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: `specs/050-seed-npc-presence/spec.md`, operator rulings OQ-1 to OQ-6 all (a)
(2026-10-27, card commit 43e6d6a). Board card TASK-0142, decision-0025 (D17) card U8.

## Summary

A seed declares each NPC's scene presence per beat (`beats[].presence`). The server turns the
declaration into logged `scene-presence.changed` rows at two recorded moments: scene start
(opening beat, `dm` visibility) and encounter start (`arrived`, `public`, before the initiative
roll). The snapshot keeps reading presence from the log only. A seed cross-check pins one id
across NPC and combatant. Seed NPCs gain optional authored aliases. A test over the recorded M2
log shows Snag stays `present` through seq 296–301.

## Technical Context

**Language/Version**: TypeScript 5.9 (Node, ESM), pnpm workspaces.
**Primary Dependencies**: Zod (seed and proposal schemas), Vitest. No new runtime dependency.
**Storage**: Postgres event log (existing). No migration.
**Testing**: Vitest. DB suites (`*.integration.test.ts`) run with `REQUIRE_DATABASE=1` and
`TEST_DATABASE_URL` from the worktree `.env`.
**Target Platform**: the one Node server process (`apps/server`), plus `packages/session-model`.
**Project Type**: monorepo; server app plus shared session-model package.
**Performance Goals**: none new. At most 20 extra rows per scene (one per seed NPC).
**Constraints**: frozen contracts change only as ruled (029 `proposals.md`, `gate-api.md` §1;
031 `scene-seed.md`). `SNAPSHOT_VERSION` stays 1. Seed `v` stays 1.
**Scale/Scope**: 3 NPCs in the shipped seed; schema maximum 20 NPCs by 12 beats.

## Constitution Check

*Checked against `.specify/memory/constitution.md` 2.0.0. Re-checked after Phase 1: unchanged.*

- [x] **I. Agent-operable** — The AI DM writes seed rows through `gate.submit` as `ai:dm`, the
      same `scene-presence` proposal a human DM seat could submit. No human-only path.
- [x] **II. Content contract** — No new codex entity. The seed NPC keeps identity, portrayal and
      hooks; `aliases` joins `identity`. The seed loader refuses an incomplete declaration.
- [x] **III. Data planes** — The seed is input (codex stand-in, decision-0009). Presence is
      session state, written only as session events. The DM runtime reads the seed and writes
      through the gate seam; the session model gains no seed import.
- [x] **IV. Event sourcing** — Presence is folded only from `scene-presence.changed`. Hidden
      information (an NPC the party has not met) rides `visibility: "dm"`, filtered by `canSee`.
      A refused seed proposal appends nothing. The event schema is unchanged (v1).
- [x] **V. Citations** — No library-derived claim.
- [x] **VI. 5e engine boundary** — The order changes only through `initiative.join` /
      `initiative.leave` via the existing planner. No engine change.
- [x] **VII. Structured first** — Presence values and reasons are closed enums. The declaration
      is a validated map. No prose sets presence.
- [x] **VIII. Operator-owned content** — The seed edits are original text (aliases, presence).
- [x] **IX. Self-hostable** — No new container, dependency or seam.

**Stack conformance**: within the table. No departure.

## Design

### D1. Seed schema (OQ-1, OQ-5, OQ-6) — `apps/server/src/dm/seed/schema.ts`, `load.ts`

- Beat gains `presence: z.record(RefIdSchema, ScenePresenceSchema)`. Required.
  `ScenePresenceSchema` is imported from `@the-stacks/session-model`, not redeclared.
- `SeedNpc.identity` gains `aliases: z.array(Text(60)).max(6).default([])`.
- `crossCheckSeed` adds, each issue naming the beat or NPC:
  1. A beat's `presence` keys equal the seed's NPC ids: a missing NPC (`beat "x" declares no
     presence for npc "y"`), an unknown key (`beat "x" declares presence for unknown npc "y"`).
  2. A beat's `npcIds` entry is not `absent` in that beat's `presence`.
  3. `identity.combatant`, when set, equals the NPC `id`, and names a `combatantId` in some
     encounter's `monsters`.
- `beats[0]` is the opening beat (documented in the contract; no new field).

### D2. Shipped seed — `apps/server/seeds/greyhollow-ford.json` and its spec copy

`specs/031-dm-runtime/data/greyhollow-ford.seed.json` stays byte-equal in content
(`seed.test.ts` compares them). Values:

| Beat | wenna | pell | snag |
|---|---|---|---|
| `ferry-house` (opening) | `present` | `absent` | `absent` |
| `the-keeper` | `present` | `absent` | `absent` |
| `reed-camp` | `absent` | `present` | `present` |

Aliases (ruled): `wenna` ["the keeper"], `pell` ["the boy"], `snag` ["the goblin leader"].
Wenna is `present` at the opening: the ferry-house clue has her hiding in the loft.

### D3. Proposal visibility (OQ-4) — `packages/session-model/src/gate/proposals.ts`, `plan.ts`

- The `scene-presence` proposal gains `visibility: z.enum(["public", "dm"]).default("public")`,
  the same shape as `journal`.
- The planner writes the `scene-presence.changed` row with `proposal.visibility`. Engine rows in
  the same batch stay `public` (a scene-start seed row never has engine rows: no encounter).
- `fixtures/proposal-examples.ts` gains a `dm` example. Every existing caller defaults to
  `public`, so U2 behaviour is unchanged.

### D4. Seed-presence group (OQ-2, OQ-3) — `apps/server/src/dm/nodes/resolve.ts`

A new code-owned function `seedPresence(run, ctx, projections, moment)`, stepRefs
`seed:presence:<moment>:<npcId>`. It reads only the seed and the projections.

- **Scene start**: after `directorOpening`'s scene-start setup, for each NPC whose
  `beats[0].presence` is not `present`: submit `scene-presence` with reason `removed` (absent)
  or `conceded` (yielded), `actionId: null`, `visibility: "dm"`.
- **Encounter start**: inside `directorOpening`'s `to: "turn"` branch, after the monsters'
  `combatant.add` and before `initiative.roll`, for the beat whose `encounterId` is the encounter
  being started: each NPC declared `present` whose logged presence is not `present` gets reason
  `arrived`, `visibility: "public"`. No encounter is active yet, so the planner plans no
  `initiative.join`; the roll includes Snag as an encounter monster.
- Reclaim: the `Run` checkpoint replays by key; the planner's same-value refusal is the backstop.
- The 048 test "no Director fixture produces a scene-presence submission" keeps its assertion
  over `director:`-keyed submissions; its row count excludes `seed:presence:` rows. A new test
  runs two Director outputs that start `reed-camp` (different reasons, trackers) and asserts
  identical seed submissions.
- U9 (TASK-0147) note: seed rows have `actionId: null` and a `seed:` key; the batch gate must
  treat them as code-owned, not as an unrolled change to another actor. Recorded in the 040
  contract's U8 row so U9's spec inherits it.

### D5. NPC lists — `nodes/assemble.ts`, `nodes/narrate.ts`

- `presentNpcIds` = seed NPCs (seed order) whose S0 actor `presence` is not `absent`.
- `beatNpcIds` passed to `buildNarrationFacts` drops NPCs whose S1 `presence` is `absent`.
- `facts.ts` `buildEvents` already reads only `public` rows, so `dm` seed rows never become
  narration facts. A test pins it.

### D6. Snapshot aliases — `apps/server/src/dm/snapshot/build.ts`

NPC `aliases` = `dedupe([...nameTerms(name, [id, combatantId]), combatant?.name,
...identity.aliases])`. Presence read is unchanged (`presenceOf`, projection only).

### D7. The M2 log test (AC #3) — new `apps/server/test/dm/seed-npc-presence.test.ts`

Reads `docs/design/m2-demo/demo-session/transcript.jsonl` in place (path from
`import.meta.url`), parses each line with `StoredEventSchema`, folds with `applyEvent` under a
DM viewer, builds a snapshot with the shipped seed at each seq 295–301. Research R1 proved the
whole file decodes. No DB needed.

## Files touched

| File | Change | Phase |
|---|---|---|
| `packages/session-model/src/gate/proposals.ts` | `scene-presence.visibility` | 2 |
| `packages/session-model/src/gate/plan.ts` | row visibility from the proposal | 2 |
| `packages/session-model/src/fixtures/proposal-examples.ts` | `dm` example | 2 |
| `packages/session-model/test/gate-plan.test.ts`, `gate-schemas.test.ts` | visibility tests | 2 |
| `specs/029-proposal-gate/contracts/proposals.md` | amend: `scene-presence` visibility (line 139 rule and schema block) | 2 |
| `specs/029-proposal-gate/contracts/gate-api.md` | amend §1 `scene-presence` row: visibility from the proposal | 2 |
| `apps/server/src/dm/seed/schema.ts`, `load.ts` | presence map, aliases, cross-checks | 1 |
| `apps/server/seeds/greyhollow-ford.json` | presence maps, aliases | 1 |
| `specs/031-dm-runtime/data/greyhollow-ford.seed.json` | same as the shipped seed | 1 |
| `specs/031-dm-runtime/contracts/scene-seed.md` | amend: presence map, opening beat, identity check, aliases | 1 |
| `apps/server/test/dm/seed.test.ts` | schema and cross-check tests | 1 |
| `apps/server/src/dm/snapshot/build.ts` | seed aliases | 3 |
| `apps/server/test/dm/snapshot.test.ts` | aliases; identity before and after `combatant.add` | 3 |
| `apps/server/test/dm/seed-npc-presence.test.ts` (new) | M2 log fold, appended-row test | 3 |
| `specs/040-actor-snapshot/contracts/actor-snapshot.md` | rule 7 and U8 row | 3 |
| `apps/server/src/dm/nodes/resolve.ts` | `seedPresence` group | 4 |
| `apps/server/src/dm/nodes/assemble.ts`, `nodes/narrate.ts` | NPC lists from presence | 4 |
| `apps/server/test/dm/resolve.integration.test.ts` | seed rows, amended 048 test, Director independence | 4 |
| `apps/server/test/dm/facts.test.ts` | `dm` presence rows excluded | 4 |
| `apps/server/test/dm/scene.integration.test.ts` and any count-sensitive suite | adjust for seed rows | 4 |
| `specs/031-dm-runtime/contracts/resolve.md` | seed-presence group | 4 |
| `docs/wiki/*` | re-ground | 5 |

No migration. No new runtime dependency. No web change: the DM approvals renderer
(`apps/web/app/play/proposals.ts`) already lists actor, reason and value, and the AI seat
auto-applies these proposals.

## Risks

- **Count-sensitive tests.** Scene-start and encounter-start tests that count rows or assert
  seqs gain up to 4 rows on Greyhollow Ford. Phase 4 runs the full DM and playtest suites and
  fixes assertions by excluding `seed:presence:` submissions, never by weakening checks.
- **Scripted CI playtest.** The scenario's encounter start now logs two `arrived` rows. The
  six code checks must still pass; Phase 4 runs `pnpm playtest run` (ci mode, the default scenario `playtests/scenarios/greyhollow-ford.json`).
- **Residual name exposure (pre-existing).** `playerFacingSeed` already gives narrate every NPC
  name, and the fiction view renders absent actors compressed. This card reduces exposure
  (absent NPCs leave the portrayal lists); an absent actor shown acting is U3's claim gate
  (TASK-0143). No new card needed.

## Project Structure

### Documentation (this feature)

```text
specs/050-seed-npc-presence/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/seed-presence.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/session-model/src/gate/{proposals,plan}.ts
apps/server/src/dm/seed/{schema,load}.ts
apps/server/src/dm/snapshot/build.ts
apps/server/src/dm/nodes/{resolve,assemble,narrate}.ts
apps/server/seeds/greyhollow-ford.json
apps/server/test/dm/*
```

**Structure Decision**: existing monorepo layout; no new package or directory.

## Complexity Tracking

No constitution violation. Nothing to justify.
