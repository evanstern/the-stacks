# Feature Specification: Roll steps and effect amounts derive from the engine

**Feature Branch**: `task-0223-engine-amounts`
**Created**: 2026-11-12
**Status**: Draft (spec author, R1 sweep, lane LE).
**Card**: TASK-0223. Depends on TASK-0104 (done). Dependent: TASK-0312.
**Input**: TASK-0223 description, AC #1–#2, operator ruling 2026-11-09 ("unarmed strikes derived
here"); spec 082 OQ-3; spec 097 OQ-5 and OQ-12; spec 104 OQ-6, OQ-7, OQ-8 and plan D8; runbook
`docs/design/r1-fast-table-runbook.md` lane note "0223 … lives in the planner after F1".

**Authored against** (upstream commits on `origin/main`): spec 082 plan `eeb91c61`; spec 092 plan
`06d7ca13` (contract `intent-schema.md` v1.1 `0cfd68f5`); spec 097 plan and contract
`planner.md` `a34d5d39`; spec 104 plan `f61a0bac`. Branch base `origin/main` `eff67463`.

`speckit-clarify` skipped: the card and the upstream rulings settle scope. Every remaining
judgment call is listed under "Open questions" with a recommendation.

## Summary

Spec 082 left three model-written number sources: the `roll` step's expression, and the `Amount`
of damage and heal effects. Since then interpret emits Intents (spec 104), and the planner owns
mechanics (spec 097). This spec takes the inventory of every model-written number that still
reaches the engine, path by path, and gives each one a disposition. Only one gap falls inside
this card's rule ("where an SRD record or stat defines one"): the Unarmed Strike. The engine now
derives it for every combatant. The remaining numbers are either already blocked from model
producers (AC #1 guard test) or belong to TASK-0313 or TASK-0312.

## AC #1 inventory — model-written numbers today

"Model-written" means a number or dice expression that an AI producer (interpret, companion,
monster policy, rulings, adjudicate) writes and the engine rolls or applies. Seed sheets and SRD
records are authored data, not model output.

### Intent path (planner, `packages/planner`)

| # | Number | Producer today | Disposition |
|---|---|---|---|
| I-1 | `attack` damage and to-hit | Attack entry in `Combatant.stats` (seed sheet or SRD block) | Already derived (spec 082). No change. |
| I-2 | `attack` with `weapon: "unarmed"` | No entry exists; the planner refuses `STAT_UNDEFINED` | **Derived here** (AC #2): engine Unarmed Strike entry. |
| I-3 | `grapple`, `shove`, `contest` DCs | `unarmed-strike` / `influence` opposition from stats | Already derived (spec 084). No change. |
| I-4 | `roll_free.params.expression` | No AI producer: not in `INTERPRET_KINDS` or `COMPANION_TURN_KINDS`; monster policy and rulings never emit it. Human seats write it. | No model-written number. **Guard test here** (FR-004). A human's free roll stays a human's choice. |
| I-5 | `apply_damage.params.amount`, `apply_heal.params.amount` | No AI producer (DM-seat kinds; interpret, companion and rulings cannot emit them). `ai:dm` fixed amounts refuse `MODEL_NUMBER` (contract §6.12). Human DM writes any number. | No model-written number. **Guard test here** (FR-004). |
| I-6 | `ruling` `dc` / `amend` | `dm/rulings.ts` model schema: `decision` accept/reject, `difficulty` tier, `reason`. No `dc`, no `amend`. | No model-written number. **Guard test here** (FR-004). |

### Beside path (`apps/server/src/dm/intent-runner.ts`, `dm/stakes.ts`)

| # | Number | Producer today | Disposition |
|---|---|---|---|
| B-1 | Band effect damage `components[].amount` (`onSuccess`, `onFailure`, `onCost`, `onSevere`) | Interpret model writes `Amount` dice or fixed values in `BesideSchema` | **Left for TASK-0313** (stakes on Intents; planner plans band effects in code). No SRD record in `packages/srd` or stat defines these amounts today (OQ-1). |
| B-2 | Band effect heal `amount` | Same as B-1 | **Left for TASK-0313** (OQ-1). |
| B-3 | Free retry and auto-fail `check.roll` | Code: `difficulty` tier from Intent params (default `medium`), `autoSuccess` / `autoFail` flags | No number. No change. |

### Legacy step path (`apps/server/src/dm/nodes/resolve.ts` `runSteps`; old checkpoints and the dormant adjudicate node)

| # | Number | Producer today | Disposition |
|---|---|---|---|
| L-1 | `roll` step `expression` | `LegacyInterpretReadingSchema` (resumed checkpoints) and adjudicate rulings (node never runs, spec 104 OQ-7) | **Deleted by TASK-0312** (spec 104 D8 lists the `roll` case). |
| L-2 | `effect` step `effects[].amount` (damage, heal) | Same producers as L-1 | **Deleted by TASK-0312** (seam note: D8 does not list the `effect` case; see "TASK-0312 seam"). |
| L-3 | `check` step `onSuccess` / `onFailure` / `onCost` / `onSevere` amounts | Same producers as L-1 | **Deleted by TASK-0312** (D8 `check` case). |
| L-4 | `attack` step `onHit` heal amounts (damage already refused by `refineSteps`) | Same producers as L-1 | **Deleted by TASK-0312** (D8 `attack` case). |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A character punches (Priority: P1)

A player types "I punch the goblin". Interpret emits `attack` with `weapon: "unarmed"`. The
planner maps it to the `Unarmed Strike` entry, and the engine derives to-hit and damage from the
attacker's Strength modifier and proficiency bonus.

**Why this priority**: card AC #2; spec 097 OQ-12. Today the action refuses `STAT_UNDEFINED`.

**Independent Test**: a scripted-dice engine test and a planner test, no model.

**Acceptance Scenarios**:

1. **Given** a combatant with Strength modifier +3, proficiency bonus +2 and no stored `Unarmed
   Strike` entry, **When** `attack.roll` names `attack: "Unarmed Strike"` with a scripted d20 of
   12, **Then** the roll total is 17 (12 + 3 + 2).
2. **Given** that attack hits, **When** the guarded `damage.apply` runs, **Then** it applies a
   fixed 4 bludgeoning (1 + 3) and draws no damage die.
3. **Given** a critical hit, **When** the damage applies, **Then** it is still 4: a fixed amount
   has no dice to double.
4. **Given** a combatant with Strength modifier −3, **When** the strike hits, **Then** the damage
   is 0, never negative (OQ-3).
5. **Given** a combatant whose stats lack a Strength modifier, **When** it attacks unarmed,
   **Then** the engine refuses `STAT_UNDEFINED` with `missing: "str modifier"`.
6. **Given** a combatant whose stat block already carries an entry named `Unarmed Strike`,
   **When** it attacks unarmed, **Then** the stored entry is used.
7. **Given** an `attack` Intent with `weapon: "unarmed"`, **When** the planner plans it, **Then**
   it returns `attack.roll` with `attack: "Unarmed Strike"` and guarded `damage.apply` commands on
   `hit` and `critical-hit`, each with a fixed bludgeoning component.

### User Story 2 — No AI producer writes a number the engine applies (Priority: P1)

**Why this priority**: card AC #1; constitution VI.

**Independent Test**: one guard test over the AI producers' schemas.

**Acceptance Scenarios**:

1. **Given** `INTERPRET_KINDS` and `COMPANION_TURN_KINDS`, **Then** neither holds `roll_free`,
   `apply_damage`, `apply_heal`, `set_dc` or `request_roll`.
2. **Given** an interpret body with a `dc` param, **Then** the body schema refuses it (already
   covered by `interpret-intents.test.ts`; the guard test links to it, no duplicate).
3. **Given** the rulings model schema, **Then** a reply with `dc` or `amend` fails it.
4. **Given** an `ai:dm` `apply_damage` with `amount.kind = "fixed"`, **Then** the Intent schema
   refuses `MODEL_NUMBER` (already covered by `packages/intent` fixtures; linked, no duplicate).

### Edge Cases

- A derived entry is not stored in `stats.attacks`. `firstMeleeAttack`, monster policy and the
  snapshot see no change (OQ-2).
- `attack.roll` with an `expression` (not an entry name) is unchanged.
- Exhaustion still lowers the derived to-hit, through `attack.roll`'s existing penalty.
- Reach of the derived entry is 5 ft (no `reachFt`; the planner's default).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (AC #2): `findAttack(c, name)` in `packages/dnd5e-engine/src/derive.ts` returns a
  derived Unarmed Strike entry when `name` is `Unarmed Strike` (case-insensitive) and no stored
  entry matches. A stored entry wins.
- **FR-002** (AC #2): The derived entry is `{ name: "Unarmed Strike", range: "melee", toHit:
  str + proficiencyBonus, damage: [{ amount: { kind: "fixed", value: max(0, 1 + str) },
  damageType: "bludgeoning" }] }`. Source: SRD 5.2.1 Rules Glossary "Unarmed Strike".
- **FR-003** (AC #2): A missing `stats` or Strength modifier refuses `STAT_UNDEFINED`, with
  `missing` set to `stats` or `str modifier`.
- **FR-004** (AC #1): One guard test asserts inventory rows I-4, I-5 and I-6: no AI producer
  schema admits a number-bearing kind or field.
- **FR-005**: No Intent contract change, no planner contract change, no prompt change, no
  migration, no new dependency.

### Constitution Requirements

- **CR-001** (VI): The engine derives every Unarmed Strike number from stats.
- **CR-002** (VI): Engine command behavior changes only through `findAttack`; the `attack.roll`
  test with a scripted RNG covers it (runbook "Engine PRs").
- **CR-003** (II): No Intent kind or param changes, so the Intent schema, round-trip and planner
  tests stay valid. The planner test for `attack` `unarmed` flips from refusal to plan.

## Success Criteria *(mandatory)*

- **SC-001**: `attack` with `weapon: "unarmed"` plans and resolves for every combatant with a
  Strength modifier. Zero `STAT_UNDEFINED` refusals for it in the planner test suite.
- **SC-002**: The FR-004 guard test fails if a future change adds a number-bearing kind to an AI
  producer.
- **SC-003**: `pnpm ci:check` green after each phase.

## Out of scope

- Band effect amounts on the beside path (B-1, B-2): TASK-0313.
- Legacy step paths (L-1 to L-4): TASK-0312 deletes them.
- Spell amounts: engine `SPELLS` table (TASK-0105, done).
- Items with SRD amounts (Potion of Healing 2d4+2): no Intent kind serves an item use yet;
  `use_object` is a ruling kind (OQ-4).

## TASK-0312 seam

- This card edits no file TASK-0312 deletes. It does not touch `resolve.ts`, `plan-gate.ts`,
  `nodes/adjudicate.ts`, `prompts/adjudicate.ts`, `prompts/step-grammar.ts` or `nodes/schemas.ts`.
- `plan-gate.ts` line ~571 calls `findAttack`. It gains the derived entry for free and is deleted
  by TASK-0312. No conflict.
- Legacy rows L-1 to L-4 die with TASK-0312. Spec 104 D8 lists the `roll`, `check` and `attack`
  cases, but not the `effect` case of `runSteps`, nor the Step-only loop in `presenceTargets`.
  **Recommend:** TASK-0312's spec adds both to its deletion inventory. `effectCommand` and
  `runEffects` stay for the beside path until TASK-0313.
- Merge order: this card merges first (spec 104 OQ-9). TASK-0312 rebases onto it with no overlap.

## Open questions

- **OQ-1 — Beside band effect amounts (B-1, B-2).** The model still writes `Amount` dice in band
  effects. Constitution VI forbids this, but no SRD record in `packages/srd` or stat defines these
  amounts: the hazards rule record lists Burning, Falling and Suffocation by name only (no
  children, no dice). (a) Leave them for TASK-0313, which replaces the beside shape. (b) Derive
  here: import the SRD hazard records, add a `hazard` effect member to `BesideSchema`, bump
  `dm.interpret` to v19 (adds a phase; touches hotspot `nodes/schemas.ts` and
  `prompts/interpret.ts`). **Recommend (a).** Also append to TASK-0313 an AC: band effect amounts
  derive from an SRD hazard record or a stat, never model dice. The orchestrator cards it.
- **OQ-2 — Store the entry or derive on lookup.** (a) Derive inside `findAttack` only. (b) Append
  it to `stats.attacks` at combatant build. Option (b) changes `firstMeleeAttack`: weaponless
  monsters would gain opportunity attacks, and monster policy would punch instead of shoot when
  engaged. **Recommend (a).** If opportunity attacks with an Unarmed Strike are wanted, card it
  separately (SRD allows them).
- **OQ-3 — Negative damage.** With Strength −2 or lower, 1 + Str is below 1. The SRD gives no
  floor; `AmountSchema` fixed values are `0..10000`. **Recommend:** floor at 0, marked with a
  `ponytail:` comment.
- **OQ-4 — Item amounts.** Potion of Healing (SRD 2d4+2) has a record, but no kind serves item
  use. **Recommend:** no change here; the item kinds' owner derives it when one lands.
- **OQ-5 — `roll_free` from `ai:dm`.** Contract §6.12 does not list `roll_free` under
  `MODEL_NUMBER`, and seat A may emit it. No AI producer does. Adding the refusal narrows a type,
  which is a major change (contract §10, C-CON). **Recommend:** no contract change; the FR-004
  guard test catches a future producer.
