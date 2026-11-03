# Feature Specification: Combat audit pass rate

**Feature Branch**: `task-0214-combat-audit-pass-rate`

**Created**: 2026-11-03

**Status**: Draft

**Input**: TASK-0214. "Most narrations pass the audit on the first attempt, so turns are faster
and players read authored prose, not the fallback." Evidence: runbook A playtest run 1
(`docs/playtests/2026-11-02-runbook-a-playtest.md`, PR #109, session `9296c653`), findings 10, 11,
13, 15, 16, 19, 25 and 28. Runbook: `docs/design/m3-runbook-b-resolution-quality.md`, lane B1,
merge spine #19 (last).

Authored against the Spec Kit templates in `.specify/templates/`. The spec dir was claimed with a
stub, so the skills' branch and directory steps do not apply. `speckit-clarify` was skipped: the
run 1 log, the merged specs 070–083 and the code settle every choice below except the four open
questions at the end, which each carry a recommended default.

## Evidence limits

- The raw run 1 rows live on vm-104 and are not in the repo. Every replay here is rebuilt from the
  playtest log, the cards it filed and the seed `greyhollow-ford-reed-camp`, as specs 071 and 081
  and TASK-0212 did. OQ-1 asks whether to fetch the rows.
- The log names the refusal issues for seq 103 (finding 11) and for seq 126 and 131 (finding 16,
  TASK-0193 hosted note). For seq 161 and 196 it names only the fallback that shipped (findings 19
  and 25). Their refusal issues are rebuilt from the card's three families and marked "rebuilt".
- "seq 126" in specs/074 plan R2 is a different run (verify `192319Z`). It is not run 1 seq 126.

## Triage: what upstream already fixed

Main merged these since run 1 (runbook B execution log): 0113, 0209, 0205, 0206, 0208, 0127,
0170, 0212, 0207, 0213, 0104, 0105, 0211, 0171, 0204. Status: **FIXED** (a merged mechanism
removes the cause), **PARTLY** (a mechanism exists; a gap is left), **OPEN** (no mechanism).

### By run 1 refusal

| Seq | Turn (finding) | What refused or failed | Status | Mechanism or gap |
|---|---|---|---|---|
| 103 | Snag's NPC turn pulls Pell in (11) | Auditor dice-lines fail: Pell's pull-in initiative line missing from the fallback | FIXED by TASK-0213 | `facts.pulled` carries the joiner's roll; `renderDiceLines` prints it; narrate lists `Joined the fight: <name>` |
| 103 | same | `ledger-mismatch`: prose says "dies" with no dead actor | Correct block (spec 051) | `checkClaims` refused an invented death, as designed. No change here |
| 103 | same | `invented-mechanics`: Odo fires an arrow on Snag's turn | **OPEN** | Only the narrate Turn/Next line (spec 071) and audit rule 6 cover it, and both name only the Next actor. Narrate's "Every other character… Give them words, moves and reactions" invites it. No code check |
| 126 | Pell's talk turn (15, 16) | Three refusals; fallback "Pell Marsh speaks up" | PARTLY, by TASK-0207 | The `say` line now reaches narrate, audit and the fallback (`says:`). The refusals themselves (another actor acting; feelings) are the OPEN families below |
| 131 | Pot-helm goblin, step `none` (16) | Three refusals: the next actor or another NPC acts in this beat; NPC or companion feelings decided | **OPEN** | Same gap as seq 103. TASK-0193 hosted note: "3 refusals each for Pell (seq 126) and the pot-helm goblin (seq 131)" |
| 161 | Kestrel's free; goblin hit replaces it (19) | Fallback "Kestrel strikes home" (wrong subject); free parked; a later beat shows it done | FIXED by TASK-0208 | The plan holds a `move` step; the engine rolls the opportunity attack as a reaction; `STEP_ACTOR_MISMATCH` refuses a foreign actor; the fallback names the roller; open followUps ride into later beats as `Earlier beat, not yet attempted:` |
| 161 | same (rebuilt) | `invented-mechanics`: the prose shows the parked free as done | PARTLY | The prompt line "A not-yet-attempted step has not happened" and the `dm.audit` call cover it. No code check. OQ-2 |
| 196 | Pot-helm goblin drops Kestrel (25) | Fallback repeats "falls unconscious" | FIXED by TASK-0212 | One life-state sentence |
| 196 | same (rebuilt) | Refusals of the card's families: a companion's chosen feeling at the drop; the next actor acting | **OPEN** (next actor); correct block (companion) | The companion part blocks correctly (TASK-0113). The next-actor part is the seq 131 gap |

### By refusal family (the card's list)

| Family | Status | Mechanism or gap |
|---|---|---|
| Invented mechanics: the **Next** actor acts in this beat | **OPEN** | Prompt line and audit rule 6 only. No code check |
| Invented mechanics: **another** actor (NPC or companion) takes a turn action in this beat | **OPEN** | Narrate RULES invite "moves and reactions" for every other character. Audit rule 6 names only the Next actor, so the `dm.audit` call judges it unevenly. No fact names who is off turn |
| Invented mechanics: a followUp shown done | PARTLY | Spec 064 line (this beat) and TASK-0208 carry-over (later beats) give the narrator the fact. Detection is the `dm.audit` call only. OQ-2 |
| Player agency: a PC's feelings or reactions | FIXED by TASK-0113 | One agency rule in every prompt; reflex facts; two code checks. A real breach blocks, correctly |
| Player agency: a companion's feelings | FIXED by TASK-0113 (spec 074 OQ-3 default) | Companions are party members; a chosen feeling blocks, correctly. OQ-3 confirms the default |
| Player agency: an NPC's feelings | PARTLY | NPC feelings are the world's (audit rule 1); a `player-agency` issue about an NPC is advisory through the E2 filter (TASK-0106). Gap: the filter blocks when the issue detail names any party member, so "Snag sneers at Kestrel's pain" blocks though it is about Snag |
| Doctrine: "What do you do?" ending | FIXED by TASK-0204 (detection) | A code check blocks it. Gap: the narrate RULES never forbid it outside the opening, so each one now costs a regenerate |
| Doctrine: either-or question, option menu | FIXED before run 1 | `EITHER_OR_END` and `LIST_LINE` checks; the clarify question is exempt (spec 073) |
| Doctrine: a private goal-note phrase leaks ("two goblins down") | PARTLY, by spec 051 (before run 1) | `withholdRefusedInputs` blanks a goal note the snapshot refutes, and `checkClaims` refuses a wrong count in prose. Gap: a true count still reaches the narrator as a "Private note", and the phrase restates the seed's DM-only `encounters[].morale` ("When two goblins fall, Snag offers the clapper…"). The Director prompt does not forbid it |

### Refusal families added since run 1 (not in scope)

TASK-0127 and TASK-0170 added `ledger-mismatch` for a band or declared outcome the prose does not
deliver (audit-v7, v8). TASK-0211 added a slot-spend check. They can lower the pass rate. This
card does not change them. The AC #1 playtest names the family of every attempt-1 failure
(FR-012), so a regression shows by name.

## Scope

In scope: the OPEN and PARTLY rows above.

1. The turn rule: who may take a turn action in a turn-mode beat, as one fact line, one shared
   prompt rule and one code check.
2. NPC feelings: the audit names the character an issue is about; `player-agency` blocks only for
   a party member.
3. The stock ending: the narrate rules forbid it, and code drops it before the audit.
4. The goal-note leak: the Director writes no counts or DM-only conditions, and code withholds a
   goal note that states a count.
5. The AC #2 replay over seq 103, 126, 131, 161 and 196.

Out of scope: interpret, adjudicate, resolve, the fallback, the playtest auditor, the engine, and
a followUp-done code check (OQ-2).

## Rules this spec states

- **Turn actions.** In turn mode, a turn action is a strike, a cast, a shot, a throw or a
  charge. Only an **on-turn** actor takes one in the beat. On-turn actors are the Turn actor, every
  character with an Action in the facts, and every roller of a roll under an Action or the Monster
  turn (a reaction attacker included; a joiner's initiative roll does not count). Every other present, standing combatant is **off turn**. An off-turn
  character may speak, look, flinch, brace or call out. The **Next** actor takes no turn action
  either. The spec 071 prompt rule that the Next actor does not speak stays a prompt and audit
  rule; code does not check it, because a hit Next actor may cry out.
- **Feelings.** A party member's chosen feeling or reaction belongs to its player, AI companions
  included (spec 074 OQ-3 default). Only a listed reflex is shown. An NPC's or monster's feelings
  belong to the world: the narrator may give them, and the audit never blocks them.
- **Goal note.** The Director's note is pacing advice. It states no count, no morale condition and
  no encounter trigger.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Only the actor whose turn it is acts (Priority: P1)

Players fight in turn order. A monster takes its turn. The narration shows that monster act. The
next actor and every bystander may react or speak, but no one else attacks, shoots or charges.

**Why this priority**: the largest OPEN family (seq 103, 131, 196) and the card's first-named one.

**Independent Test**: unit tests over the facts and the code check, with no model call.

**Acceptance Scenarios**:

1. **Given** a turn-mode beat on Snag's turn with Odo, Pell and the goblins present, **When**
   facts are built, **Then** `turn.offTurn` lists every present, standing combatant except the
   on-turn actors, in encounter order. The Next actor is in the list unless it is on turn.
2. **Given** that beat, **When** the narrate prompt is built, **Then** it holds
   `Off turn: <names> (may speak, look or flinch; no strike, shot, cast, throw or charge).` after the Turn and Next lines.
3. **Given** prose "Odo fires an arrow at Snag." on Snag's turn, **When** `deterministicChecks`
   runs, **Then** it blocks with an `invented-mechanics` issue naming Brother Odo.
4. **Given** prose "The goblin with a pot-helm lunges at Kestrel." when that goblin is Next,
   **Then** the check blocks. **Given** "The goblin with a pot-helm moves next.", **Then** it
   passes (turn-order phrase).
5. **Given** a beat whose facts hold a reaction roll by the goblin, **When** the prose says the
   goblin strikes as Kestrel pulls away, **Then** the check passes (the roller is on turn).
6. **Given** prose where an off-turn NPC or the Next actor shouts or flinches, **Then** the check
   passes (speech is not a turn action).
7. **Given** a free-mode beat, **Then** the check does not run.

### User Story 2 - An NPC's feelings never block (Priority: P1)

The audit model flags "Snag sneers at Kestrel's pain". The issue is about Snag, not Kestrel. The
narration ships.

**Why this priority**: the card's "decides an NPC's feelings" family; it must stay consistent with
the TASK-0113 rule.

**Independent Test**: `audit.test.ts` with a scripted `dm.audit` reply.

**Acceptance Scenarios**:

1. **Given** a `player-agency` issue with `actor: "Snag"` whose detail names Kestrel, **Then** it
   is advisory.
2. **Given** a `player-agency` issue with `actor: "Brother Odo"` or `actor: "Odo"`, **Then** it
   blocks.
3. **Given** a `player-agency` issue with no `actor` (the old reply shape), **Then** today's E2
   detail filter decides, unchanged.

### User Story 3 - The stock ending costs no regenerate (Priority: P2)

The narrator ends a combat beat on "What do you do?". Code drops that sentence. The audit sees the
sentence before it as the ending.

**Independent Test**: `narrate.test.ts` over `narrateAttempt` with a scripted reply.

**Acceptance Scenarios**:

1. **Given** prose "The blade bites. Kestrel staggers. What do you do?", **Then** the attempt
   returns "The blade bites. Kestrel staggers.".
2. **Given** prose that is only "What do you do?", **Then** it is kept, and the TASK-0204 check
   still blocks it.
3. **Given** a beat whose prose ends on its clarify question, **Then** nothing is dropped.

### User Story 4 - The goal note leaks no count (Priority: P2)

The Director knows Snag's morale condition. Its note may say "press Snag toward a bargain". It may
not say "two goblins down". If it does, the narrator never sees the note.

**Independent Test**: `narrate.test.ts` over `withholdRefusedInputs`; `assemble.test.ts` over the
Director prompt text.

**Acceptance Scenarios**:

1. **Given** goal note "Two goblins down; Snag will bargain." with two goblins dead, **When**
   inputs are filtered, **Then** the note is blanked and an advisory names the count.
2. **Given** goal note "Keep the horn in view.", **Then** it passes unchanged.
3. **Given** the Director prompt, **Then** its `goalNote` shape text forbids counts, morale
   conditions and encounter triggers.

### User Story 5 - Run 1's refusals replay against the change (Priority: P1)

**Why this priority**: card AC #2.

**Independent Test**: `combat-audit-replay.test.ts`, fake gateway, no DB.

**Acceptance Scenarios**: one `describe` per seq, as plan.md "Replay" lists. Each rebuilds the
beat's facts and S1, asserts the next-version narrate prompt holds the turn rule and the Off turn
line, runs the refused (or rebuilt) prose through `deterministicChecks` and a scripted `dm.audit`,
and asserts each refusal's outcome under the change.

### Edge Cases

- A group noun names several actors ("the goblin" with three goblins): the unique-alias rule skips
  it. A `ponytail:` comment names the ceiling.
- An off-turn actor is down or absent: the claim gate already reports it. The turn check skips
  barred actors, so one sentence gives one issue.
- Quoted speech holds a turn verb ("Charge!" Pell shouts): quotes are masked, as in `checkClaims`.
- A negated act ("Odo does not fire"): the claim gate's negation rule applies.
- A group commit holds two party actions in one beat: both characters are on turn.
- The encounter starts this beat: facts carry no `turn`, so the check does not run.
- The goal note is blanked for a count: the narrator still gets the pacing tension.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In turn mode, `NarrationFacts.turn` MUST carry `offTurn: string[]`: the names of
  present, standing combatants in encounter order, minus the on-turn actors. The Next actor is
  listed unless it is on turn.
- **FR-002**: The narrate and audit fact lines MUST render `Off turn: …` after the Turn and Next
  lines when `offTurn` is not empty.
- **FR-003**: One exported rule text MUST state the turn-action rule. The narrate and audit
  prompts MUST both render it. It MUST replace narrate's "Every other character is part of the
  world. Give them words, moves and reactions." and its Turn/Next line, and audit rule 6.
- **FR-004**: `deterministicChecks` MUST block, as `invented-mechanics`, an `offTurn` actor named
  as the subject of a turn-action verb, outside quotes, negations and the turn-order phrase. An
  on-turn actor is never checked, even when it is also Next.
- **FR-005**: The `dm.audit` output MUST accept an optional `actor` per issue. A `player-agency`
  issue with `actor` MUST block only when `actor` names a party member. Without `actor`, the E2
  detail filter MUST decide.
- **FR-006**: The narrate RULES MUST forbid ending on "What do you do?".
- **FR-007**: `narrateAttempt` MUST drop a final "What do you do?" sentence (the "all" and "two"
  forms included) when another sentence precedes it.
- **FR-008**: `withholdRefusedInputs` MUST blank a goal note that holds a count claim, true or not,
  and record an advisory.
- **FR-009**: The Director's `goalNote` shape text MUST forbid counts, morale conditions and
  encounter triggers.
- **FR-010**: The narrate, audit and director prompt versions MUST each bump to the next version.
- **FR-011**: A fake-gateway test MUST replay run 1 seq 103, 126, 131, 161 and 196, rebuilt from
  the playtest log and named as rebuilt.
- **FR-012**: The AC #1 playtest MUST report attempt-1 passes over combat narrations as a count
  and a share, and name the family of each attempt-1 failure.
- **FR-013**: The fallback is not changed. The replay test MUST assert that each seq's fallback
  passes `deterministicChecks`, the turn check included.

### Key Entities

- **On-turn actor**: the Turn actor, an Action's character, or a roller of a roll under an Action
  or the Monster turn.
- **Off-turn actor**: any other present, standing combatant, the Next actor included.
- **Turn action**: a verb from `TURN_ACT_VERBS`, a new lemma list beside the claim gate's lexicons.
- **Audit issue `actor`**: the character an issue is about, or absent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a hosted run of 15 or more combat turns, at least 70% of combat narrations pass
  the audit on attempt 1 (card AC #1).
- **SC-002**: The replay test passes for all five seqs (card AC #2).
- **SC-003**: The existing fallback property test stays green, and each replayed fallback passes
  the turn check.

## Assumptions

- Prompt versions on main at authoring: narrate-v16, audit-v10, director-v6, interpret-v12.
  Interpret is not changed.
- `p.encounter.order` lists every combatant with its name in initiative order.
- Snapshot actor names equal fact names: both come from the engine combatant or party name.

## Card acceptance criteria map

| Card AC | Covered by | When it ticks |
|---|---|---|
| #1 Hosted run of 15+ combat turns, ≥70% attempt-1 pass | SC-001, FR-012; plan.md "Measuring AC #1" | At the runbook B playtest. Not at merge |
| #2 Replay-tested against run 1 seq 103, 126, 131, 161, 196 | US5, FR-011, SC-002 | At merge |

## Open questions (each with a recommended default)

- **OQ-1 — Raw run 1 rows.** The audit-flag journal rows for the five seqs live on vm-104. Reading
  them needs an announced vm-104 command and the operator's go. **Default (a):** rebuild from the
  log; no vm-104 command. (b) The orchestrator fetches the five journal rows through the debug
  route and adds them as a fixture before Phase 4.
- **OQ-2 — A followUp-done code check.** Detecting "the parked free shown done" needs verb-and-
  object matching against free text. **Default (a):** no check here; the orchestrator cards a
  revisit task with the trigger "the runbook B playtest shows a followUp shown done in an
  attempt-1 failure". (b) Build a lexical check now.
- **OQ-3 — Companions and feelings.** Spec 074 OQ-3 defaulted to "companions count as party
  members". No ruling is on record. **Default (a):** keep it; a companion's chosen feeling blocks.
  (b) Let the narrator give companions feelings, as for NPCs.
- **OQ-4 — The goal note in narrate.** **Default (a):** keep the note and withhold one that states
  a count (FR-008). (b) Stop sending the goal note to narrate at all; the pacing tension stays.
