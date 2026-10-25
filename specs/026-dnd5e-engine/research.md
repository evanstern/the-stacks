# Research: pure 5e engine package

Phase 0 output for [plan.md](plan.md). Each entry: decision, rationale, alternatives.

## R1. Package placement and name

- **Decision**: a new workspace package `packages/dnd5e-engine`, published in the workspace as
  `@the-stacks/dnd5e-engine`, built with `tsc -b` like `packages/shared`.
- **Rationale**: decision-0010 keeps a `dnd5e` module boundary "as its own package with a
  narrow entry point". A package boundary is what Biome overrides, TypeScript project
  references and `package.json` dependencies can all police. The `packages/*` glob in
  `pnpm-workspace.yaml` already admits it.
- **Alternatives**: a folder under `apps/server/src/` (rejected: Biome could scope a rule to
  it, but the server's `@types/node` and dependencies would be one import away and the
  package could not be consumed by the web app later); adding to `packages/shared`
  (rejected: shared carries a DOM lib and web helpers, and mixes concerns).

## R2. Seeded RNG algorithm

- **Decision**: mulberry32 over a 32-bit integer seed, with rejection sampling to map its
  output onto `1..sides` without modulo bias. About 15 lines, written in the package.
- **Rationale**: the engine needs reproducibility, not cryptographic strength. mulberry32 is
  public domain, passes the statistical tests that matter for dice, and needs no dependency.
  `node:crypto` is forbidden by the boundary rule anyway.
- **Alternatives**: `seedrandom` or `pure-rand` packages (rejected: a dependency for 15
  lines); xoshiro128** (equally good; mulberry32 is shorter and its single 32-bit state is
  trivially serialisable if TASK-0045 ever wants to persist the generator).

## R3. RNG interface granularity

- **Decision**: the RNG exposes one method, `rollDie(sides)`, returning a face.
- **Rationale**: scripted-dice tests then script faces exactly as a player reads them ("the
  d20 shows 17"), and every draw maps 1:1 to a face in a `dice.rolled` event. A raw
  `nextFloat()` interface would make scripts opaque and tie tests to the mapping algorithm.
- **Alternatives**: `nextInt(min, max)` (more general than needed; no engine draw is not a
  die); `nextUint32()` (scripts become unreadable).

## R4. Decide/evolve split and before/after events

- **Decision**: `execute` decides and returns events; `evolve` applies an event by writing its
  `after` slice. Every state-change event carries `before` and `after`.
- **Rationale**: decision-0021 idea 2 already requires before/after in the ledger. Making
  `evolve` copy `after` means projections (TASK-0044) rebuild state with no rules and no RNG,
  and a replay can never re-roll. `before` lets `evolve` (in tests) and audit assert that the
  log is consistent.
- **Alternatives**: `execute` returning the next state alongside events (rejected: two
  sources of truth; the event log must be the only one, constitution IV); `evolve`
  re-applying rules from command-like events (rejected: replay would need the RNG and would
  drift when a rule changes).

## R5. Validation inside `execute`

- **Decision**: `execute` accepts `command: unknown` and parses both the command and the
  state with Zod on every call.
- **Rationale**: the gate forwards LLM proposals; parsing at the engine makes it impossible to
  forget. The state is small (a scene's combatants), so the parse cost is negligible.
- **Alternatives**: trusting typed inputs (rejected: an LLM proposal is untyped until parsed,
  and a corrupted projection would crash rather than refuse).

## R6. Boundary enforcement mechanics

- **Decision**: a Biome override with `noRestrictedImports` (denylist) plus
  `noRestrictedGlobals` for the clock and network globals, proven by fixtures; backed by a
  source-scan allowlist test and a `lib: ["ES2022"], types: []` tsconfig.
- **Rationale**: the project's existing boundary gate (`scripts/check-boundaries.mjs`) proves
  `noRestrictedImports` rules fire against fixtures; extending it is the smallest change that
  makes AC #10 a CI failure. Biome 2.5.14's schema confirms both rules live in the `style`
  group and that `noRestrictedGlobals` takes `deniedGlobals` as a name-to-message record.
  `Math.random` is a member access, not a global, so no Biome rule can deny it without
  denying `Math`; the scan test covers it.
- **Alternatives**: an allowlist written as a Biome pattern with negations (`"**"`,
  `"!zod"`) (rejected as the primary gate: how Biome's gitignore-style matcher treats scoped
  names and `node:` specifiers is unverified, and a silent non-match would leave the gate
  green; the scan test gives the allowlist without that risk); a custom ESLint rule (rejected:
  Biome is the single lint tool).

## R7. Rules edition

- **Decision**: SRD 5.2.1 (2024 rules) wherever the editions differ: exhaustion has six
  levels and level 6 kills; long rest restores all hit dice, needs at least 1 HP and ends
  temporary HP; dropping to 0 HP gives the Unconscious condition.
- **Rationale**: decision-0012 makes SRD 5.2.1 the mechanics baseline.
- **Alternatives**: 2014 rules (rejected by decision-0012).

## R8. The engine/adjudication split (orchestrator ruling 2026-10-25, from decision-0021 idea 1 and decision-0017)

- **Decision**: the engine owns every piece of arithmetic and every comparison; adjudication
  supplies inputs as data. In the engine: attack resolution against an AC (natural 20 is a
  critical hit and natural 1 a miss, SRD 5.2.1), ability checks and saving throws against a
  DC, damage types with resistance, vulnerability and immunity from the target's record or a
  per-command defense set, and critical-hit dice doubling in the dice layer. In adjudication
  (TASK-0046): deciding which rule applies, and spell and monster effects beyond these
  primitives. Those decisions reach the engine only as data: an AC, a DC, a damage type, a
  defense set, a roll mode or a condition record. No command accepts a hit/miss verdict, a
  success/failure or a final adjusted damage amount.
- **Rationale**: decision-0021 idea 1 says the script owns numbers and the LLM owns story.
  Decision-0017's rationale says every number is auditable and the LLM stays out of layer 2.
  `adjudicate` is an LLM node, so a "final amount" or a "hit" from it would be an LLM
  computing a number. With the split above, every comparison and every halving or doubling
  is in the ledger (`attack.resolved`, `check.resolved`, `hp.changed.components`), where
  `audit` can check narration against it.
- **What remains data, not code**: condition effects on rolls (for example Poisoned giving
  disadvantage) reach the engine as the roll mode adjudication picks; the engine stores
  conditions but does not hard-code their effects (FR-011).
- **Alternatives**: the first draft of this spec left attacks, saves, defenses and critical
  doubling to adjudication, with the engine taking final amounts (rejected by the ruling
  above); modelling spell and monster effects in code (rejected: the card scopes them to
  adjudication).

## R9. Test runner

- **Decision**: Vitest `^5.0.1`, already in the lockfile through `apps/server`. Tests live in
  `packages/dnd5e-engine/test/`, typechecked by their own project reference
  (`test/tsconfig.json`, `noEmit`), mirroring `apps/server/test`.
- **Rationale**: one runner across the repo; no new package enters the lockfile.
- **Alternatives**: `node --test` (rejected: the server suites and their helpers use Vitest).

## R10. New runtime dependencies

- **Decision**: none. `zod ^4.6.5` is already a workspace dependency (server, shared).
