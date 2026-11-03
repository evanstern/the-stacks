# Feature Specification: No undeclared method

**Feature Branch**: `task-0205-no-undeclared-method`

**Created**: 2026-11-02

**Status**: Draft. M3 runbook B, lane B1, spine #5.

**Input**: TASK-0205. "The DM resolves what the player declared. A method the player did not state
(stealth, force, a specific skill) is not assumed; the DM either asks or resolves the plain
action." Evidence: runbook A playtest run 1 (`docs/playtests/2026-11-02-runbook-a-playtest.md`,
PR #109, session `9296c653`), finding 4 (seq 24–30) and finding 14 (seq 114–122).

`speckit-specify` ran as authoring guidance only. The spec dir was claimed with a stub, so its
branch and directory steps were skipped. `speckit-clarify` was skipped: the card, run 1, spec 073
(merged) and spec 074 (TASK-0113, on its branch) settle the behaviour. The open questions at the end
are scope calls the card leaves open. Each has a default, and spec, plan and tasks are written
against each default.

## What neighbouring cards already settle

- **TASK-0209 (spec 073, merged #113).** A human's clarify holds the turn and spends no Director
  move. The player sees the question. Asking costs the player nothing.
- **TASK-0113 (spec 074, not merged).** It sets the shared agency rule (`AGENCY_RULE`,
  `agencyRule(node)` in `dm/doctrine/doctrine.ts`). Its phase 1 (commit `c7ef9e3f`) adds to the
  interpret prompt "when the method matters and is not stated, ask (clarify)". It adds to the
  Director prompt a goal-note line that names no undeclared act, method or skill. Spec 074 states
  that this card's AC #3 is delivered by 0113's AC #4 text and test. This card cites that test.
- **TASK-0128.** It owns opposition, Help and group checks (one roll or many for a party). This card
  never decides how many party members roll.

## Background: what happened in run 1

1. **Seq 24–30 (finding 4).** Tamsin's player committed "We move toward the reed camp until we see
   Goblins or they see us." The player never mentioned stealth. `dm.director-v4` wrote in its goal
   note "Approach beat: call Stealth (Kestrel leads, +5; Tamsin's mail and Wenna's boathook argue
   against quiet)". `dm.interpret-v5` followed it with one DEX (Stealth) check for Kestrel at
   disadvantage, DC 13, `1d20+5`, total 9, failure. Kestrel is a second human player's PC. The
   narration described sneaking and raised the alarm.
2. **Seq 114–122 (finding 14).** Tamsin: "I move towards Pell". It became an Athletics check
   (failure). The goal note kept "hidden goblins tracking her". The operator: "the result assumed
   stealth was still on … the stealth check failed so I had assumed we were out of stealth." The DM
   held an approach mode nobody declared.
3. Today no code compares a check's skill with the declaration, or a check's roller with the
   declaring player. The only defence is prompt text. Run 1 shows the model following the
   Director's note over it.

## Decision: a prompt line is not enough for AC #1

0113's interpret line asks the model to clarify. A replay on the fake gateway can only prove the
prompt holds that text. It cannot prove a model obeys it, and run 1 is a model that did not. So this
card adds a **deterministic rule in code**. After planning and before resolve, a reading whose step
picks a manner the declaration does not state is turned into a clarify. The replay then proves the
behaviour: fed run 1's exact reading, no Stealth check reaches the engine and the player is asked.

This card makes **no interpret or Director prompt change**, so it bumps no prompt version. The
prompt side is 0113's. Both rules live in `gates/plan-gate.ts` beside `checkPlan`, as the runbook
names. The runner applies them, because only a clarify (not a refusal) keeps the player's turn.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The DM asks before it picks a manner (Priority: P1)

A player declares an approach with no stated manner. The DM does not roll Stealth (or Deception, or
Intimidation) for them. It asks how they go, and the turn holds until they answer.

**Why this priority**: card AC #1 and the merge condition. The playtest's top theme was "the DM
decides for players".

**Independent Test**: a DB integration test replays run 1 seq 24–30 with run 1's goal note and
interpret reading on the fake gateway.

**Acceptance Scenarios**:

1. **Given** the `greyhollow-ford-duo` table in free mode and Tamsin's committed "We move toward the
   reed camp until we see Goblins or they see us.", **When** interpret returns run 1's reading (one
   DEX Stealth check for Kestrel, disadvantage, DC 13), **Then** no `check.resolved` row is written
   for the action, the action resolves `no-effect`, the stored reading has `steps: []` and a clarify
   question, and no `turn.advanced` row follows.
2. **Given** the same action, **When** the turn ships, **Then** the stored clarify is the code-written
   question "Are you trying to stay unseen, or moving openly?". The fallback voices it (spec 073).
3. **Given** Tamsin's answer "We sneak toward the camp." on the next turn, **When** interpret plans a
   Stealth check for Tamsin, **Then** the check runs.
4. **Given** run 1 seq 114, "I move towards Pell", **When** interpret plans an Athletics check,
   **Then** the check runs (Athletics is not a manner skill). **When** interpret plans a Stealth
   check instead, **Then** the DM asks.
5. **Given** an AI companion's action with an unstated manner, **When** interpret plans a Stealth
   check, **Then** the check runs (OQ-2 default).

### User Story 2 - One player's action never rolls for another human's character (Priority: P1)

A player declares for "we". The DM never rolls a check or an attack for a character a different
human plays. That player decides for their own character.

**Why this priority**: card AC #2. A roll for Kestrel from Tamsin's action spends Kestrel's
player's choice.

**Independent Test**: pure tests over the rule, plus a replay case with a stated manner.

**Acceptance Scenarios**:

1. **Given** Tamsin's character-scope "We sneak toward the reed camp.", **When** interpret plans a
   Stealth check for Kestrel (a human PC), **Then** the DM asks "Kestrel's player decides what
   Kestrel does. What do you do?" and runs no step of the action.
2. **Given** the same declaration, **When** interpret plans a Stealth check for Tamsin and one for
   Odo (an AI companion), **Then** both checks run.
3. **Given** a party-scope action (group sign-off, spec 044), **When** interpret plans a check for
   Kestrel, **Then** the check runs. Every present human approved the party action.
4. **Given** Tamsin's action, **When** interpret plans a saving throw for Kestrel (a trap Tamsin
   springs), **Then** the save runs. A save is not a volitional act.
5. **Given** Tamsin's action, **When** interpret plans a heal or damage effect on Kestrel, **Then**
   it runs. The rule covers who acts, not who is affected.
6. **Given** one human who controls two PCs, **When** that human's action rolls for either PC,
   **Then** the check runs.

### User Story 3 - The Director's note prescribes no skill (Priority: P2)

Delivered by TASK-0113 AC #4. This card adds no code for it. AC #3 ticks after 0113 merges, by
citing 0113's tests (see the mapping table).

### Edge Cases

- **Resumed plan** (spec 057): a human DM approved it. The rules skip it.
- **A ruling replaces the reading** (adjudicate): the rules check the ruling's steps. When they
  ask, the action's ruling is dropped, so spec 073's `clarifyHolds` holds the turn.
- **Free-mode cut** (spec 064): the rules run after the cut. A step cut to `followUps` never runs,
  so it is never checked.
- **Both rules fire** on one reading: the first failing step in step order sets the question.
- **NPC reading** (`actionId: null`): never checked.
- **Null roller** on a check or attack: the roller rule skips it. The manner rule still applies.
- **Repeated ask**: the answer is a new action (spec 073). If interpret again plans an unstated
  manner, the DM asks again. Nothing caps the loop, as in spec 073.
- **Negation** ("I don't sneak"): the cue matches and the check runs. Accepted lexical ceiling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Code MUST define a closed table of **manner skills**: `stealth`, `deception`,
  `intimidation`. Each row carries a cue pattern and one player-facing question.
- **FR-002**: An `ability-check` step whose `skill` is a manner skill MUST run only when the
  declaring action's text matches that skill's cue pattern.
- **FR-003**: When FR-002 fails for a human's action, the reading MUST become a clarify:
  `steps: []`, `followUps: []`, `clarify` set to the skill's question. The action's ruling MUST be
  removed.
- **FR-004**: The rules MUST run in the runner's post-planning step, after the free-mode cut and
  before `clarifyHolds`, so spec 073's hold applies to the new clarify unchanged.
- **FR-005**: FR-002 MUST NOT apply to an AI companion's action (OQ-2 default).
- **FR-006**: An `ability-check` step or an `attack` step from a character-scope action MUST name,
  as its roller (`combatantId` or `attackerId`), no party member whose controller is a human player
  other than the action's declarer.
- **FR-007**: When FR-006 fails, for any declarer, the reading MUST become a clarify as FR-003 says,
  with the question "<Name>'s player decides what <Name> does. What do you do?".
- **FR-008**: FR-006 MUST exempt a party-scope action, a saving throw, and every effect target.
- **FR-009**: The rules MUST be pure and deterministic. They MUST skip resumed action ids and the
  NPC reading. They MUST return a passing reading unchanged.
- **FR-010**: Each question MUST pass the fallback's speakable test (no digits, no system words), so
  the player sees it when narration falls back.
- **FR-011**: The runner's `dm.plan.cut` log line MUST report how many readings the rules turned
  into a clarify.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): the rules run inside the DM pipeline every turn. An agent
  playtest seat meets them through the same clarify a human sees.
- **CR-004** (VI. 5e engine boundary): the rules only remove steps before the engine runs. They
  compute no number and change no roll.

### Acceptance criteria mapping (card TASK-0205)

| Card AC | Requirements | Proof |
|---|---|---|
| #1 interpret adds no check whose method the declaration does not state or clearly imply; it asks instead; replay test | FR-001 to FR-005, FR-009 to FR-011 | US1 scenarios 1–5. Replay test case 1 (seq 24–30). Unit cases for seq 114. |
| #2 a check from one player's action rolls for that player's character, never another human's; test | FR-006 to FR-009 | US2 scenarios 1–6. Replay test case 2. |
| #3 the Director's goal note cannot prescribe a skill the player did not choose (prompt rule plus test) | delivered by TASK-0113 AC #4 | Spec 074 phase 1: `apps/server/test/dm/assemble.test.ts` (director rule and goal-note line) and `apps/server/test/dm/interpret-prompt.test.ts` ("holds the agency rule and labels the goal note as pacing advice"). Tick after 0113 merges. |
| Card note: approach mode persists after a failed check (seq 114–122) | FR-002 | Covered in part: no Stealth check runs without a stated manner, on any later action. The tracked hidden state is not covered (OQ-4). |

### Key Entities

- **Manner skill**: `{ skill, cues: RegExp, question: string }`. Three rows.
- **Asked record**: `{ actionId, stepIndex, rule: "manner" | "other-player", skill | name }`.
  Logged by the runner. Never stored as an event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The seq 24–30 replay writes zero `check.resolved` and zero `turn.advanced` rows after
  Tamsin's commit, and stores one clarify reading.
- **SC-002**: No check or attack from a character-scope action rolls for another human's PC in the
  replay or in any shipped DM script the suite runs.
- **SC-003**: `pnpm ci:check` is green with the DB suites run (`REQUIRE_DATABASE=1`).
- **SC-004**: At runbook B's playtest (hosted, checkpoint C6), an approach with no stated method
  resolves plain or asks. Observed in the "Undeclared method" scenario row, not gated here.

## Open questions (operator)

- **OQ-1 — Ask or refuse on another human's PC?** **Default (a):** ask (FR-007). The declarer keeps
  the turn and re-declares. No engine change. (b) Refuse the group in `checkPlan` with a new engine
  refusal code. The player then reads "cannot do that here" and, in turn mode, loses the turn.
- **OQ-2 — Does the manner rule apply to AI companions?** **Default (a):** no. A companion cannot
  answer a clarify (spec 073), so asking would void its action. The AI already chose for the
  character it plays. (b) Apply it to companions too. The companion's action resolves `no-effect`.
- **OQ-3 — Which skills are manners?** **Default (a):** `stealth`, `deception`, `intimidation`. Each
  is how a character presents itself, and the player picks it. (b) Stealth only, the run 1 evidence.
  (c) A cue row for every skill. That asks on plain task checks the DM may call: an Athletics check
  to cross mud, a Sleight of Hand check to untie a knot.
- **OQ-4 — Tracked hidden state.** The card note asks that "a failed stealth check ends the hidden
  state, and the hidden state is tracked, not assumed from goal-note prose". The engine has no
  hidden state. SRD 5.2.1's Hide action gives the Invisible condition and lists what ends it. That
  is engine work outside this card's footprint. **Default:** the orchestrator cards "Engine tracks
  Hide (SRD 5.2.1 Invisible from Hide); a failed Stealth check or a noisy act ends it; Director and
  narrate read the tracked state" for a later runbook (decision-0020: no "for now" without a card).

## Assumptions

- Run 1's raw rows live on vm-104. The replay rebuilds seq 24–30 from the playtest log on the
  `greyhollow-ford-duo` seed. That seed seats Tamsin and Kestrel as humans and Odo as a companion,
  the same seats as `greyhollow-ford-reed-camp`. The test header names the source, as spec 073 does.
- Run 1's seq 24 action was character scope. Finding 5 marks seq 33 "group commit"; finding 4 does
  not. The replay uses character scope.
- The fake gateway ignores prompt versions, so the replay does not depend on 0113's prompt bumps.
- No paid model run. No new runtime dependency. No migration. No event, proposal or frame shape
  changes.
