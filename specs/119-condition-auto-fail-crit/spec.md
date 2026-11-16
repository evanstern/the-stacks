# Feature Specification: Condition automatic save failure and automatic critical hits

**Feature Branch**: `task-0222-condition-auto`
**Card**: TASK-0222 (milestone m-10). Depends on TASK-0104 (spec 082, Done) and TASK-0304 (spec 117, merged in PR #192).
**Created**: 2026-11-15
**Status**: Draft
**Authored against**: `origin/main` `f076c127`.
Source: `specs/082-engine-derived-numbers/spec.md` OQ-2 ("Condition auto-fail and auto-crit ... Resolved (a), carded as TASK-0222").
Evidence: none hosted. No playtest log records a paralyzed, petrified or stunned combatant, and `dm/monster-policy.ts` never targets a downed party member (`c.lifeState !== "conscious"`). The engine tests are the replay (FR-016), plus one gate test (FR-017).
Runbook: `docs/design/r1-fast-table-runbook.md` (R1 sweep claim, TASK-0222 notes).
Operator ruling: every fix carries a test that replays the flow.
**Clarify**: skipped. The card AC, the SRD records and the code settle the behaviour. The judgment calls are recorded below.
**Spec Kit**: authored directly in the template shape, as specs 114, 116 and 117 were. `.specify/feature.json` is untouched.

## Summary

Spec 026 FR-023 and the R8 ruling say the engine does not derive automatic failure from
conditions. Adjudication sends `check.roll` `autoFail` as data. Spec 082 moved every check and
attack number into the engine and left this rule out (OQ-2). Since spec 104 the planner plans
saves and spell saves with `autoFail: null`, so a paralyzed creature today rolls its Dexterity
save. A hit on a paralyzed or unconscious creature today is a plain `hit` unless the d20 shows 20.

This card makes the engine derive both rules from the condition list:

1. A Strength or Dexterity save by a combatant with `paralyzed`, `petrified`, `stunned` or
   `unconscious` fails automatically. No die is drawn.
2. An attack roll that hits a combatant with `paralyzed` or `unconscious` is a critical hit when the
   attack is a melee use (the engine's "within 5 feet" rule, FR-007).

No new command, event type, refusal code or schema field. No planner, server or prompt change.

### SRD sources (SRD 5.2.1)

- Condition `paralyzed` (p. 186): "Saving Throws Affected": automatic failure on Strength and
  Dexterity saving throws. "Automatic Critical Hits": an attack roll that hits is a Critical Hit
  if the attacker is within 5 feet.
- Condition `petrified` (p. 186): "Saving Throws Affected": automatic failure on Strength and
  Dexterity saving throws. No automatic critical hit.
- Condition `stunned` (p. 189): "Saving Throws Affected": automatic failure on Strength and
  Dexterity saving throws. No automatic critical hit.
- Condition `unconscious` (p. 191): "Saving Throws Affected" and "Automatic Critical Hits", as for
  `paralyzed`.
- Condition `incapacitated` (p. 184): no save effect. It is the shared effect of the four above.
- Rule `playing-the-game.damage-and-healing.critical-hits`: extra damage dice on a Critical Hit.
- Rule `playing-the-game.damage-and-healing.dropping-to-0-hit-points.death-saving-throws`
  ("Damage at 0 Hit Points"): damage from a Critical Hit at 0 HP is two failures.
- Rule `playing-the-game.actions` (Dodge, spec 117): the benefit is lost while Incapacitated.

All four save conditions are in `ConditionKeySchema`, so all four are modelled.

## Decision record

| # | Question | Option | Verdict | Reason |
|---|---|---|---|---|
| 1 | Which conditions auto-fail which saves | `paralyzed`, `petrified`, `stunned`, `unconscious`; `str` and `dex` saving throws only | **Chosen** | The four SRD records above. All four keys exist in `ConditionKeySchema`. Ability checks, other saves and death saves are untouched. |
| 2 | Which conditions auto-crit | `paralyzed` and `unconscious` only | **Chosen** | Only these two records carry "Automatic Critical Hits". `petrified` and `stunned` give advantage only (already in `attackModeSources`). |
| 3 | What "within 5 feet" means | A. A melee pair (`Encounter.melee`, spec 101) | Rejected | A pair forms only after a melee attack resolves, so the first swing at a paralyzed foe would not crit. `closeCombatFoes` also makes a pair inert while its foe is unable, and every auto-crit target is unable. |
| 3 | | B. Same zone (band `engaged`) | Rejected | A ranged shot from 25 ft across a 30-ft zone would crit. The prone rule already reads ranged as "farther". |
| 3 | | C. A melee use: `!isRangedUse(state, attackerId, targetId, entry)` in `commands/attacks.ts` | **Chosen** | It is the rule `attack.roll` already uses for melee reach (`bandCheck`) and the melee pair (spec 101). A `melee` entry is a melee use; a `melee-or-ranged` entry is one at band `engaged` or when either side is unplaced; a `ranged` entry never is. It matches the prone source in `attackModeSources` ("within 5 feet" assumed for melee and melee-or-ranged entries). Grid mode (R5) measures feet. |
| 4 | Where the conditions are read | The combatant's `conditions` list | **Chosen** | `attackModeSources` and `checkModeSources` read the same list. `dropToZero` always adds the `unconscious` instance (source `hp-zero`), and a `stable` combatant keeps it until healed, so a downed PC is covered. |
| 5 | Which save paths derive auto-fail | Every `check.roll` saving throw with a non-null `combatantId`, with or without `expression`, and every `spell.cast` save delivery | **Chosen** | Auto-fail is a fact about the creature, not a modifier. It needs no stats entry, so the explicit-expression path gets it too. This differs from spec 117 FR-011 on purpose: a mode source changes the arithmetic, an automatic failure removes it. |
| 6 | Which attack paths derive auto-crit | `attack.roll` with an `attack` entry, reaction attacks included. Not the explicit-expression path. Not `spell.cast` attacks | **Chosen** | The melee-use rule needs an entry. All `SPELLS` attack deliveries are `range: "ranged"`, so no spell attack is a melee use. A `ponytail:` comment in `commands/spells.ts` names the gap. |
| 7 | A command `autoFail` beside a derived one | The command's `autoFail` wins | **Chosen** | FR-023 data stays valid. The outcome is the same; only the reason text differs. |
| 8 | A command `autoSuccess` beside a derived one | The derived auto-fail wins | **Chosen** | `autoSuccess` is a free retry (spec 070). The intent runner sends it only for ability checks, so it never meets a save today. If it does, the condition is the current state and the SRD says "automatically fail". |
| 9 | How the result shows | Saves: `check.resolved` with `autoFail: { reason: "<name> is <condition>" }`, `rollIndex`, `total`, `natural` and `margin` null, `band: "failure"`, no `dice.rolled`. Attacks: `attack.resolved` with `outcome: "critical-hit"` and the real `natural` | **Chosen** | Both shapes already exist (FR-023 and `attack.resolved`). `facts.ts` already renders a no-roll `check.resolved` as `<name> — <reason>: auto-fail vs DC n: failure`. The planner already plans `damage.apply` `critical: true` on `critical-hit` (`guardedDamage`). No schema change. |
| 10 | Refusal and draw order | Unchanged. Every precondition still runs first; the derived auto-fail is decided after the modifier is derived | **Chosen** | It is the FR-023 rule ("still runs every precondition"). A combatant with no stats still refuses `STAT_UNDEFINED`. |
| 11 | Dodge (spec 117) | No new code | **Chosen** | All four conditions are in `INCAPACITATING`, so `isDodging` is already false. An auto-failed save draws no die, so no mode applies. An attack on such a target never gets Dodge's disadvantage. |
| 12 | Advantage and disadvantage | No change. The crit conversion runs after hit or miss is known | **Chosen** | Advantage decides the kept face. The condition then turns a hit into a critical hit. A miss stays a miss; a natural 1 stays a miss. |
| 13 | The planner `save` kind for an unable actor | Out of this card | **Chosen** | `resolveActor` refuses `ACTOR_UNABLE` for a `save` Intent by an unable actor (spec 097). That is a ratified planner rule. See OQ-1. |
| 14 | Hosted replay | Engine golden-dice tests plus one gate unit test | **Chosen** | No hosted flow failed. The gate test replays a slash `/attack` on a paralyzed foe through `planProposal`, so the planner guard and the engine meet in one run. |

## Acceptance criteria map

| Card AC | Requirements | Success criteria | Phase |
|---|---|---|---|
| #1 The engine applies automatic save failure and automatic critical hits from conditions, with engine tests | FR-001–FR-017 | SC-001–SC-004 | 1 |
| Grounding freshness | FR-018 | SC-005 | 2 |

## User scenarios

### US1 — A paralyzed goblin fails its Dexterity save (P1)

Brother Odo casts `sacred-flame` at a paralyzed goblin. The goblin rolls no save. The ledger shows
"Goblin — Goblin is paralyzed: auto-fail vs DC 13: failure", and the radiant damage lands in full.

### US2 — A Constitution save still rolls (P1)

Odo casts `inflict-wounds` at the same goblin. It is a Constitution save, so the goblin rolls.

### US3 — A melee hit on a paralyzed foe is a critical hit (P1)

Tamsin sends `/attack @goblin-2 with longsword` at a paralyzed goblin. She rolls with advantage and
keeps a 12. The attack hits, the outcome is `critical-hit`, and the damage dice double.

### US4 — A hit on a downed hero costs two death saves (P1)

Ana is at 0 HP, unconscious. A goblin's melee attack hits her. The hit is a critical hit, so the
damage marks two death-save failures.

### US5 — Range matters (P2)

Kestrel shoots a paralyzed goblin with her Shortbow. The hit is a plain `hit`. A `fire-bolt` hit on
it is a plain `hit` too.

### US6 — Stunned and petrified do not crit (P2)

A melee hit on a stunned or petrified foe rolls with advantage and is a plain `hit`.

## Requirements

### Engine: the condition reads (`src/derive.ts`)

- **FR-001**: `derive.ts` MUST export
  `autoFailCondition(c: Combatant, kind: "ability-check" | "saving-throw", ability: Ability): ConditionKey | null`.
  It returns the key of the first instance in `c.conditions` whose key is in
  `["paralyzed", "petrified", "stunned", "unconscious"]`, when `kind` is `saving-throw` and `ability`
  is `str` or `dex`. Otherwise it returns `null`.
- **FR-002**: `derive.ts` MUST export `autoCritCondition(c: Combatant): ConditionKey | null`. It
  returns the key of the first instance in `c.conditions` whose key is `paralyzed` or
  `unconscious`, else `null`.
- **FR-003**: Each function MUST carry a doc comment that cites its SRD 5.2.1 condition records by id.

### Engine: saves (`src/commands/attacks.ts`, `src/commands/spells.ts`)

- **FR-004**: `handleCheckRoll` MUST compute the effective automatic failure after the derived
  modifier block and before any outcome branch:
  `command.autoFail`, else `{ reason: "<checker name> is <condition>" }` when `command.combatantId`
  is not null and `autoFailCondition` returns a key, else `null`. It applies with and without
  `expression`. The `autoFail` and `autoSuccess` `INVALID_COMMAND` check keeps reading the command
  fields only.
- **FR-005**: When the effective automatic failure is not null, `handleCheckRoll` MUST emit only
  `check.resolved` with outcome `failure`, band `failure`, `margin`, `rollIndex`, `total` and
  `natural` null, and that `autoFail`. It draws no die and uses no assist. This branch runs before
  the `autoSuccess` branch, so a derived failure beats a command `autoSuccess`.
- **FR-006**: `handleSpellCast` with a `save` delivery MUST read
  `autoFailCondition(target, "saving-throw", d.ability)` after the existing target modifier check.
  With a key, it MUST push no `dice.rolled` for the save and push `check.resolved` with outcome
  `failure`, band `failure`, `rollIndex`, `total`, `natural` and `margin` null,
  `autoFail: { reason: "<target name> is <condition>" }` and `spellId`. `dealt` is `full`. The
  damage dice and the spell condition then follow as today.

### Engine: attacks (`src/commands/attacks.ts`)

- **FR-007**: `handleAttackRoll` MUST compute `autoCrit` inside the `command.attack !== undefined`
  branch: true when `target` exists, `autoCritCondition(target)` is not null, and
  `!isRangedUse(state, attacker.id, command.targetId, entry.value)`. Add the comment
  `// Spec 119: paralyzed and unconscious turn a hit within 5 feet into a Critical Hit (SRD 5.2.1). ponytail: "within 5 feet" is a melee use (isRangedUse), the rule that gates melee reach; a reach weapon in the engaged band counts. Grid mode (R5) measures feet.`
- **FR-008**: The outcome MUST stay `critical-hit` on a natural 20 and `miss` on a natural 1. A total
  that meets or beats AC MUST be `critical-hit` when `autoCrit` is true, else `hit`. A miss stays a
  miss. `natural` and `total` record the real roll.
- **FR-009**: The explicit-expression path MUST derive no automatic critical hit.
- **FR-010**: Reaction attacks (`reaction: true`) MUST follow FR-007 and FR-008 unchanged.
- **FR-011**: `handleSpellCast` with an `attack` delivery MUST NOT derive an automatic critical hit.
  Add above its outcome the comment
  `// ponytail: spec 119 auto-crit needs a melee use; every SPELLS attack is ranged. Add the paralyzed and unconscious check when a melee spell attack enters SPELLS.`

### Engine: unchanged rules

- **FR-012**: `attackModeSources`, `checkModeSources`, `foldMode`, `isDodging` and the damage path
  MUST NOT change. `damage.apply` with `critical: true` already doubles dice and marks two
  death-save failures at 0 HP.
- **FR-013**: No new command, event type, refusal code or schema field. `EngineEventSchema` stays
  `v: 1`.

### Contracts

- **FR-014**: `specs/026-dnd5e-engine/spec.md` FR-023 and `specs/026-dnd5e-engine/contracts/commands.md`
  ("Automatic failure") MUST carry an "Amended by spec 119 (TASK-0222)" note: the engine derives
  automatic failure on Strength and Dexterity saves from `paralyzed`, `petrified`, `stunned` and
  `unconscious`, and a command `autoFail` stays valid data that wins over the derived one.
- **FR-015**: `specs/026-dnd5e-engine/contracts/commands.md` (the `attack.roll` outcome rule) and
  `contracts/events.md` (the `attack.resolved` row) MUST carry an "Amended by spec 119 (TASK-0222)"
  note: a hit within 5 feet (a melee use) on a `paralyzed` or `unconscious` target is
  `critical-hit`, so `critical-hit` may carry a `natural` below 20.

### Replay (operator ruling)

- **FR-016**: `packages/dnd5e-engine/test/commands/condition-auto.test.ts` (new) MUST hold every
  SC-001 and SC-002 case with scripted dice. It is the replay of the rule.
- **FR-017**: `packages/session-model/test/gate-intents.test.ts` MUST gain
  `describe("spec 119: a melee hit on a paralyzed foe is a critical hit")`. `world()` gains the
  option `paralyzeGoblin`. With it, `world()` runs
  `{ type: "condition.apply", targetId: "goblin", condition: "paralyzed", source: "test", reason: "r" }`
  as batch `b-para` after `b-init`. Ana sends
  `parse("/attack @goblin with Longsword", { id: "c119-1", actor: { kind: "pc", id: "ana" }, source: "composer", commit: "confirmed" })`
  with faces `[10, 4, 3, 5]`. The result settles. Its `attack.resolved` row has outcome
  `critical-hit` and `natural` 10. Its damage `dice.rolled` row has `critical: true` and total 11.

### Wiki

- **FR-018**: The wiki MUST be re-pinned with worded prose where behaviour changed (tasks Phase 2).

## Success criteria

- **SC-001**: Saves in `condition-auto.test.ts`. Each case asserts the `check.resolved` fields of
  FR-005 and `counter.draws()` 0, or the `dice.rolled` mode when a die is drawn:
  - for each of `paralyzed`, `petrified`, `stunned` and `unconscious`: a derived `str` save and a
    derived `dex` save auto-fail, reason `"<name> is <condition>"`;
  - a `paralyzed` combatant's `con` save rolls (faces `[15]`, DC 12, success) with mode `normal`;
  - an `incapacitated`-only combatant's `dex` save rolls;
  - a `restrained` combatant's `dex` save still rolls with `disadvantage` and does not auto-fail;
  - an explicit `expression: "1d20+2"` `dex` save by a `stunned` combatant auto-fails with no draw;
  - a `stunned` combatant listed in `Encounter.dodging`, with command `mode: "advantage"`, auto-fails its `dex` save with no draw;
  - a command `autoFail: { reason: "held fast" }` on a `paralyzed` combatant keeps the reason `"held fast"`;
  - a command `autoSuccess` on a `paralyzed` combatant's `str` save yields outcome `failure` with the derived reason;
  - a combatant dropped to 0 HP by `damage.apply` (so `unconscious`, source `hp-zero`) auto-fails a `dex` save, and still does after `stabilize` makes it `stable`;
  - a `paralyzed` combatant with no `stats` and no `expression` still refuses `STAT_UNDEFINED` before any draw;
  - `sacred-flame` on a `paralyzed` target draws no save die: no `dice.rolled` has purpose `save`, the `check.resolved` carries `spellId` and `autoFail`, and the damage is full;
  - `inflict-wounds` (a `con` save) on a `paralyzed` target rolls its save.
- **SC-002**: Attacks in `condition-auto.test.ts`. Use the `economy.test.ts` combatants (AC 13,
  `Sword` melee `toHit: 4`) plus a `Bow` ranged entry and a `Spear` `melee-or-ranged` entry. Each
  case asserts `dice.rolled` mode, `attack.resolved` `natural` and `outcome`:
  - `Sword` on a `paralyzed` target: `advantage`, faces `[12, 3]`, natural 12, `critical-hit`;
  - `Sword` on an `unconscious` target: the same faces, `critical-hit`;
  - `Sword` on a `paralyzed` target, faces `[3, 2]`: `miss`; faces `[1, 1]`: `miss`;
  - `Sword` on a `stunned` target and on a `petrified` target, faces `[12, 3]`: `advantage`, `hit`;
  - `Bow` on a `paralyzed` target, both unplaced, faces `[12, 3]`: `hit`;
  - `Spear` (`melee-or-ranged`, `rangeFt: { normal: 30, long: 120 }`, no sides) on a `paralyzed` target placed in the same zone (band `engaged`), faces `[12, 3]`: `critical-hit`; one zone apart (band `near`, a ranged use at normal range): `advantage`, `hit`;
  - a reaction `Sword` attack (`reaction: true`) in an encounter on an `unconscious` target: `critical-hit`, and `reactionsSpent` gains the attacker;
  - an explicit `expression: "1d20+4"` attack on a `paralyzed` target, faces `[12, 3]` with `mode: "advantage"`: `hit`;
  - `fire-bolt` on a `paralyzed` target, faces `[12, 3]` then one damage face: `advantage`, `hit`, not `critical-hit`;
  - a `poisoned` attacker against a `paralyzed` target: mode `normal`, faces `[14]`, `critical-hit` (the conversion ignores the mode);
  - a dodger (`Encounter.dodging`) that is `paralyzed`: mode `advantage`, not `normal` (Dodge lost), and the hit is `critical-hit`.
- **SC-003**: The downed-hero flow in `condition-auto.test.ts`: a target at 0 HP with
  `lifeState: "unconscious"`, `zeroHpRule: "death-saves"` and the `unconscious` `hp-zero` instance.
  A `Sword` attack with faces `[12, 3]` is `critical-hit`. `damage.apply` with
  `critical: true` and a fixed amount then moves `deathSaves.failures` from 0 to 2. `replay` of the
  events rebuilds the same state.
- **SC-004**: FR-017 passes. The coverage meta-test passes unchanged. Every existing test passes
  unchanged; any test that now changes is listed in the commit message with the reason.
- **SC-005**: `pnpm ci:check` is green. `node scripts/check-boundaries.mjs` exits 0. The wiki plan
  prints nothing. The wiki freshness gate exits 0.

## Scope

- **In**: `autoFailCondition` and `autoCritCondition`; the derived auto-fail in `check.roll` and in
  `spell.cast` save deliveries; the derived critical hit in `attack.roll`; the engine tests; the
  gate test; the 026 contract amendments; the wiki.
- **Out**: the planner `save` refusal for an unable actor (OQ-1). Petrified Resistance to all damage
  and Poison immunity (OQ-2). Planner `why` facts for the two rules. Any change to the planner,
  `apps/server/src`, `packages/session-model/src`, prompts, seeds, the harness or the web.

## Open questions

- **OQ-1**: The planner refuses a `save` Intent by an unable actor with `ACTOR_UNABLE`
  (`resolveActor`, spec 097). So a stunned PC who answers a Constitution save prompt is refused,
  and a `/save dex` by a paralyzed PC never reaches this card's auto-fail. Saves are not actions,
  so the SRD lets such a creature save. Default: out of this card, because it changes a ratified
  planner rule. Recommend the orchestrator card "planner: unable actors still make saves" with a
  trigger: the first playtest or ruling that asks an incapacitated PC for a save.
- **OQ-2**: `petrified` also gives Resistance to all damage and Immunity to Poisoned (SRD 5.2.1
  `petrified`). The engine applies neither. Default: out of this card. Recommend a card with a
  trigger: the first seed with a petrifying effect.
