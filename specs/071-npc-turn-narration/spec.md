# Feature Specification: NPC turn narration

**Feature Branch**: `task-0193-npc-turn-narration`

**Created**: 2026-11-02

**Status**: Draft

**Input**: TASK-0193. "On an NPC's turn the player reads what the NPC actually did, not a code
fallback like 'Snag makes a move. Kestrel moves next.'" Evidence: alpha run 3
(`docs/playtests/2026-11-01-two-browser-alpha-run-3.md`, findings 14 and 15, session `e8e8326d`,
seq 148–163).

`speckit-specify` ran as authoring guidance only: the spec dir was already claimed with a stub, so
its branch and directory steps were skipped. `speckit-clarify` was skipped: the card, the run 3 log
and the code settle every choice below. The remaining choices are open questions with a
recommended default (see the end).

## Background: what happens today

1. On a monster turn, interpret writes one reading with `actionId: null`. Its intent and step
   reasons say what the monster means to do. A talk or stance turn has no rolled step.
2. Resolve runs the reading's steps. The narration facts (`NarrationFacts.npcTurn`) carry only the
   monster's name, rolls and changes. The reading's intent and reasons never reach narrate, audit or
   the fallback.
3. The facts list `Monster turn: Snag` with nothing under it, then `Event: Kestrel acts next`.
   Nothing says whose turn this beat is. In run 3 the narrator wrote ahead of the turn once (the
   goblin by the fire acting on Odo's beat, refused as `invented-mechanics`). The auditor also
   refused correct prose once (Snag acting on Snag's turn, refused as `ledger-mismatch` because "the
   facts say it is Kestrel's turn").
4. After three refusals the code fallback ships. For a monster turn with no roll it says
   "<name> makes a move." That line tells the players nothing.
5. When the absence job passes an absent player's turn, the transcript shows only a floor line,
   "Tamsin's turn". Players read it as a skipped turn (finding 14).

## Answers to the card's questions

- **Q1. Does an NPC turn with no mechanical step still get a described action?** Yes. The facts
  carry the monster's planned action (intent and step reasons). The narrator shows it: talk,
  stance, movement or holding back. The fallback states it in plain words (FR-001 to FR-004).
- **Q2. Does the narrator see the next actor?** It sees it today, unmarked. Narrate v7 names the
  actor of this beat and marks the next actor as not yet acted, with a rule that forbids showing
  the next actor act (FR-005 to FR-007).
- **Q3. Does the fallback name what was resolved?** Yes, for the monster turn: it voices the
  planned action, or says the monster holds. Action sentences already name rolled outcomes
  (FR-003, FR-004).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A monster turn says what the monster did (Priority: P1)

Players in an encounter reach a goblin leader's turn. The leader makes no attack; he talks. The
transcript tells them what he said or did, even when the audit refused every narration attempt.

**Why this priority**: card AC #1 and #3, and the runbook merge condition.

**Independent Test**: a fake-gateway test replays run 3 seq 150–157. It runs narrate and audit on
Snag's no-roll turn with the turn passing to Kestrel. The shipped text describes Snag's action and
never holds "Snag makes a move".

**Acceptance Scenarios**:

1. **Given** a monster turn whose reading plans a talk with no rolled step, **When** narrate runs,
   **Then** the facts the model sees hold the monster's intent and planned action.
2. **Given** that turn and an audit that refuses all three attempts, **When** the fallback ships,
   **Then** it states the planned action in plain words, never "<name> makes a move".
3. **Given** a monster turn with no reading step and no usable reason, **When** the fallback
   ships, **Then** it says the monster holds, in fiction (for example "Snag holds back, watching.").
4. **Given** a monster turn with a rolled attack, **When** the fallback ships, **Then** it reads as
   today: the reason when usable, then the outcome sentence.

---

### User Story 2 - The narrator knows whose turn it is (Priority: P1)

The narrator writes one beat in turn mode. The facts name the actor of this beat and the actor
who is next. The narrator shows only this beat's actor acting. The auditor reads the same marking
and does not refuse a monster for acting on its own turn.

**Why this priority**: card AC #2, and the run 3 cause of both fallbacks.

**Independent Test**: build the narrate and audit prompts for run 3's Snag turn. Each names Snag
as acting now and Kestrel as next and not yet acted. The narrate rules forbid showing the next
actor act.

**Acceptance Scenarios**:

1. **Given** a beat in turn mode, **When** the narrate prompt is built, **Then** its facts hold one
   line naming this beat's actor and, when the turn advanced, one line naming the next actor as not
   yet acted.
2. **Given** the narrate rules, **When** the model reads them, **Then** one rule says the next
   actor has not acted and must not be shown acting.
3. **Given** the audit prompt for the same beat, **When** the auditor reads it, **Then** it holds
   the same turn lines and a rule that the turn's actor acts in this beat even with no roll.
4. **Given** a free-mode beat, **When** the prompt is built, **Then** no turn line appears.

---

### User Story 3 - A passed turn says why (Priority: P2)

A player's window closes on their turn. The absence job passes the turn on. The transcript says
the player is away and the turn passes, so nobody reads it as a skipped turn.

**Why this priority**: card implementation note (finding 14). Not an acceptance criterion; folded
into this task by the run 3 triage.

**Independent Test**: a web view-model test projects an absence pass. The floor line reads
"Kestrel is away; the turn passes to Tamsin." A turn advance after a resolved action keeps today's
"Tamsin's turn".

**Acceptance Scenarios**:

1. **Given** the AI DM ends an absent human's turn, **When** the transcript renders, **Then** the
   floor line names the absent character and the new turn holder.
2. **Given** the viewer holds the new turn, **When** the transcript renders, **Then** the line
   reads "Kestrel is away; your turn."
3. **Given** any other turn-mode change, **When** the transcript renders, **Then** the floor line is
   unchanged.

### Edge Cases

- The plan gate refuses the monster's plan: resolve runs no step. The facts still carry the
  planned action. The fallback says the monster holds; it never voices a refused plan.
- A reading reason fails the fallback filter (a digit, a system word, a claim the state refutes):
  the fallback skips it and uses the intent sentence instead.
- An adjudicated monster turn: the ruling's steps replace the reading's, as in resolve today. The
  facts use the ruling's step reasons.
- A monster turn awaiting a human DM: no `npcTurn` fact exists today. Unchanged.
- The turn advances to a party member: the next-actor line names them; the rule forbids deciding
  their action as well (it already forbids deciding a PC's choices).
- The encounter ends this beat: no turn-advanced event exists, so no next-actor line appears.
- A scene-start or talk turn: no turn lines.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The monster-turn narration fact MUST carry the reading's intent and the reasons of
  its planned steps (the ruling's steps when a ruling exists), capped in count and length.
- **FR-002**: The narrate prompt MUST render that intent and the planned action under the monster
  turn line, and MUST state that with no rules effect the monster still acts in the story.
- **FR-003**: The fallback MUST voice a usable planned-action reason for a monster turn with no
  rolled outcome. "Usable" is the existing roll-reason filter (no digit, no system word, no dice
  word, no death word, no refuted claim).
- **FR-004**: When no reason is usable, the fallback MUST state an intent sentence in fiction
  (talk, move, help, other) or that the monster holds. It MUST never ship "<name> makes a move".
- **FR-005**: In turn mode the narration facts MUST name this beat's actor: the monster on a
  monster turn, else the turn holder at the start of the beat.
- **FR-006**: The narrate and audit fact lines MUST mark the next actor (from the turn-advanced
  event) as next and not yet acted.
- **FR-007**: The narrate rules MUST forbid showing the next actor act. The prompt version MUST
  become `dm.narrate-v7`.
- **FR-008**: The audit rules MUST say the turn's actor acts in this beat even with no roll, and
  that showing the next actor act is a mismatch. The prompt version MUST become `dm.audit-v4`.
- **FR-009**: The fallback MUST still pass `deterministicChecks` by construction. The existing
  property test MUST cover a monster turn with a planned action.
- **FR-010**: A floor line for an absence pass MUST name the absent character and the new turn
  holder. Other floor lines MUST stay as today.
- **FR-011**: A fake-gateway test MUST replay run 3 seq 150–157 and assert the shipped text
  describes Snag's action, on both the passing-audit path and the all-refused fallback path.

### Key Entities

- **Monster turn fact** (`FactNpcTurn`): name, rolls, outcomes, changes; gains the planned intent
  and the planned step reasons.
- **Turn fact** (new, optional on `NarrationFacts`): this beat's actor name and the next actor's
  name, present only in turn mode.
- **Absence-pass floor line**: a transcript floor item whose text names the absent character.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the run 3 replay, 0 shipped narrations for Snag's turn hold "makes a move".
- **SC-002**: In the run 3 replay, the narrate and audit prompts each name Snag as acting and
  Kestrel as next; a prompt test pins both lines.
- **SC-003**: Every fallback built from the fallback property fixtures passes the deterministic
  checks (100%, as today), including monster turns with a planned action.
- **SC-004**: The absence-pass floor line names the absent character in the view-model test.

## Assumptions

- Run 3's raw rows are not in the repository. The replay fixture is reconstructed from the run 3
  log (finding 15) and the greyhollow-ford-duo seed (OQ-1).
- The reading's step reasons are the best available text for what the monster did. No interpret
  prompt change is needed (OQ-2).
- The fallback's per-roll reason sentence stays (spec 034). The repeated roll text on Odo's line is
  not changed here (OQ-3).
- No new runtime dependency, migration or frozen contract change.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 An NPC turn ships narration that states what that NPC did, or states that it held | US1, FR-001 to FR-004, FR-009 |
| #2 The narrator prompt marks the turn's actor and forbids narrating the next actor | US2, FR-005 to FR-008 |
| #3 A fake-gateway test replays run 3 seq 150–157 and ships a described Snag action | US1, FR-011, SC-001 |
| Note (finding 14): a floor pass says why | US3, FR-010, SC-004 |

## Open questions (each with a recommended default)

- **OQ-1. Replay source.** The raw run 3 rows live on vm-104, and any vm-104 command needs operator
  consent. **Default (a):** reconstruct a minimal fixture from the run 3 log and the duo seed, and
  name its source in the fixture. (b) The operator exports seq 140–163 from vm-104 and the fixture
  uses the real rows.
- **OQ-2. Interpret prompt.** The fix reads the reasons interpret already writes. **Default (a):**
  no interpret change; the intent sentence covers an empty plan. (b) Tell interpret to always write
  a `none` step whose reason says what the monster does. That edits `prompts/interpret.ts`, which
  lane A2 may touch.
- **OQ-3. Odo's repeated roll text.** The fallback voices a usable roll reason, and code appends
  the dice line holding the same reason. **Default (a):** no change in this task; the operator
  decides whether to card it. (b) Drop the reason sentence when a dice line follows.
- **OQ-4. Floor-pass line scope.** **Default (a):** include it here (US3), as the run 3 triage
  folded it in. (b) Move it to its own card after TASK-0191.
