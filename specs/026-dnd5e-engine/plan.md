# Implementation Plan: First Scene — pure 5e engine package

**Branch**: `task-0042-dnd5e-engine` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/026-dnd5e-engine/spec.md` (board card TASK-0042).

## Summary

Build `@the-stacks/dnd5e-engine`, a new workspace package whose one command entry point is
`execute(state, command, rng) → { ok: true, events } | { ok: false, refusal }`. It parses dice
expressions, rolls through an injected RNG (seeded or scripted), and resolves HP and temporary
HP, conditions as data, initiative and turns, life states and death saves, rests and spell
slots, plus attack resolution against AC, checks and saves against DC, damage types with
resistance, vulnerability and immunity, and critical-hit dice doubling (orchestrator ruling
2026-10-25, research R8: the engine owns all arithmetic; adjudication supplies data). Every
roll event carries its reason and every state-change event carries before and
after values (the roll ledger). `evolve`/`replay` fold events back into state so TASK-0044's
projections need no rules and no RNG. A Biome boundary rule, proven by fixtures in
`pnpm check:boundaries`, forbids database, network, model and clock access. Scripted-dice
tests cover all 21 commands and all 26 refusal codes, enforced by a meta-test.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), ES2022 target, Node 22 for tests.

**Primary Dependencies**: `zod ^4.6.5` (already in the workspace). No new runtime dependency.
Dev: `vitest ^5.0.1` (already in the lockfile through `apps/server`).

**Storage**: N/A. The engine is pure; its state lives in the session log as a projection
(TASK-0044).

**Testing**: Vitest, scripted-dice unit tests in `packages/dnd5e-engine/test/`, plus the
fixture-backed `pnpm check:boundaries`.

**Target Platform**: any ES2022 runtime (server today; the package has no Node or DOM types,
so a browser build stays possible).

**Project Type**: library (workspace package).

**Performance Goals**: one `execute` call well under 1 ms for a scene of up to 50 combatants
(parse plus resolve). Not gated; noted so nobody adds work proportional to the log.

**Constraints**: no I/O, no clock, no global randomness, no mutation of inputs, refusal draws
no dice (contracts/engine-api.md, Invariants).

**Scale/Scope**: 21 commands, 18 events, 26 refusal codes; up to 50 initiative participants;
dice limits per contracts/engine-api.md.

## Constitution Check

*Pre-research gate: pass. Post-design re-check: pass (no change). Re-checked after the
2026-10-25 amendment (research R8): pass, and VI is strengthened — attack, check, save,
critical and defense arithmetic moved from adjudication into the engine, so no model
computes those numbers.* Against constitution 2.0.0.

- [x] **I. Agent-operable** — the interface is `execute` with `EngineCommandSchema`. The gate
      (TASK-0045) forwards LLM proposals and a human DM's commands through the same function.
      There is no human-only path; the engine has no UI.
- [x] **II. Content contract** — N/A: no codex entity. `Combatant` is a mechanical record in
      the session plane (data-model.md).
- [x] **III. Data planes** — the engine owns no state. Its state is a session-plane
      projection. The package imports no plane; the boundary rule forbids `apps/**`.
- [x] **IV. Event sourcing** — every outcome is a typed, versioned (`v: 1`) event; a refusal
      produces none ("refuse before write"). Visibility is the session envelope's field
      (TASK-0044); the engine emits no hidden information of its own.
- [x] **V. Citations** — N/A: no library claim.
- [x] **VI. 5e engine boundary** — this feature *is* the boundary: one pure package, narrow
      entry point, seeded and scriptable RNG, no I/O or model import, scripted-dice tests for
      every command (AC #11) and a CI-gated boundary check (AC #10).
- [x] **VII. Structured first** — N/A: no generated artifact.
- [x] **VIII. Operator-owned content** — ships no rulebook data. SRD records are TASK-0043's,
      outside this package. Condition names are identifiers, not text.
- [x] **IX. Self-hostable** — no new service, container or dependency.

**Stack conformance**: TypeScript and Zod only. No departure from the Architecture
Constraints table.

## Project Structure

### Documentation (this feature)

```text
specs/026-dnd5e-engine/
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── engine-api.md    # entry point, result, RNG, state schema, invariants
│   ├── commands.md      # the 21 commands, their events and refusals, rule details
│   ├── events.md        # the 18 events (roll ledger), before/after slices
│   ├── refusals.md      # the 26 codes and their precedence
│   └── boundary-rule.md # Biome rule, fixtures, package guards
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
packages/dnd5e-engine/
├── package.json              # @the-stacks/dnd5e-engine; deps: zod only; devDeps: vitest
├── tsconfig.json             # extends base; lib ES2022; types []; rootDir src; outDir dist
├── vitest.config.ts          # include test/**/*.test.ts
├── README.md                 # one screen: entry point, invariants, link to the contracts
├── src/
│   ├── index.ts              # the public surface (contracts/engine-api.md) and nothing else
│   ├── schema/
│   │   ├── state.ts          # EngineStateSchema and parts, refinements
│   │   ├── commands.ts       # EngineCommandSchema
│   │   ├── events.ts         # EngineEventSchema
│   │   └── refusals.ts       # RefusalCodeSchema, RefusalSchema, refuse() helper
│   ├── rng.ts                # Rng, seededRng (mulberry32), scriptedRng, error classes
│   ├── dice.ts               # parseDiceExpression, rollParsed (uses Rng; mode, critical doubling), limits
│   ├── execute.ts            # parse state + command, dispatch by type, return result
│   ├── evolve.ts             # evolve, replay, emptyState
│   ├── selectors.ts          # conditionsOf, activeCombatant
│   └── commands/
│       ├── roll.ts
│       ├── attacks.ts        # attack.roll, check.roll
│       ├── combatants.ts     # combatant.add, combatant.remove
│       ├── hit-points.ts     # damage.apply (components, defenses), healing.apply, temp-hp.grant (+ shared zero-HP logic)
│       ├── life.ts           # death-save.roll, stabilize
│       ├── conditions.ts     # condition.apply, condition.remove, exhaustion.adjust
│       ├── encounter.ts      # initiative.roll, initiative.join, turn.advance, encounter.end
│       ├── rests.ts          # rest.short, rest.long
│       └── spell-slots.ts    # spell-slot.expend, spell-slot.restore
└── test/
    ├── tsconfig.json         # noEmit; references ".."
    ├── helpers.ts            # fixtures (makeCombatant, stateWith), expectRefusal, expectOk,
    │                         # countingRng, deepFreeze, applyResult
    ├── rng.test.ts
    ├── dice.test.ts
    ├── execute.test.ts       # INVALID_STATE, INVALID_COMMAND, purity, determinism
    ├── commands/<file>.test.ts  # one per src/commands file
    ├── replay.test.ts        # replay equivalence across a scripted mini-scene
    ├── purity.test.ts        # import allowlist, no Math.random/Date, deps === {zod}
    └── coverage.test.ts      # meta-test: every command type and refusal code is tested

fixtures/boundary-violations/packages/dnd5e-engine/src/bad-{database,orm,network,fetch,llm,clock}.ts
```

Repo files touched outside the package:

- `biome.json` — new override for `packages/dnd5e-engine/src/**` and its fixture path
  (contracts/boundary-rule.md).
- `scripts/check-boundaries.mjs` — add `--only=style/noRestrictedGlobals`; update the header
  comment.
- `tsconfig.json` (root) — add references `packages/dnd5e-engine` and
  `packages/dnd5e-engine/test`.
- `pnpm-lock.yaml` — the new workspace importer (via `pnpm install`; no new registry
  package).

**Structure Decision**: one new library package under `packages/` (research R1). Command
handlers are split one file per mechanic family, each exporting a handler map merged by
`execute.ts`, so later phases add files instead of editing a shared switch.

### How a handler is shaped (binding for every command file)

```ts
type Handler<C> = (state: EngineState, cmd: C, rng: Rng) => EngineResult;
```

Each handler: (1) runs every precondition and returns `refuse(code, message, details)` on the
first failure, in the order commands.md lists; (2) only then draws dice; (3) builds events
with before/after; (4) returns `{ ok: true, events }`. Handlers never mutate `state`. Rules
shared across commands (zero-HP transition, leaving 0 HP, condition expiry) live in one
helper each, used by every command that needs them.

## Post-merge obligations (orchestrator, not implementer phases)

- **Wiki re-pin.** `biome.json` and `scripts/check-boundaries.mjs` are sources of the
  `monorepo-and-toolchain` and `ci-pipeline` notes; `/grounding-wiki:wiki-update` runs after
  merge. A new engine note is the wiki-update's call.
- **Consumers.** TASK-0044, TASK-0045 and TASK-0046 depend on `contracts/` here. No consumer
  code lands in this task.

## Complexity Tracking

No constitution violations. No entries.
