# Implementation Plan: AI companion and monster turns emit Intents

**Branch**: `task-0299-ai-turn-intents` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)
**Tasks**: 36 (T001–T036) in 5 phases: 4 implementation phases, 1 wiki phase.

**Split check: no split.** 36 tasks is under the ~40 line. The companion and monster halves do
not separate cleanly:

- Both halves edit `dm/nodes/interpret.ts` and `dm/prompts/interpret.ts` (a runbook hotspot).
- Both halves rescript the same three DM scripts (`fight-round`, `turn-floor-round`,
  `greyhollow-ford-full`).
- AC #4 (the 4v4 round) needs both halves, so either split PR would carry no closing proof.

**Authored against**: spec 092 contract `0cfd68f5`, spec 097 contract `a34d5d39`, spec 102
`86d425b6`, spec 104 `f61a0bac` (merged `1aae66a2`), spec 106 `bb6d6beb`. Base `origin/main`
`348afe1c`.

## Summary

Monster turns build their stages in code from the engine stat block, the spatial view and a seed
`tactics` field. A monster turn with an empty beat skips the Director call through a code-made
Director output, the same mechanism the `intent` trigger already uses. The companion call returns
typed Intent bodies on the companion's own turn. The job stamps them, then declares their slash
text. Interpret's existing slash pre-pass learns multi-line items, so the turn job makes no
interpret call. A `check:timing` bench test plays a 4v4 round under 60 s on the fake model.

## Technical context

- TypeScript, Zod 4, Vitest, Postgres via `TEST_DATABASE_URL`. Existing pieces only.
- Fake model: `FakeProvider` with `strict = true` and per-purpose queues
  (`apps/server/src/ai/adapters/fake.ts` `scriptChatFor`), loaded from a JSON script by
  `test/dm/worker-world.ts` `script()` and `workerFor({ gateway })`.
- Per-purpose queues mean a removed call shifts every later script of that purpose. A phase that
  removes a call MUST rescript every DM script in the same commit (see "Phase coupling").

## Constitution Check (3.0.0)

| Principle | Check | Status |
|---|---|---|
| I Agent-operable | Companions and monsters reach the world through the same `intent` request and gate a human uses; kinds named in spec CR-001 | Pass |
| II One Intent vocabulary | AI actors' mechanics are Intents chosen in code (monster) or typed bodies (companion); the planner plans every stage; no free-text write path on an AI turn | Pass |
| II "planner MUST NOT call a model" | Monster policy is pure code before the gate; the planner is unchanged | Pass |
| III Event-sourced, server authority | Every write through `gate.submit`; the companion job and resolve stay the only `dm/` gate callers | Pass |
| IV Three planes | No codex or library write | Pass |
| V Many views | Companion prompt renders comment actors as character ids (fixes a user-id leak, spec 096 OQ1) | Pass |
| VI Engine owns numbers | Monster policy names attack entries by name; no model or policy writes a number, DC or actor id | Pass |
| VII Narration around facts | One narrate call per turn job, over carrier facts (spec 104 window) | Pass |
| IX UX / latency | Monster turn drops two model calls; companion turn drops one; 4v4 round gated in CI | Pass |
| XIII Plan just-in-time | Every deferral is an open question with a trigger (spec OQ-3, OQ-5, OQ-7) | Pass |
| Quality gate: Intent contract tests | Schema, round-trip and per-outcome tests for each kind touched (Phase 3) | Pass |
| Quality gate: latency gate | The 4v4 round joins `check:timing` (Phase 4) | Pass |

No justified deviation.

## Contract flags

- **C-GATE: none.** No change to `packages/session-model/src/gate/`, `ws/protocol.ts`,
  `specs/029-proposal-gate/contracts/` or `specs/030-play-route/contracts/proposal-seam.md`.
- **C-CON: none.** No change to `@the-stacks/intent` (kinds, params, text form, refusals). The
  companion body schema is a server-side subset of the interpret body schema.
- **Seed schema (minor, not a frozen contract):** encounter monster entries gain an optional
  `tactics` field with a default. Existing seeds load unchanged.

## Touched files

| File | Change | Phase |
|---|---|---|
| `apps/server/src/dm/monster-policy.ts` | New. `monsterStages()` (D3). | 1 |
| `apps/server/src/dm/seed/schema.ts` | Encounter monster `tactics` (optional, default `nearest`). | 1 |
| `apps/server/src/dm/nodes/interpret.ts` | Monster reading from `monsterStages`; multi-line slash pre-pass; hold reading. | 1, 2 |
| `apps/server/src/dm/prompts/interpret.ts` | Drop monster-turn lines and the `Monster turn:` user line; `dm.interpret-v18`. | 1 |
| `apps/server/src/dm/pipeline/runner.ts` | `NPC_DIRECTOR` for `npc-turn` with an empty beat (D4). | 1 |
| `apps/server/src/dm/companion.ts` | `turn` field, stamping, round-trip check, slash declare (D5). | 2 |
| `apps/server/src/dm/prompts/companion.ts` | `turn` grammar; `dmActorLabel` for comment actors; `dm.companion-v9`. | 2 |
| `apps/server/src/dm/nodes/schemas.ts` | Export `COMPANION_TURN_KINDS` and `CompanionIntentBodySchema`. | 2 |
| `apps/server/test/dm/monster-policy.test.ts` | New. Unit tests per D3 branch. | 1 |
| `apps/server/test/dm/npc-turn-intents.integration.test.ts` | New. AC #2 integration. | 1 |
| `apps/server/test/dm/companion-turn-intents.integration.test.ts` | New. AC #1 integration. | 2 |
| `apps/server/test/dm/ai-actor-parity.integration.test.ts` | New. AC #3 per-outcome and round-trip tests. | 3 |
| `apps/server/test/dm/interpret-intents.test.ts` | Multi-line slash, hold reading, monster reading cases. | 1, 2 |
| `apps/server/test/dm/interpret-prompt.test.ts`, `player-facing-prompts.test.ts`, `companion*.test.ts`, `npc-turn-narration.test.ts`, `director*.test.ts` | Follow the prompt and output changes. | 1, 2 |
| `apps/server/test/dm/scripts/{fight-round,turn-floor-round,greyhollow-ford-full,talk-chain}.json` | Remove monster-turn `dm.director` and `dm.interpret` calls (P1); companion `turn` fields and removed companion-turn interpret calls (P2). | 1, 2 |
| `apps/server/test/playtest/fixtures/downed-seat.json` | Same rescripting, if it scripts a monster or companion turn. | 1, 2 |
| `apps/server/test/dm/fixtures/greyhollow-ford-4v4.json` | New. Fixture seed (D6). | 4 |
| `apps/server/test/dm/scripts/ai-round-4v4.json` | New. Scripted calls for the round. | 4 |
| `apps/server/test/ai-round.bench-test.ts` | New. The 60 s gate (D6). | 4 |
| `docs/wiki/dm-runtime.md`, `dm-turn-jobs.md`, `turn-floor.md`, `seed-npc-presence.md`, `test-suite.md`, `INDEX.md`, `CAPSULES.md` | Re-ground. | 5 |

Not touched: `dm/intent-runner.ts` (the npc source already exists), `dm/enqueue.ts` (rules 1–10
unchanged; rule 9 stays off for `ai:` actors), `dm/nodes/resolve.ts`, `dm/nodes/director.ts`,
`dm/prompts/director.ts`, every package under `packages/`, `apps/server/seeds/*.json`.

**Hotspots touched** (runbook "Concurrency & conflict doctrine"): `dm/nodes/{schemas,interpret}.ts`
and `dm/prompts/interpret.ts` (shared with 0273); `dm/seed/` (shared with 0271, 0247, 0278).
`dm/nodes/resolve.ts` and `dm/{jobs,enqueue}.ts` are not touched.

## Migrations

None. No table, column or event type changes.

## New runtime dependencies

None.

## Prompt version bumps (read from code at `348afe1c`)

| Prompt | From | To | Why |
|---|---|---|---|
| `dm/prompts/interpret.ts` | `dm.interpret-v17` | `dm.interpret-v18` | Monster-turn instructions removed. |
| `dm/prompts/companion.ts` | `dm.companion-v8` | `dm.companion-v9` | `turn` field; comment actor labels. |

`dm.director-v12` and `dm.narrate-v24` are unchanged.

## Design

### D1 — Companion turn kinds (`dm/nodes/schemas.ts`)

```ts
export const COMPANION_TURN_KINDS = ["attack","cast","help","grapple","shove","move","dash",
  "disengage","stand","drop_prone","attempt"] as const;
export const CompanionIntentBodySchema = z.discriminatedUnion("kind",
  IntentBodyMembers.filter(m => COMPANION_TURN_KINDS.includes(m.shape.kind.value)) as ...);
```

No check-family kind: a check needs model-written stakes (`beside`), which ride only on the
interpret path (spec OQ-3). `attempt` covers the inventive move and goes to a ruling. Every kind
here is planner-served or a ruling kind.

### D2 — Multi-line slash items and the hold reading (`dm/nodes/interpret.ts`)

- `isSlash(text)`: every non-blank line, trimmed, starts with `/`. A single line behaves as today.
- `parseSlashItem`: parse line `n` with id `<actionId>.<n>`; push one stage per line; the first
  refusal yields a clarify reading naming the line. Cap at 6 stages (the reading max).
- Hold: an `ai:companion:` item whose trimmed text equals `HOLD_ACT_TEXT` yields
  `{ stages: [], clarify: null, followUps: [], say: null }` with no model call. Resolve already
  maps a zero-stage reading to `no-effect`, and the turn-advance group already ends a companion's
  turn on `no-effect`.

### D3 — Monster policy (`dm/monster-policy.ts`)

```ts
export function monsterStages(p: SessionProjections, seed: SceneSeed, combatantId: string):
  InterpretStage[]
```

1. `me` = `p.engine.combatants[combatantId]`. No combatant, or no `stats.attacks` → `[]`.
2. Foes = encounter order entries whose combatant `side` is `party` and `lifeState` is
   `conscious`, in initiative order. None → `[]`.
3. Zones from `spatialFor(p, { role: "dm" })`. No placements → every foe counts as engaged
   (spec OQ-4).
4. Tactics = the seed encounter monster entry's `tactics`, else `nearest`.
   - `nearest`: engaged foes first (same zone), then foes in other zones; initiative order breaks ties.
   - `weakest`: lowest `hp.current` among engaged foes, else among all foes; initiative order
     breaks ties.
5. Target engaged and a melee entry exists → `[attack(melee)]`.
6. Else a ranged entry exists → `[attack(ranged)]` at the chosen target.
7. Else (melee only, target in another zone) → `[move #<target zone>, attack(melee)]`.
8. `attack(entry)` = `{ intent: { kind: "attack", targets: [{ kind: "actor", id: <foe target id> }],
   params: { weapon: entry.name, mode: "normal" } }, beside: null }`. The target id keys a party
   member by character id (spec 102 FR-013): map the foe combatant to its `party` member.

Each stage is validated with `InterpretStageSchema` at build time (a failure is a programming
error and throws). The policy reads state only; the planner still judges reach and range.

### D4 — Code Director on monster turns (`dm/pipeline/runner.ts`)

Add `NPC_DIRECTOR`, equal to `INTENT_DIRECTOR`. Choose it when
`ctx.job.trigger === "npc-turn"`, the assembled beat is empty, `assembled.npcTurn` is set, and no
checkpointed Director exists. The Director node runs after assemble, so the check reads
`ctx.results.assemble`. Turn advance and next-job logic live in resolve and read table mode, not
the Director, so the monster turn still advances (resolve "Turn advance group").

### D5 — Companion job (`dm/companion.ts`, `dm/prompts/companion.ts`)

- `CompanionOutput.turn: z.array(CompanionIntentBodySchema).max(3).nullable()`.
- On `active && turnMode && ownOpen.length === 0`:
  1. Stamp each body: `stampIntent(body, { id: \`${actionId}.${n}\`, actor: { kind: "companion",
     id: companionId }, source: "ai", commit: "declared" })`.
  2. Check `parse(toText(i), ctx)` returns an Intent deep-equal to `i`.
  3. All ok and at least one stage → declare text = lines joined by `\n` (≤ 2000 chars, the
     `action.declare` cap), then commit.
  4. Else → `HOLD_ACT_TEXT` declare and commit (today's fallback), log
     `dm.companion.turn-invalid` with the failing path.
- `act` is ignored in that branch; elsewhere `turn` is ignored. The open-action branch (commit,
  withdraw, revise) is unchanged.
- Prompt: in the active-turn line, ask for `turn` (typed bodies, in order, at most 3) and `say`.
  List the kinds with targets and params from `INTENT_GRAMMAR` (shared lines, filtered). Render
  comment actors through `dmActorLabel(c.actor, null, seatsOf(projections.party))`.

### D6 — The 4v4 bench test (`apps/server/test/ai-round.bench-test.ts`)

- Fixture seed `greyhollow-ford-4v4`: `greyhollow-ford-reed-camp` with three companion seats and
  one human seat; the reed-camp encounter's four goblins, one with `tactics: "weakest"`. Loaded by
  path, so it never lists in Start scene. The test passes it to `createWorld({ seed })` and
  `workerFor({ loadSeed })`.
- Setup (untimed): start the scene, start the encounter in turn mode with fixed initiative so the
  order is human, then the others; place every combatant in one zone except one goblin in a
  neighbouring zone (exercises D3 step 7).
- Timed: from the human's `action.commit` of `/attack @goblin-1 with "Longsword"` to the
  `table-mode.changed` row that makes the human active in round 2. Drain with `drainAll`.
- Scripted calls (`ai-round-4v4.json`): three `dm.companion` replies with `turn` bodies, three
  `dm.director` replies for the companion beats, one `dm.director` reply for the human's beat,
  and one `dm.narrate` reply per turn job (eight). No `dm.interpret` script; the provider is
  strict, so an interpret call fails the test. Dice are scripted.
- Assertions: round time < 60 000 ms; call counts per spec US-4 #2; print the round time and each
  job's duration from `listDmJobs`.
- Budget constant cites constitution IX ("A combat round of 4 PCs and 4 monsters MUST take under
  60 s of wall time.").

## Phase coupling

- Phase 1 removes monster-turn `dm.director` and `dm.interpret` calls. Its commit MUST rescript
  every DM script and fixture that scripts a monster turn, or later scripted calls shift queues.
- Phase 2 removes companion-turn `dm.interpret` calls and adds `turn` to companion replies. Same
  rule for companion-turn scripts.
- Each phase's commit leaves `pnpm ci:check` green on its own. No phase pair must land together.

## Gates for the PR

Runbook "Per-PR gates": frozen-lockfile install; `pnpm ci:check` green with `REQUIRE_DATABASE=1`
on the worktree stack (DB suites and the bench test need it); wiki freshness `OK`; spec-bridge
check exits 0; a `Dispatch:` line per dispatch; every `tasks.md` task ticked. Intent PR gate:
schema, round-trip and planner/gate tests per outcome for each kind touched (Phase 3).
