# Implementation Plan: Roll steps and effect amounts derive from the engine

**Branch**: `task-0223-engine-amounts` | **Date**: 2026-11-12 | **Spec**: `specs/109-engine-amounts/spec.md`
**Card**: TASK-0223 | **Authored against**: spec 082 `eeb91c61`, spec 092 `06d7ca13` (contract
`0cfd68f5`), spec 097 and `planner.md` `a34d5d39`, spec 104 `f61a0bac`; base `origin/main` `eff67463`.

## Summary

`findAttack` derives an Unarmed Strike entry from stats when none is stored. The planner already
maps `weapon: "unarmed"` to `Unarmed Strike`, so the attack plans with no planner source change.
One guard test pins the AC #1 inventory: no AI producer can emit a number-bearing kind or field.

## Technical Context

- TypeScript, Zod, Vitest. Pure engine package `@the-stacks/dnd5e-engine`; planner
  `@the-stacks/planner` consumes `findAttack` through the engine's published exports.
- `attack.roll` (`commands/attacks.ts` lines ~233 and ~309) and the planner (`combat.ts` line
  ~144) both call `findAttack`. Changing `findAttack` changes both with no edit to either.
- `damage.apply` with a fixed amount draws no die and ignores `critical` (`hit-points.ts` ~211).

## Constitution Check (3.0.0)

| Principle | Check | Status |
|---|---|---|
| I Agent-operable | No new surface; the same `attack` Intent works for every producer | Pass |
| II One Intent vocabulary | No kind or param change; schema and round-trip tests unchanged; planner test per changed outcome (`attack` `unarmed`: refusal → plan) | Pass |
| III Server authority | No new write path | Pass |
| IV Three planes | No codex or library write | Pass |
| V Many views | No projection change | Pass |
| VI Engine owns numbers | Unarmed Strike to-hit and damage derive from stats in the engine; scripted-dice test | Pass |
| VII Narration around facts | Fact rows come from engine events as before | Pass |
| IX UX | Removes a refusal; no added I/O | Pass |
| XIII Plan just-in-time | Beside amounts named with their owner (TASK-0313); legacy amounts with theirs (TASK-0312) | Pass |
| VI "a model MUST NOT write a mechanical number" | Beside band effect amounts stay model-written | **Known deviation, not introduced here.** Ruled at spec 097 OQ-5 (2026-11-09), time-boxed by TASK-0313; spec OQ-1 |

## Design

### D1 — Derived entry (`packages/dnd5e-engine/src/derive.ts`)

```ts
// SRD 5.2.1 Rules Glossary "Unarmed Strike": Str mod + proficiency to hit; 1 + Str mod bludgeoning.
// ponytail: damage floors at 0 (OQ-3); add a rule entry if a feature changes the die (e.g. Monk).
function unarmedStrike(stats: CombatantStats): Derived<AttackEntry> {
  const str = stats.abilityMods.str;
  if (str === undefined) return { ok: false, missing: "str modifier" };
  return { ok: true, value: {
    name: "Unarmed Strike", range: "melee",
    toHit: str + stats.proficiencyBonus,
    damage: [{ amount: { kind: "fixed", value: Math.max(0, 1 + str) }, damageType: "bludgeoning" }],
  } };
}
```

`findAttack`: after the stored lookup misses, return `unarmedStrike(c.stats)` when
`want === "unarmed strike"`. The stored entry wins. `firstMeleeAttack` is unchanged (spec OQ-2).

### D2 — Planner

No source change. `combat.ts` already maps `"unarmed"` to `"Unarmed Strike"`. The test in
`packages/planner/test/combat.test.ts` "refuses STAT_UNDEFINED for a missing entry and for unarmed
(OQ-12)" splits: `Warhammer` still refuses; `unarmed` plans `attack.roll` plus guarded fixed damage.

### D3 — AC #1 guard (`apps/server/test/dm/model-numbers.test.ts`, new)

Assert, with no model call:
1. `INTERPRET_KINDS` and `COMPANION_TURN_KINDS` share no member with `roll_free`, `apply_damage`,
   `apply_heal`, `set_dc`, `request_roll`.
2. The rulings model schema refuses a reply carrying `dc` or `amend`. If `dm/rulings.ts` builds it
   inline, export the schema with no behavior change (one `export` keyword; not a hotspot file).
3. A comment names the existing coverage: `interpret-intents.test.ts` (body `dc` refused) and
   `packages/intent` `MODEL_NUMBER` fixtures. Do not duplicate them.

## Files touched

| File | Change |
|---|---|
| `packages/dnd5e-engine/src/derive.ts` | D1 |
| `packages/dnd5e-engine/test/derive.test.ts` | `findAttack` unit cases: derived, stored wins, missing Str, negative floor |
| `packages/dnd5e-engine/test/commands/attacks.test.ts` | scripted-dice `attack.roll` `Unarmed Strike` hit, crit, and attack-to-damage flow (fixed, no damage die drawn) |
| `packages/planner/test/combat.test.ts` | D2 |
| `apps/server/src/dm/rulings.ts` | export the model reply schema only if needed (D3.2) |
| `apps/server/test/dm/model-numbers.test.ts` (new) | D3 |
| `docs/wiki/dnd5e-engine-derived-rolls.md`, `docs/wiki/planner.md`, `docs/wiki/INDEX.md`, `docs/wiki/CAPSULES.md` | wiki phase |

Hotspots: none of the runbook's hotspot files (`schema/`, `execute.ts`,
`commands/{encounter,combatants,attacks}.ts` source, `resolve.ts`, `plan-gate.ts`, `nodes/schemas.ts`,
`prompts/interpret.ts`) change in source. `attacks.test.ts` is a test file beside a hotspot; a
sibling engine PR (0222, 0224) may touch it. Reconcile by taking both sides' cases.

## Migrations

None.

## New runtime dependencies

None.

## Prompt version bumps

None. `dm.interpret-v18` (`prompts/interpret.ts` line 26) already offers `weapon: "unarmed"`.
`dm.adjudicate-v10` is untouched (TASK-0312 deletes it).

## Checkpoint flags

- **C-CON:** none. No Intent contract change (contract v1.1 stays). Spec OQ-5 would need a major
  change and is recommended against. Spec OQ-1 option (b) is not an Intent contract change
  (`BesideSchema` is server-local), but it touches hotspots and bumps a prompt.
- **C-GATE:** none. No frozen contract touched.
- **C5:** none (no new dependency).

## Tests (runbook "Per-PR gates")

- Engine PR: scripted-dice tests for the changed `attack.roll` behavior (entry derivation) and
  the damage flow.
- Intent kinds touched: none in schema; the planner test for `attack` covers the changed outcome.
- `pnpm ci:check` green per phase. No DB suite change; no `REQUIRE_DATABASE` run needed.

## Size and split check

3 phases, 10 tasks, about 6 files (2 source, 4 test) plus wiki. Far under the runbook split
triggers. No split.

## Risks

- A seed or SRD stat block named its own unarmed attack differently (e.g. `Fist`). The planner
  maps only `unarmed` → `Unarmed Strike`, so `Fist` still needs its exact name. Acceptable.
- TASK-0224 (grapple escape DC) may edit `derive.ts` near the opposition rules. Separate
  functions; a textual merge only.
