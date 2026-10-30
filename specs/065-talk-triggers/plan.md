# Implementation Plan: In-character talk draws a reaction from the world

**Branch**: `task-0180-talk-triggers` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: `specs/065-talk-triggers/spec.md` and decision-0027 (proposed). This plan assumes
OQ-1 to OQ-16 (a). A different operator ruling changes the design section named under that OQ.
No phase starts before the operator rules and decision-0027 is accepted.

## Summary

The gate listener reads each public IC `talk` row from a human or companion. When the post passes
the read rule and the chain cap, it queues a `turn` job with trigger `talk` after a 3 s quiet
window. A talk turn with no committed beat runs a short path: assemble, code triggers, one `react`
call (purpose `dm.narrate`, version `dm.react-v1`), code checks, then one narration row. An
`escalate` outcome starts an unstarted seed encounter through the existing resolve opening move.
Completed talk turns prompt the named companions; their lines are read in turn until two DM
reactions follow the latest human row.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest, Drizzle. No new dependency.
**Storage**: Postgres event log; `jobs.input` and `jobs.result` JSON. No migration.
**Testing**: Vitest unit tests; DB integration tests with `REQUIRE_DATABASE=1`; the fake gateway
and DM scripts (spec 053).
**Target Platform**: the server's DM runtime (`apps/server/src/dm/`).
**Project Type**: monorepo web service.
**Performance Goals**: one model call per reaction; a reply lands within about 10 s of the quiet
window ending on hosted dev (one `dm.narrate`-class call, 10 to 20 s measured in run 2).
**Constraints**: serial hotspot with TASK-0182 (merged): `pipeline/runner.ts`, `jobs.ts`. No
frozen contract change.
**Scale/Scope**: about 10 source files, 6 test files, 2 DM scripts.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: no new human path. Triggers and the outcome are in the job result and
      on the debug page.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: session plane only.
- [x] **IV. Event sourcing**: no new event type. Rows are written only through `gate.submit` as
      `ai:dm`. The cap is derived from logged rows.
- [x] **V. Citations**: no rules claim is made. N/A.
- [x] **VI. 5e engine boundary**: the only mechanics are the existing encounter start rows.
- [x] **VII. Structured first**: triggers and the react output are typed Zod schemas.
- [x] **VIII. Operator-owned content**: reads the shipped seeds only; fixtures use
      `greyhollow-ford-duo`.
- [x] **IX. Self-hostable**: no new service, purpose or dependency (OQ-5 (a)).

**Stack conformance**: no departure.

## Research

- **R1 — Enqueue.** `createDmEnqueuer.onAppended` (`enqueue.ts`) sees every appended batch. A talk
  rule fits beside rule 3 (companion react). `loadProjections` gives the seat, mode, presence and
  transcript the read rule needs.
- **R2 — One queued turn per session.** `jobs_turn_queued_key` holds one queued turn. `enqueueTurn`
  is `ON CONFLICT DO NOTHING`, so a queued commit turn absorbs a talk post for free (OQ-14 (a)).
  The reverse case (a commit onto a queued talk turn) needs an upsert that rewrites `trigger` and
  clears `notBefore`.
- **R3 — `notBefore`.** The claim query applies `notBefore` to `companion` and `floor` only
  (`jobs.ts` claim, `j.kind NOT IN ('companion','floor') OR …`). Turn jobs need the same gate. It is
  a SQL text change in the claim, not a migration.
- **R4 — Empty beat.** `pipeline/runner.ts` returns `empty-beat` after assemble when the beat is
  empty, there is no NPC turn and the trigger is not `scene-start`. The talk path branches there.
- **R5 — Encounter start.** `encounterToStart(seed, director, trigger)` reads only
  `director.tableMode`. A synthetic Director output with `tableMode: { to: "turn", encounterId }`
  and every other decision held (`stay`/none/`continue`) drives the existing opening move. The
  plan gate's `joiningCombatants` and `arrivingNpcs` already follow it.
- **R6 — Code checks.** `deterministicChecks` (`nodes/audit.ts`) runs digits, dice language, claim
  gate and party-name checks over `NarrationFacts`. With `trigger: "talk"` and empty `actions`,
  dice language with no roll is refused, as wanted. `dmOnlySeedText` (`seed/views.ts`) supplies
  the DM-only strings.
- **R7 — Ship.** `submitNarration` (`nodes/resolve.ts`) ships one narration row with a checkpoint
  guard against double ships. A talk turn reuses it with `actionIds: []`.
- **R8 — Companions.** The worker's after-turn table queues `{ reason: "prompt" }` from
  `resolved.nextJob`. A talk turn sets `nextJob` the same way.
- **R9 — Aliases.** `nameTerms` and the snapshot's `aliases` match names, ids and given names.
  Seed role words come from `npc.identity.role`.
- **R10 — Human-authored rows.** `StoredEvent.actor` is a user id for humans and `ai:…` or
  `system` otherwise.

## Design

### D1 — `dm/talk-triggers.ts` (new, pure) (OQ-1, OQ-2, OQ-10, OQ-16)

- `isReadable(row, p)`: FR-001. Channel `ic`, visibility `public`, actor human or
  `ai:companion:*`, `p.gate.seat.kind === "ai"`, `p.tableMode.mode === "free"`.
- `capReached(p, cap = 2)`: walk `p.transcript` back from the end. Count `narration` entries by
  `ai:dm` until the first entry whose actor is human. True when the count is at least `cap`.
  Export `TALK_CHAIN_CAP = 2`.
- `codeTriggers(text, snapshot, seed)`: returns `{ kind, actorId }[]`. Match each present,
  non-dead, non-party actor's aliases and its seed role word, as whole words, case-insensitive.
  A name or alias at the start of the post, or followed by a comma or `?`, is `addressed`; any
  other match is `mentioned`; a role word shared by two present NPCs is `mentioned` for both.
  Every other present NPC is `overheard`. Party companions match too, for FR-004.
- `needsModel(triggers, text)`: OQ-16 (a). False when no trigger names a non-party NPC and the
  text holds no `?`.
- `companionOnly(triggers)`: true when every `addressed` trigger names an AI companion and no NPC
  is addressed or mentioned (FR-004).

### D2 — Enqueue (`enqueue.ts`, `jobs.ts`) (OQ-4, OQ-11, OQ-14)

- `TurnTriggerSchema` gains `"talk"`. `TurnJobInput` gains `notBefore` and `firstPostAt`
  (optional ISO strings), as `CompanionJobInput`.
- New `enqueueTalkTurn(db, sessionId, triggerSeq, { quietMs, maxWaitMs })`: insert a turn job with
  trigger `talk` and `notBefore = least(now()+quiet, firstPostAt+maxWait)`. On conflict with a
  queued talk turn, move `notBefore` and `triggerSeq` in one statement. On conflict with any other
  queued turn, do nothing. Loop when the queued row was claimed in between.
- `enqueueTurn` gains an upsert step: when the conflicting queued row has trigger `talk`, set its
  `trigger` and `triggerSeq` to the new values and remove `notBefore`.
- The claim query adds `turn` to the `notBefore` kinds.
- `onAppended` rule 7: for each `talk` row, after the commit rule, run `isReadable` and
  `capReached` on fresh projections. `companionOnly` queues `enqueueCompanion({ reason: "prompt" })`
  for the addressed companions. Otherwise call `enqueueTalkTurn`. Deps gain `talkQuietMs` (3000)
  and `talkMaxWaitMs` (10000).
- `reconcileTurnJobs` is unchanged: a lost talk turn is not repaired at boot. A reaction that
  arrives a reboot late is worse than none.

### D3 — The talk path (`pipeline/runner.ts`, `dm/talk-turn.ts` new) (OQ-3, OQ-5, OQ-7, OQ-8)

- In the runner, where `empty-beat` returns: when `ctx.job.trigger === "talk"`, run
  `runTalkTurn(ctx, assembled)` instead and return its status. A talk job with a non-empty beat
  runs the full pipeline unchanged (spec US5 #3).
- `runTalkTurn`:
  1. Read posts: every `talk` row with seq in `(lastHumanCutoff, triggerSeq]` that passes
     `isReadable`. `lastHumanCutoff` is the seq of the last `ai:dm` narration before `triggerSeq`.
  2. `codeTriggers` per post. If `needsModel` is false for all, record `none`, return `completed`.
  3. Call `react` (D4). Checkpoint the output (`checkpoint.react`), so a reclaim reuses it.
  4. For `escalate`, run the legality check (D5). An illegal one becomes `scene`.
  5. For non-`none`: build `NarrationFacts` with `trigger: "talk"`, empty `actions`, the present
     NPCs and party; run `deterministicChecks` plus a `dmOnlySeedText` substring check. On a
     refusal, call `react` once more with the issues. A second refusal records `none`.
  6. For `escalate`: run resolve's opening move with the synthetic Director (D5), then ship.
     Otherwise ship directly through `submitNarration` with `actionIds: []`.
  7. Set `resolve.nextJob` to `{ kind: "companion", reason: "prompt", companions }` when the
     output names companions and the shipped row does not reach the cap.
  8. Record `talk: { posts, codeTriggers, modelTriggers, outcome, reason }` in the job result.

### D4 — `prompts/react.ts` and `nodes/schemas.ts` `ReactOutput` (OQ-2, OQ-5, OQ-6, OQ-8)

```ts
export const ReactOutput = z.object({
  outcome: z.enum(["none", "reply", "scene", "escalate"]),
  triggers: z.array(z.object({
    kind: z.enum(["addressed", "mentioned", "overheard", "narrator", "hostile"]),
    actorId: RefIdSchema.nullable() })).max(8),
  speaker: RefIdSchema.nullable(),          // reply only: the NPC who answers
  text: z.string().max(1200),               // empty for none
  encounterId: RefIdSchema.nullable(),      // escalate only
  companionPrompts: z.array(RefIdSchema).max(2),
  reason: z.string().min(1).max(300),
});
```

`superRefine`: `reply` needs `speaker`; `escalate` needs `encounterId`; `none` needs empty text.
The prompt (`PROMPT_VERSION = "dm.react-v1"`, purpose `dm.narrate`) takes the posts with their
speakers, the code triggers, `renderSnapshot(…, "fiction")`, the `PlayerSeedView` NPC voices, the
transcript tail and whether this reaction reaches the cap. Rules: one outcome; voice only present
NPCs; never state anything outside the player view; no digits, no dice; persuasion and requests
with stakes get a reply that invites a declared action; `escalate` only for violence or fast
action and only into a listed unstarted encounter; at the cap, prompt no companion and end on a
beat for the PCs. `maxTokens` reuses the `dm.narrate` cap (500).

### D5 — Escalation (`dm/talk-turn.ts`, `nodes/resolve.ts`) (OQ-9)

- `legalEscalation(seed, p, encounterId)`: true when the mode is free and `encounterToStart` finds
  the encounter and no monster of it is already a combatant and the encounter did not end
  (`p.encounter` is null or names another encounter).
- The talk path runs the existing resolve node with `ctx.results.director` set to a synthetic
  output: `{ beat: resolve, tableMode: { to: "turn", encounterId, reason }, trackers: [],
  scene: continue, companionPrompts: [] }`, and `ctx.results.interpret` set to no readings. Resolve
  then runs only its opening move (monsters, initiative, turn mode) and its submissions are
  checkpointed as today. Turn advance does not run, because the mode started this turn. If resolve
  needs more than this, export `directorOpening` from `nodes/resolve.ts` instead and record why.
- The worker's after-turn table then queues the NPC or companion turn by initiative.

### D6 — Fixtures and tests

- `test/dm/talk-triggers.test.ts`: `isReadable` (each FR-001 condition), `capReached` (0, 1, 2
  rows; reset by a human row), `codeTriggers` (Odo's run 2 line → `addressed: wenna`; a role word;
  a dead NPC dropped; overheard), `needsModel`, `companionOnly`.
- `test/dm/scripts/talk-reply.json`: one `dm.narrate` call with `ReactOutput` `reply` by Wenna;
  `talk-none.json`; `talk-chain.json` (two replies prompting Odo, two companion `say` replies);
  `talk-escalate.json` (escalate into the seed's reed-camp encounter, dice for initiative).
- `test/dm/talk-turn.integration.test.ts` (DB): reply ships one narration row and no state row;
  none ships nothing; a DM-only leak is refused then dropped; OOC, whisper, turn mode and human
  seat queue nothing; a queued commit absorbs a post; a commit onto a queued talk turn converts
  it; the chain stops at two; escalate writes combatant adds, initiative and `table-mode.changed`;
  an illegal escalate becomes scene.
- `test/dm/enqueue-talk.integration.test.ts` (DB): quiet window coalesces two posts into one job;
  the 10 s cap holds.
- `test/dm/react-prompt.test.ts`: version, rules present, no DM-only field reaches the prompt
  (extends the type-level test in `player-facing-prompts.test.ts`).

### D7 — Mutation guard

Stub `codeTriggers` to return `[]`; stub `capReached` to return `false`; stub `legalEscalation`
to return `true`. Each fails at least one test. Restore; `git diff` is empty.

### D8 — Script-mode live check (spec 053)

`apps/server/dm-scripts/greyhollow-talk.json`: `scene-start.json` calls plus `talk-reply.json` and
its chronicle call. `test/dm/dm-scripts.test.ts` proves the composition.
`specs/065-talk-triggers/evidence/talk.mjs` posts Odo's run 2 line as IC talk. The orchestrator
runs it on the worktree stack in Brave and records Wenna's reply.

## Files touched

| File | Change |
|---|---|
| `apps/server/src/dm/talk-triggers.ts` | new: read rule, cap, code triggers (D1) |
| `apps/server/src/dm/jobs.ts` | trigger `talk`, `notBefore`/`firstPostAt` on turn input, `enqueueTalkTurn`, `enqueueTurn` upsert, claim `notBefore` for turns, `TurnCheckpoint.react?` (D2, D3) |
| `apps/server/src/dm/enqueue.ts` | rule 7, talk deps (D2) |
| `apps/server/src/dm/talk-turn.ts` | new: `runTalkTurn`, `legalEscalation` (D3, D5) |
| `apps/server/src/dm/pipeline/runner.ts` | branch to the talk path at the empty beat (D3) |
| `apps/server/src/dm/nodes/schemas.ts` | `ReactOutput` (D4) |
| `apps/server/src/dm/prompts/react.ts` | new: the react prompt, `dm.react-v1` (D4) |
| `apps/server/src/dm/nodes/resolve.ts` | only if D5's fallback is needed: export `directorOpening` |
| `apps/server/src/dm/worker.ts` | record the talk result; wire talk deps (D3) |
| `apps/server/src/dm/facts.ts` | `NarrationFacts` accepts trigger `talk` with no actions, if the type needs it (D3) |
| `apps/server/test/dm/talk-triggers.test.ts`, `react-prompt.test.ts` | new (D6) |
| `apps/server/test/dm/talk-turn.integration.test.ts`, `enqueue-talk.integration.test.ts` | new DB tests (D6) |
| `apps/server/test/dm/player-facing-prompts.test.ts`, `dm-scripts.test.ts`, `runner.test.ts` | extended (D6, D8) |
| `apps/server/test/dm/scripts/talk-*.json` | four fixtures (D6) |
| `apps/server/dm-scripts/greyhollow-talk.json` | live script (D8) |
| `specs/065-talk-triggers/evidence/talk.mjs` | live-check post script (D8) |
| `specs/031-dm-runtime/contracts/turn-jobs.md`, `nodes.md`, `node-seam.md`, `purposes.md` | additive amendments |
| `backlog/decisions/decision-0027 - …md` | status `accepted` with the rulings (orchestrator, via the CLI) |
| `docs/wiki/dm-turn-jobs.md`, `dm-runtime.md`, `dm-narration-quality.md`, `session-model.md`, `CAPSULES.md`, `INDEX.md` | re-ground (Phase 6) |
| `docs/design/m3-table-sweep-runbook.md` | execution log row (Phase 6) |

**Migrations**: none. The claim query's `notBefore` gate is SQL in `jobs.ts`; `jobs.input` is JSON.
**New runtime dependencies**: none.

## Frozen-contract impact

None under the (a) rulings. `ws-protocol.md` frames, `specs/029-proposal-gate/contracts/` and
`specs/030-play-route/contracts/proposal-seam.md` are untouched. OQ-6 (c) is the only option that
would touch them. The 031 contracts are amended additively.

## Phases

1. Pure core: `talk-triggers.ts`, `ReactOutput`, unit tests (sonnet).
2. Enqueue: trigger, quiet window, upserts, claim gate, rule 7, enqueue DB test (sonnet).
3. Talk path: `talk-turn.ts`, react prompt, runner branch, worker result, reply/none/refusal and
   chain DB tests (sonnet).
4. Escalation: `legalEscalation`, opening-move reuse, escalate DB tests (sonnet).
5. DB suites, mutation guard, script-mode live check **[orchestrator]**.
6. Contracts and wiki re-ground, runbook log row (sonnet).

## Cut line (before alpha run 3)

The operator wants this in before run 3 "if possible". If the build grows too large, these cuts
keep a playable result. Each is the orchestrator's proposal to the operator, never its own call.

- **Cut 1: Phase 4 (escalation).** Card AC #5 is then met by the rule "a talk reaction never starts
  turn mode; it may narrate a threat, and the next commit's Director starts the encounter" (OQ-9
  (c)). The `escalate` outcome leaves the schema; the prompt says to use `scene`. Saves one
  dispatch. Recommended first cut.
- **Cut 2: the chain (Phase 3, FR-012 and FR-013).** A reaction prompts no companion. AI-only
  chains cannot form, so the cap is trivially met. Saves about a third of Phase 3.
- **Cut 3: the quiet window (Phase 2).** Queue the talk turn at once (OQ-4 (b)). Drops the
  `notBefore` claim change and the coalescing test.

Phase 1, the rest of Phase 2, the reply path of Phase 3 and Phase 6 are the minimum that fixes run
2 item 1.

## Live check

Phase 5 runs D8 on the worktree stack. Expected: Odo's IC line to Wenna draws one narration row in
Wenna's voice about 3 s later; the debug page shows the talk turn with `addressed: wenna` and
outcome `reply`; no dice line; table mode stays free.
