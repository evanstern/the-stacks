# Implementation Plan: Seat actor id

**Branch**: `task-0302-seat-actor-id` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: `specs/096-seat-actor-id/spec.md`, authored against `origin/main` `48725992`.

## Summary

Stop the DM prompts from showing a user id as a human's actor, and catch the case anyway. Candidate
fixes were (a) render the seated character id everywhere, (b) a deterministic normalizer after
interpret, (c) both. **Chosen: (c), small.** (a) removes the cause: the model can only copy an id it
was shown. (a) alone is not proof: the model can still echo an id from another surface, and a
refused turn spends the human's turn. (b) alone leaves two ids for one actor in the prompt, which
also confuses narration of the reason text. (b) is about 20 lines and is retired by TASK-0269, where
the seat supplies the actor and no model writes it.

## Technical Context

**Language/Version**: TypeScript (`apps/server`), Node 22 ESM.
**Primary Dependencies**: none new.
**Storage**: none. **No migration.** No event change.
**Testing**: Vitest unit tests in `apps/server/test/dm/`. Fake gateway only; no paid model run.
**Constraints**: plan gate unchanged (`dm/gates/plan-gate.ts`). Frozen contracts unchanged.
**Scale/Scope**: 4 source files, 3 existing test files edited, 1 test file added, wiki notes.

## Design

**D1 — one actor label for the DM-side form.** In `apps/server/src/dm/prompts/common.ts`:

- Add `seatsOf(party: SessionProjections["party"]): Map<string, string>`: player `userId` to
  `characterId`, built from `controller.kind === "player"` members. First member wins.
- Add `dmActorLabel(actor, characterId, seats)`: returns `characterId`, else `seats.get(actor)`,
  else `actor` when it is `ai:dm`, `system` or starts with `ai:`, else `"a player"`. It never
  returns a user id.
- `transcriptEntries(tail, roster?, seats?)`: with no roster, `speaker()` uses `dmActorLabel` with
  `seats ?? new Map()`. The roster form is unchanged. The DM form keeps every entry (FR-002).
- `beatEntries(beat, seats)`: renders `by ${dmActorLabel(b.actor, b.characterId, seats)}`.

**D2 — callers.** `prompts/interpret.ts` and `prompts/director.ts` compute
`const seats = seatsOf(assembled.projections.party)` and pass it to `transcriptEntries(tail,
undefined, seats)` and `beatEntries(..., seats)`. Bump `PROMPT_VERSION` to `dm.interpret-v16` and
`dm.director-v11`. The `ponytail:` comment on `seatsOf` reads: one user seating two characters
labels as the first; upgrade path is TASK-0269, where each Intent carries its seat's actor.

**D3 — seat normalizer.** In `apps/server/src/dm/nodes/interpret.ts`, export a pure
`seatActorIds(readings, party)` returning `{ readings, swaps: { actionId, field }[] }`. For each
step, the actor field (`attack.attackerId`, `spell.casterId`, `help.helperId`, `check.combatantId`,
`move.combatantId`) that equals a player member's `controller.userId` becomes that member's
`combatantId`, when the member has one. Nothing else changes. Target fields are not touched: a
human never targets a user id in the evidence, and a wrong target should still be refused. Call it
on the final `readings` in both return paths of the `interpret` node (resumed-only and fresh). Log
each swap as `{ event: "dm.interpret.seat-actor", jobId, actionId, field }` through `ctx.deps.log`.
The output schema and `checkPlan` are unchanged.

**D4 — regression test.** New `apps/server/test/dm/seat-actor-id.test.ts`, built from session
`3406d9ae` seq 117:

1. Take `greyhollowFight()` (`test/dm/snapshot-fixtures.ts`). Set Tamsin's controller `userId` to
   `6ff0a0f1-073a-4b11-b31b-5a0ede04f613`. Build a reading for action `a1` with one `attack` step,
   `attackerId` the user id, `targetId: "goblin-3"`, reason "Tamsin shoots the wounded goblin
   lookout on the rise." Assert `checkPlan` without the normalizer refuses `STEP_ACTOR_MISMATCH`
   (the bug, reproduced). Assert `seatActorIds` yields `attackerId: "tamsin"` and one swap, and
   `checkPlan` with `actors: new Map([["a1", "tamsin"]])` returns `ok: true`. Mirror the gate setup
   in `test/dm/plan-gate.test.ts`.
2. A user id that seats nobody is not rewritten.
3. Build interpret and director prompts from `free-mode-action` events (`freeEventsThrough`, Ana
   seated by `00000000-0000-4000-8000-000000000001`) plus one party-scope `action.declared` row by
   that user. Assert neither `user` text contains the user id, the declaration line names `ana`,
   and the party beat item reads `by ana`. Follow `test/dm/interpret-prompt.test.ts` `prompts()`.

## Files touched

| File | Change |
|---|---|
| `apps/server/src/dm/prompts/common.ts` | `seatsOf`, `dmActorLabel`; `transcriptEntries` third arg; `beatEntries` second arg (D1) |
| `apps/server/src/dm/prompts/interpret.ts` | pass seats; `dm.interpret-v16` (D2) |
| `apps/server/src/dm/prompts/director.ts` | pass seats; `dm.director-v11` (D2) |
| `apps/server/src/dm/nodes/interpret.ts` | `seatActorIds`; call and log in both return paths (D3) |
| `apps/server/test/dm/seat-actor-id.test.ts` | new regression test (D4) |
| `apps/server/test/dm/interpret-prompt.test.ts` | version assertion to `v16` |
| `apps/server/test/dm/assemble.test.ts` | director version assertion to `v11` |
| `apps/server/test/dm/narration-quality-repro.test.ts` | line 296: the no-roster line no longer holds the user id; assert the character id |
| `docs/wiki/dm-runtime.md`, `dm-narration-quality.md`, `dm-plan-gate.md`, `dm-failure-and-gates.md`, `INDEX.md`, `CAPSULES.md` | wiki phase |

No migration. No new runtime dependency. Any other test that pins the DM-side transcript text with a
user id is updated in Phase 1 to the character id.

## Relation to TASK-0269

TASK-0269 makes interpret emit Intents whose actor comes from the seat, so no model writes an actor
id. That retires D3 entirely and makes card AC #2 true. D1 survives: it is correct prompt hygiene
regardless. TASK-0269 should delete `seatActorIds` and its test case 1-2, keeping case 3. This spec
adds nothing TASK-0269 would duplicate.

## Constitution Check

Against `.specify/memory/constitution.md` 3.0.0.

- [x] **I. Agent-operable**: no new surface. A human's declaration reaches the same gate an agent's
      does. No Intent kind added.
- [x] **II. One Intent vocabulary**: no write path added. The model-written actor id is a pre-Intent
      bridge; TASK-0269 replaces it.
- [x] **III. Event sourcing, server authority**: no event change. The normalizer is deterministic
      server code before the gate; the gate still decides and appends nothing on refusal.
- [x] **IV. Data planes**: no new state. N/A.
- [x] **V. Many views, one state**: player-facing roster views unchanged. The DM view loses a user
      id it never needed.
- [x] **VI. Engine owns the numbers**: no mechanic change. N/A.
- [x] **VII. Narration around facts**: narration prompts unchanged. N/A.
- [x] **VIII. Campaign is data**: no content. N/A.
- [x] **IX. UX quality bar**: no UI. Removes a stall that spent a human's turn.
- [x] **X. Citations**: no library claim. N/A.
- [x] **XI. Operator-owned content**: no content. N/A.
- [x] **XII. Self-hostable**: no service. N/A.
- [x] **XIII. Just-in-time**: operator ruling 2026-11-09, R1 sweep. OQ1 named for the orchestrator.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Risks

- **Prompt drift.** The label change touches every interpret and director prompt. It removes
  information the model never needed. Fake-gateway tests are unaffected beyond the version strings.
- **Masking.** The normalizer could hide a recurrence. The `dm.interpret.seat-actor` log line keeps
  it visible in the debug view and the playtest watcher.
