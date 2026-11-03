# Feature Specification: Talk fallback voices the line

**Feature Branch**: `task-0207-talk-fallback-line`

**Created**: 2026-11-02

**Status**: Draft

**Input**: TASK-0207. "When an NPC's turn is talk and the narration falls back, the player still
reads what the NPC said (the planned line), not '<name> speaks up.'" Evidence: runbook A playtest
run 1 (`docs/playtests/2026-11-02-runbook-a-playtest.md`, PR #109, finding 15, session
`9296c653`, seq 124–127).

`speckit-specify` ran as authoring guidance only: the spec dir was already claimed with a stub, so
its branch and directory steps were skipped. `speckit-clarify` was skipped: the card, the run 1 log
and the code settle every choice below. The remaining choices are open questions with a
recommended default (see the end).

## Background: what happens today

1. On a monster turn, interpret writes one reading with `actionId: null`. A talk turn plans one
   `none` step. Its `reason` says what the monster does.
2. The reading has no field for the monster's words. In run 1, interpret put Pell's shout (the
   clapper is tied with a wet slip-knot; four goblins, two hidden left of the fire) in
   `followUps`. Its one `none` reason held a rules note: "Pell is grappled and can't act
   physically, but can shout a clue to the party with no roll needed."
3. `followUps` mean something else: later plan steps the first-stage cut held back (spec 064).
   The narration facts carry `followUps` only for player actions, so the NPC's words reached
   neither the narrator, nor the audit, nor the fallback.
4. The audit refused three narrations. The spec 071 fallback (`plannedSentence`) refused the reason
   (it holds "roll") and wrote the intent sentence: "Pell Marsh speaks up. Goblin with a pot-helm
   moves next." The players never heard the clue.

## Answers to the brief's questions

- **A dedicated field or `followUps`?** A dedicated `say` field on the interpret reading.
  `followUps` are held-back steps: narrate renders them as "not yet attempted", and the runner
  counts a non-empty list as a cut beat. Speech is not a deferred step (FR-001).
- **How does the fallback voice it?** As quoted speech, attributed:
  `<Name> calls out, "<line>"` (FR-004).
- **Guards?** The schema caps the line at 200 characters. The fallback runs the existing
  `reasonSpeakable` filter on it: digits are spelled, then the line is refused for a digit, a
  system word, a dice word, a death or unconscious word, a `?`, or a claim the state refutes.
  Quote marks inside the line are removed (FR-005).
- **PC talk too?** No. Only the monster turn. A player character's words are the player's own
  post; a fallback that voices them would speak for a player (spec 074 agency rule). Companions
  speak through their own job (FR-008).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A talking NPC's words survive the fallback (Priority: P1)

Players reach a captive NPC's turn in combat. The NPC shouts a clue. The audit refuses every
narration attempt. The fallback still shows the NPC's words, in quotes, attributed to the NPC.

**Why this priority**: card AC #1 and the runbook merge condition.

**Independent Test**: a fake-gateway test replays run 1 seq 124–126. Narrate runs on Pell's
talk turn, the audit refuses three times, and the shipped text holds Pell's planned words.

**Acceptance Scenarios**:

1. **Given** a monster turn with intent `talk`, a speakable `say` line and no roll, **When** the
   audit refuses every narration, **Then** the shipped text holds `<Name> calls out, "<line>"`
   and not `<Name> speaks up.`
2. **Given** the same turn whose `say` line fails the filter (for example it holds "roll"),
   **When** the fallback runs, **Then** it writes today's spec 071 sentence: the first speakable
   reason, else the intent sentence.
3. **Given** a talk turn with no `say` line, **When** the fallback runs, **Then** the output is
   unchanged from today.

### User Story 2 - The plan keeps the line apart from the rules note (Priority: P1)

Interpret writes the monster's spoken words in their own field. The step reason states the action
without rules notes.

**Why this priority**: card AC #2.

**Independent Test**: prompt and schema tests. The interpret prompt names `say` in its output
shape and rule paragraph. A reading with `say` parses, and a reading without it still parses.

**Acceptance Scenarios**:

1. **Given** the interpret prompt, **Then** its output shape holds `"say":str|null` and one rule:
   a monster that speaks this beat has its words in `say`, and no reason holds a rules note.
2. **Given** a reading without `say` (old scripts, old checkpoints), **When** it parses, **Then**
   it is accepted and read as no line.

### User Story 3 - The narrator sees the line (Priority: P2)

The narrator and the audit see the monster's planned words, so a passing narration can voice them
too.

**Why this priority**: run 1's narrator never saw the clue, so no narration could carry it.

**Independent Test**: the narrate prompt for the replay holds a `says:` line under
`Monster turn: Pell Marsh`.

**Acceptance Scenarios**:

1. **Given** a monster turn with a `say` line, **Then** the narrate and audit fact lines hold
   `  says: <line>` under the monster turn.

### Edge Cases

- A ruling replaces the monster's steps: the line still comes from the reading, as the intent does.
- The plan has a `say` line and no step: the monster is not held; the line is voiced.
- The plan gate refuses the monster's plan: the line is dropped and the monster holds.
- The line shows a down or dead actor acting: the claim gate refuses it in narrate's input filter
  and in the fallback filter; the fallback writes the spec 071 sentence.
- The line holds quote marks: the fallback removes them before it wraps the line.
- The monster turn has a rolled outcome: the roll sentences win, as today; the line reaches only
  the narrator.
- A `say` line on a player reading: it is ignored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The interpret reading MUST carry an optional `say` field: one line of at most 200
  characters, or null. It MUST NOT be a step field, so the shared step grammar is unchanged.
- **FR-002**: The interpret prompt MUST name `say` in its output shape and tell the model to put a
  speaking monster's words there, and to keep rules notes out of every reason.
- **FR-003**: The narration facts MUST carry the monster's line on its plan, or null when absent,
  refused by the plan gate, or withheld by the claim gate.
- **FR-004**: With no rolled outcome, the fallback MUST voice a speakable line as
  `<Name> calls out, "<line>"` before it tries the planned reasons.
- **FR-005**: The fallback MUST apply the existing `reasonSpeakable` filter to the line and remove
  quote marks from it. A line that fails gives today's spec 071 sentence.
- **FR-006**: A plan with a line and no step MUST NOT be marked held.
- **FR-007**: The narrate and audit fact lines MUST render the line under the monster turn.
- **FR-008**: The player action path MUST NOT voice a `say` line.
- **FR-009**: The fallback MUST still pass `deterministicChecks` by construction (property test).
- **FR-010**: A fake-gateway test MUST replay run 1 seq 124–126 and ship Pell's planned words.

### Key Entities

- **Interpret reading `say`**: the monster's spoken line this beat, or null.
- **`FactNpcPlan.say`**: the same line in the narration facts, after the gate and claim filters.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the run 1 replay, the shipped fallback holds Pell's words and never holds
  "Pell Marsh speaks up."
- **SC-002**: The fallback property test passes with `say` lines added to its generator.
- **SC-003**: Every existing fallback, facts and interpret test passes unchanged or with only
  version-pin updates.

## Assumptions

- The run 1 rows live on vm-104. The replay rebuilds the beat from the run 1 log (finding 15) and
  names that source, as spec 071 did (its OQ-1 (a)).
- Pell's exact words are not in the log. The fixture writes a line from the log's summary of the
  clue.
- No new runtime dependency, migration or frozen contract change.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 A talk NPC turn whose narration falls back ships the NPC's planned words in fiction, with a test replaying seq 124–126 | US1, US3, FR-003 to FR-007, FR-010, SC-001 |
| #2 The plan carries the NPC's line in a field the fallback can voice (not mixed with rules notes like 'no roll needed') | US2, FR-001, FR-002 |

## Open questions (each with a recommended default)

- **OQ-1. The narrator sees the line.** **Default (a):** render `says:` in the shared fact lines
  and bump narrate and audit to their next versions (US3). This adds `prompts/narrate.ts`,
  `prompts/audit.ts`, `facts.ts` and `nodes/narrate.ts` to the runbook's file list for 0207.
  (b) Fallback only; the narrator still never sees the line.
- **OQ-2. Questions in the line.** `reasonSpeakable` refuses any `?`. **Default (a):** keep it; a
  quoted question can trip the closing-question audit checks. (b) Allow `?` inside `say` only.
- **OQ-3. NPC `followUps` hold the beat.** The runner's `cutBeat` counts the NPC reading's
  `followUps`, so a Pell-style reading can hold the Director's mode, tracker and scene decisions.
  **Default (a):** not fixed here; the orchestrator cards it. The new prompt rule steers speech
  into `say`, which makes the case rarer. (b) Exclude `actionId: null` readings from `cutBeat` in
  this task (adds `pipeline/runner.ts`).
- **OQ-4. A reason beside the line.** **Default (a):** the line alone; a reason often restates it.
  (b) Voice the first speakable reason, then the line.
