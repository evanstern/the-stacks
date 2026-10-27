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
- `seededRng(seed)` serves play. `scriptedRng(faces)` serves tests.

## Invariants

- `execute` never mutates its inputs.
- `execute` draws dice only after every refusal check passes.
- `attack.roll` and ability-check `check.roll` refuse an unable actor with `ACTOR_UNABLE`, beside the dead-actor `TARGET_DEAD` refusals. Unable means `unconscious` or `stable`, or a condition of `incapacitated`, `paralyzed`, `petrified`, `stunned` or `unconscious`. Saving throws and attack targets are never checked.
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
