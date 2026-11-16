# Implementation Plan: Monster-feature DCs come from the stat block

**Spec**: `specs/120-monster-feature-dc/spec.md` | **Card**: TASK-0224 | **Branch**: `task-0224-monster-dc`
**Authored against**: branch base `b82168ad`; `origin/main` `cdc739b0` touches none of the files below.

## Summary

Engine stats gain `featureDcs`. `statsFromSrd` fills it from each SRD feature's `save` field and from
"escape DC N" in the feature text. `check.roll` gains a fourth DC source, `feature: { sourceId, name }`,
and `check.resolved` records it. `oppositionDc` takes the roll kind, so an escape check against a
monster uses its stated escape DC. No migration, no new dependency, no new command, event or refusal
code, no Intent, prompt, seed or web change.

## Constitution Check (3.0.0)

| Principle | Verdict |
|---|---|
| I Agent-operable | Pass. A DM `mechanics` proposal can name a feature; no new surface. |
| II One Intent vocabulary | Pass. `packages/intent` is untouched; contract v1.1 stays. |
| III Event-sourced, server authority | Pass. One optional event field; `evolve` and `replay` unchanged. |
| IV Three data planes | Pass. SRD data is read, not changed. |
| V Many views, one state | Pass. No view change. |
| VI Engine owns the numbers | Pass, strengthened. Two more DCs come from the stat block, not a model tier; scripted-dice tests pin each. |
| VII Narration around facts | Pass. Narration reads the same `check.resolved` row. |
| VIII Campaign is data | Pass. Seeds unchanged. |
| IX UX quality bar | Pass. A web or a grapple holds at the number on the card. |
| X Grounded claims carry citations | Pass. Each rule cites its SRD record ids. |
| XI Operator-owned content | Pass. |
| XII Self-hostable | Pass. |
| XIII Plan just-in-time | Pass. Producers and prose-only DCs wait for a trigger (spec OQ-1, OQ-2). |

## Design

### D1 — Stats (`packages/dnd5e-engine/src/schema/state.ts`)

Add before `CombatantStatsSchema`:

```ts
/** Spec 120: a DC a monster feature states in its SRD stat block (SRD 5.2.1 monster records). */
export const FeatureDcSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("save"),
    feature: z.string().min(1).max(60),
    ability: AbilitySchema,
    dc: z.number().int().min(1).max(40),
  }),
  z.object({
    kind: z.literal("escape"),
    feature: z.string().min(1).max(60),
    dc: z.number().int().min(1).max(40),
  }),
]);
export type FeatureDc = z.infer<typeof FeatureDcSchema>;
```

In `CombatantStatsSchema`, after `abilityScores`:

```ts
  // Spec 120: stat-block save and escape DCs, in record order.
  featureDcs: z.array(FeatureDcSchema).max(12).optional(),
```

### D2 — Derivations (`packages/dnd5e-engine/src/derive.ts`)

Add after `oppositionDc`:

```ts
/** Spec 120: the save DC a source's feature states, matched by name (trimmed, case-insensitive). */
export function findFeatureDc(
  c: Combatant,
  name: string,
): Derived<Extract<FeatureDc, { kind: "save" }>> {
  if (!c.stats) return { ok: false, missing: "stats" };
  const want = name.trim().toLowerCase();
  const hit = (c.stats.featureDcs ?? []).find(
    (f): f is Extract<FeatureDc, { kind: "save" }> =>
      f.kind === "save" && f.feature.toLowerCase() === want,
  );
  return hit ? { ok: true, value: hit } : { ok: false, missing: `feature "${name}"` };
}
```

Change `oppositionDc` to take `kind` third, and replace its doc comment's last two lines:

```ts
/**
 * unarmed-strike: 8 + Strength modifier + proficiency bonus (Unarmed Strike, SRD 5.2.1 p. 190).
 * Spec 120: an ability check against unarmed-strike is the escape check; an opponent whose stat
 * block states an escape DC uses it.
 * influence: the higher of 15 and the opponent's Intelligence score (rules-glossary.influence-action).
 * ponytail: the first stated escape DC applies even to a grapple made by Unarmed Strike; record the
 * grappling feature on the condition when TASK-0320 plans feature use.
 */
export function oppositionDc(
  opponent: Combatant,
  rule: OppositionRule,
  kind: "ability-check" | "saving-throw",
): Derived<number> {
  const stats = opponent.stats;
  if (!stats) return { ok: false, missing: "stats" };
  if (rule === "unarmed-strike") {
    const escape = stats.featureDcs?.find((f) => f.kind === "escape");
    if (kind === "ability-check" && escape) return { ok: true, value: escape.dc };
    /* the existing formula, unchanged */
  }
  /* influence, unchanged */
}
```

Import the `FeatureDc` type from `./schema/state.js`. Export `FeatureDcSchema`, `FeatureDc` and
`findFeatureDc` from `src/index.ts` beside `oppositionDc`.

### D3 — `check.roll` (`src/schema/commands.ts`, `src/commands/attacks.ts`, `src/schema/events.ts`)

`commands.ts`, in the `check.roll` object after `opposition`:

```ts
    // Spec 120: the DC a monster feature states (a fourth DC source; exactly one of the four).
    feature: z
      .object({ sourceId: Id, name: z.string().min(1).max(60) })
      .optional(),
```

`events.ts`, in `check.resolved` after `opposition`:

```ts
    // Spec 120: set when the DC came from a monster feature.
    feature: z
      .object({ sourceId: Id, name: z.string().min(1).max(60) })
      .optional(),
```

`attacks.ts` `handleCheckRoll`, in this order:

1. Count four sources: `[command.dc, command.difficulty, command.opposition, command.feature]`.
   The message becomes "check.roll needs exactly one of dc, difficulty, opposition and feature".
2. After the opposition check, add:
   ```ts
   const feature = command.feature;
   if (
     feature &&
     (command.kind !== "saving-throw" || feature.sourceId === command.combatantId)
   ) {
     return refuse(
       "INVALID_COMMAND",
       "a feature DC needs a saving throw by a combatant other than its source",
     );
   }
   ```
3. Leave `checkNamed` over `[command.combatantId, opposition?.opponentId ?? null]`. Do not add the
   feature source: a dead source is allowed (spec decision 7).
4. After the opposition DC block, add:
   ```ts
   let featureName: string | null = null;
   if (feature) {
     const source = state.combatants[feature.sourceId];
     if (!source) {
       return refuse("UNKNOWN_COMBATANT", `no combatant "${feature.sourceId}"`, {
         combatantId: feature.sourceId,
       });
     }
     const found = findFeatureDc(source, feature.name);
     if (!found.ok) {
       return refuse(
         "STAT_UNDEFINED",
         `cannot derive the DC of feature "${feature.name}"`,
         { combatantId: feature.sourceId, missing: found.missing },
       );
     }
     if (found.value.ability !== command.ability) {
       return refuse(
         "INVALID_COMMAND",
         `the feature "${found.value.feature}" calls a ${found.value.ability} save`,
         { ability: found.value.ability },
       );
     }
     dc = found.value.dc;
     featureName = found.value.feature;
   }
   ```
5. Pass `command.kind` to the existing `oppositionDc` call.
6. In `base`, after `...(opposition ? { opposition } : {})`, add
   `...(feature && featureName ? { feature: { sourceId: feature.sourceId, name: featureName } } : {})`.
   Every branch spreads `base`, so FR-013 needs no other edit.

Import `findFeatureDc` from `../derive.js`. `refuse` takes a free `details` record, so the
`{ ability }` detail needs no schema change.

### D4 — Server stats (`apps/server/src/dm/seed/combatants.ts`)

Add above `statsFromSrd`:

```ts
const ESCAPE_DC = /escape DC (\d+)/i;

/**
 * Spec 120: stat-block DCs. A feature's `save` field gives a save DC; "escape DC N" in its text
 * gives an escape DC (SRD 5.2.1 monster records, e.g. aboleth Tentacle).
 * ponytail: the escape DC is read from prose; add a structured field in convert-open5e.mjs when
 * the SRD data is next regenerated.
 */
function featureDcsFromSrd(monster: Monster): FeatureDc[] {
  const out: FeatureDc[] = [];
  for (const f of [
    ...monster.traits,
    ...monster.actions,
    ...monster.bonusActions,
    ...monster.reactions,
    ...(monster.legendaryActions?.actions ?? []),
  ]) {
    if (f.save) {
      out.push({ kind: "save", feature: f.name, ability: f.save.ability, dc: f.save.dc });
    }
    const escape = ESCAPE_DC.exec(f.text);
    if (escape) out.push({ kind: "escape", feature: f.name, dc: Number(escape[1]) });
  }
  return out.slice(0, 12);
}
```

In `statsFromSrd`'s return, after `abilityScores`:

```ts
    ...(featureDcs.length > 0 ? { featureDcs } : {}),
```

with `const featureDcs = featureDcsFromSrd(monster);` before the return. Change the
`spellcastingAbility` comment to
`// ponytail: monster spellcasting is TASK-0230; null until it lands.`
Import the `FeatureDc` type from `@the-stacks/dnd5e-engine`.

### D5 — Tests

- `packages/dnd5e-engine/test/commands/feature-dc.test.ts` (new): SC-001, SC-002 and the two
  `check.roll` cases of SC-003. Build state with `combatant.add` commands and `settle`, as
  `economy.test.ts` does. Combatants:
  - `ana`: `zeroHpRule: "death-saves"`, stats `abilityMods { str: 3, dex: 3, con: 1, int: 0, wis: 1, cha: 0 }`,
    `proficiencyBonus: 2`, `saves: {}`, `skills: { athletics: 5 }`, `attacks: []`, `spellcastingAbility: null`;
  - `spider`: stats as Ana's plus `featureDcs: [{ kind: "save", feature: "Web", ability: "dex", dc: 13 }]`;
  - `mephit`: `hp.max` 18, `zeroHpRule: "dies"`, `featureDcs: [{ kind: "save", feature: "Death Burst", ability: "dex", dc: 11 }, { kind: "save", feature: "Fire Breath", ability: "dex", dc: 11 }]`;
  - `aboleth`: `abilityMods.str` 5, `proficiencyBonus` 4, `featureDcs` the four SC-004 aboleth entries;
  - `rock`: no `stats`.
  Use `expectRefusedBeforeDraw` for every SC-002 case and the counter for the auto-fail case. Add the
  `paralyzed` instance with `condition.apply` (source `test`). Kill the mephit with `damage.apply`
  `components: [{ amount: { kind: "fixed", value: 30 }, damageType: "fire" }]`, then `settle`.
- `packages/dnd5e-engine/test/derive.test.ts`: add `"saving-throw"` to every existing `oppositionDc`
  call, then add the SC-003 `oppositionDc` cases and three `findFeatureDc` cases (hit, trimmed
  case-insensitive hit, miss text).
- `apps/server/test/dm/seed-stats.test.ts`: add `describe("spec 120 feature DCs")` with SC-004. Import
  `list` from `@the-stacks/srd` and `CombatantStatsSchema` from `@the-stacks/dnd5e-engine`.
- `packages/session-model/test/gate-intents.test.ts`: add `goblinFeatures?: boolean` to the `world()`
  options. With it, the goblin is
  `fighter("goblin", "a", { stats: { ...stats([sword]), featureDcs: [{ kind: "save", feature: "Web", ability: "dex", dc: 13 }, { kind: "escape", feature: "Grab", dc: 11 }] } })`.
  Add the FR-019 `describe` with two cases:
  1. `planProposal(p, aiDm, mechanicsProposal({ type: "check.roll", combatantId: "ana", kind: "saving-throw", ability: "dex", skill: null, mode: "normal", feature: { sourceId: "goblin", name: "Web" }, autoFail: null, reason: "web" } as never), scriptedRng([12]), { batchId: "b-plan" }, null)`.
     Assert the row types are `dice.rolled`, `check.resolved` and the SC-005 fields.
  2. `parse("/contest athletics @goblin", { id: "c120-1", actor: { kind: "pc", id: "ana" }, source: "composer", commit: "confirmed" })`
     through the file's `plan` helper with faces `[6]`. Find the `check.resolved` row and assert the
     SC-005 fields. Fold the rows after the world, as the spec 119 case does.
  Import `mechanicsProposal` from `../src/index.js`.
- Search for tests the change touches before editing:
  `rg -n 'oppositionDc|exactly one of dc|featureDcs|statsFromSrd|combatantFromSrd' packages/*/test apps/server/test`.
  Known callers: `derive.test.ts` (signature), `seed.test.ts` (self-consistent `stats: statsFromSrd(...)`,
  unchanged). If an expectation changes, it is the rule: update the expectation, never the rule, and
  list it in the commit message.

### D6 — Planner (`packages/planner/src/checks.ts`, `packages/planner/src/combat.ts`)

- `checks.ts` `contest`: `oppositionDc(opp.value.combatant, rule, roll.kind)`.
- `combat.ts` `grappleSave`: `oppositionDc(who.combatant, rule, "saving-throw")`.
No other planner edit. `packages/planner/test` needs no change unless a typecheck fails.

### D7 — Contracts

- `specs/026-dnd5e-engine/contracts/commands.md`, new section at the end:
  "## Amended by specs/120-monster-feature-dc (TASK-0224)". Text: `check.roll` gains optional
  `feature: { sourceId, name }`, a fourth DC source: exactly one of `dc`, `difficulty`, `opposition`
  and `feature`. It is valid only on a `saving-throw` by a combatant other than the source. The
  engine reads the DC from the source's `stats.featureDcs`. The source must exist and may be dead.
  Refusals: `INVALID_COMMAND` (second source, wrong kind, self source, ability mismatch),
  `UNKNOWN_COMBATANT`, `STAT_UNDEFINED`. The `unarmed-strike` opposition on an ability check uses the
  opponent's first stated escape DC.
- `contracts/events.md`, same heading: `check.resolved` gains optional `feature: { sourceId, name }`.
- `contracts/engine-api.md`, same heading: `index.ts` exports `FeatureDcSchema`, `FeatureDc` and
  `findFeatureDc`; `CombatantStats` gains optional `featureDcs`; `oppositionDc` takes a third
  argument `kind`.
- `specs/082-engine-derived-numbers/spec.md` OQ-7 and `specs/084-opposition-and-help/spec.md` OQ-2:
  append "Closed by spec 120 (TASK-0224)." to the bullet.

## Files

| File | Change |
|---|---|
| `packages/dnd5e-engine/src/schema/state.ts` | `FeatureDcSchema`, `stats.featureDcs` |
| `packages/dnd5e-engine/src/schema/commands.ts` | `check.roll` `feature` |
| `packages/dnd5e-engine/src/schema/events.ts` | `check.resolved` `feature` |
| `packages/dnd5e-engine/src/derive.ts` | `findFeatureDc`; `oppositionDc` `kind` and escape DC |
| `packages/dnd5e-engine/src/commands/attacks.ts` | the feature DC source |
| `packages/dnd5e-engine/src/index.ts` | exports |
| `packages/dnd5e-engine/test/commands/feature-dc.test.ts` (new) | SC-001–SC-003 |
| `packages/dnd5e-engine/test/derive.test.ts` | SC-003, signature |
| `packages/planner/src/checks.ts`, `packages/planner/src/combat.ts` | `oppositionDc` call sites |
| `apps/server/src/dm/seed/combatants.ts` | `featureDcsFromSrd` |
| `apps/server/test/dm/seed-stats.test.ts` | SC-004 |
| `packages/session-model/test/gate-intents.test.ts` | SC-005 |
| contracts | D7 |
| wiki | Phase 3 |

Not edited: `packages/srd` (data, schema, scripts), `packages/intent`, `packages/session-model/src`,
`apps/server/src` outside `dm/seed/combatants.ts`, `apps/web`, the seeds, the prompts, the harness.

## Concurrency

`attacks.ts`, `derive.ts` and `schema/` are runbook hotspots (TASK-0215, TASK-0223 follow on the
engine spine). Merge `origin/main` before Phase 3 and before the PR.

## Migrations, prompts, dependencies

- Migrations: none. `stats` rides the `combatant.added` JSON payload; the new keys are optional.
- Prompts: none. The snapshot sheet (`dm/snapshot/build.ts`) is built from the seed sheet, not engine
  `stats`, so `featureDcs` does not reach a prompt.
- Dependencies: none.

## Flags

- A monster added before this card has no `featureDcs` in its logged `combatant.added` payload. A
  replayed session keeps the formula escape DC and refuses a `feature` save `STAT_UNDEFINED`. The
  producer falls back to a tier. That is safe and needs no upcaster.
- `apps/server/src/dm/fact-sheet.ts` renders the planner `dc` fact, not `check.resolved`. A
  `mechanics` feature save has no planner facts, so the ledger shows `vs DC 13` with no source. No
  change.
