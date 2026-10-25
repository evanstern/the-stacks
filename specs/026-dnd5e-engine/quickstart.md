# Quickstart: pure 5e engine package

How to prove the feature works, from a worktree with dependencies installed (`pnpm install`).
No database is needed: the engine has no I/O.

## Run the engine's tests

```bash
pnpm --filter @the-stacks/dnd5e-engine test
```

Expect every suite green, including `coverage.test.ts` (every command and refusal code has a
test) and `purity.test.ts` (imports allowlist, no clock or global randomness).

## Prove the boundary rule fires

```bash
pnpm check:boundaries
```

Expect `boundary rules: N/N fixtures flagged`, where N now includes the six
`fixtures/boundary-violations/packages/dnd5e-engine/src/bad-*.ts` files. To see the gate
fail, delete the engine override from `biome.json` locally and rerun: the six engine fixtures
are reported as not flagged and the script exits 1. Restore the file.

## Use the engine from a caller

```ts
import { emptyState, execute, replay, scriptedRng } from "@the-stacks/dnd5e-engine";

let state = emptyState();
const add = execute(state, {
  type: "combatant.add",
  reason: "scene seed",
  combatant: { id: "pc-ana", name: "Ana", hp: { max: 12 }, zeroHpRule: "death-saves",
               hitDice: [{ die: 10, total: 1 }] },
}, scriptedRng([]));
if (add.ok) state = replay(add.events, state);

const hit = execute(state, {
  type: "attack.roll", attackerId: null, targetId: "pc-ana", expression: "1d20+4",
  targetAc: 14, reason: "goblin scimitar attack",
}, scriptedRng([15]));
// hit.ok === true; hit.events: dice.rolled (total 19), attack.resolved (outcome "hit")

const dmg = execute(state, {
  type: "damage.apply", targetId: "pc-ana", critical: false,
  components: [{ amount: { kind: "roll", expression: "2d6+2" }, damageType: "slashing" }],
  reason: "goblin scimitar hit",
}, scriptedRng([4, 3]));
// dmg.ok === true; dmg.events: dice.rolled (total 9), hp.changed 12 → 3 (raw 9, applied 9)
```

## Full gate

```bash
pnpm ci:check
```
