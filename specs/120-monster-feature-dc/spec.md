# Feature Specification: Monster-feature DCs come from the stat block

**Feature Branch**: `task-0224-monster-dc`
**Card**: TASK-0224 (milestone m-10). Depends on TASK-0104 (spec 082, Done). Dependents: TASK-0230 (monster spellcasting) and TASK-0320 (monster policy); neither is in scope.
**Created**: 2026-11-15
**Status**: Draft
**Authored against**: branch base `b82168ad` (spec 119 merged). `origin/main` `cdc739b0` changes none of the files this spec names.
Source: `specs/082-engine-derived-numbers/spec.md` OQ-7 ("Saves a monster feature calls ... Resolved (a), carded as TASK-0224") and `specs/084-opposition-and-help/spec.md` OQ-2 ("The stat-block escape DC joins TASK-0224"), recorded in the card notes.
Evidence: none hosted. Every shipped seed monster is `goblin-minion` or `goblin-warrior` (`apps/server/seeds/*.json`, 25 entries). Neither record has a `save` field or an escape DC. No hosted run could fail this way. The engine tests are the replay (FR-018), plus two gate tests (FR-019).
Runbook: `docs/design/r1-fast-table-runbook.md` (row 18, escape line E6: "card AC drives, including the grapple escape DC scope. Engine tests.").
Operator ruling: every fix carries a test that replays the flow.
**Clarify**: skipped. The card AC, the SRD records and the code settle the behaviour. The judgment calls are recorded below.
**Spec Kit**: authored directly in the template shape, as specs 117 and 119 were. `.specify/feature.json` is untouched.

## Summary

A save a monster feature calls (a breath weapon, a web, a death burst) today takes a model-picked
difficulty tier: the planner asks for a ruling and `dm.ruling-v1` answers with a tier
(`apps/server/src/dm/rulings.ts`). An escape from a monster's grapple takes the Unarmed Strike formula
(`oppositionDc`, `packages/dnd5e-engine/src/derive.ts`, its `ponytail:` names this card). The SRD
record states both numbers.

This card puts the stated numbers on the engine combatant and gives `check.roll` a way to name them:

1. `statsFromSrd` copies each feature's save DC and escape DC into a new optional
   `stats.featureDcs` list.
2. `check.roll` takes a fourth DC source, `feature: { sourceId, name }`. The engine reads the save DC
   from the source's `featureDcs`. The event records the feature.
3. The `unarmed-strike` opposition on an ability check (the escape check) uses the opponent's stated
   escape DC when it has one.

No new command, event type or refusal code. No Intent contract change. No prompt, seed or migration.
The command that names a feature comes from a DM `mechanics` proposal today. A monster turn that uses
a feature is TASK-0320 (OQ-1).

### SRD sources (SRD 5.2.1, `packages/srd/data/monster.json`)

- **Structured save field.** `MonsterFeature.save: { ability, dc, onFail?, onSuccess? }`
  (`packages/srd/src/schema/monster.ts`). 198 features in 137 of 331 monsters carry it, across
  `traits` (12), `actions` (146), `bonusActions` (16), `reactions` (2) and `legendaryActions.actions`
  (22). For every one, `ability` and `dc` equal the feature text's first "<Ability> Saving Throw: DC N".
  At most 4 per monster. DCs run 10 to 27. Feature names are unique within each record.
- **Escape DC, prose only.** 39 features in 38 monsters state "escape DC N" in `text` (and in
  `attack.hitText` when the feature is an attack). No structured field holds it. `mimic` states it
  twice, both 13. 21 of the 38 differ from 8 + Strength modifier + proficiency bonus (spec 084 R2).
- Records cited below: `giant-spider` (p. 353) Web, Dexterity DC 13. `magma-mephit` (p. 307) Death
  Burst and Fire Breath, Dexterity DC 11. `aboleth` (p. 258) Mucus Cloud Con 14, Tentacle escape 14
  (formula 17), Consume Memories Int 16, Dominate Mind Wis 16. `water-elemental` (p. 337) Whelm,
  Strength DC 15 and escape 14 on one feature. `sphinx-of-valor` Roar: the field holds the first roar
  (Wis 20); the second and third roars are prose in `onFail`.
- Out of scope, prose only: 61 "spell save DC N" (TASK-0230), 11 ability-check DCs such as the
  `cloaker` Attach detach DC 14 and the `gelatinous-cube` Transparent DC 15, and 7 secondary saves such
  as the `behir` Swallow regurgitation DC 14 and the `zombie` Undead Fortitude "DC 5 plus the damage
  taken" (OQ-2).

## Decision record

| # | Question | Option | Verdict | Reason |
|---|---|---|---|---|
| 1 | Where the save DC is read from | A. Parse the text | Rejected | The structured `save` field already exists for every save feature and matches the text in all 198. |
| 1 | | B. The record's `save: { ability, dc }` | **Chosen** | No data change, no converter run, verified against the text. |
| 2 | Where the escape DC is read from | A. A structured field added to `packages/srd/data/monster.json` | Rejected | `scripts/convert-open5e.mjs` needs the pinned Open5e checkout and the PDF, so a dispatch cannot regenerate the data. A hand edit of 39 rows breaks provenance. |
| 2 | | B. `/escape DC (\d+)/i` on the feature `text`, in `statsFromSrd` at stat-build time | **Chosen** | One regex in the one place that already maps records to engine stats. `text` includes the attack rider, so all 39 match. A `ponytail:` comment names the upgrade (a structured field in the converter). |
| 3 | Which package reads the SRD | `apps/server` (`dm/seed/combatants.ts`) | **Chosen** | `biome.json` forbids `@the-stacks/srd` in `packages/planner/src` and `packages/intent/src`. The engine does not depend on it (`packages/dnd5e-engine/package.json`), and its `SPELLS` table avoids it on purpose. `scripts/check-boundaries.mjs` proves those rules. The DCs ride on `stats`, as every other stat-block number does since spec 082. |
| 4 | The stats shape | `stats.featureDcs?: FeatureDc[]` (max 12). `FeatureDc` is `{ kind: "save", feature, ability, dc }` or `{ kind: "escape", feature, dc }` | **Chosen** | One list, in record order (traits, actions, bonusActions, reactions, legendary actions). A feature with both a save and an escape DC gives two entries. At most 5 per monster in the SRD. The key is omitted when the list is empty, so goblin combatants and their `combatant.added` payloads are unchanged. |
| 5 | How the save command names the feature | `check.roll` `feature: { sourceId, name }`, a fourth DC source: exactly one of `dc`, `difficulty`, `opposition` and `feature` | **Chosen** | It mirrors `opposition`: the engine derives the DC from another combatant's stats. The name matches case-insensitively after trim, as `findAttack` does. |
| 6 | Which rolls take `feature` | `kind: "saving-throw"` only, by a combatant other than the source | **Chosen** | Every structured DC is a save against others. Else `INVALID_COMMAND`, as `opposition` refuses the checker. |
| 7 | A dead source | Allowed. The source must exist; it need not live | **Chosen** | `magma-mephit` Death Burst triggers "when it dies". `checkNamed` would refuse `TARGET_DEAD`, so the source is checked for existence only (`UNKNOWN_COMBATANT`). |
| 8 | A feature with no stated DC | `STAT_UNDEFINED`, `missing: feature "<name>"`, before any die | **Chosen** | The feature is absent from `featureDcs`. The producer falls back to a ruling tier, the path that exists today. The same refusal covers a source with no `stats` (`missing: "stats"`) and a name that holds only an escape DC. |
| 9 | The command's ability differs from the feature's | `INVALID_COMMAND` "the feature "<name>" calls a <ability> save", details `{ ability }` | **Chosen** | The record states the ability. A wrong one is a producer mistake, not a missing stat. Sphinx Roar's later roars refuse this way and fall back to a tier (OQ-2). |
| 10 | The model sends a different DC | Impossible by construction. `feature` plus `dc` or `difficulty` refuses `INVALID_COMMAND` | **Chosen** | No model writes a number (spec 109 guard). A ruling tier only answers a save the planner cannot tie to a feature. When a command names the feature, the stat-block DC is the only DC. |
| 11 | The escape DC | The `unarmed-strike` opposition on an `ability-check` uses the opponent's first `escape` entry; a `saving-throw` keeps 8 + Str + PB | **Chosen** | Spec 084 routes the escape check (Str (Athletics) or Dex (Acrobatics) against the grappler) through `opposition: unarmed-strike`, and the grapple and shove attempt through the same rule as a save. The SRD Unarmed Strike formula stays the attempt DC. A `ponytail:` names the ceiling: a monster that grapples by Unarmed Strike rather than its feature still reports the feature's escape DC. |
| 12 | `oppositionDc` signature | Gains a required third parameter `kind` | **Chosen** | The escape rule needs it. Three callers: `handleCheckRoll`, planner `contest` (`roll.kind`) and planner `grappleSave` (`"saving-throw"`). |
| 13 | Auto-fail (spec 119), Dodge (spec 117), modes | Unchanged. They run after the DC is known | **Chosen** | A paralyzed target of a Web save still auto-fails with no draw; the event carries the feature's DC. |
| 14 | The event | `check.resolved` gains optional `feature: { sourceId, name }`, `name` the canonical name from `featureDcs` | **Chosen** | Mirrors `opposition`. Optional, so `v: 1` rows still parse. |
| 15 | Producers | No producer change in this card. A DM `mechanics` proposal can send it now | **Chosen** | No Intent carries a feature, and an Intent field is a contract change. TASK-0320 plans feature use (OQ-1). The escape rule needs no producer: the planner `contest` already sends `opposition`. |
| 16 | Hosted replay | Engine golden-dice tests, a data test over all 331 records, and two gate tests | **Chosen** | No hosted flow failed. The gate tests replay a DM `mechanics` save and a slash `/contest` escape through `planProposal`. |

## Acceptance criteria map

| Card AC | Requirements | Success criteria | Phase |
|---|---|---|---|
| #1 A save against a monster feature uses the DC its SRD record states, with an engine test | FR-001–FR-020 | SC-001–SC-005 | 1, 2 |
| Grounding freshness | FR-021 | SC-006 | 3 |

## User scenarios

### US1 — A web uses its stat-block DC (P1)

A giant spider's Web catches Tamsin. The human DM sends the Dexterity save with
`feature: { sourceId: "spider-1", name: "Web" }`. The ledger shows DC 13, the number on the stat
block, not a tier.

### US2 — A death burst after death (P1)

Kestrel kills a magma mephit. It explodes. The DM sends the save against `Death Burst`. The dead
mephit is still the source, and the DC is 11.

### US3 — Escaping an aboleth (P1)

The aboleth's Tentacle grapples Odo. Odo sends `/contest athletics @aboleth`. The DC is 14, the
stated escape DC, not the formula's 17.

### US4 — A feature with no DC refuses (P2)

The DM names the spider's `Bite` as the feature. Bite states no save DC. The engine refuses
`STAT_UNDEFINED` before any die, and the DM sets a tier instead.

### US5 — Goblins are unchanged (P2)

A goblin has no save feature and no escape DC. Its stats carry no `featureDcs`. Every shipped flow
rolls as before.

## Requirements

### Engine: stats (`src/schema/state.ts`)

- **FR-001**: `state.ts` MUST export `FeatureDcSchema`, a discriminated union on `kind`:
  `{ kind: "save", feature: string 1..60, ability: Ability, dc: int 1..40 }` and
  `{ kind: "escape", feature: string 1..60, dc: int 1..40 }`, and the type `FeatureDc`.
- **FR-002**: `CombatantStatsSchema` MUST gain `featureDcs: z.array(FeatureDcSchema).max(12).optional()`.

### Engine: derivations (`src/derive.ts`)

- **FR-003**: `derive.ts` MUST export
  `findFeatureDc(c: Combatant, name: string): Derived<Extract<FeatureDc, { kind: "save" }>>`.
  No `stats` gives `missing: "stats"`. It returns the first `kind: "save"` entry whose `feature`
  equals `name` after trim, case-insensitively. Else it returns `missing: feature "<name>"`.
- **FR-004**: `oppositionDc` MUST take a third parameter `kind: "ability-check" | "saving-throw"`.
  For `unarmed-strike` with `kind: "ability-check"`, it returns the `dc` of the first `kind: "escape"`
  entry in `stats.featureDcs` when one exists. Every other case is unchanged.
- **FR-005**: The `oppositionDc` doc comment MUST replace its TASK-0224 `ponytail:` with the spec 120
  rule and the new ceiling (decision 11).

### Engine: `check.roll` (`src/schema/commands.ts`, `src/commands/attacks.ts`)

- **FR-006**: `check.roll` MUST gain optional `feature: { sourceId: Id, name: string 1..60 }`.
- **FR-007**: `handleCheckRoll` MUST refuse `INVALID_COMMAND` unless exactly one of `dc`,
  `difficulty`, `opposition` and `feature` is set. The message reads
  "check.roll needs exactly one of dc, difficulty, opposition and feature".
- **FR-008**: With `feature`, `handleCheckRoll` MUST refuse `INVALID_COMMAND` when `kind` is not
  `saving-throw` or `feature.sourceId` equals `combatantId`.
- **FR-009**: With `feature`, after `checkNamed`, `handleCheckRoll` MUST refuse `UNKNOWN_COMBATANT`
  when the source does not exist. A dead source is allowed.
- **FR-010**: It MUST then call `findFeatureDc`. On a miss it refuses `STAT_UNDEFINED`
  "cannot derive the DC of feature "<name>"" with details `{ combatantId: sourceId, missing }`.
- **FR-011**: When the found entry's `ability` differs from the command's, it MUST refuse
  `INVALID_COMMAND` "the feature "<feature>" calls a <ability> save" with details `{ ability }`.
- **FR-012**: Otherwise the DC is the entry's `dc`. Every refusal comes before any die.
- **FR-013**: `check.resolved` MUST carry `feature: { sourceId, name }` (the entry's `feature`) when
  the command named one, on the rolled, auto-fail and auto-success branches alike.
- **FR-014**: The derived modifier, mode folding, assists, bands, the spec 119 auto-fail and the
  explicit-expression path MUST NOT change.

### Engine: events and exports

- **FR-015**: `check.resolved` in `src/schema/events.ts` MUST gain optional
  `feature: { sourceId: Id, name: string 1..60 }`. `EngineEventSchema` stays `v: 1`. `src/index.ts`
  MUST export `FeatureDcSchema`, `FeatureDc` and `findFeatureDc`.

### Server: stats builder (`apps/server/src/dm/seed/combatants.ts`)

- **FR-016**: `statsFromSrd` MUST build `featureDcs` from `traits`, `actions`, `bonusActions`,
  `reactions` and `legendaryActions?.actions`, in that order. A feature with `save` gives a `save`
  entry. A feature whose `text` matches `/escape DC (\d+)/i` gives an `escape` entry with the first
  match, after its `save` entry. Cap the list at 12. Omit the key when the list is empty. The
  `ponytail:` on `spellcastingAbility` MUST name TASK-0230 only.

### Planner

- **FR-017**: `packages/planner/src/checks.ts` `contest` MUST pass `roll.kind` to `oppositionDc`.
  `packages/planner/src/combat.ts` `grappleSave` MUST pass `"saving-throw"`. No other planner change.

### Replay (operator ruling)

- **FR-018**: `packages/dnd5e-engine/test/commands/feature-dc.test.ts` (new) MUST hold every SC-001
  and SC-002 case with scripted dice. `test/derive.test.ts` MUST hold the SC-003 cases.
- **FR-019**: `packages/session-model/test/gate-intents.test.ts` MUST gain
  `describe("spec 120: monster-feature DCs from the stat block")` with the two SC-005 cases.

### Contracts

- **FR-020**: `specs/026-dnd5e-engine/contracts/commands.md`, `events.md` and `engine-api.md` MUST
  each gain an "Amended by specs/120-monster-feature-dc (TASK-0224)" section (plan D7).
  `specs/082-engine-derived-numbers/spec.md` OQ-7 and `specs/084-opposition-and-help/spec.md` OQ-2
  MUST each gain one line: "Closed by spec 120 (TASK-0224)."

### Wiki

- **FR-021**: The wiki MUST be re-pinned with worded prose where behaviour changed (tasks Phase 3).

## Success criteria

- **SC-001**: Feature saves in `feature-dc.test.ts` (plan D5 combatants). Each case asserts the
  `check.resolved` fields, or the refusal code with `counter.draws()` 0:
  - Ana's `dex` save against `spider` `Web`, faces `[10]`: `dc` 13, `total` 13, `natural` 10,
    `outcome` `success`, `feature` `{ sourceId: "spider", name: "Web" }`, no `difficulty` key;
  - the same with faces `[9]`: `total` 12, `failure`;
  - `name: "  web "`: resolves, and the event `name` is `Web`;
  - an explicit `expression: "1d20+3"` with faces `[10]`: `dc` 13, `success`;
  - a `paralyzed` Ana: auto-fail, no draw, `dc` 13 and the `feature` recorded (spec 119);
  - the dead `mephit` (after `damage.apply` fixed 30) `Death Burst`, faces `[8]`: `dc` 11, `success`.
- **SC-002**: Feature refusals in `feature-dc.test.ts`, each before any draw:
  - `feature` plus `difficulty: "medium"`: `INVALID_COMMAND`;
  - `feature` on `kind: "ability-check"`: `INVALID_COMMAND`;
  - `sourceId` equal to `combatantId`: `INVALID_COMMAND`;
  - `sourceId: "ghost"`: `UNKNOWN_COMBATANT`;
  - a source with no `stats`: `STAT_UNDEFINED`, `missing: "stats"`;
  - `name: "Bite"`: `STAT_UNDEFINED`, `missing: 'feature "Bite"'`;
  - `name: "Tentacle"` on `aboleth` (an escape entry only): `STAT_UNDEFINED`;
  - Web with `ability: "con"`: `INVALID_COMMAND`, details `{ ability: "dex" }`.
- **SC-003**: Escape DCs. In `derive.test.ts`: `oppositionDc(aboleth, "unarmed-strike", "ability-check")`
  is 14; with `"saving-throw"` it is 17; a combatant with no `escape` entry gives the formula for both
  kinds; `influence` is unchanged. Every existing `oppositionDc` call gains `"saving-throw"` and keeps
  its expected value. In `feature-dc.test.ts`: Ana's `str` `athletics` check with
  `opposition: { opponentId: "aboleth", rule: "unarmed-strike" }`, faces `[9]`: `dc` 14, `total` 14,
  `success`. Ana's `str` save with the same opposition, faces `[14]`: `dc` 17, `total` 17, `success`.
- **SC-004**: Stats in `apps/server/test/dm/seed-stats.test.ts`:
  - `giant-spider`: `featureDcs` equals `[{ kind: "save", feature: "Web", ability: "dex", dc: 13 }]`;
  - `aboleth`: Mucus Cloud con 14 save, Tentacle escape 14, Consume Memories int 16 save, Dominate
    Mind wis 16 save, in that order;
  - `water-elemental`: Whelm str 15 save, then Whelm escape 14;
  - `magma-mephit`: Death Burst dex 11, Fire Breath dex 11;
  - `goblin-warrior` and `goblin-minion`: `featureDcs` is undefined;
  - over `list("monster")`: the `save` entries total 198, the `escape` entries total 39, no list
    exceeds 12, and every `statsFromSrd` result parses with `CombatantStatsSchema`.
- **SC-005**: FR-019 passes. With `world({ goblinFeatures: true })`:
  - the AI DM's `mechanics` `check.roll` (Ana `dex` save, `feature: { sourceId: "goblin", name: "Web" }`),
    faces `[12]`: rows `dice.rolled`, `check.resolved`; `dc` 13, `total` 13, `success`, `feature` set;
  - Ana's `/contest athletics @goblin`, faces `[6]`: the `check.resolved` row has `dc` 11 (the
    formula would be 13), `total` 11, `success`, `opposition` `{ opponentId: "goblin", rule: "unarmed-strike" }`.
  The coverage meta-test passes. Every existing test passes; any test that changes is listed in the
  commit message with the reason.
- **SC-006**: `pnpm ci:check` is green. `node scripts/check-boundaries.mjs` exits 0. The wiki plan
  prints nothing. The wiki freshness gate exits 0.

## Scope

- **In**: `FeatureDcSchema` and `stats.featureDcs`; `findFeatureDc`; the `check.roll` `feature`
  source and its refusals; the `check.resolved` `feature` field; the escape DC in `oppositionDc`;
  `statsFromSrd`; the two planner call sites; the tests; the contract notes; the wiki.
- **Out**: any producer that sends `feature` (OQ-1); prose-only DCs (OQ-2); spell save DCs and
  monster spellcasting (TASK-0230); multiattack and feature choice in `monsterStages` (TASK-0320);
  a structured escape field in `packages/srd` (decision 2); any Intent, prompt, seed, web or
  migration change.

## Open questions

- **OQ-1**: No Intent names a monster feature, so only a DM `mechanics` proposal sends `feature`
  today. A monster turn that uses a breath weapon needs an Intent shape for it, an Intent contract
  change. Default: out of this card. Recommend an AC on TASK-0320: "a monster feature use plans
  `check.roll` with `feature`, with a planner test". Its contract change goes through §10.
- **OQ-2**: Prose-only DCs stay model-tiered: 11 ability-check DCs, 7 secondary saves, Sphinx Roar's
  later roars, and Undead Fortitude's computed DC. Default: out of this card. Recommend a card with a
  trigger: the first seed with a monster that has one.
- **OQ-3**: The escape rule reads the first stated escape DC, even when a monster grappled by
  Unarmed Strike. Default: accept, marked `ponytail:`. Recommend folding the fix into TASK-0320,
  when a grapple records the feature that made it.
