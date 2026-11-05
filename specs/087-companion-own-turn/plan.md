# Implementation Plan: A companion acts in its own turn

**Branch**: `task-0244-companion-own-turn` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: `specs/087-companion-own-turn/spec.md`; runbook B playtest run 1 finding 40 (seq
206-241) and finding 44; runbook B2 merge spine #4 (`docs/design/m3-runbook-b2-playtest-fixes.md`).
This plan assumes OQ-1 to OQ-5 at their defaults. Research and design are small, so they live in
this file; there is no separate research.md, data-model.md or quickstart.md.

## Summary

In turn mode the plan gate holds a party action whose only step actor is an off-turn AI companion,
and refuses one that mixes an off-turn companion with other actors. Resolve runs no step for a held
group and leaves it committed. When the turn advances to that companion, resolve queues a turn job
instead of a companion job, and that beat resolves the held group as the companion's turn action.
The narration facts say the action waits, and every actor a group's steps name is on turn for that
beat.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency.**
**Storage**: no table change. **No migration.** The new turn trigger value lives in the
`jobs.input` JSON, which no CHECK constraint reads. No event shape change: a held group writes no
row.
**Testing**: Vitest unit tests (plan gate, facts, narrate). One integration test against the
worktree stack's test database (`pnpm env:up`, `TEST_DATABASE_URL`), scripted dice, no model.
**Constraints**: no frozen contract change (`ws-protocol`, spec 029, spec 030 seam). Every new field
is optional, so old checkpoints and test literals still parse and compile. `fallback.ts`,
`floor-state.ts`, `floor.ts`, `enqueue.ts`, `companion.ts` and the session-model gate are not
edited.
**Scale/Scope**: 6 source files, 1 new test file, 3 extended test files, 4 contract amendments.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the DM pipeline is the agent path. The hold is code the runtime
      applies and a fact line the narrator reads. No human-only path.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: no new state. The held verdict is derived per turn from S0 and stored in
      the existing `checkpoint.planGate` JSON.
- [x] **IV. Event sourcing, server authority**: no event change. A held action stays committed in
      the log until its resolve row lands. The gate's commit authority is unchanged.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: no engine change. The engine still spends the slot and rolls the
      healing. Turn order stays the engine's.
- [x] **VII. Structured first**: the held verdict, the `held` outcome, `stepActors` and
      `NarrationFacts.held` are typed fields; the rules are pure functions.
- [x] **VIII. Operator-owned content**: no content change. The seed is read, not edited.
- [x] **IX. Self-hostable**: no new service or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — Where the act escapes the turn.** `checkPlan` (spec 079 D5, `foreignActor`) lets a
  party-scope group name any party combatant. `resolve` runs every unresolved beat item in commit
  order with no turn test. The gate (`session-model/gate/authority.ts`) lets a party action commit
  at any time by group authority. The DM runtime is the only place that knows the step actors, so
  the hold belongs in the plan gate and resolve, not the gate.
- **R2 — S0 holds everything the rule needs.** `ActorSnapshot.stage.tableMode.mode`,
  `stage.encounter.activeCombatantId` and `stage.encounter.order` give the turn. Each S0 actor gives
  `kind`, `controller.kind` (`ai-companion`), `combatantId` and `lifeState`. `PlanInput.actors`
  maps each character action id to its combatant id, so the companion's own action in the beat is
  known too.
- **R3 — A held action stays in every beat.** `selectBeat` (`nodes/assemble.ts`) takes every
  committed, unresolved, non-awaiting action. With no `action.resolve` row the group returns in
  each later beat, is interpreted again, and is gated again. No new storage is needed.
- **R4 — Why the off-turn list named Odo.** `buildNarrationFacts` builds `onTurn` from the Turn
  actor, `actions[].characterName` (null for a party action) and roll names. Cure Wounds rolls
  `healing` on its target (`dnd5e-engine/commands/spells.ts` → `healingEvents(target, …)`), so the
  only roll names Tamsin. The caster appears nowhere in `onTurn`.
- **R5 — Who queues the companion's turn.** `resolve` sets `nextJob` to a companion `turn` job when
  the new active actor is `ai:companion:*`. The worker enqueues it. `floor.ts` and `enqueue.ts`
  queue the same job when a floor pass or a human's mode row hands the turn to a companion.
- **R6 — The turn-advance rule.** Resolve advances when a beat item's `characterId` equals the
  active character and its result is not `awaiting-dm`. A party action's `characterId` may equal
  the active human's, so a held group must be excluded there, or the human's turn would end with
  nothing done.

## Design

### D1 — Held verdict (`apps/server/src/dm/gates/plan-gate.ts`)

- `PlanFailureReason` gains `"off-turn"`.
- Export `TURN_HELD_CODE = "TURN_HELD" as const`. It is a plan-gate literal, not a `RefusalCode`,
  and never reaches an event.
- `PlanVerdict` gains `{ actionId: string | null; ok: false; code: typeof TURN_HELD_CODE;
  heldFor: string }` (`heldFor` is the companion's combatant id).
- New pure helper `stepActors(steps: readonly Step[]): string[]`: the distinct `attackerId`,
  `casterId`, `helperId` and `move` `combatantId` values, in step order. Export it; resolve uses it
  (D3). Reuse it inside `foreignActor` only if the diff stays smaller; otherwise leave
  `foreignActor` as it is.
- New pure helper `heldFor(steps, snapshot, ownActors): { held: string } | { offTurn: PlanFailure }
  | null`, applied in `checkPlan` to a group where `input.actors.get(actionId) === null` (party
  scope), after the `foreignActor` check:
  - Return null unless `snapshot.stage.tableMode.mode === "turn"` and `snapshot.stage.encounter`
    is set.
  - Off-turn companions: S0 party actors with `controller.kind === "ai-companion"`,
    `lifeState === "conscious"`, a `combatantId` in `stage.encounter.order`, and either
    `combatantId !== activeCombatantId` or a character group in this beat whose actor is that
    combatant (`ownActors`: the values of `input.actors` for groups present in `groups`).
  - Let `A = stepActors(steps)`. When no member of `A` is an off-turn companion: null.
  - When `A` is exactly one off-turn companion: `{ held: id }` → push the held verdict, `continue`.
  - Otherwise: `{ offTurn: { stepIndex, field, id, reason: "off-turn" } }` for the first step that
    names the off-turn companion → push a `STEP_ACTOR_MISMATCH` verdict, `continue`.
- `// ponytail: only AI companions are held (OQ-2); a human PC named off turn still acts. Extend
  the off-turn set to human party members when a playtest shows it.`

### D2 — Held outcome (`apps/server/src/dm/nodes/resolve.ts`)

- `ActionOutcome` gains `"held"`. `ResolveOutput.actionResults[]` gains optional
  `heldFor?: string` and `stepActors?: string[]`.
- `resolveAction`: when `verdict` is the held variant, return
  `{ actionId, outcome: "held", batchIds: [], refusalCode: null, heldFor: verdict.heldFor }` before
  any pull, step or `action.resolve` submission.
- For a group that ran (no plan refusal, no clarify), set `stepActors: stepActors(steps)` on the
  returned result when non-empty.

### D3 — Release and turn advance (`apps/server/src/dm/nodes/resolve.ts`)

- In the turn-advance `done` test, the existing beat-item clause also requires
  `r.outcome !== "held"` (R6).
- Add one clause: when `mode.activeActor` starts with `ai:companion:` and `activeAtStart` is set,
  `done` is also true when an action result with outcome `applied`, `refused` or `no-effect` lists
  `activeAtStart` in `stepActors`. This is the released group ending the companion's turn.
- `nextJob`: when the new table mode's active actor is `ai:companion:<id>` and an action result in
  this beat has outcome `held` with `heldFor` equal to the new active combatant
  (`fresh.encounter.activeCombatantId` after the advance, read from the projections resolve already
  loads), set `nextJob = { kind: "turn", trigger: "held" }` instead of the companion job. The
  companion takes no act of its own that turn (spec R2).
- `ResolveOutput.nextJob`'s turn variant widens to `trigger: "npc-turn" | "held"`.
- `// ponytail: a floor pass or a human mode row (floor.ts, enqueue.ts) still queues the companion
  job; R1 then holds the group again because the companion has its own action, so it waits a
  round. Read the newest checkpoint's held verdicts in the companion job when a playtest shows it.`
- `// ponytail: a held group is interpreted again each beat (R3). Cache its reading in the
  checkpoint when the token cost shows in a playtest.`

### D4 — The `held` trigger (`apps/server/src/dm/jobs.ts`, `apps/server/src/dm/worker.ts`)

- `TurnTriggerSchema` gains `"held"` with the comment `// a turn job ended with an AI companion
  active whose party action was held (TASK-0244)`.
- `worker.ts`, the `next?.kind === "turn"` branch: enqueue `next.trigger`, not the literal
  `"npc-turn"`.

### D5 — On-turn step actors and held facts (`apps/server/src/dm/facts.ts`)

Starts after TASK-0242 has merged (spine #1; it edits the same `turn` block).

- `NarrationFacts` gains `held?: { name: string; text: string }[]` (set only when non-empty).
- In the `actions` loop: a result with outcome `held` is not pushed to `actions`. Push
  `{ name: nameOf(result.heldFor), text: item.text }` to `held` instead.
- In the `turn` block's `onTurn` set, add `nameOf(id)` for each `stepActors` id of each action
  result whose outcome is `applied`, `refused` or `no-effect` and whose plan verdict was ok (a
  plan-refused group has no `stepActors`, D2).

### D6 — The waiting line (`apps/server/src/dm/prompts/narrate.ts`)

- `factEntries`: after the `Off turn:` push, for each `facts.held` entry push
  `Waiting: "<text>" waits for <name>'s turn; nothing has happened yet.`
- `PROMPT_VERSION` → the next narrate version (one past `origin/main` at Phase 2 start;
  `dm.narrate-v19` at authoring). The audit prompt reads `factEntries`, so it shows the line with
  no edit and no version bump.

## Replay (card AC #1)

New `apps/server/test/dm/companion-own-turn.integration.test.ts`, in the style of
`opportunity-attack.integration.test.ts` (`createWorld`, scripted dice, `runResolve` with readings,
`loudSkip`). Header: source is runbook B playtest run 1 finding 40, seq 206-230, session
`729a6c5c`; rows rebuilt from the log on seed `greyhollow-ford`; seq numbers name the log's rows.

| Step | Run 1 seq | Case |
|---|---|---|
| 1 | — | Scene start; Kestrel re-seated human (as the opportunity-attack test); turn mode in reed-camp with dice giving Kestrel, goblin-2, then Odo; DM `turn.advance` until round 2, Kestrel active |
| 2 | 206 | Tamsin declares the party action "Odo casts Cure Wounds on Tamsin." and it commits (group sign-off as the world allows) |
| 3 | 206-210 | Resolve with the party reading `spellStep("tamsin", { spellId: "cure-wounds", slotLevel: 1 })`: plan verdict `TURN_HELD` for `odo`; no `slot.expended` row; action still committed; Kestrel still active; facts have one `held` entry naming Brother Odo and no Action line for it |
| 4 | 211-220 | Kestrel's own action resolves beside the held group; the group is held again; the turn advances to goblin-2 |
| 5 | 221 | goblin-2's NPC turn beside the held group: held again; the turn advances to Odo; `nextJob` is `{ kind: "turn", trigger: "held" }` |
| 6 | 222-230 | The `held` turn job: the cast applies, one `slot.expended` for Odo, Tamsin healed; the turn advances past Odo; facts `turn.offTurn` omits Brother Odo |
| 7 | — | Round 2 assertion: exactly one Odo-cast `slot.expended` row and no `ai:companion:odo` `action.declared` row between round 2's start and the advance past Odo |

Also one case for R3: on Kestrel's turn a party reading with `spellStep` (Odo) and a Kestrel
`attackStep` resolves `refused` with `STEP_ACTOR_MISMATCH`.

## Contracts

- `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md`: amendment — the held verdict,
  `off-turn` reason, `stepActors`.
- `specs/031-dm-runtime/contracts/resolve.md`: amendment — the `held` outcome, `stepActors`, the
  release clause and the `held` next job.
- `specs/031-dm-runtime/contracts/turn-jobs.md`: amendment — the `held` trigger.
- `specs/034-narration-quality/contracts/narration-facts.md`: amendment — `held`, the `Waiting:`
  line, step actors on turn.

## Files

| File | Change | Phase |
|---|---|---|
| `apps/server/src/dm/gates/plan-gate.ts` | D1 | 1 |
| `apps/server/src/dm/nodes/resolve.ts` | D2, D3 | 1 |
| `apps/server/src/dm/jobs.ts` | D4 (`held` trigger) | 1 |
| `apps/server/src/dm/worker.ts` | D4 (enqueue `next.trigger`) | 1 |
| `apps/server/test/dm/plan-gate.test.ts` | held, refused and not-held cases | 1 |
| `apps/server/src/dm/facts.ts` | D5 | 2 |
| `apps/server/src/dm/prompts/narrate.ts` | D6, narrate version bump | 2 |
| `apps/server/test/dm/facts.test.ts` | AC #2 cases, held entry | 2 |
| `apps/server/test/dm/narrate.test.ts` | version pin, `Waiting:` line | 2 |
| `apps/server/test/dm/companion-own-turn.integration.test.ts` | new; the replay | 3 |
| the four contract files above | amendments | 3 |
| `docs/wiki/turn-floor.md`, `dm-failure-and-gates.md`, `dm-runtime.md`, `dm-turn-jobs.md`, `dm-narration-quality.md`, `CAPSULES.md`, `INDEX.md` | re-ground | 4 |

Not touched: `floor-state.ts` (the runbook's "possibly"; the hold needs no floor read),
`companion.ts`, `floor.ts`, `enqueue.ts`, `fallback.ts`, `prompts/audit.ts`, the session-model
gate, the engine.

**Footprint note for the orchestrator**: against the runbook's expected footprint this plan adds
`jobs.ts`, `worker.ts` and `prompts/narrate.ts`, and drops `floor-state.ts`. TASK-0203 (merged,
#136) also edited `jobs.ts`-adjacent files but not these lines. TASK-0238 follows on
`prompts/narrate.ts` and re-bumps the narrate version if both claim the same one. Two more wiki
notes than the runbook lists (`dm-turn-jobs`, `dm-narration-quality`) pin these files.

## Overlap

Before Phase 1, merge `origin/main` into the branch (the claim cut 8128fb3a; main has since merged
0242, 0240, 0246 and 0203). Phase 2 edits `facts.ts` and starts only after TASK-0242 is on the
branch (merged as PR #133 at authoring; confirm with `git merge-base --is-ancestor bef9c4d5 HEAD`).
TASK-0238 starts after this task merges (plan gate, resolve, `facts.ts`).
