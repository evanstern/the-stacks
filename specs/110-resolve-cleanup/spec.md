# Feature Specification: Resolve loses planner-owned step paths

**Feature Branch**: `task-0312-resolve-cleanup`
**Card**: TASK-0312 (epic TASK-0258, milestone m-10). Depends on TASK-0269 and TASK-0223 (both merged).
**Created**: 2026-11-12
**Status**: Draft (C-GATE pending, see "Checkpoints")
**Authored against**: `origin/main` `e0d4ed33`. Upstream plans: spec 104 `plan.md` `f61a0bac`
(D7, D8, OQ-7, OQ-8), spec 109 `spec.md` `fd588db1` (L-1 to L-4, "TASK-0312 seam"), spec 107
`plan.md` `98014bc2`, spec 100 `spec.md` `8d8a9692` (OQ-13).

## Summary

Since TASK-0269, interpret emits only Intent stages. Monster turns are Intent stages chosen in
code (spec 107 D3, `dm/monster-policy.ts`). Companion and slash items go through interpret's slash
pre-pass and also become stages. No reading sets `needsAdjudication`, so the adjudicate node never
runs (spec 104 OQ-7). The planner owns moves, reactions, pulls, reach and spell legality.

So the legacy step path in `resolve.ts`, its plan-gate checks, the adjudicate node and the step
grammar run only for two inputs: an old-shape reading in a resumed or reclaimed checkpoint, and a
test that injects one. This card deletes that path, deletes the encounter-start gathering block,
and drops old-shape checkpoints so their items are interpreted again.

## Acceptance criteria map

| Card AC | Requirements | Success criteria | Phase |
|---|---|---|---|
| #1 resolve.ts loses the code paths the planner now owns | FR-001–FR-008 | SC-001, SC-002, SC-004 | 1, 3, 4, 5 |
| #2 The encounter-start gathering is removed (spec 100 OQ-13) | FR-009 | SC-003 | 2 |
| #3 An old-shape resumed plan is dropped and re-interpreted (spec 104 OQ-8) | FR-010–FR-012 | SC-005 | 5 |

## User scenarios

### US1 — A turn runs only the Intent path (P1, AC #1)

**Given** any committed beat, **When** resolve runs, **Then** every action group and the monster
turn run through `runStages`, and no code path reads a `steps` list.

- **Given** the scripted fake-gateway runs and the full test suite, **When** each deleted symbol
  is replaced with a throw-stub, **Then** only tests that inject a legacy reading, a ruling, or
  the deleted symbol itself fail (Phase 1 probe).

### US2 — An encounter starts with the party where it stands (P1, AC #2)

**Given** a seed with a space and an encounter zone, **When** the Director starts the encounter,
**Then** the monsters are added in the encounter zone, no `combatant.place` row moves a party
member, and initiative rolls. A party member closes distance with a `move` Intent on their turn.

### US3 — A turn paused across the deploy is re-interpreted (P2, AC #3)

**Given** a prior turn checkpoint whose reading for an action has `steps` and no `stages`, and its
paused proposal is approved, **When** the next turn assembles, **Then** `findResumedPlans` returns
no plan for that action, and interpret plans it fresh.

**Given** a reclaimed job whose own checkpoint holds an old-shape reading, **When** the worker
loads the checkpoint, **Then** the checkpoint's `interpret`, `cut` and `resumed` are cleared,
`dm.checkpoint.legacy-dropped` is logged, and interpret runs again.

### Edge cases

- An old checkpoint that holds an adjudicate ruling for an action: the plan is dropped (FR-010).
- An old checkpoint's ruling `followUps`: no longer read by `openFollowUps`. One-way door
  (spec 104 OQ-8); the follow-up text is lost for that one action.
- A dropped plan whose paused proposal already applied: the approved batch stays in the log, and
  the fresh plan may roll again. Same ceiling as spec 082 D10, which already drops stale plans.

## Requirements

- **FR-001**: `resolve.ts` MUST delete `runSteps` (every case: `none`, `roll`, `effect`, `check`,
  `move`, `spell`, `help`, `attack`), `hitDamage` and `pullIn`.
- **FR-002**: `resolveAction` and the NPC group MUST run only `runStages`. A reading with no stages
  runs nothing.
- **FR-003**: `presenceTargets` MUST read only Intent `beside` effects (spec 109 seam).
- **FR-004**: The ruling group (the journal rows built from adjudicate rulings) MUST be deleted.
- **FR-005**: `checkPlan` MUST keep only the turn hold (`TURN_HELD`) for staged readings. The id,
  actor, stat, spell and pull checks MUST be deleted. `askUndeclared` MUST keep only the manner
  branch for Intent `check` stages.
- **FR-006**: The adjudicate node, its prompt, `AdjudicateModelOutput`, `Ruling`, the runner's
  adjudicate branch and `prompts/step-grammar.ts` MUST be deleted. The `dm.adjudicate` purpose and
  `PURPOSE_OF.adjudicate` MUST stay: `dm/rulings.ts` uses them for the ruling call (spec 102 OQ-2).
- **FR-007**: The first-stage cut, `askUndeclared` and `clarifyHolds` MUST run after interpret,
  where they ran after adjudicate. Their behaviour MUST NOT change.
- **FR-008**: `StepSchema`, `Step`, `refineSteps`, `LegacyInterpretReadingSchema`,
  `AnyInterpretReading` and `hasStages` MUST be deleted. `EffectSchema`, `StakesSchema`,
  `BesideSchema` and `AmountSchema` stay.
- **FR-009**: The encounter-start gathering block in `directorOpening` MUST be deleted.
- **FR-010**: `findResumedPlans` MUST return a plan only when the reading passes
  `InterpretReadingSchema`. Any other reading MUST be skipped, so the action is interpreted again.
- **FR-011**: A reclaimed job whose checkpoint `interpret` holds a reading without `stages` MUST
  have `interpret`, `cut` and `resumed` cleared before the runner reuses them.
- **FR-012**: Both drops MUST be covered by a unit test in `test/dm/resume.test.ts`.

## Deletion inventory

Evidence greps ran at `e0d4ed33` from `apps/server/src`. "No producer" means no code path writes
the input shape outside tests.

| File | Symbol or range | Why it is dead | Evidence |
|---|---|---|---|
| `dm/nodes/resolve.ts` | `runSteps` L511–804, all 8 cases | Called only at L1563 (old-shape branch) and L1834 (NPC fallback). Interpret emits `stages` only (`interpret.ts` L106–127); monster readings are stages (`monster-policy.ts` L89). | `grep -n runSteps` → L511, L1563, L1834 only |
| `dm/nodes/resolve.ts` | `runSteps` `effect` case L589–591 | L-2 of spec 109; omitted from spec 104 D8 | card note; spec 109 "TASK-0312 seam" |
| `dm/nodes/resolve.ts` | `hitDamage` L496–509 | Called only inside `runSteps` (L702, L783) | `grep -n hitDamage` |
| `dm/nodes/resolve.ts` | `presenceTargets` Step loop L820–837, `rulings` param | Step readings and rulings have no producer | spec 109 seam; `grep needsAdjudication src` → only schema and adjudicate |
| `dm/nodes/resolve.ts` | gathering block L1274–1291 | Planner `move` / `move_token` place combatants (`packages/planner/src/dm.ts` L250, `movement.ts`); spec 100 OQ-13 | comment at L1274 names TASK-0269 as the remover |
| `dm/nodes/resolve.ts` | `actionGroup` steps branch L1415–1438 | Ruling and old-reading inputs have no producer | as `runSteps` |
| `dm/nodes/resolve.ts` | `pullIn` L1445–1507, `pullBatchIds` | `verdict.pull` is filled only from `stepIds(step)`; staged groups have `steps = []` (`plan-gate.ts` L720–723). The planner pulls (`r.value.pull`, `planner/src/dm.ts` L248). | `grep -n "pull.add"` → L825 only |
| `dm/nodes/resolve.ts` | ruling group L1765–1795; `ctx.results.adjudicate` reads L1663, L1672, L1692, L1763 | Adjudicate never runs (OQ-7) | runner L201 skips on `!needsAdjudication` |
| `dm/nodes/resolve.ts` | `stepActors(steps)` at L1550; `Intent: ${reading.intent}` at L1592 | Old-shape only | `hasStages` guards |
| `dm/nodes/resolve.ts` | `splitArrivals` `steps` param | Check steps have no producer; stakes arrive through `extraStakes` | L1694–1705 |
| `dm/reactions.ts` (40 lines) | whole file | Only importer is `runSteps` `move` case (L44, L653); the planner owns reactions (`movement.ts` FR-026) | `grep -rl reactions.js src` → resolve.ts only |
| `dm/gates/plan-gate.ts` | `effectIds`, `stepIds`, `foreignActor`, `stepActors`, `statGap`, `spellGap`, `SpellGap`, `SpellRefusalCode`, `STAT_REFUSAL_CODE`, `ACTOR_REFUSAL_CODE`, the `UNKNOWN_COMBATANT` loop L786–838, `pull` | Each reads `steps`; staged groups pass `[]` | `grep` of each constant outside plan-gate.ts → none |
| `dm/gates/plan-gate.ts` | `PlanInput` fields `rulings`, `joining`, `arriving`, `combatants`, `spellLists`, `srdSpell`, `resumed` | Read only by the deleted checks | `checkPlan` body L683–870 |
| `dm/gates/plan-gate.ts` | `askUndeclared` legacy branch L951–1010, `otherPlayerQuestion`, `rulings` | Old-shape and ruling only; the Intent branch L930–949 stays | `grep otherPlayerQuestion src` → plan-gate only |
| `dm/nodes/adjudicate.ts` (189) | whole file | No reading sets `needsAdjudication` (OQ-7) | see above |
| `dm/prompts/adjudicate.ts` (70) | whole file | Only importer is the node | `grep buildAdjudicatePrompt` |
| `dm/prompts/step-grammar.ts` (46) | whole file | Only importers: `prompts/adjudicate.ts` and `test/dm/presence-effect.test.ts`. The Director does not import it; interpret uses its own `INTENT_GRAMMAR` (spec 104 D4). | `grep -rn step-grammar` |
| `dm/nodes/schemas.ts` | `AdjudicateModelOutput`; `StepSchema`, `Step`, `refineSteps`, `CircumstanceSchema`, `OppositionSchema`; `LegacyInterpretReadingSchema`, `LegacyInterpretReading`, `AnyInterpretReading`, `hasStages` | Producers deleted above; spec 109 L-1 to L-4 die here | `grep StepSchema src` → schemas, resume |
| `dm/pipeline/runner.ts` | `needsAdjudication`, the adjudicate skip L201–205, `"adjudicate"` in `CHECKPOINTED` | Node deleted; cut step re-anchored after interpret (FR-007) | L54, L105, L201, L248 |
| `dm/pipeline/context.ts` | `"adjudicate"` in `NODE_NAMES`, `NodeOutputs.adjudicate`, `NodeDeps.retrieve`, `NodeDeps.minSimilarity` | Only the node reads `retrieve` and `minSimilarity` | `grep deps.retrieve src` → adjudicate.ts L106 only |
| `dm/jobs.ts` | `TurnCheckpoint.adjudicate` | Written only by the runner's adjudicate branch | L191 |
| `dm/first-stage.ts` | `firstStage(steps)`, the ruling and steps branches of `cutPlans` and `clarifyHolds` | Old-shape and ruling only | L28, L101, L113 |
| `dm/resume.ts` | `ResumedPlan.ruling`, the `LegacyInterpretReadingSchema` / `StepSchema` accept | FR-010 | L116–127 |
| `dm/follow-ups.ts`, `dm/nodes/narrate.ts`, `dm/facts.ts` | ruling reads (`cp.adjudicate`, `npcRuling`, `rulings` fact, legacy `npcPlan` branch) | Rulings have no producer | `grep adjudicate src` |
| `dm/talk-turn.ts`, `dm/worker.ts` | `adjudicate:` result and node wiring | Node deleted | L370; L39, L71, L234 |
| tests | `adjudicate.integration.test.ts`, `reactions.test.ts`; legacy cases in `plan-gate.test.ts`, `resolve.integration.test.ts`, `opportunity-attack.integration.test.ts`, `first-stage.test.ts`, `runner.test.ts`, `presence-effect.test.ts`, and ~15 more; fixtures `checkStep`, `attackStep`, `spellStep`, `helpStep`, `reading()` in `test/dm/world.ts` | Test the deleted path. Port a case only when no planner or Intent sibling covers it (plan D6). | `grep -rlE "checkStep\|attackStep\|reading\(\|rulings:" test` → 28 files |

## Keep list

| Symbol | Why it stays |
|---|---|
| `intent-runner.ts` `runStages`, its `legacyRoll` `check.roll` branch | The beside path: the free retry and `autoFail` still roll through `check.roll` (spec 104 FR-014). TASK-0313 owns stakes on Intents (spec 104 OQ-6). |
| `intent-runner.ts` `effectCommand`, `runEffects` | Band effects beside the Intent path (spec 109 seam) |
| `stakes.ts` `effectsForBand`, `isFreeRetry`, `clueFor`, `bandTexts`, `consequenceFor` | Beside path and fact sheet. `isFreeRetry` is retyped off `Step` (plan D4). |
| `schemas.ts` `EffectSchema`, `AmountSchema`, `StakesSchema`, `ClueRefSchema`, `BesideSchema`, `InterpretStageSchema` | The beside block |
| `resolve.ts` `Run` (`mech`, `submit`), `Submission`, `splitArrivals` (stakes only), `landHeldArrivals`, `directorOpening` minus gathering | Intent runner and Director group |
| `plan-gate.ts` `TURN_HELD_CODE`, `heldFor` (declarer only), `checkPlan` (hold only), `PlanVerdict`, `askUndeclared` Intent manner branch, `MANNER_SKILLS` | Spec 087 hold and spec 077 manner ask still apply to Intents (spec 104 D5) |
| `plan-gate.ts` encounter helpers (`encounterToStart`, `joiningCombatants`, `encounterRan`, `encounterPhase`, `eligibleMonsters`, `startableEncounterIds`, `joinableMonsters`, `unseenMonsters`, `arrivingMonsters`, `arrivingNpcs`) | Director group and `prompts/interpret.ts` L7 |
| `first-stage.ts` `firstStages`, `cutPlans` (stages), `clarifyHolds`, `holdDirector`, `CLARIFY_HELD` | Free-mode cut and clarify hold of Intent readings |
| `purposes.ts` `dm.adjudicate`, `PURPOSE_OF.adjudicate`; `playtest/budget.ts` row | The ruling call uses the purpose (spec 102 OQ-2; `rulings.ts` L45). The hosted config on vm-104 names purposes (C9). |
| `schema/jobs.ts` stage CHECK value `'adjudicate'` | Old job rows hold it. No migration. |
| `apps/web/app/debug/*` adjudicate section and label | Reads old checkpoints as `unknown`; the purpose label still names ruling calls |
| `jobs.ts` `LegacyAuditRecord` | Spec 103: old rows in `routes/dm.ts` and `playtest/export.ts`. Unrelated to resolve. |
| `packages/dnd5e-engine` `REASON_CONTRADICTS_STATE` | Engine refusal enum; spec 103 already removed the plan-gate check. Out of scope. |

## Success criteria

- **SC-001**: `grep -rnE "runSteps|StepSchema|LegacyInterpretReading|hasStages|needsAdjudication|step-grammar" apps/server/src` returns nothing.
- **SC-002**: The Phase 1 probe lists every test that failed under the throw-stubs, and each one
  injects a legacy input or tests a deleted symbol. No scripted run fails.
- **SC-003**: The scene-start-space test shows no `combatant.placed` row for a party member at
  encounter start.
- **SC-004**: `pnpm ci:check` is green after every phase.
- **SC-005**: `resume.test.ts` proves an old-shape plan and an old-shape reclaimed checkpoint are
  both dropped.

## Checkpoints

- **C-GATE (operator ruling needed before Phase 3):** deleting the adjudicate node removes the
  branch `specs/031-dm-runtime/contracts/node-seam.md` describes ("exactly two conditional
  branches: adjudicate or not"), the `adjudicate` node name, and `TurnCheckpoint.adjudicate` in
  `contracts/turn-jobs.md`. Spec 031 is not on the dispatch-rules frozen list, but the brief rules
  a contract-described seam is C-GATE. **Recommend:** delete, and amend both contract files in
  Phase 3. Alternative: keep `adjudicate` as a node name that always yields `{ rulings: [] }`.
- **C-CON:** none. No Intent contract change.

## Open questions

- **OQ-1 — Where the cut step anchors.** The runner runs the cut at `name === "adjudicate"`.
  **Recommend:** run it right after interpret's checkpoint save, same body, same `cut` flag.
- **OQ-2 — `NodeDeps.retrieve` and `minSimilarity`.** Only the adjudicate node reads them.
  **Recommend:** delete both from `NodeDeps`; keep the worker's own `retrieve` dep only if
  another reader exists (typecheck decides).
- **OQ-3 — Legacy tests.** About 28 test files use legacy fixtures. **Recommend:** delete a case
  when a planner test or an Intent-path test covers the behaviour; port it to `stage(...)`
  fixtures otherwise (plan D6). Never keep a legacy fixture alive for a test.
- **OQ-4 — Fights start at range.** Without gathering, a party member in another zone must move
  before a melee attack; the planner refuses `OUT_OF_REACH` otherwise. **Recommend:** accept (spec
  100 OQ-13 adopted it). Interpret already emits compound `move` + `attack` stages.
- **OQ-5 — Old ruling follow-ups.** **Recommend:** drop them (one-way door, spec 104 OQ-8).
