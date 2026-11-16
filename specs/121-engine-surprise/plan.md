# Implementation Plan: The engine records surprise; the fact sheet derives startlement

**Spec**: `specs/121-engine-surprise/spec.md` | **Card**: TASK-0215 | **Branch**: `task-0215-surprise`
**Authored against**: branch base `f5cee110`, cut from `origin/main` `0f0add89`.

## Summary

`initiative.roll` participants gain `surprised?: boolean`. A surprised participant rolls with
Disadvantage folded into its mode, and `encounter.started` records the surprised ids. Engine state
does not change. `buildNarrationFacts` derives a `startle` reflex for each surprised party member
from that row, so the fact sheet lists it in `settled.involuntary`. The agency rule names the new
reflex, and four prompts take the next version. No migration, no new dependency, no new command,
event type or refusal code, no Intent, seed, web or fact-sheet change.

## Constitution Check (3.0.0)

| Principle | Verdict |
|---|---|
| I Agent-operable | Pass. A DM `mechanics` proposal sends the flag; no new surface. |
| II One Intent vocabulary | Pass. `packages/intent` is untouched; contract v1.1 stays. |
| III Event-sourced, server authority | Pass. One optional event field; `evolve` and `replay` unchanged. |
| IV Three data planes | Pass. SRD data is read, not changed. |
| V Many views, one state | Pass. No view change. |
| VI Engine owns the numbers | Pass, strengthened. The engine applies the surprise Disadvantage; scripted-dice tests pin it. |
| VII Narration around facts | Pass, strengthened. Startlement is a code-derived fact, never a model's guess. |
| VIII Campaign is data | Pass. Seeds unchanged (spec OQ-1). |
| IX UX quality bar | Pass. The ambushed hero may start; no decision is taken from the player. |
| X Grounded claims carry citations | Pass. The rule cites its SRD record id. |
| XI Operator-owned content | Pass. |
| XII Self-hostable | Pass. |
| XIII Plan just-in-time | Pass. Producers and condition effects wait for a trigger (spec OQ-1, OQ-2). |

## Design

### D1 — Command and event schemas (`packages/dnd5e-engine/src/schema/commands.ts`, `events.ts`)

`commands.ts`, in `initiative.roll`:

```ts
    participants: z
      .array(
        z.object({
          combatantId: Id,
          mode: RollMode,
          // Spec 121: surprised by combat starting (SRD 5.2.1 playing-the-game.combat.the-order-of-combat.initiative).
          surprised: z.boolean().optional(),
        }),
      )
      .min(1)
      .max(50),
```

`events.ts`, in `encounter.started` after `after: EncounterSchema`:

```ts
    // Spec 121: participants surprised by combat starting, in command order; omitted when none.
    surprised: z.array(Id).min(1).max(50).optional(),
```

### D2 — Handler (`packages/dnd5e-engine/src/commands/encounter.ts`)

Import `foldMode` from `../derive.js`. Add a doc comment above `handleInitiativeRoll`:

```ts
/**
 * Spec 121: a participant surprised by combat starting has Disadvantage on its Initiative roll
 * (SRD 5.2.1 playing-the-game.combat.the-order-of-combat.initiative, p. 13). It loses no turn.
 * The surprised ids ride on `encounter.started`; engine state holds no surprise.
 */
```

In the roll loop, replace `p.mode` with the folded mode and collect the ids:

```ts
  const surprised: string[] = [];
  for (const p of command.participants) {
    const c = state.combatants[p.combatantId];
    if (!c) continue;
    const mode = p.surprised ? foldMode(p.mode, ["disadvantage"]) : p.mode;
    if (p.surprised) surprised.push(c.id);
    const rolled = rollInitiative(c.id, c.initiativeBonus, mode, reason, rng);
    /* unchanged */
  }
```

Emit:

```ts
  events.push({
    type: "encounter.started",
    v: 1,
    reason,
    before: null,
    after: { round: 1, turnIndex: 0, order },
    ...(surprised.length > 0 ? { surprised } : {}),
  });
```

No other edit in `encounter.ts`. `evolve.ts` stays: it reads `event.after`.

### D3 — Facts (`apps/server/src/dm/facts.ts`)

- `FactInvoluntary.trigger`: `"stagger" | "heavy-hit" | "flinch" | "avoid" | "startle"`.
- Add after `deriveInvoluntary`:

```ts
/**
 * Pure. Spec 121: a startle for each surprised party member, from the public `encounter.started`
 * rows appended this turn, in seq order, once per name. The ledger change row drops the event's
 * `surprised` field, so this reads the stored row.
 */
export function deriveStartle(
  rows: readonly StoredEvent[],
  party: ReadonlySet<string>,
  nameOf: NameOf,
): FactInvoluntary[] {
  const out: FactInvoluntary[] = [];
  const seen = new Set<string>();
  for (const r of [...rows].sort((a, b) => a.seq - b.seq)) {
    if (r.type !== "encounter.started" || r.visibility !== "public") continue;
    const ids =
      (r.payload as { event?: { surprised?: unknown } } | null)?.event?.surprised;
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      if (typeof id !== "string" || !party.has(id)) continue;
      const name = nameOf(id);
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({ name, trigger: "startle", detail: "surprised as the fight starts" });
    }
  }
  return out;
}
```

- In `buildNarrationFacts`, wrap the existing call:

```ts
  const involuntary = [
    ...deriveStartle(input.appendedRows, partyIds, nameOf),
    ...deriveInvoluntary(/* the existing four arguments, unchanged */),
  ];
```

`partyIds` is the set already built above the call.

### D4 — Prompts and doctrine

- `prompts/narrate.ts` `REFLEX_PHRASE`: add `startle: "startle",`. The record type forces it.
- `dm/doctrine/doctrine.ts` `AGENCY_RULE[2]`: change the parenthesis to
  `(a stagger on a critical hit, a heavy-hit reaction, a flinch on a failed save, a flinch on a foe's miss, a startle when surprised as a fight starts)`.
- Version bumps: `dm.narrate-v26` to `v27`, `dm.director-v12` to `v13`, `dm.interpret-v18` to
  `v19`, `playtest.audit-v2` to `v3`. Each version pin test changes with it:
  `apps/server/test/dm/narrate.test.ts` (two pins), `assemble.test.ts`, `interpret-prompt.test.ts`,
  `test/playtest/auditor-prompt.test.ts`. Before the bump, run
  `git fetch origin && git diff origin/main -- apps/server/src/dm/prompts apps/server/src/playtest/auditor/prompt.ts`.
  If `main` moved a version, take one past `main` (runbook rule: the later merge re-bumps).

### D5 — Tests

- `packages/dnd5e-engine/test/commands/encounter.test.ts`: add `describe("spec 121: surprise")`.
  Use the file's `pc` and `stateWith`. Build each command inline:
  `{ type: "initiative.roll", participants: [{ combatantId: "a", mode: "normal", surprised: true }, { combatantId: "b", mode: "normal" }], reason: "ambush" }`.
  Assert the SC-001 fields with `toMatchObject` on `dice.rolled` (`mode`, `natural`, `total`, and
  `terms[0].faces`), and `expect("surprised" in started).toBe(false)` for the no-surprise cases.
  For SC-002: `settle`, then `expect(state.encounter && "surprised" in state.encounter).toBe(false)`
  and `EngineStateSchema.parse(state)`. The dead case uses the file's `dead` overrides and
  `expectRefusedBeforeDraw(..., "TARGET_DEAD")`.
- `apps/server/test/dm/facts.test.ts`: add `describe("deriveStartle (spec 121)")` next to the
  `deriveInvoluntary` block. Build stored rows by hand:
  `{ seq, type: "encounter.started", visibility, actor: "ai:dm", payload: { event: { type: "encounter.started", surprised } } } as unknown as StoredEvent`.
  Party `new Set(["ana"])`, the file's `nameOf`.
- `apps/server/test/dm/fact-sheet.test.ts`: add `describe("spec 121: startlement on the fact sheet")`.
  Load the run-5 fixture as `facts.test.ts` does. Patch a deep copy: set
  `payload.event.surprised = ["tamsin", "odo", "goblin-3"]` on the seq 50 row. Build facts with
  `buildNarrationFacts` over rows 39 to 58 and `modeBefore: "free"`, copying the `facts v2` test's
  `director`, `resolveOf` and `build` shape (`testSeed`, `playerFacingSeed`, `projectDm` from
  `./helpers.js`, `EMPTY_RESOLVE_SNAPSHOT` from `./snapshot-fixtures.js`). Then call
  `buildFactSheet({ settled, beat: [], projections: projectDm(rows through 58), nameOf, submissions: [] })`
  and assert SC-004 on `sheet.settled.involuntary` and `factEntries(sheet.settled)`. Repeat over the
  unpatched fixture.
- `packages/session-model/test/gate-plan.test.ts`: add `describe("spec 121: surprise through the gate")`.
  `plan(dmFold(), aiDm, parse({ kind: "mechanics", command: { type: "initiative.roll", participants: [{ combatantId: "ana", mode: "normal", surprised: true }, { combatantId: "goblin", mode: "normal" }], reason: "ambush" } }), [15, 4, 10])`.
  Assert the SC-005 row types and fields through `okRows`. Fold with
  `dmFold({ extra: rows.map((r) => ({ type: r.type, payload: r.payload, opts: { actor: r.actor, visibility: r.visibility } })) })`
  and assert `encounter?.activeCombatantId` is `goblin`.
- `apps/server/test/dm/doctrine.test.ts`: in "the reflex line allows a flinch on a miss", add
  `expect(text).toContain("a startle when surprised as a fight starts")`.
- Search before editing:
  `rg -n 'REFLEX_PHRASE|involuntary|narrate-v26|director-v12|interpret-v18|playtest.audit-v2|a flinch on a foe' apps/server/test packages/*/test`.
  If an expectation changes, it is the rule: update the expectation, never the rule, and list it in
  the commit message.

### D6 — Contracts

- `specs/026-dnd5e-engine/contracts/commands.md`, new section at the end:
  "## Amended by specs/121-engine-surprise (TASK-0215)". Text: each `initiative.roll` participant
  gains optional `surprised: boolean`. A surprised participant rolls with Disadvantage folded into
  its `mode` (SRD 5.2.1 `playing-the-game.combat.the-order-of-combat.initiative`); Advantage and
  Disadvantage cancel. It loses no turn. `initiative.join` takes no surprise. Refusals unchanged.
- `contracts/events.md`, same heading: `encounter.started` gains optional `surprised: Id[]`, the
  surprised participants in command order, omitted when none. Engine state holds no surprise.
- `specs/074-player-agency/spec.md` OQ-2: append "Closed by spec 121 (TASK-0215)." to the bullet.

## Files

| File | Change |
|---|---|
| `packages/dnd5e-engine/src/schema/commands.ts` | participant `surprised` |
| `packages/dnd5e-engine/src/schema/events.ts` | `encounter.started` `surprised` |
| `packages/dnd5e-engine/src/commands/encounter.ts` | the Disadvantage fold and the event field |
| `packages/dnd5e-engine/test/commands/encounter.test.ts` | SC-001, SC-002 |
| `packages/session-model/test/gate-plan.test.ts` | SC-005 |
| `apps/server/src/dm/facts.ts` | `startle`, `deriveStartle`, the `involuntary` order |
| `apps/server/src/dm/prompts/narrate.ts` | `REFLEX_PHRASE`, version |
| `apps/server/src/dm/doctrine/doctrine.ts` | the `AGENCY_RULE` reflex line |
| `apps/server/src/dm/prompts/director.ts`, `prompts/interpret.ts`, `playtest/auditor/prompt.ts` | version |
| `apps/server/test/dm/facts.test.ts`, `fact-sheet.test.ts`, `doctrine.test.ts` | SC-003, SC-004, SC-006 |
| version pin tests | SC-006 |
| contracts, spec 074 | D6 |
| wiki | Phase 3 |

Not edited: `packages/srd`, `packages/intent`, `packages/planner`, `packages/session-model/src`,
`packages/dnd5e-engine/src/evolve.ts` and `schema/state.ts`, `apps/server/src/dm/fact-sheet.ts`,
`apps/server/src/dm/nodes/resolve.ts`, `apps/web`, the seeds, the playtest harness.

## Concurrency

`commands/encounter.ts` and `schema/` are engine-spine hotspots. `dm/facts.ts`, `prompts/narrate.ts`
and the prompt versions are narration hotspots (TASK-0272 and TASK-0269 are In Progress). Merge
`origin/main` before Phase 2's version bump, before Phase 3 and before the PR. A version another
card took in flight is re-bumped at merge.

## Migrations, prompts, dependencies

- Migrations: none. The field rides the `encounter.started` JSON payload; it is optional.
- Prompts: four versions bump (D4). The narrate `Facts` section gains a `Reflex:` line only when a
  party member is surprised.
- Dependencies: none.

## Flags

- `apps/web/app/play/stream.ts` reads `encounter.started` `after` only, so the new field needs no
  web change. The auditor's `stats.ts` and `checks.ts` read the ledger change row, which drops it.
- A `startle` entry lands in `involuntary` on the turn the encounter starts, even when no action
  runs. On a Director-only start turn the narrate node may still skip on `nothingToNarrate`. That
  path is unchanged; the sheet still carries the entry for any later reader.
