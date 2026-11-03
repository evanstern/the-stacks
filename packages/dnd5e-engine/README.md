# @the-stacks/dnd5e-engine

Pure 5e rules engine. State and a command go in. Events or a refusal come out.

## Entry point

```ts
import { emptyState, execute, replay, scriptedRng } from "@the-stacks/dnd5e-engine";

const result = execute(state, command, rng);
if (result.ok) state = replay(result.events, state);
```

- `execute(state, command, rng)` returns `{ ok: true, events }` or `{ ok: false, refusal }`.
- `replay(events, state)` applies events. `evolve` applies one event.
- `initiative.leave` takes a combatant out of the encounter order and keeps its state. When the active combatant leaves, the next entry becomes active.
- `attack.roll` with `reaction: true` spends the attacker's Reaction. It refuses `REACTION_SPENT` until the start of that combatant's next turn.
- `seededRng(seed)` serves play. `scriptedRng(faces)` serves tests.

## Invariants

- `execute` never mutates its inputs.
- `execute` draws dice only after every refusal check passes.
- `attack.roll` and ability-check `check.roll` refuse an unable actor with `ACTOR_UNABLE`, beside the dead-actor `TARGET_DEAD` refusals. Unable means `unconscious` or `stable`, or a condition of `incapacitated`, `paralyzed`, `petrified`, `stunned` or `unconscious`. Saving throws and attack targets are never checked.
- `check.roll` computes `margin` and `band` (`success`, `success-at-cost`, `failure`, `severe-failure`) on `check.resolved`. `houseRules.naturals` makes a natural 20 succeed and a natural 1 fail. `houseRules.outcomeBands` adds the cost band (-1 to -2) and the severe band (-5 or worse) to ability checks only. Both default false, so a caller that sends none gets SRD behaviour. `autoSuccess` resolves a check with no roll and is refused beside `autoFail` (spec 070).
- Every state change is an event with before and after values.
- `replay` of the events from `execute` yields the next state.
- Replaying all events from `emptyState()` reproduces the live state.

## No I/O

The engine has no database, network, clock, or global randomness. Its only
runtime dependency is `zod`. `pnpm check:boundaries` and `test/purity.test.ts`
enforce this.

## Contracts

See `specs/026-dnd5e-engine/contracts/`: `engine-api.md`, `commands.md`,
`events.md`, `refusals.md`, `boundary-rule.md`.

## Stats and derived rolls (spec 082)

A combatant may carry `stats` (ability modifiers, proficiency bonus, save and skill totals, attack
entries, spellcasting ability). `check.roll` with `difficulty` and no `expression`, and `attack.roll`
with `attack`, derive the modifier, to-hit, DC and roll mode from those stats and the SRD conditions
(`src/derive.ts`). A missing stat refuses `STAT_UNDEFINED`. Explicit `expression` and `dc` stay valid.

## Spells (spec 083)

`spell.cast` resolves one spell by SRD id from the engine's `SPELLS` table (`src/spells.ts`):
slot spend, spell attack or the target's save at the caster's DC, then damage (half on a save
where the SRD says so), healing (dice plus the spellcasting modifier) or a condition. The table
holds six spells (`fire-bolt`, `sacred-flame`, `inflict-wounds`, `ray-of-sickness`,
`cure-wounds`, `healing-word`); any other id refuses `SPELL_UNRESOLVED`. The engine imports no
SRD data: `apps/server/test/dm/spell-mechanics.test.ts` checks each entry against the SRD record.
