# Implementation Plan: Interpret emits Intents

**Branch**: `task-0269-interpret-intents` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)
**Authored against**: spec 092 `06d7ca13`, 093 `beae54aa`, 097 `a34d5d39`, 100 `16ae6147`,
102 `86d425b6`, 103 `39c9ed24`; base `origin/main` `702390db`.

## Size check (required)

**36 tasks in 6 phases. Fits one PR.** The first draft counted about 52 tasks for the whole card
and recommended a split. Operator ruling 2026-11-11, quoted: "Approve split + OQs". The deletion
(old AC #4, #6) moved to TASK-0312; this plan covers TASK-0269 only.

| Phase (one sonnet dispatch each) | Tasks | Card AC |
|---|---|---|
| 1 Schema and slash parse | 7 | #1, #2 |
| 2 Prompt v17 and interpret node | 6 | #1, #2 |
| 3 Resolve Intent runner and beside data | 9 | #3, #4 |
| 4 Narrate window | 5 | #5 |
| 5 Test and script migration | 6 | #2 (CI proxy), all |
| 6 Wiki | 3 | — |

## Summary

Interpret returns Intent stages with beside data; slash text skips the model; resolve submits each
stage through `gate.submit` as an `intent` request (declare, then confirm under `ai:dm`);
narrate reads carrier rows in a checkpointed seq window. Resolve's step paths stay for old
checkpoints and the free-retry fallback; TASK-0312 deletes them.

## Technical Context

TypeScript 5 / Node 22, Zod 4, Vitest. Packages consumed: `@the-stacks/intent` (`IntentSchema`,
`paramsSchemaOf`, `parse`, `toText`, `INTENT_KINDS`, fixtures), `@the-stacks/planner` (types and
`stepOutcome`, `PLAN_KINDS`), `@the-stacks/session-model`. `apps/server` already depends on
`intent`; it gains **`@the-stacks/planner` as a workspace dependency** (types plus `stepOutcome`;
spec 103 OQ-7 avoided it, here `stepOutcome` is a runtime import). That is a workspace package,
not a new third-party runtime dependency: **C5 does not fire**. If the orchestrator rules against
the edge, copy the 10-line `stepOutcome` into `stakes.ts` and derive types from session-model.

## Constitution Check (3.0.0)

| Principle | Check | Status |
|---|---|---|
| I Agent-operable | Interpreter submits the same `intent` request a human sends; actor rules per contract §3 (OQ-1) | Pass |
| II One Intent vocabulary | Slash and prose both emit Intents; planner plans every mechanical stage; no model between slash and engine | Pass |
| III Server authority | All writes through `gate.submit`; a refused stage appends nothing; carrier rows `dm` when fogged stay out of the public sheet | Pass |
| IV Three planes | No codex or library write | Pass |
| V Many views | Narrate reads public carrier rows only | Pass |
| VI Engine owns numbers | Interpret bodies forbid `dc`, `amount`, `slot` numbers outside the schema's own enums; the model writes no actor id | Pass |
| VII Narration around facts | Why rows come from code-chosen `PlanFact`s | Pass |
| IX UX | Slash path removes the interpret call (AC #1); no added I/O on the fact path except one bounded event read in narrate | Pass |
| XIII Plan just-in-time | Beside path time-boxed by OQ-6; every unserved kind names its owner | Pass, with OQ-6 carded |
| II "planner MUST NOT call a model" / III "model output only as ruling, proposal or prose slot" | Beside effects are model-written legacy proposals beside the Intent | **Justified deviation**, ruled at spec 097 OQ-5 (2026-11-09); ceiling OQ-6 |

## Design

### D1 — Interpret output schema (`dm/nodes/schemas.ts`)

```ts
INTERPRET_KINDS = ["attempt","check","save","contest","attack","cast","help","hide","search",
                   "grapple","shove","use_object","move","stand","drop_prone","dash","dodge",
                   "disengage"] as const;   // ponytail: TASK-0299 adds the monster-only kinds if any
IntentBody = z.discriminatedUnion("kind", INTERPRET_KINDS.map(k => z.object({
  kind: z.literal(k), targets: <TargetRefSchema array, contract arity>,
  params: paramsSchemaOf(k) with `dc` removed (CR-004), text: BodySchema.optional() })));
Beside = z.object({ stakes: StakesSchema, onSuccess, onFailure, onCost, onSevere: z.array(EffectSchema),
                    newRisk, reveals: ClueRefSchema.nullable(), autoFail: {reason}|null });
InterpretStage = z.object({ intent: IntentBody, beside: Beside.nullable() })
                   .refine(beside only on check/save/contest/search/hide);
InterpretReadingSchema = z.object({ actionId, stages: InterpretStage.array().max(6),
                   clarify, followUps, say });
```

The structured-output JSON schema comes from the existing `callJson` path (spec 093 D4). The
implementer confirms the discriminated union converts under the provider's strict mode; if not,
flatten to `{ kind, targets, params: z.record }` and validate per kind in a `superRefine`
(record the choice in the phase notes). Delete the `intent`, `uncertain`, `needsAdjudication`,
`rulesQuestion`, `steps` fields from the reading. `StepSchema`, `AdjudicateModelOutput` stay for
TASK-0312.

### D2 — Slash parse and stamping (`dm/nodes/interpret.ts`)

- Pre-pass over fresh beat items: `text.trimStart().startsWith("/")` → `parse(text, { id, actor,
  source: "composer", commit: "declared" })`. Ok → reading `{ stages: [{ intent, beside: null }] }`.
  Refused → reading `{ stages: [], clarify: <refusal message, ≤200> }`.
- The model call carries only the remaining items. Zero remaining and no monster turn → no call.
- Stamp: `id` per D3, `actor` from the beat item (`characterId` → `pc`; an `ai:companion:<id>`
  beat actor → `companion`; monster turn → `npc:<combatantId>`). Validate the full Intent with
  `IntentSchema`; a failure is `invalid-output` with the issue path.
- Delete `seatActorIds` and its log event (`dm.interpret.seat-actor`).

### D3 — Ids

`<actionId>.<n>` (n = stage index). The longest action id today is `act-<uuid>` (40 chars); 42
fits `IdSchema` (64). Monster turn: `npc.<jobId short 8>.<n>`. Deterministic, so a resumed turn
resubmits the same id and the gate's `INTENT_EXISTS` / confirm rule makes resubmission idempotent.

### D4 — Prompt (`dm/prompts/interpret.ts`, `dm/prompts/common.ts`)

`PROMPT_VERSION` `dm.interpret-v16` → **`dm.interpret-v17`**. Replace `STEP_GRAMMAR` and
`OUTPUT_SHAPE` with an Intent body grammar: the kind list with one line each (targets, params),
target keying (party by character id, NPCs and monsters by seed id), stage order rule ("one stage
per thing the actor does, in order"), clarify rule, beside rules (today's stakes paragraph, moved).
Keep the first-stage paragraph, follow-ups and `say`. `EXAMPLE_OUTPUT` becomes one `search` stage
with beside. Remove the step-grammar import from interpret only (adjudicate keeps it until TASK-0312).

### D5 — Resolve's Intent runner (`dm/nodes/resolve.ts`, new `dm/intent-runner.ts`)

New module `dm/intent-runner.ts` (keeps the hotspot diff small):

```ts
runStages(run, item | npcTurn, stages): Promise<ChainResult>
```

Per stage, in order:
1. Free-retry / autoFail check (FR-014): if the stage is a check kind with beside and
   `isFreeRetry(...)` or `beside.autoFail`, build today's `check.roll` mechanics proposal from the
   Intent params and submit it via `run.mech` (existing path). Continue to step 5.
2. Player/companion item: `gate.submit(item proposer, { kind: "intent", intent: declared })`; then
   `gate.submit(AI_DM, { kind: "intent", intent: { ...intent, commit: "confirmed" } })`.
   Monster turn: one `confirmed` submit under `AI_DM`.
3. Read the result's carrier row: `settled` → push `batchId`; `needs_ruling` → AI seat:
   `answerRulings(...)`, then read the answering carrier; human seat: `awaiting = true`, stop.
   Pending proposal (human seat confirm) → `awaiting = true`, stop. Refusal → record
   `firstRefusal` on stage 1, stop.
4. Beside: `band = stepOutcome(engine rows of the batch)`; run `effectsForBand(beside, band)`
   through the existing `runEffects`; set `reveals` / `revealedText` (FR-015).
5. Record the submission key `act:<actionId>:i<n>` in the checkpoint so a resumed turn skips
   applied stages (today's key scheme, new infix).

`resolveAction` branches: reading has `stages` → `runStages`; old-shape resumed reading → today's
`runSteps` (OQ-8). `actionGroupSteps`, `firstStage`, `follow-ups` gain stage-aware overloads
(`first-stage.ts`: a stage is roll-bearing when its kind's `PLAN_KINDS` class is `served` and the
kind rolls). `plan-gate.ts` `checkPlan` gains an Intent branch that applies only the turn hold
(`TURN_HELD`) and the undeclared-manner ask (spec 077); the planner and gate own the rest.
`stepActors` returns the stage actors' combatant ids.

Submission results are read from `GateResult` rows. The implementer confirms `gate.submit`
returns the appended rows for an `intent` request (spec 102 `gate.ts` line ~197 reads the carrier).

### D6 — Narrate window (`dm/nodes/narrate.ts`, `dm/jobs.ts`, `dm/pipeline/context.ts`, `dm/worker.ts`)

- `TurnCheckpoint` gains `factsThrough?: number` (optional; old checkpoints read as absent).
- `NodeDeps` gains `loadEvents(sessionId, { afterSeq, throughSeq, types }): Promise<StoredEvent[]>`
  wired in `worker.ts` to the existing event-store read.
- Narrate: `W1 = projections.throughSeq` (the projections it already loads). `W0` = the
  `factsThrough` of the newest completed prior turn job (`loadPriorTurns`). When no prior job
  recorded one (first beat, or the first beat after deploy), `W0` = the seq of the newest
  `narration` row before `W1`, else 0. That fallback keeps a deploy from re-rendering history.
- `planFacts` = carrier rows in `(W0, W1]`, `visibility === "public"`, seq order, facts flattened.
- The checkpoint saved after narrate records `factsThrough = W1`. A failure-notice path also
  records it, so a fallback beat does not re-render on the next one.
- Delete the `ponytail` comment at narrate.ts:294.

### D7 — Old checkpoints

`ResumedPlan.reading` is a union of the old and new reading shapes. `resolveAction` routes on
`"stages" in reading`. Assemble's `findResumedPlans` is unchanged.

### D8 — Deletion inventory (handed to TASK-0312; not done here)

- `resolve.ts`: `runSteps` cases `roll`, `check` (except the free-retry builder, moved to
  `intent-runner.ts`), `move` (reaction loop), `spell`, `help`, `attack`; `hitDamage`; `pullIn`;
  the old-shape branch in `resolveAction`; the gathering block (lines ~1280–1296).
  `effectCommand` and `runEffects` stay (beside effects).
- `plan-gate.ts`: `statGap`, `spellGap`, `foreignActor` / `STEP_ACTOR_MISMATCH`, `stepIds`,
  the pull checks; keep `TURN_HELD`, `askUndeclared`, encounter helpers used by the Director.
- `dm/nodes/adjudicate.ts`, `dm/prompts/adjudicate.ts`, `AdjudicateModelOutput`, runner branch
  (OQ-7); `dm/prompts/step-grammar.ts` (only if the Director no longer imports it; else trim).
- `StepSchema` members no longer referenced.

## Files touched

| File | Change |
|---|---|
| `apps/server/package.json`, `pnpm-lock.yaml` | add `@the-stacks/planner` workspace dep (hotspot: regenerate lockfile, never hand-merge) |
| `apps/server/src/dm/nodes/schemas.ts` | D1 |
| `apps/server/src/dm/nodes/interpret.ts` | D2, D3; delete `seatActorIds` |
| `apps/server/src/dm/prompts/interpret.ts` | D4, v17 |
| `apps/server/src/dm/prompts/common.ts` | beat entries show slash items as already parsed (if needed) |
| `apps/server/src/dm/intent-runner.ts` (new) | D5 |
| `apps/server/src/dm/nodes/resolve.ts` | D5 branch in `resolveAction`, `stepActors` |
| `apps/server/src/dm/gates/plan-gate.ts` | D5 Intent branch of `checkPlan` |
| `apps/server/src/dm/first-stage.ts`, `follow-ups.ts`, `stakes.ts` | stage-aware rules; `effectsForBand` takes `Beside` |
| `apps/server/src/dm/resume.ts` | D7 union |
| `apps/server/src/dm/nodes/narrate.ts`, `jobs.ts`, `pipeline/context.ts`, `pipeline/runner.ts`, `worker.ts` | D6 |
| `apps/server/src/dm/pipeline/runner.ts` | `needsAdjudication` returns false for new-shape readings |
| `apps/server/test/dm/**` (52 files listed by `grep -rl readings apps/server/test`), `test/dm/scripts/*.json` (16), `test/playtest/fixtures/downed-seat.json`, `test/dm/fixtures/task-0203-shapes.ts` | rescript readings to stages |
| `apps/server/test/dm/interpret-intents.test.ts` (new) | schema, round-trip, slash, stamping (SC-002, SC-007) |
| `apps/server/test/dm/intent-runner.integration.test.ts` (new) | per-outcome resolve tests, compound, beside, free retry |
| `apps/server/test/dm/narrate-window.test.ts` (new) | SC-005 |
| `apps/server/test/dm/seat-actor-id.test.ts` | deleted |
| `docs/wiki/*` | phase 6 |

**Migrations:** none (checkpoint JSON gains an optional field; no SQL). **New runtime
dependencies:** none third-party. **Contract changes:** none (no C-CON, no frozen contract).
**Catalog:** none.

## Tests (Intent PR gate, runbook "Per-PR gates")

- Schema test: each interpret kind's body schema accepts its fixture and rejects `dc`, an actor
  field and an unknown kind.
- Round-trip test: every stamped Intent from the fixtures `parse(toText(i))` deep-equals.
- Resolve test per outcome per kind group touched (check, combat action, movement, deed):
  `settled`, `needs_ruling` (AI and human seat), planner refusal, engine refusal.
- Planner tests: none new (the planner is unchanged); resolve tests assert the planner's facts on
  the carrier.

## Risks

- **Rescript volume.** 52 test files script readings. Phase 5 adds a `reading()` test helper in
  `test/dm/world.ts` that builds a stage list, so most edits are one line.
- **Human-seat approval count.** Declare-then-confirm adds one approval per stage for a human DM
  where today one mechanics proposal per step needed one. Net equal; the human-dm integration
  tests prove it.
- **Structured-output conversion of a 18-member union.** Fallback named in D1.
- **Wiki NEEDS-REVIEW** (runbook table, row 0267/0268/0269): `proposal-gate`, `session-model`,
  `dm-failure-and-gates`, `dm-runtime`, `ws-protocol` (re-pin only; no frame change), plus
  `dm-plan-gate`, `planner`, `intent-contract`, `dm-narration-quality`, `INDEX.md`, `CAPSULES.md`.
