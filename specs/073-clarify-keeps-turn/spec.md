# Feature Specification: Clarify keeps the turn

**Feature Branch**: `task-0209-clarify-keeps-turn`

**Created**: 2026-11-02

**Status**: Draft

**Input**: TASK-0209. "When interpret asks the player to clarify, the player sees the question and
keeps their turn until they answer." Evidence: runbook A playtest run 1
(`docs/playtests/2026-11-02-runbook-a-playtest.md`, finding 21, session `9296c653`, seq 172–182).

`speckit-specify` ran as authoring guidance only: the spec dir was already claimed with a stub, so
its branch and directory steps were skipped. `speckit-clarify` was skipped: the card, the run 1 log
and the code settle every choice below. The remaining choices are open questions with a
recommended default (see the end).

## Background: what happens today

1. Tamsin declared "I attack Pell" on her turn (turn mode, encounter active). Interpret returned a
   reading with no steps and `clarify: "Longsword in melee, or the light crossbow at range?"`.
2. Resolve (`dm/nodes/resolve.ts`, `actionGroupSteps` and `resolveAction`) ran no step and
   submitted `action.resolve` `no-effect`, as `specs/031-dm-runtime/contracts/resolve.md` says
   ("`clarify` set → submit `action.resolve` `no-effect`").
3. The turn advance group then counted that `no-effect` as "the active actor's action resolved" and
   ran `turn.advance` (seq 176). The turn passed to Pell. Tamsin lost her turn to a question.
4. The narrator voiced the question as written. The deterministic audit refused it as an option
   menu (`EITHER_OR_END` in `audit-words.ts`, check in `nodes/audit.ts`), three times.
5. The code fallback (`dm/fallback.ts`) shipped "Pell Marsh moves next. What does Tamsin Vale do?".
   It never voices the clarify question: the last row always says "What does <Name> do?". The
   player never saw the question.
6. The Director's closing moves (tracker advances, scene end) and an encounter start still run on a
   beat whose only action is a clarify. A clarify is not free today.

TASK-0205 (spine #5) makes interpret clarify instead of assuming a method. Every new clarify would
cost a turn under today's code. This task lands first (runbook B re-split R1) so a clarify costs
nothing.

## Answers to the brief's questions

- **Q1. What does "holds the turn" mean across floor modes?** In turn mode, a beat whose only
  resolved action for the active character is a human's clarify runs no turn advance group: no
  `turn.advance`, no settling, no `table-mode` row. The active actor keeps the floor. In free mode
  there is no turn to spend; "holds" means the Director's turn-entry, tracker and scene-end moves
  are held for that beat, as a cut beat holds them (specs/064). The floor rules are unchanged: the
  player can still End turn, the seated human DM can still Pass or Take the floor, and the absence
  job still passes an absent player's turn (`dm/floor.ts`, `turn-floor.md`).
- **Q2. What happens on the player's next submission?** The answer is a new declaration ("I swing
  my longsword"), committed as any action. The clarified action stays resolved `no-effect`, so no
  event shape changes. Interpret reads the answer beside the original declaration and the shipped
  question, both already in its Recent transcript section. No prompt change (OQ-1 (a)).
- **Q3. Must the audit allow a question-shaped ending when it is the clarify question?** Yes. The
  option-menu check skips a closing either-or question that is one of the beat's clarify questions.
  Any other either-or ending is still refused. Narrate v8 tells the narrator to end with the
  clarify question as written.
- **Q4. TASK-0205 makes interpret clarify more often.** A clarify costs nothing: no turn, no
  Director move, no die, no pull-in. The question reaches the player on both the narration and the
  fallback paths.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A clarify does not spend the turn (Priority: P1)

Tamsin declares an ambiguous attack on her turn. The DM asks which weapon. The turn stays with
Tamsin until she answers or ends her turn.

**Why this priority**: card AC #1 and the runbook B merge condition for TASK-0209.

**Independent Test**: a DB integration test replays run 1 seq 172–176. A clarify reading for
Tamsin's action resolves `no-effect`, and no `turn.advanced` or `table-mode.changed` row follows.
Tamsin's answer then resolves and the turn advances once.

**Acceptance Scenarios**:

1. **Given** turn mode with Tamsin active, **When** her committed action's reading has `clarify`
   set and no ruling, **Then** resolve submits `action.resolve` `no-effect` and no `turn.advance`.
   The encounter's active combatant is still Tamsin. Resolve queues no next job.
2. **Given** the held turn above, **When** Tamsin declares and commits her answer and it resolves
   with a step, **Then** the turn advances once, as today.
3. **Given** the held turn, **When** Tamsin ends her turn with the floor control, **Then** the turn
   passes as today.
4. **Given** a beat holding a human's clarify in free mode, **When** the Director asked to enter
   turn mode, advance a tracker or end the scene, **Then** those moves are held and recorded as
   overrides with reason "held: an action awaits an answer".

---

### User Story 2 - The player sees the question (Priority: P1)

The transcript shows the DM's question itself, whether the narration passed the audit or the
fallback shipped.

**Why this priority**: card AC #2.

**Independent Test**: unit tests over run 1 seq 172–176 facts. The fallback ends with "Longsword in
melee, or the light crossbow at range?" and holds no "moves next". A narration ending with that
question passes the deterministic checks; an unrelated either-or ending still fails.

**Acceptance Scenarios**:

1. **Given** facts with a clarify question that holds no digit, system word or dice word, **When**
   the fallback is built, **Then** its last sentence is that question.
2. **Given** a clarify question the fallback may not voice (a system word such as "roll"),
   **When** the fallback is built, **Then** it closes with "What does <Name> do?", as today.
3. **Given** facts with a clarify question, **When** the prose ends with that question (case and
   whitespace aside), **Then** the option-menu check does not fire.
4. **Given** facts with a clarify question, **When** the prose ends with a different either-or
   question, **Then** the option-menu check fires, as today.
5. **Given** the answer turn, **When** the interpret prompt is built, **Then** its Recent transcript
   section holds the original declaration and the narration ending with the question.

---

### Edge Cases

- **Companion clarify.** An AI companion cannot answer a question. Its clarify does not hold the
  turn; the turn advances as today (OQ-2 (a)). The question still reaches the transcript.
- **Monster turn.** The NPC group ignores `clarify` today and still does. Unchanged.
- **Mixed beat.** When the active character's beat holds a clarified item and an item that
  resolved with a step, the turn advances (the character acted).
- **A ruling replaces the reading.** `actionGroupSteps` returns `clarify: false` for a ruling. No
  hold. Unchanged.
- **Repeated clarify.** Each answer is a new action. Nothing caps the loop; End turn and the absence
  job bound it.
- **Reclaim.** The hold is derived from the checkpointed readings, so a reclaimed job decides the
  same way. A checkpoint that holds `advance` still replays the group, as today.
- **Human DM floor.** `floorHeld` already skips the advance. Unchanged.
- **Plan refusal.** A refused plan group is not a clarify. It still spends the turn, as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: One pure helper decides which beat items a clarify holds: a committed beat item whose
  actor is human (not `ai:`), whose reading has `clarify` set, and which has no ruling.
- **FR-002**: In turn mode, the turn advance group MUST NOT run when every active-character item
  that resolved this beat is held by FR-001. No `turn.advance`, no settling, no `table-mode` row.
- **FR-003**: A held beat MUST leave resolve's `nextJob` null in turn mode, so the active human
  keeps the floor.
- **FR-004**: When FR-001 holds any item, the runner MUST hold the Director's turn-entry, tracker
  and scene-end moves, recorded as overrides with reason "held: an action awaits an answer". The
  `free` decision is never held (as specs/064).
- **FR-005**: The fallback MUST close with each clarify question itself, digits spelled, when it
  holds no system, dice, death or unconscious word and passes the claim checker. Otherwise it
  closes with "What does <Name> do?".
- **FR-006**: The deterministic option-menu check MUST NOT fire when the closing either-or question
  is the tail of one of the beat's clarify questions (case, whitespace and quotes aside).
- **FR-007**: Narrate v8 MUST tell the narrator to end with the Unclear intent question as written,
  and MUST exempt that question from the either-or rule. Every other narrate rule is unchanged.
- **FR-008**: The answer MUST be an ordinary declaration. No event, proposal or frame shape
  changes. The clarified action stays `no-effect`.
- **FR-009**: The floor controls, the absence job and the stall job MUST behave as today.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): the hold is decided in code from the turn's readings; an agent
  seat answers through the same declare and commit proposals a human uses.
- **CR-004** (VI. 5e engine boundary): no mechanic changes. A clarify runs no engine command.

### Key Entities

- **Clarify hold**: the set of beat action ids FR-001 selects for one turn. Derived, not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The run 1 seq 172–176 replay writes zero `turn.advanced` rows after the clarify.
- **SC-002**: The run 1 seq 172–176 fallback text ends with the clarify question and holds no
  "moves next".
- **SC-003**: `pnpm ci:check` is green with the DB suites run (`REQUIRE_DATABASE=1`).

## Assumptions

- The raw run 1 rows live on vm-104. The replay rebuilds seq 172–176 from the playtest log and the
  `greyhollow-ford` seed, and names that source in the test header (as specs/071 OQ-1 (a)).
- `action.resolved` keeps outcome `no-effect` for a clarify. The outcome enum is a session-model
  event field read by the ws protocol; it stays unchanged.
- Whether an attack on a pulled captive is legal is TASK-0210, not this task.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 A clarify reading holds the turn (no turn.advance) until the player answers, with a test replaying seq 172–176 | US1, FR-001 to FR-004, Phase 1 (T004 replay test) |
| #2 The narration or fallback shows the clarify question itself, with a test | US2, FR-005 to FR-007, Phase 2 (T011 to T014) |

## Open questions (each with a recommended default)

- **OQ-1. Linking the answer to the question.** **Default (a):** no interpret change. The answer is
  a new declaration; Recent transcript already carries the original declaration and the question,
  and a prompt test pins that. (b) Add an interpret rule that reads an answer with the question it
  answers. That bumps `dm.interpret-v6` and collides with TASK-0113 and TASK-0205.
- **OQ-2. Companion clarify.** **Default (a):** a companion's clarify advances the turn as today;
  holding it would stall the turn with no job to answer. (b) Hold it and re-queue the companion
  job, with a loop cap.
- **OQ-3. Director moves on a clarify beat.** **Default (a):** hold turn-entry, tracker and
  scene-end moves (FR-004), so a clarify costs nothing. (b) Hold the turn advance only.
- **OQ-4. Footprint beyond the runbook overlap row.** The runbook lists `nodes/resolve.ts` and
  `fallback.ts`. AC #2 on the narration path also needs `prompts/narrate.ts` and `nodes/audit.ts`;
  FR-004 needs `pipeline/runner.ts` and `first-stage.ts`. TASK-0113 (spine #3) shares
  `prompts/narrate.ts` and `nodes/audit.ts`. **Default (a):** keep them here. 0209 merges first;
  0113 rebases and takes `dm.narrate-v9`. (b) Drop FR-006 and FR-007. AC #2 is then met by the
  fallback only, and the narration keeps its own-words question.
