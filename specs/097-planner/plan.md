# Implementation Plan: Deterministic planner

**Branch**: `task-0267-planner` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: `specs/097-planner/spec.md`, `specs/097-planner/contracts/planner.md`

## Summary

Create `@the-stacks/planner`, a pure package with one entry point,
`plan(state, space, intent) -> commands + facts | refusal + facts | needs_ruling`. It ports the
deterministic checks of `dm/gates/plan-gate.ts` (ids, able actors, stats, spells) and the
step-to-command mapping of `dm/nodes/resolve.ts` (checks, attacks, damage, spells, help, move
reactions) onto Intents. Engine helpers do every derivation; the planner adds reference
resolution, reach and range by band, the ruling loop and the formulation-3 seat rules. Nothing in
`apps/` changes (CP-5 F1).

## Technical Context

**Language/Version**: TypeScript 5 (repo `tsconfig.base.json`), Node 22, ESM.

**Primary Dependencies**: `@the-stacks/intent`, `@the-stacks/space`, `@the-stacks/dnd5e-engine`
(all `workspace:*`), `zod` `^4.6.5`. No new third-party runtime dependency (no C5 stop).

**Storage**: N/A.

**Testing**: vitest `^5.0.1`, golden tests over hand-built `PlanState` fixtures.

**Target Platform**: Node 22 server (the gate). Client-safe: no Node import.

**Project Type**: workspace library package.

**Performance Goals**: `plan()` under 5 ms per call on a 64-zone space and 12 combatants.

**Constraints**: pure, deterministic, no model, no I/O, no clock (constitution II, VI).

**Scale/Scope**: 57 kinds classified; 28 served, 2 ruling-only, 27 refused `KIND_UNSERVED`.

## Constitution Check

*Constitution 3.0.0. Checked before design and after.*

- [x] **I. Agent-operable**: the AI DM and companions send the same Intents. Ruling requests are
      answered by `ruling` and `set_dc` Intents from either DM seat.
- [x] **II. One Intent vocabulary**: `plan()` takes a typed `Intent`. It calls no model. Only
      `needs_ruling` reaches a DM. No surface imports the package; the gate is its only caller
      (TASK-0268). Planner tests per outcome for each kind (Quality Gates "Intent contract tests").
- [x] **III. Event sourcing**: the planner appends nothing. It returns commands for the gate to
      execute and append. A refusal appends nothing.
- [x] **IV. Data planes**: no new state. `PlanState` is a per-call read model of the session plane.
- [x] **V. Many views, one state**: no view. Geometry comes from `space` (`bandBetween`,
      `reachCovers`, `rangeOf`) and engine `provokers`; the planner computes no distance.
- [x] **VI. Engine owns the numbers**: the planner writes no number. DCs come from tiers,
      `oppositionCovers` rules or a human DM's `dc`; damage from attack entries; spell dice from
      `SPELLS`. The engine rolls. No engine command changes, so no new scripted-dice test is owed.
- [x] **VII. Narration around facts**: `PlanFact` is code-chosen data. The fact sheet (spec 098)
      is unchanged; the seam is named in the contract §4.
- [x] **VIII. Campaign is data**: N/A.
- [x] **IX. UX quality bar**: `plan()` is synchronous and in-memory; a timing test bounds it at
      5 ms. It serves the < 1 s p95 fact-row budget. Facts give every ruling its "why".
- [x] **X. Citations**: N/A (no library retrieval). SRD rule ids cited in facts are data ids.
- [x] **XI. Operator-owned content**: no rulebook text ships. Facts cite SRD ids only.
- [x] **XII. Self-hostable**: no container change in this card. The server does not import the
      planner until TASK-0268, which adds the Dockerfile copy lines that TASK-0303's guard demands.
- [x] **XIII. Just-in-time**: R1 milestone card. Deferrals are open questions for the orchestrator
      to card (OQ-2, OQ-3, OQ-5, OQ-12). The Intent contract it builds on is frozen (v1.1).

**Stack conformance**: Architecture Constraints names `planner` among the package seams. Zod is the
validation library. No service, language or datastore is added.

## Design decisions

**D1 — New package, not a module of `session-model` or the server.** The constitution's package
seam list names `planner`. `session-model` holds the gate (TASK-0268) and imports the planner, so the
planner cannot live in or import it. A package keeps the boundary lint narrow: intent, space,
engine, zod.

**D2 — `PlanState`, not `SessionProjections` (OQ-1).** The planner needs actors with side,
presence, `seen` and controller; caster lists and levels; SRD spell ids; combatant inits for
pull-in; open ruling requests; table rules. `SessionProjections` has some of these and the seed has
the rest. A narrow read model avoids a dependency cycle and lets tests build state by hand.

**D3 — Guarded command lists, not a callback.** Resolve branches on engine outcomes between
submissions. A pure planner cannot see outcomes, so a `PlannedCommand` carries
`when: { step, outcomes }`. The gate runs the list (contract §3 execution rule). This is a flat,
serialisable plan, so a ruling job or proposal row can show it.

**D4 — Engine helpers do the rules.** `checkModifier`, `findAttack`, `firstMeleeAttack`,
`oppositionCovers`, `spellcastingModifier`, `SPELLS`, `movementLeft`, `provokers`, `spaceViewOf`,
`execute` and `scriptedRng` are already exported. The only engine edit exports `isUnable`, which
`attackRoll`, `checkRoll` and `move` already use, so planner and engine agree on "unable".

**D5 — The `move` probe.** `move` legality (path, blocked edges, speed, prone cost, turn) lives in
the engine handler. The planner runs `execute(state.engine, moveCommand, scriptedRng([]))`: `move`
draws no dice, so the probe is pure and exact. A refusal passes through; success is discarded.

**D6 — Grapple and shove as one save.** SRD 5.2.1 Unarmed Strike: the target makes a Strength or
Dexterity saving throw (its choice) against 8 + Strength modifier + proficiency bonus. The engine's
`unarmed-strike` opposition rule already derives that DC. The planner picks the target's better
save modifier (Strength on a tie), so the choice is deterministic and favours the target.

**D7 — Formulation 3 at the planner.** A player-seat Intent can change another actor only through
a roll that names the actor (attack, contest, grapple, shove, spell) or an SRD beneficial rule
(help, healing spell). An `ai:dm` Intent cannot apply damage, add a condition or move a party
actor, and cannot end combat while `hostilesStanding`. A human DM can (`dm` seat). The legality
suite checks this as an invariant over every player-seat fixture.

**D8 — Rulings are Intents.** `RulingRequest.requestId` is the planned Intent's id, so the gate
needs no id generator and stays deterministic. A replan that asks again keys on the answering
Intent's id.

## Project Structure

### Documentation (this feature)

```text
specs/097-planner/
├── spec.md
├── plan.md
├── tasks.md
└── contracts/
    └── planner.md
```

### Source Code

```text
packages/planner/
├── package.json            # deps: intent, space, dnd5e-engine (workspace:*), zod
├── tsconfig.json           # references ../intent, ../space, ../dnd5e-engine
├── vitest.config.ts
├── README.md               # contract summary + CHANGELOG
├── src/
│   ├── index.ts            # FR-037 exports only
│   ├── types.ts            # PlanState, PlanResult, PlannedCommand, PlanFact, RulingRequest + schemas
│   ├── kinds.ts            # PLAN_KINDS table (class, owner card)
│   ├── plan.ts             # plan(): dispatch on kind, KIND_UNSERVED, reason text
│   ├── refs.ts             # actor/target resolution, able actor, pull-in, hostilesStanding
│   ├── checks.ts           # check, save, contest, search, hide
│   ├── combat.ts           # attack, cast, help, grapple, shove
│   ├── movement.ts         # move (probe, reactions), dash, disengage, stand, drop_prone, end_turn
│   ├── resources.ts        # rest_short, rest_long, roll_free
│   ├── dm.ts               # apply_*, start/end_combat, add_combatant, move_token, seat rules
│   ├── rulings.ts          # attempt, use_object, ruling, set_dc, replan
│   └── outcome.ts          # stepOutcome
└── test/
    ├── tsconfig.json       # references .., ../../intent, ../../dnd5e-engine, ../../space
    ├── fixtures.ts         # PlanState builders: a 3-zone space, party, goblins, casters, inits
    ├── purity.test.ts      # import allowlist (mirrors engine test/purity.test.ts)
    ├── kinds.test.ts       # every kind classified; KIND_UNSERVED per unserved/not-planned kind
    ├── checks.test.ts
    ├── combat.test.ts
    ├── movement.test.ts
    ├── dm.test.ts
    ├── rulings.test.ts
    ├── refusals.test.ts    # coverage: every contract §6 code has a golden case
    ├── determinism.test.ts # every intent fixture twice; text-insensitive; < 5 ms
    └── legality.test.ts    # TASK-0145 #1, TASK-0147 #1–#4, formulation-3 invariant
```

### Every touched file

| File | Change |
|---|---|
| `packages/planner/**` | new (layout above) |
| `packages/dnd5e-engine/src/index.ts` | add `isUnable` to the `./commands/attacks.js` export line |
| `tsconfig.json` (root) | add `packages/planner`, `packages/planner/test` references |
| `biome.json` | one override for `packages/planner/src/**` and `fixtures/boundary-violations/packages/planner/**` |
| `fixtures/boundary-violations/packages/planner/src/{bad-app,bad-session-model,bad-clock,bad-model}.ts` | new violation fixtures |
| `pnpm-lock.yaml` | `pnpm install` adds the package's workspace links |
| `docs/wiki/planner.md` | new note (wiki phase) |
| `docs/wiki/{intent-contract,space,dnd5e-engine,monorepo-and-toolchain,dm-plan-gate,overview}.md` | review and re-pin (wiki phase) |
| `docs/wiki/{INDEX,CAPSULES}.md` | add the planner note (wiki phase) |

No migration. No Dockerfile change (the server does not depend on the planner yet). No file under
`apps/` changes.

### Port map

| Source | Planner home |
|---|---|
| `plan-gate.ts` `checkPlan` id checks (`not-in-snapshot`, `absent`, `not-a-combatant`), pull-in | `refs.ts` |
| `plan-gate.ts` `foreignActor` | not ported: an Intent has one actor; the gate checks it (`NOT_YOUR_ACTOR`) |
| `plan-gate.ts` `heldFor` (`TURN_HELD`) | not ported: gate turn rule (TASK-0268) |
| `plan-gate.ts` `statGap` | `checks.ts`, `combat.ts` (`STAT_UNDEFINED`) |
| `plan-gate.ts` `spellGap` | `combat.ts` `cast` |
| `plan-gate.ts` reason check (`checkClaims`) | not ported: Intents carry no model reason (FR-003) |
| `resolve.ts` `runSteps` `check` | `checks.ts` (house rules; band effects stay, OQ-5) |
| `resolve.ts` `runSteps` `attack`, `hitDamage` | `combat.ts` (guarded `damage.apply`) |
| `resolve.ts` `runSteps` `spell`, `help` | `combat.ts` |
| `resolve.ts` `runSteps` `move` + `dm/reactions.ts` `reactors` | `movement.ts` (engine `provokers`, side filter) |
| `resolve.ts` `effectCommand` | `dm.ts` (`apply_damage`, `apply_heal`, `apply_condition`) |
| actor-state-gate §5 U5 #1, U9 #1–#4 | `dm.ts` seat rules, `rulings.ts`, `legality.test.ts` |

### Boundary override (`biome.json`)

Copy the `packages/intent/src/**` override. Change the include globs to `packages/planner/src/**`
and `fixtures/boundary-violations/packages/planner/**`. Remove `@the-stacks/dnd5e-engine` from the
forbidden paths. Add `@the-stacks/srd`, `@the-stacks/shared` and `@the-stacks/session-model`. Keep
the `node:*`, Node builtin, `**/apps/**`, model SDK and globals rules. Every message reads: "the
planner is pure: intent, space, engine and zod only; no app, session model, node module, model or
clock (constitution II, VI)."

## Complexity Tracking

No constitution violation. Nothing to justify.
