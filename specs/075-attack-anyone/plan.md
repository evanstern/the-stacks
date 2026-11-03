# Implementation Plan: Attacks and damage may target anyone present, combatant or not

**Branch**: `task-0210-attack-anyone` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/075-attack-anyone/spec.md`. This plan assumes OQ-1 to OQ-3 (a). A different
ruling changes the design section named under that OQ. Research and design sit inline here, as in
specs 058 and 068; there is no separate research.md, data-model.md or quickstart.md. The contract
amendment text is `contracts/plan-reason-gate-amendment.md`.

## Summary

The plan gate stops treating attack and damage fields as special. Every non-presence named id may
be the exact id of a present non-combatant NPC, and every such actor outside the order joins the
`ok` verdict's `pull`. Resolve already pulls every `pull` id before the group's steps run (spec 068
`pullIn`), so resolve is unchanged. The absent and alias rules hold. The 058 plan-reason-gate
contract records the reversal with the operator ruling cited verbatim. The spec 068 tests that
assert the refusal are replaced, and a new DB test replays run 1 seq 45.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. No new dependency.
**Storage**: Postgres event log; `jobs.result` checkpoint JSON. No shape change. No migration.
**Testing**: Vitest unit tests; DB integration tests with `REQUIRE_DATABASE=1`; the fake gateway and
DM scripts (spec 053).
**Target Platform**: the server's DM runtime (`apps/server/src/dm/`).
**Project Type**: monorepo web service.
**Performance Goals**: none new.
**Constraints**: merge spine #4, developed beside TASK-0113 (spine #3). TASK-0113 edits
`prompts/interpret.ts`; this plan does not touch any prompt (see "Prompt check").
**Scale/Scope**: 1 source file, 3 edited tests, 1 new DB test, 1 new DM script, 2 spec docs.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the gate runs inside the DM turn job. No human-only path.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: session plane only.
- [x] **IV. Event sourcing**: pull rows stay keyed `run.mech` submissions through `gate.submit`
      (spec 068). Nothing writes the log directly.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: the engine resolves the attack, rolls damage and any initiative.
      The gate only decides which ids reach it. The engine is unchanged.
- [x] **VII. Structured first**: `pull` stays a typed verdict field.
- [x] **VIII. Operator-owned content**: no new content. The pulled block is the NPC's
      `srdMonsterId`, else SRD `commoner` (spec 068).
- [x] **IX. Self-hostable**: no new service, container or dependency.

**Stack conformance**: no departure. **New runtime dependencies**: none (checkpoint C5 not hit).

## Research

- **R1 — Resolve needs no change.** `pullIn` (`nodes/resolve.ts`) iterates the verdict's `pull`
  ids with no field filter. It adds a combatant from `identity.srdMonsterId ?? "commoner"` and
  joins initiative when an encounter is active, the actor is not in the order, `canAct` holds and
  presence is `present`. An attack target or attacker in `pull` is pulled exactly as a check
  target is.
- **R2 — The engine accepts a pulled target.** `attack.roll` (`commands/attacks.ts`) runs
  `checkNamed` over target and attacker, then reads the target's AC from its combatant. After the
  pull both exist. A `damage` effect runs as `hp.damage` on the pulled combatant.
- **R3 — The absent check order.** `checkPlan` runs the combatant check before the absent check.
  Run 1 seq 45 (Snag absent, no combatant) failed `not-a-combatant`. After this change the same
  state fails `absent`. The code stays `UNKNOWN_COMBATANT` (TASK-0141 OQ-4). This is card AC #2.
- **R4 — Snag before the encounter.** Seed NPC `snag` has `identity.combatant: "snag"` and
  `srdMonsterId: "goblin-warrior"`. Until encounter start adds the combatant, the snapshot's
  `snag` actor has `combatantId: null`, so `snag` is in `npcIds`. After a free-mode pull the
  snapshot links him through `identity.combatant`, and the encounter start's add loop skips him
  (`if (p.engine.combatants[m.combatantId]) continue`). He still rolls initiative with the
  encounter, because the roll lists `enc.monsters`.
- **R5 — Disposition and encounter start (OQ-1).** No seed NPC, combatant or snapshot actor carries
  a disposition or side. The only hostility signal is the `react` node's `hostile` trigger
  (`nodes/schemas.ts`), which escalates a talk turn. Encounter start is the Director's `tableMode`
  decision (`encounterToStart`). Under OQ-1 (a) a pull starts nothing. TASK-0206 AC #2's "starts
  that encounter" branch stays with TASK-0206.
- **R6 — Prompt check.** `prompts/interpret.ts` (`dm.interpret-v5`), `prompts/step-grammar.ts` and
  `prompts/adjudicate.ts` name step ids only. None states that an attack on a non-combatant is
  refused (grep for "combatant", "turn order", "in combat" at `6a1b3e80`). No prompt changes and
  no version bump. **Flag for the orchestrator:** this plan shares no file with TASK-0113's prompt
  work.
- **R7 — Which tests assert the refusal.** `grep not-a-combatant` over `apps/server/test`:
  `plan-gate.test.ts` (5 cases), `resolve.integration.test.ts` (3 cases, the plan-gate block and
  the encounter-end case), `noncombatant-targets.integration.test.ts` (the attack control).

## Design

### D1 — `gates/plan-gate.ts`: drop the attack and damage exception (FR-001 to FR-004)

- Delete `pullable` from `NamedId`, from `effectIds`, and from both `stepIds` cases.
- In `checkPlan`, the id check becomes `if (!valid.has(id) && !npcIds.has(id))`. The failure
  reason, the absent check after it, and the pull-id block are unchanged.
- Update the comments that say "not an attack or damage" to cite spec 075.
- Under OQ-2 (b) instead: keep a flag only on `attackerId`. Not designed further.

### D2 — The contract amendment (FR-007; the PR's review reason)

Apply `contracts/plan-reason-gate-amendment.md` to
`specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md`: replace the "Non-combatant
targets (spec 068)" section with the amendment's text block, verbatim.

In `specs/068-noncombatant-targets/spec.md`, append one line under OQ-4 and under FR-002:
`*Reversed 2026-11-02 by spec 075 (TASK-0210): "I actually think that the rule itself is incorrect
-- we should be able to attack anyone regardless of combatant state."*` No other spec 068 edit.

### D3 — Replace the spec 068 refusal tests (FR-009)

`apps/server/test/dm/plan-gate.test.ts`:

| Case (today) | Change |
|---|---|
| "refuses an effect on a seed NPC with no combatant as not-a-combatant" | Flip: the damage effect on `pell` passes, `[{ actionId: "a1", ok: true, pull: ["pell"] }]`. Rename. |
| "walks nested ... in step order", third block (`checkStep(), attackStep("pell")`) | Name pell's alias instead of `pell`. Keep `stepIndex: 1`, `reason: "not-a-combatant"`. |
| "lets a ruling replace the reading's steps" | Use unknown id `ghoul-9` in place of `pell` in both directions. |
| "gates the NPC group (actionId null)" | `attackStep("ghoul-9", { attackerId: "snag" })`. |
| "still refuses attack ids and damage effects on pell" | Flip: each of the three steps passes with `pull: ["pell"]`. Rename "passes attack ids and damage effects on pell (spec 075)". |
| new | An absent `pell` named as `targetId` fails `absent` (pattern "refuses an absent pell as absent"). |
| new | Pell's alias as an attack `targetId` fails `not-a-combatant`. |

`apps/server/test/dm/resolve.integration.test.ts`:

| Case (today) | Change |
|---|---|
| "a refused action still resolves before the encounter ends" | `attackStep("ghoul-9")`. Still `refused` `UNKNOWN_COMBATANT`. Update the comment. |
| "refuses the whole action group when a later step names a non-combatant ..." | `attackStep("ghoul-9")`; expect `failure: { stepIndex: 1, id: "ghoul-9", reason: "not-in-snapshot" }`. Rename "... names an unknown id ...". |
| "a refused NPC group runs no step and the turn still advances" | `attackStep("ghoul-9", { attackerId: "snag" })`; expect `failure: { id: "ghoul-9" }`. |

`apps/server/test/dm/noncombatant-targets.integration.test.ts`:

- Replace "control: an attack on a non-combatant is still refused" with "an attack on Pell pulls
  him in and resolves (spec 075)". Mutate the reading to `[attackStep("pell")]`. Give
  `runFreePell` an optional extra-dice argument and append the attack and damage dice. Assert:
  the action resolves `applied`; `planGate` is `[{ actionId, ok: true, pull: ["pell"] }]`; one
  `combatant.added` for `pell` precedes the `attack.resolved` with `targetId: "pell"`; the final
  order holds `pell` once.
- Update the file's header comment to cite spec 075.

### D4 — The merge-condition test: run 1 seq 45 (FR-006, card AC #1 and #2)

New script `apps/server/test/dm/scripts/shoot-snag.json`, seed `greyhollow-ford-duo`, free mode.
Rebuilt from `docs/playtests/2026-11-02-runbook-a-playtest.md` findings 5 and 6 (no vm-104 read).

- Turn 1 (the reveal, run 1 seq 33–43): Tamsin's "We hold. Looking and listening." Interpret
  writes one `check` step, `combatantId: "tamsin"`, wis `perception`, DC 12, `onSuccess:
  [{ effect: "presence", targetId: "snag", reason: "arrived" }]`. Dice make it succeed. Snag is
  now `present` with no combatant (OQ-3 (a)).
- Turn 2 (seq 45): Kestrel declares "I take aim and shoot at Snag." through Kestrel's player
  (pattern `duo.integration.test.ts`, `kestrelPlayer`). Interpret writes one `attack` step,
  `attackerId: "kestrel"`, `targetId: "snag"`, `onHit: [damage on snag]`. Dice make it hit.
- Director replies keep `tableMode: { to: "stay" }` on both turns. Narrate, audit and chronicle
  replies as in `exploration-check.json`.

New DB test `apps/server/test/dm/attack-anyone.integration.test.ts` (pattern
`noncombatant-targets.integration.test.ts`):

1. **seq 45 replay**: Kestrel's action resolves `applied`; `planGate` for it is
   `[{ actionId, ok: true, pull: ["snag"] }]`; the log holds `combatant.added` for `snag` before
   `attack.resolved` with `targetId: "snag"`; no `UNKNOWN_COMBATANT` refusal; no
   `encounter.started` row (OQ-1 (a)).
2. **absent control** (card AC #2): skip turn 1. Kestrel's action resolves `refused`,
   `UNKNOWN_COMBATANT`; `failure: { field: "targetId", id: "snag", reason: "absent" }`; no
   `combatant.added` for `snag`.

### D5 — Mutation guard

Restore `pullable: false` on the attack `targetId`: test D4.1 fails `not-a-combatant`. Restore
D1; `git diff` on `plan-gate.ts` is the D1 change only.

### D6 — OQ handling at (a)

- OQ-1 (a): no encounter start, no disposition. D4.1 asserts no `encounter.started`.
- OQ-2 (a): `attackerId` is pullable like every other field (D1, D3 table row 5).
- OQ-3 (a): the replay sets Snag present by a turn 1 `presence` `arrived` effect (D4).

## Files touched

| File | Change |
|---|---|
| `apps/server/src/dm/gates/plan-gate.ts` | drop `pullable`; every non-presence id may be an NPC id (D1) |
| `apps/server/test/dm/plan-gate.test.ts` | refusal cases replaced, two new cases (D3) |
| `apps/server/test/dm/resolve.integration.test.ts` | three refusal cases moved to `ghoul-9` (D3) |
| `apps/server/test/dm/noncombatant-targets.integration.test.ts` | attack control becomes the attack-pull case (D3) |
| `apps/server/test/dm/scripts/shoot-snag.json` | new DM script (D4) |
| `apps/server/test/dm/attack-anyone.integration.test.ts` | new DB test, the merge condition (D4) |
| `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md` | the reversal, ruling verbatim (D2) |
| `specs/068-noncombatant-targets/spec.md` | reversal pointer under OQ-4 and FR-002 (D2) |
| `docs/wiki/dm-failure-and-gates.md`, `dm-runtime.md`, `turn-floor.md`, `output-claim-gate.md`, `seed-npc-presence.md`, `CAPSULES.md`, `INDEX.md` | re-ground (wiki phase) |

**Not touched** (overlap check): `dm/nodes/resolve.ts`, `dm/nodes/schemas.ts`, `dm/prompts/*`
(including `interpret.ts`), `dm/facts.ts`, `dm/fallback.ts`, `dm/snapshot/`, `dm/seed/`,
`apps/server/seeds/*.json`, `packages/dnd5e-engine/`. The runbook's footprint for 0210 named
`nodes/resolve.ts` (pullIn); R1 shows it needs no change. TASK-0206 (spine #6) may therefore not
need to wait on `resolve.ts` for this card.

**Migrations**: none. **New runtime dependencies**: none.

## Frozen-contract impact

None. `ws-protocol.md` frame shapes, `specs/029-proposal-gate/contracts/` and
`specs/030-play-route/contracts/proposal-seam.md` are unchanged. The 058 contract is not frozen;
amending it is this PR's stated reason for review.

## Open questions

- OQ-1 to OQ-3: see spec.md. Defaults (a) are designed above.
