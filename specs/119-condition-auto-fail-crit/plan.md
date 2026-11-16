# Implementation Plan: Condition automatic save failure and automatic critical hits

**Spec**: `specs/119-condition-auto-fail-crit/spec.md` | **Card**: TASK-0222 | **Branch**: `task-0222-condition-auto`
**Authored against**: `origin/main` `f076c127`.

## Summary

`derive.ts` gains two condition reads. `check.roll` and `spell.cast` save deliveries turn a
Strength or Dexterity save by a `paralyzed`, `petrified`, `stunned` or `unconscious` combatant into
an automatic failure with a derived reason. `attack.roll` with a derived entry turns a hit on a
`paralyzed` or `unconscious` target into `critical-hit` when the use is melee (`isRangedUse` false).
No migration, no new dependency, no new command, event, refusal or field, no planner or server
change, no prompt change.

## Constitution Check (3.0.0)

| Principle | Verdict |
|---|---|
| I Agent-operable | Pass. No new surface. |
| II One Intent vocabulary | Pass. `packages/intent` is untouched. |
| III Event-sourced, server authority | Pass. Existing event shapes; `evolve` and `replay` unchanged. |
| IV Three data planes | Pass. No plane touched. |
| V Many views, one state | Pass. No view change. The ledger already renders an auto-fail row. |
| VI Engine owns the numbers | Pass, strengthened. The engine derives two more SRD outcomes; scripted-dice tests pin each. |
| VII Narration around facts | Pass. Narration reads the same `check.resolved` and `attack.resolved` rows. |
| VIII Campaign is data | Pass. Seeds unchanged. |
| IX UX quality bar | Pass. A paralyzed foe falls as the SRD says. |
| X Grounded claims carry citations | Pass. Each rule cites its SRD 5.2.1 record id. |
| XI Operator-owned content | Pass. |
| XII Self-hostable | Pass. |
| XIII Plan just-in-time | Pass. The planner save rule and petrified defenses wait for a trigger (spec OQ-1, OQ-2). |

## Design

### D1 — Condition reads (`src/derive.ts`)

Add after `checkModeSources`:

```ts
/** SRD 5.2.1 conditions paralyzed, petrified, stunned, unconscious: "Saving Throws Affected". */
const AUTO_FAIL_SAVES = ["paralyzed", "petrified", "stunned", "unconscious"] as const;
/** SRD 5.2.1 conditions paralyzed, unconscious: "Automatic Critical Hits". */
const AUTO_CRIT = ["paralyzed", "unconscious"] as const;

/** Spec 119: the condition that makes this Strength or Dexterity save fail, or null. */
export function autoFailCondition(
  c: Combatant,
  kind: "ability-check" | "saving-throw",
  ability: Ability,
): ConditionKey | null {
  if (kind !== "saving-throw" || (ability !== "str" && ability !== "dex")) return null;
  return (
    c.conditions.find((i) =>
      (AUTO_FAIL_SAVES as readonly string[]).includes(i.condition),
    )?.condition ?? null
  );
}

/** Spec 119: the condition that turns a hit within 5 feet into a Critical Hit, or null. */
export function autoCritCondition(c: Combatant): ConditionKey | null {
  return (
    c.conditions.find((i) => (AUTO_CRIT as readonly string[]).includes(i.condition))
      ?.condition ?? null
  );
}
```

Import the `ConditionKey` type from `./schema/state.js` (already exported).
Export both functions from `src/index.ts` beside `checkModeSources`.

### D2 — `check.roll` (`src/commands/attacks.ts`)

In `handleCheckRoll`, after the derived-modifier block (the `if (command.expression === undefined && ...)`
block) and before `const base`:

```ts
// Spec 119: paralyzed, petrified, stunned and unconscious fail Str and Dex saves (SRD 5.2.1).
// A command autoFail is adjudication's data and wins (spec 026 FR-023).
const checker =
  command.combatantId === null ? undefined : state.combatants[command.combatantId];
const derivedKey = checker
  ? autoFailCondition(checker, command.kind, command.ability)
  : null;
const autoFail =
  command.autoFail ??
  (derivedKey && checker ? { reason: `${checker.name} is ${derivedKey}` } : null);
```

Then:

- Keep the `command.autoFail && command.autoSuccess` `INVALID_COMMAND` check as it is (it reads the
  command fields).
- Move the `autoFail` branch above the `autoSuccess` branch, and test the local `autoFail`, not
  `command.autoFail`. Emit `autoFail` (the local) in the event.
- `applied` assists are not used on this branch (no `usedAssists`), as today.

`checkNamed` already ran, so `checker` exists when `combatantId` is not null.

### D3 — `spell.cast` saves (`src/commands/spells.ts`)

In the `d.kind === "save"` branch, before `rollExpression`:

```ts
// Spec 119: an automatic failure draws no save die (SRD 5.2.1 condition records).
const failKey = autoFailCondition(target, "saving-throw", d.ability);
if (failKey) {
  events.push({
    type: "check.resolved",
    v: 1,
    reason,
    combatantId: target.id,
    kind: "saving-throw",
    ability: d.ability,
    skill: null,
    rollIndex: null,
    dc,
    total: null,
    natural: null,
    autoFail: { reason: `${target.name} is ${failKey}` },
    outcome: "failure",
    margin: null,
    band: "failure",
    spellId: spell.id,
  });
  dealt = "full";
} else {
  /* the existing roll, check.resolved and dealt code, unchanged */
}
```

Then the existing `if (dealt !== "none" && components.length > 0)` damage block runs for both arms.
Keep it outside the `if`/`else`.

In the `d.kind === "attack"` branch, above the `outcome` computation, add the FR-011 `ponytail:`
comment. No code change there.

### D4 — `attack.roll` (`src/commands/attacks.ts`)

In `handleAttackRoll`, declare `let autoCrit = false;` beside `let applied`. Inside the
`command.attack !== undefined` branch, after `placed`:

```ts
// Spec 119: paralyzed and unconscious turn a hit within 5 feet into a Critical Hit (SRD 5.2.1).
// ponytail: "within 5 feet" is a melee use (isRangedUse), the rule that gates melee reach; a
// reach weapon in the engaged band counts. Grid mode (R5) measures feet.
autoCrit =
  target !== undefined &&
  autoCritCondition(target) !== null &&
  !isRangedUse(state, attacker.id, command.targetId, entry.value);
```

Change the outcome:

```ts
const outcome =
  natural === 20
    ? "critical-hit"
    : natural === 1
      ? "miss"
      : rolled.total >= ac
        ? autoCrit ? "critical-hit" : "hit"
        : "miss";
```

`isRangedUse` is the module-local function already in `attacks.ts`. Import `autoCritCondition` and
`autoFailCondition` from `../derive.js`.

### D5 — Tests

- `packages/dnd5e-engine/test/commands/condition-auto.test.ts` (new): SC-001, SC-002, SC-003.
  Copy the `stats`, `mk`, `cond` and `play` helpers from `economy.test.ts`. Add attack entries:
  `{ name: "Bow", range: "ranged", rangeFt: { normal: 80, long: 320 }, toHit: 4, damage: [] }` and
  `{ name: "Spear", range: "melee-or-ranged", reachFt: 5, rangeFt: { normal: 30, long: 120 }, toHit: 4, damage: [] }`.
  For the band cases, define a two-zone space (`a`, `b`, one 30-ft edge) with `space.define` and
  place both combatants with `combatant.place`, as `melee.test.ts` does. Use `run(...).counter.draws()`
  for the no-draw cases. Use `expectRefusedBeforeDraw` for the `STAT_UNDEFINED` case. The SC-003
  case sets `hp.current: 0`, `lifeState: "unconscious"` and an `unconscious` instance with source
  `hp-zero`, then runs `damage.apply` with `components: [{ amount: { kind: "fixed", value: 3 }, damageType: "slashing" }]`
  and `critical: true`.
  For the "dropped to 0 HP" save case, run `damage.apply` past current HP on a `death-saves`
  combatant, `settle`, assert the auto-fail, then run `stabilize`, `settle`, assert again.
  For the `sacred-flame` cases, reuse the caster and slot setup of `test/commands/spells.test.ts`.
- `packages/session-model/test/gate-intents.test.ts`: add `paralyzeGoblin?: boolean` to the
  `world()` options and the `condition.apply` batch after `b-init`. Add the FR-017 `describe`.
  Find the damage roll as the `dice.rolled` row whose payload purpose is `damage`.
- No other test file changes unless it fails. Search first for tests that roll a Str or Dex save
  or land a melee hit on a target holding one of the four conditions:
  `rg -n 'paralyzed|petrified|stunned|"unconscious"|hp-zero' packages/*/test apps/server/test`.
  Known candidates: `packages/dnd5e-engine/test/commands/attacks.test.ts` (the `stunned` far
  target at line ~1426 is a ranged shot, so it stays a `hit`), `test/derive.test.ts`,
  `test/commands/spells.test.ts`, `test/commands/hit-points.test.ts`, `test/commands/life.test.ts`,
  `apps/server/test/dm/resolve.integration.test.ts`. If one changes, it is the rule: update the
  expectation, never the rule, and list it in the commit message.

### D6 — Contracts

- `specs/026-dnd5e-engine/spec.md` FR-023: append
  "Amended by spec 119 (TASK-0222): the engine derives automatic failure on Strength and Dexterity
  saves from `paralyzed`, `petrified`, `stunned` and `unconscious`; a command `autoFail` stays valid
  and wins." Leave the sentence it amends in place.
- `specs/026-dnd5e-engine/contracts/commands.md` "Automatic failure" bullet: the same note. The
  `attack.roll` outcome rule: "Amended by spec 119 (TASK-0222): a derived attack that hits a
  `paralyzed` or `unconscious` target with a melee use is `critical-hit`."
- `specs/026-dnd5e-engine/contracts/events.md` `attack.resolved` row: "Amended by spec 119
  (TASK-0222): `critical-hit` may carry a `natural` below 20." `check.resolved` row: "Amended by
  spec 119: a derived automatic failure has the FR-023 shape with reason `<name> is <condition>`."
- `specs/026-dnd5e-engine/contracts/engine-api.md`: list `autoFailCondition` and
  `autoCritCondition` with "Amended by spec 119 (TASK-0222)".

## Files

| File | Change |
|---|---|
| `packages/dnd5e-engine/src/derive.ts` | `autoFailCondition`, `autoCritCondition` |
| `packages/dnd5e-engine/src/commands/attacks.ts` | derived auto-fail in `check.roll`; auto-crit in `attack.roll` |
| `packages/dnd5e-engine/src/commands/spells.ts` | derived auto-fail on save deliveries; `ponytail:` on attack deliveries |
| `packages/dnd5e-engine/src/index.ts` | exports |
| `packages/dnd5e-engine/test/commands/condition-auto.test.ts` (new) | SC-001–SC-003 |
| `packages/session-model/test/gate-intents.test.ts` | FR-017 |
| contracts | D6 |
| wiki | Phase 2 |

Not edited: `packages/planner`, `packages/intent`, `packages/session-model/src`, `apps/server/src`,
`apps/web`, the harness, the seeds, the prompts.

## Concurrency

TASK-0224 and TASK-0215 follow on the engine spine (runbook wave 3) and touch `attacks.ts`,
`spells.ts` and `derive.ts`. Merge `origin/main` before Phase 2 and before the PR.

## Migrations, prompts, dependencies

- Migrations: none.
- Prompts: none. `interpret` may still send `autoFail`; the command value wins.
- Dependencies: none.

## Flags

- `check.resolved` rows with null roll fields now appear without a model-sent `autoFail`.
  `facts.ts` reads `e.autoFail?.reason`, which the engine now always sets on this path, so the
  ledger line reads "<name> — <name> is paralyzed: auto-fail vs DC n: failure". No server change.
- The playtest auditor counts `critical-hit` as a hit (`auditor/stats.ts`). No change.
- `facts.ts` adds a "stagger" reflex on a `critical-hit` against a party member. A hit on a downed
  PC now raises it. That is the rule.
