# Feature Specification: Seat actor id

**Feature Branch**: `task-0302-seat-actor-id`

**Created**: 2026-11-09

**Status**: Draft

**Input**: TASK-0302. In the R1 baseline playtest (session `3406d9ae`, seq 117-124) the
`dm.interpret` reading set an attack step's `attackerId` to the player's user id
(`6ff0a0f1-073a-4b11-b31b-5a0ede04f613`), not `tamsin`. The plan gate refused the group
`STEP_ACTOR_MISMATCH` (reason `not-the-actor`). Four of Tamsin's five combat actions failed this
way (seq 118, 216, 271, 316); one resolved (seq 164). AI companion and monster turns were unaffected.
Evidence: `docs/playtests/2026-11-09-r1-baseline-playtest.md` (branch `origin/playtest-r1-baseline`,
finding 2).

Operator ruling 2026-11-09: fix it now, ahead of the Intent work. TASK-0269 (interpret emits
Intents; the seat supplies the actor) is the structural fix. This spec is the small bridge until it
lands. Authored against `.specify/templates/`. The spec number and branch were reserved, so the
skills' branch steps were skipped. `speckit-clarify` was skipped: the root cause is in code and the
card settles the behavior.

## Root cause

The interpret and director prompts show the model a user id as the actor of the human's action.

1. `apps/server/src/dm/prompts/interpret.ts` line 135 and `prompts/director.ts` line 82 call
   `transcriptEntries(assembled.transcriptTail)` with no roster.
2. With no roster, `speaker()` in `apps/server/src/dm/prompts/common.ts` (lines 122-138) returns the
   raw `actor`. A human's row actor is the user id (`ActorIdSchema`, `packages/session-model/src/ids.ts`).
   The declaration line therefore reads `[117] 6ff0a0f1-… declared act-…: I shoot the wounded
   goblin lookout on the rise`. `test/dm/narration-quality-repro.test.ts` line 296 asserts this form.
3. `beatEntries()` (`common.ts` lines 177-181) renders `by ${b.characterId ?? b.actor}`. A
   character-scope declaration always carries `characterId` (`ActionDeclaredV1` refine), so it
   shows `by tamsin`. A party-scope declaration has `characterId: null` and shows the user id.
4. The model sees two ids for one actor and sometimes copies the user id into `attackerId`.
   `CombatantIdSchema` (`^[a-z0-9][a-z0-9_.:-]{0,63}$`) accepts a lowercase UUID, so the schema
   passes it.
5. The plan gate compares against `PlanInput.actors`, built by `actionActors()`
   (`apps/server/src/dm/nodes/resolve.ts` lines 1389-1402): action id to the party member's
   `combatantId` (`tamsin`). `foreignActor()` (`dm/gates/plan-gate.ts` lines 488-510) sees
   `attackerId !== "tamsin"` and refuses.

Companions are unaffected because their actor is `ai:companion:<characterId>`, which names the
character. Monster turns name the monster id. The gate side is correct: it compares character
combatant ids. The leak is on the prompt side.

## Scope

- **In**: the interpret and director prompts render every human actor as the seated character id,
  never a user id (transcript lines and beat items). A deterministic seat normalizer after interpret
  maps a seated user id in a step's actor field to that member's combatant id. Prompt version bumps.
  One regression test file built from the session's real shape.
- **Out**: the companion prompt's comment lines (`prompts/companion.ts` line 131 renders `c.actor`);
  see OQ1. Effect target fields (`targetId`, `onHit` targets); see plan D3. Any Intent work
  (TASK-0269).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A human's attack on their own turn resolves (Priority: P1)

Tamsin's player declares "I shoot the wounded goblin lookout on the rise" on Tamsin's turn. The
attack resolves with `attackerId: "tamsin"`. The plan gate passes it.

**Why this priority**: the bug blocks combat for a human player on the solo seed.

**Independent Test**: the new regression test feeds a fixture reading whose `attackerId` is the
user id through the seat normalizer and `checkPlan`. The verdict is `ok`.

**Acceptance Scenarios**:

1. **Given** Tamsin is seated by user `6ff0a0f1-073a-4b11-b31b-5a0ede04f613` and the action's actor
   is `tamsin`, **When** interpret returns `attackerId: "6ff0a0f1-…"`, **Then** the reading reaching
   the plan gate names `attackerId: "tamsin"` and the verdict is `ok`.
2. **Given** the same beat, **When** the interpret and director prompts are built, **Then** neither
   prompt's user text contains the user id, and the declaration line names `tamsin`.

### User Story 2 - A party-scope action names a character, not a user (Priority: P2)

**Independent Test**: build the interpret prompt for a party-scope declaration by the same user.
The beat item reads `by tamsin`, not the user id.

### Edge Cases

- A user id that seats no party member (a spectator, or the human DM) renders as `a player` and is
  never rewritten by the normalizer. A step naming it is still refused by the gate.
- A user seating two characters: the label and the normalizer take the first party member that user
  controls (plan D2 `ponytail:` note).
- A resumed reading (spec 057) from a checkpoint written before this fix passes the normalizer too.
- `ai:dm` and `ai:companion:<id>` labels are unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The interpret and director prompts MUST render a human actor as the seated character
  id. Neither prompt's user text MAY contain a user id.
- **FR-002**: The DM-side transcript form MUST keep every entry it keeps today, including non-public
  rows. Only the actor label changes.
- **FR-003**: `beatEntries` MUST label a party-scope item with the declarer's seated character id.
- **FR-004**: After interpret, a step's actor field (`attackerId`, `casterId`, `helperId`, a `check`
  or `move` `combatantId`) that equals a party member's player user id MUST be replaced with that
  member's `combatantId` before the plan gate. Fresh and resumed readings both pass this step.
- **FR-005**: Each replacement MUST log one `dm.interpret.seat-actor` line (job id, action id,
  field). The log shows a recurrence.
- **FR-006**: The plan gate MUST stay unchanged. It never maps an alias.
- **FR-007**: `dm.interpret` MUST move to `v16` and `dm.director` to `v11`.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (II. One Intent vocabulary): this changes no write path. The structural fix, where the
  seat and not the model supplies the actor, is TASK-0269.
- **CR-002** (III. Server authority): the normalizer is deterministic code between model output and
  the gate. It writes nothing; the gate still decides.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 a human's attack on their own turn carries the character id, with a regression test from session 3406d9ae seq 117 | FR-001 to FR-004; US1; `seat-actor-id.test.ts` (plan) |
| #2 no model output may set an actor id; the seat supplies it | Not met here. Bypass note: TASK-0269 fixes it structurally (card dependency). FR-004 enforces it for seated user ids until then. |

## Success Criteria *(mandatory)*

- **SC-001**: the regression test passes: the seq-117 reading resolves as `tamsin` with verdict `ok`.
- **SC-002**: zero user ids in the interpret and director prompts for a beat with a human declarer.
- **SC-003**: the next hosted playtest shows zero `STEP_ACTOR_MISMATCH` refusals on a human's own turn.

## Assumptions

- The hosted prompt text of seq 117 was not inspected (it lives in the vm-104 database). The root
  cause follows from the code path above, and the playtest is consistent with it (1 of 5 succeeded,
  a stochastic copy).
- The playtest declared through the page composer, which defaults to character scope. Both scopes
  are fixed regardless.

## Open questions

- **OQ1 — companion prompt comment lines.** `prompts/companion.ts` line 131 renders a comment's
  `c.actor`, a user id for a human. It causes no refusal today. **Recommendation**: leave it to
  TASK-0299 (companion turns emit Intents). The orchestrator may card it.
