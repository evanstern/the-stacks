# Implementation Plan: Acting on anyone outside the turn order pulls them in

**Branch**: `task-0194-noncombatant-targets` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/068-noncombatant-targets/spec.md`. This plan assumes OQ-1 to OQ-4 (a). A different
ruling changes the design section named under that OQ. Research and design sit inline here, as in
specs 058 and 064; there is no separate research.md, data-model.md or quickstart.md.

## Summary

The plan gate stops refusing a non-combatant NPC on non-attack steps and returns the group's
**pull ids**. Before each action group (and the NPC group) runs, resolve pulls each pull id in:
`combatant.add` from the NPC's SRD block (default `commoner`), then `initiative.join` when an
encounter is active and the actor can act. The snapshot joins a seed NPC to an engine combatant of
the same id, so the pulled NPC stays one actor. No engine, schema, prompt, seed or migration change.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. No new dependency.
**Storage**: Postgres event log; `jobs.result` checkpoint JSON (`planGate` gains an optional field).
No migration.
**Testing**: Vitest unit tests; DB integration tests with `REQUIRE_DATABASE=1`; the fake gateway and
DM scripts (spec 053).
**Target Platform**: the server's DM runtime (`apps/server/src/dm/`).
**Project Type**: monorepo web service.
**Performance Goals**: none new. One extra projections load per action group with pull ids.
**Constraints**: lane A2 shares `dm/nodes/resolve.ts` with TASK-0193 and `dm/snapshot/` with
TASK-0164 (runbook overlap check).
**Scale/Scope**: 3 source files, 2 extended tests, 1 new DB test, 1 new DM script.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the pull runs inside the DM turn job. No human-only path.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: session plane only. The SRD lookup goes through the existing `deps.srd`.
- [x] **IV. Event sourcing**: every pull row is a keyed `run.mech` submission through `gate.submit`.
      Nothing writes the log directly. Projections already fold `combatant.added` and
      `encounter.changed`.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: mechanics only through `combatant.add` and `initiative.join`. The
      engine rolls the initiative. The stat block copies SRD numbers with `combatantFromSrd`. The
      engine is unchanged.
- [x] **VII. Structured first**: `pull` is a typed verdict field.
- [x] **VIII. Operator-owned content**: the default block is SRD `commoner` (CC-BY, already shipped).
      The fixture rebuilds the run 3 post from the committed playtest log.
- [x] **IX. Self-hostable**: no new service, container or dependency.

**Stack conformance**: no departure. **New runtime dependencies**: none (checkpoint C5 not hit).

## Research

- **R1 — Why relaxing the gate alone fails.** The engine's `check.roll` (`checkNamed`),
  `condition.*` and `healing.apply` refuse an id with no combatant (`UNKNOWN_COMBATANT`). A passed
  gate would only move the refusal from the plan gate to the engine. The target must be a combatant
  before the step runs.
- **R2 — The engine already joins mid-encounter.** `initiative.join` (`commands/encounter.ts`)
  rolls the joiner's own initiative, slots it by total and keeps `turnIndex` on the active
  combatant. It refuses an id with no combatant, a dead one, or one already in the order. The
  proposal gate already uses it for an `arrived` presence change (`gate/plan.ts`).
- **R3 — Where combatants come from.** `combatantFromSrd(rec, id, name)` (`seed/combatants.ts`)
  builds a `CombatantInit` from an SRD monster. SRD `commoner` exists (hp 4, AC 10, init +0). Seed
  NPC `pell` has `srdMonsterId: null` (OQ-1).
- **R4 — Snapshot collision.** `buildSnapshot` rule 3 links an NPC to a combatant only through
  `identity.combatant`. A pulled `pell` combatant would fall to rule 4 as a monster actor with id
  `pell` and collide with the NPC actor: `ACTOR_ID_COLLISION`. Rule 3 must also link an engine
  combatant whose id equals the NPC id. The seed cross-check (`load.ts`) already pins a linked
  `identity.combatant` to the NPC id, so both paths give the same identity.
- **R5 — Resolve order.** Opening moves (encounter start, initiative roll) run before action groups
  (decision-0025 §4). A pull inside the group therefore joins an order that already exists, even on
  the turn the encounter starts.
- **R6 — Downstream readers need no change.** Facts read `combatant.added` as a
  `combatant-joined` line. The S0-to-S1 diff gives Pell a `life-state` change (null to conscious)
  and an `initiative` change; the claim gate's omission rule reads only dead, unconscious and
  stable. Assemble's `deriveNpcTurn` treats a non-party combatant as a DM-controlled turn, so a
  pulled NPC's turn plays as a monster turn with `srdMonsterId: null`.
- **R7 — The run 3 plan.** The seq 133 reading is not in the repo. The fixture rebuilds it from
  item 13 of the run log (open question OQ-5 below).

## Design

### D1 — `gates/plan-gate.ts`: the relaxed id check and pull ids (FR-001 to FR-005)

- `NamedId` gains `pullable: boolean`. `stepIds` sets it true for a `check` step's `combatantId`
  and for `condition` and `heal` effect targets in any list. It sets it false for an `attack`
  step's `attackerId` and `targetId` and for `damage` effect targets. Presence effects keep
  `presenceReason` and today's rule.
- `checkPlan` builds `npcIds`: S0 actors of kind `npc` with `combatantId` null, by exact `id` only
  (not aliases). In the id loop, an id not in `valid` passes when it is in `npcIds` and `pullable`
  is true. Otherwise today's failure stands (`not-a-combatant` or `not-in-snapshot`). The absent
  check runs after, unchanged, so an absent NPC still fails `absent`.
- Pull ids: for each non-presence named id in step order, find the S0 actor
  (`a.combatantId === id`, or `a.combatantId === null && a.id === id`). Add the id when the actor's
  id is not in `snapshot.stage.encounter?.order` and the id is not in `input.joining`. Dedupe.
- The ok verdict becomes `{ actionId, ok: true, pull?: string[] }`. Set `pull` only when non-empty,
  so every existing `toEqual([{ actionId, ok: true }])` still holds. A refused verdict has no pull.

### D2 — `snapshot/build.ts`: one actor after a pull (FR-009)

In rule 3, `const linked = npc.identity.combatant ?? (combatants[npc.id] ? npc.id : null)`. Nothing
else changes. Amend rule 3 in `specs/040-actor-snapshot/contracts/actor-snapshot.md`.

### D3 — `nodes/resolve.ts`: the pull (FR-006 to FR-008, FR-011)

Add `async function pullIn(run, ctx, prefix, ids)`. For each id:

1. Load fresh projections once per call (`ctx.deps.loadProjections`).
2. If `fresh.engine.combatants[id]` is missing: find the seed NPC with that id (skip when none).
   Look up `deps.srd.getById("monster", npc.identity.srdMonsterId ?? "commoner")`; throw
   `stop("internal", ...)` when missing. Submit `run.mech(`${prefix}:pull:${id}`,
   { type: "combatant.add", combatant: combatantFromSrd(rec, id, npc.name) },
   `${npc.name} joins the scene`, null)`. Reload projections after it applies.
3. If `fresh.encounter` is set, the id is not in its order, `canAct(fresh.engine, id)` is true
   (`@the-stacks/session-model`) and `fresh.scenePresence[id]?.presence ?? "present"` is
   `present`: submit `run.mech(`${prefix}:pull:${id}:join`,
   { type: "initiative.join", combatantId: id, mode: "normal" }, `${name} joins the fight`, null)`.

Pull rows carry `actionId: null`, so they never enter the group's `batchIds` and never change its
outcome (FR-008). They are keyed submissions, so a reclaim replays them once (SC-004).

Call sites: in `resolveAction`, when the verdict is ok and the group is not a clarify, call
`pullIn(run, ctx, `act:${item.actionId}`, verdict.pull ?? [])` before `runSteps`. In the NPC
group, call `pullIn(run, ctx, "npc", npcVerdict.pull ?? [])` before its `runSteps`.
`resolveAction` gains the `ctx` argument.

### D4 — OQ handling at (a)

- OQ-1 (a): the `commoner` default lives in `pullIn`. No seed change.
- OQ-2 (a): no object actors. The orchestrator cards "object targets join the scene".
- OQ-3 (a): no starting conditions. A `condition remove restrained` on a fresh Pell is refused
  `CONDITION_NOT_PRESENT` by the engine after the check lands; the group still resolves `applied`
  on the check row. The orchestrator cards seed-declared starting conditions.
- OQ-4 (a): attack and damage on a non-combatant stay refused (card AC #2).

### D5 — The merge-condition test (FR-010, card AC #3)

`apps/server/test/dm/scripts/free-pell.json`, seed `greyhollow-ford-duo`. Calls: the Director
enters turn mode for `reed-camp` (pattern `fight-round.json`); dice put Tamsin first in the order
and include one roll for Pell's join. Tamsin's turn: interpret one reading for her action, post text
"I run to Pell and attempt to free him." (run 3 seq 118). The reading is the plan a model writes
for it: one `check` step, `combatantId: "tamsin"`, dex, `sleight-of-hand`, DC 12, `onSuccess:
[{ effect: "condition", op: "remove", targetId: "pell", condition: "restrained", source: "cut
free" }]`, `onFailure: []`. Dice make the check succeed. Under OQ-3 (a) the engine refuses the
remove with `CONDITION_NOT_PRESENT` after the check row lands, so the group resolves `applied`.
The test asserts that refusal openly; OQ-3 (b) would flip it to an applied removal.
Narrate, audit and chronicle replies as in `exploration-check.json`.

`apps/server/test/dm/noncombatant-targets.integration.test.ts` (pattern
`plan-first-step.integration.test.ts` and `duo.integration.test.ts`):

1. **free-Pell replay**: the action resolves `applied`; the log holds `combatant.added` for `pell`,
   then `encounter.changed` whose order holds `pell` exactly once, then Tamsin's `check.resolved`;
   no `UNKNOWN_COMBATANT` refusal anywhere; `checkpoint.planGate` holds `pull: ["pell"]`.
2. **attack control**: a reading with an `attack` on `pell` resolves `refused`, code
   `UNKNOWN_COMBATANT`, reason `not-a-combatant`; no `combatant.added` for `pell`.
3. **reclaim**: re-run resolve with the saved checkpoint; no second `combatant.added` or join row.

Unit tests:

- `test/dm/plan-gate.test.ts`: a check `combatantId`, a condition effect and a heal effect on
  `pell` pass with `pull: ["pell"]`; an attack target, an attack `attackerId` and a damage effect on
  `pell` stay refused (the existing damage test stays); an alias (`the boy`) still fails; an absent
  `pell` still fails `absent`; a combatant outside the S0 order is a pull id; an in-order combatant
  and a `joining` id are not; a presence-effect target is not; pull ids dedupe in step order.
- `test/dm/snapshot.test.ts`: an engine combatant with a seed NPC's id builds one `npc` actor with
  `combatantId` set; no `ACTOR_ID_COLLISION`.

### D6 — Mutation guard

Stub `pullIn` to return at once: test 1 fails (no `combatant.added`, no `pell` in the order).
Revert D1's `pullable` pass: test 1 fails `UNKNOWN_COMBATANT`. Restore; `git diff` is empty.

## Files touched

| File | Change |
|---|---|
| `apps/server/src/dm/gates/plan-gate.ts` | `pullable`, relaxed NPC check, `pull` on the ok verdict (D1) |
| `apps/server/src/dm/snapshot/build.ts` | rule 3 links a same-id combatant (D2) |
| `apps/server/src/dm/nodes/resolve.ts` | `pullIn`, two call sites, `ctx` into `resolveAction` (D3) |
| `apps/server/test/dm/plan-gate.test.ts` | extended (D5) |
| `apps/server/test/dm/snapshot.test.ts` | extended (D5) |
| `apps/server/test/dm/scripts/free-pell.json` | new DM script (D5) |
| `apps/server/test/dm/noncombatant-targets.integration.test.ts` | new DB test, the merge condition (D5) |
| `specs/031-dm-runtime/contracts/resolve.md` | additive amendment: the pull before a group's steps |
| `specs/040-actor-snapshot/contracts/actor-snapshot.md` | additive amendment: rule 3 |
| `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md` | additive amendment: `pull` on the ok verdict |
| `docs/wiki/dm-failure-and-gates.md`, `dm-runtime.md`, `actor-snapshot.md`, `seed-npc-presence.md`, `dm-turn-jobs.md`, `turn-floor.md`, `output-claim-gate.md`, `CAPSULES.md`, `INDEX.md` | re-ground (wiki phase) |

**Not touched** (overlap check): `dm/facts.ts`, `dm/nodes/schemas.ts`, `dm/prompts/*`,
`dm/seed/schema.ts`, `apps/server/seeds/*.json`, `dm/nodes/assemble.ts`, `packages/dnd5e-engine/`.
`dnd5e-engine.md` needs no review: engine use adds `initiative.join` from a new caller only.

**Shared with other lanes**: `dm/nodes/resolve.ts` (TASK-0193 may touch the NPC turn path) and
`dm/snapshot/build.ts` (TASK-0164 may touch `dm/snapshot/` for class and level).

**Migrations**: none. **New runtime dependencies**: none.

## Frozen-contract impact

None. `ws-protocol.md` frame shapes, `specs/029-proposal-gate/contracts/` and
`specs/030-play-route/contracts/proposal-seam.md` are unchanged. The proposal kinds used
(`mechanics` with `combatant.add` and `initiative.join`) already exist.

## Open questions

- OQ-1 to OQ-4: see spec.md. Defaults (a) are designed above.
- **OQ-5 — The real seq 133 plan.** The replay rebuilds the reading. The real one sits in
  `jobs.result` on vm-104. Reading it is a vm-104 command (checkpoint C9). (a) Ship the rebuilt
  reading (recommended). (b) The operator approves the exact read and the fixture copies it.
