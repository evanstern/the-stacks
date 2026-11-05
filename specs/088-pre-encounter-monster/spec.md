# Feature Specification: An encounter monster can be acted on before its encounter starts

**Feature Branch**: `task-0238-pre-encounter-monster`

**Created**: 2026-11-05

**Status**: Draft. Open questions OQ-1 to OQ-4 carry defaults (a); see Open questions.

**Input**: TASK-0238. Card outcome: "a seed encounter's monsters (goblin-2/3/4 in reed-camp) can be
targeted, opposed or talked to before the encounter starts, once the fiction puts them on screen:
they become present actors the plan gate can resolve and pull in." Evidence:
`docs/playtests/2026-11-03-runbook-b-playtest.md` (runbook B run 1, session 729a6c5c) findings 16
and 19. Merge condition (runbook B2): "a test replays seq 52-58 and seq 73-92 (same-beat encounter
start); the opposed check rolls."

`speckit-clarify` was skipped. The card, the run 1 log, specs 075, 078 and 084, and the runbook's
lane note settle what must happen. The open questions below are design calls with a safe default,
not card ambiguities.

## Background: what happens today

1. The reed-camp seed declares four encounter monsters: `snag` (also a seed NPC), `goblin-2`,
   `goblin-3` ("Goblin lookout") and `goblin-4`. Only `snag` is a seed NPC.
2. The actor snapshot (spec 040) holds party actors, seed NPCs and engine combatants. An encounter
   monster that is not a seed NPC has no actor until it is an engine combatant. It becomes one only
   when the Director starts its encounter (`directorOpening`, one `combatant.add` per monster).
3. Spec 078's Director `arrivals` field accepts only offstage seed NPCs. Spec 075's pull-in adds
   only a seed NPC (`pullIn` looks the id up in `seed.npcs`).
4. Run 1 seq 43-51: Kestrel's severe Perception failure put "the lookout by the fire" on screen.
   Seq 52-58: Odo parleyed with it. Interpret wrote a Persuasion check with
   `difficulty.opposedBy: "goblin-lookout"` (influence rule, spec 084). Interpret had no id to name:
   `goblin-3` was in no prompt section. The plan gate refused `UNKNOWN_COMBATANT`, field
   `difficulty.opposedBy`, reason `not-in-snapshot`.
5. Run 1 seq 73-92: Odo's second parley (a coin to the lookout) was refused the same way. The
   Director started `reed-camp` in that beat (seq 90). The plan gate already accepts the encounter's
   monster ids in that case: `joiningCombatants` puts them in the gate's `joining` list. So the
   refusal most likely came from interpret, which again could not see `goblin-3` and named an
   invented id. Phase 1 confirms this reading before any code changes (plan R2).
6. Seq 60 and seq 94: the narration voiced the parley failing and the coin landing, though the plan
   gate refused both actions and nothing ran. The fact line was
   `refused (refused: UNKNOWN_COMBATANT)`; the narrate prompt has no rule for a refused action.
7. A latent gap, found while specifying: `runnableEncounterIds` (Director legality) and
   `legalEscalation` (talk turns) call an encounter runnable only while none of its monsters is an
   engine combatant. A monster added before the fight would make its encounter unstartable.

## Terms

- **Encounter monster**: an entry in a seed encounter's `monsters`.
- **Run encounter**: a seed encounter that is active now, or one of whose monsters is in the order
  of an `encounter.started` ledger row.
- **Unseen monster**: an encounter monster of an encounter that has not run, whose `combatantId` is
  not an engine combatant and is not a seed NPC id.
- **Monster arrival**: an unseen monster id the Director reports in `arrivals`.
- **Arriving this beat**: the monster ids an interpret call may name although S0 lacks them: the
  beat's monster arrivals and the encounter-start joiners.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Parley with the lookout the DM revealed (Priority: P1)

The narration puts the goblin lookout on screen before the fight. Odo parleys with it. The Director
reports the lookout arrived, the lookout joins the scene as a combatant, and Odo's Persuasion check
rolls against it.

**Why this priority**: card AC #1 and AC #2, run 1 seq 52-58, and the merge condition.

**Independent Test**: replay run 1 seq 52-58 on a scripted DM. The Director reports
`arrivals: ["goblin-3"]` in free mode. Interpret writes a Persuasion check opposed by `goblin-3`,
rule `influence`. Assert a `combatant.added` row for `goblin-3` before the check's rows, a
`check.resolved` row with the opposition, the action `applied`, and no `UNKNOWN_COMBATANT` verdict.

**Acceptance Scenarios**:

1. **Given** free mode and `goblin-3` unseen, **When** the Director reports it in `arrivals`,
   **Then** resolve adds `goblin-3` from its SRD block with the seed name "Goblin lookout", as a
   Director opening move before the action groups, and logs no presence row for it.
2. **Given** the same beat, **When** interpret names `goblin-3` in `difficulty.opposedBy`,
   **Then** the plan gate passes the group and the engine rolls the opposed check.
3. **Given** the same beat, **When** interpret's prompt is built, **Then** it lists `goblin-3`
   "Goblin lookout" as arriving this beat.
4. **Given** the next beat, **When** the snapshot is built, **Then** `goblin-3` is a monster actor
   with `combatantId: "goblin-3"` (snapshot rule 4, unchanged).
5. **Given** no arrival (control), **When** interpret names `goblin-3`, **Then** the plan gate
   refuses `UNKNOWN_COMBATANT`, reason `not-in-snapshot`, as today.

---

### User Story 2 - Toss the coin as the fight starts (Priority: P1)

Odo tosses a coin to the lookout in the beat where the Director starts the reed-camp encounter. The
encounter starts, the lookout is in the order once, and Odo's opposed check rolls against it.

**Why this priority**: card AC #2 and its implementation note, run 1 seq 73-92, the merge condition.

**Independent Test**: the beat's Director moves to turn mode with `encounterId: "reed-camp"`.
Interpret names `goblin-3` as the opponent. Two variants: `goblin-3` unseen before the beat, and
`goblin-3` already arrived in an earlier free beat (Story 1 first).

**Acceptance Scenarios**:

1. **Given** `goblin-3` unseen, **When** the Director starts `reed-camp` in the parley's beat,
   **Then** interpret's prompt lists `goblin-3` as arriving, the encounter starts, and the opposed
   check rolls against `goblin-3` with no `UNKNOWN_COMBATANT` verdict.
2. **Given** `goblin-3` arrived in an earlier free beat, **When** the Director starts `reed-camp`,
   **Then** Director legality keeps the `turn` decision, resolve adds no second `goblin-3`
   combatant, and `goblin-3` is in the initiative order exactly once.
3. **Given** a run encounter, **When** the Director asks to start it again, **Then** legality
   refuses it as today ("the encounter is not a seed encounter that has yet to run").
4. **Given** the Director reports `goblin-3` in `arrivals` and starts `reed-camp` in one beat,
   **When** resolve runs, **Then** `goblin-3` is added once and joins the order once.

---

### User Story 3 - A refused action is not narrated as done (Priority: P1)

When the plan gate refuses an action, the narration never shows the attempt succeeding, failing or
landing. No roll was made and no result exists.

**Why this priority**: card AC #3, run 1 seq 60 and seq 94.

**Independent Test**: build the narration facts and the narrate prompt for a beat with one refused
action. Assert the fact line says the action did not happen, the system text forbids showing its
outcome, the action carries no follow-ups, and the fallback states no roll or result for it.

**Acceptance Scenarios**:

1. **Given** a plan-gate-refused action, **When** the facts render, **Then** its line reads
   refused, says nothing happened, and lists no roll, change or follow-up.
2. **Given** any narrate prompt, **When** it is built, **Then** the system text says a refused
   action did not happen and must not be shown succeeding, failing or landing.
3. **Given** the same facts, **When** the fallback renders, **Then** it says the character cannot
   do that and states no roll, outcome or change for the action.

### Edge Cases

- The Director reports `snag` and `goblin-3`: `snag` takes the seed NPC path (presence row, spec
  078); `goblin-3` takes the monster path (combatant add). No id takes both.
- The Director reports `goblin-3` while in turn mode: legality drops it (OQ-2 (a)).
- The Director reports a monster of a run encounter, or one already a combatant: legality drops it.
- A reclaim: a monster arrival is a keyed mechanics submission (`director:arrival:<id>`), so a row
  that landed before its checkpoint is found, not repeated.
- The Director misses the reveal: the refusal stays as today, and Story 3 keeps the narration honest
  (OQ-4 (a)).
- A free-mode monster arrival writes a public `combatant.added` row, so the facts carry
  "Event: Goblin lookout joins". The narration covers it as the lookout coming into view.
- A talk turn escalates into an encounter one of whose monsters already arrived: `legalEscalation`
  uses the run-encounter rule, so the escalation stays legal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (AC #1): Director legality MUST accept in `arrivals` an unseen monster id, in free mode
  only, in addition to the offstage seed NPCs of spec 078. It MUST drop any other id and record one
  `arrivals` override.
- **FR-002** (AC #1): The Director prompt MUST list the unseen monsters by id, name and encounter,
  and tell the Director to name one in `arrivals` when the transcript or the beat puts it on screen.
- **FR-003** (AC #1, #2): Resolve MUST add each monster arrival as an engine combatant from its SRD
  block and seed name, keyed `director:arrival:<id>`, before any action group. It MUST log no
  presence row for it.
- **FR-004** (AC #1, #2): The plan gate's `joining` input MUST include the beat's monster arrivals.
- **FR-005** (AC #1, #2): The interpret prompt MUST list every monster id arriving this beat with its
  name, so interpret can name it.
- **FR-006** (AC #2): An encounter MUST count as runnable until it has run, whether or not some of
  its monsters are already combatants. Director legality and `legalEscalation` MUST share the rule.
- **FR-007** (AC #2): An encounter start in the same beat as a monster arrival MUST add each monster
  once.
- **FR-008** (AC #3): A plan-gate-refused action's fact line MUST say the action did not happen, and
  the action MUST carry no follow-ups.
- **FR-009** (AC #3): The narrate system text MUST forbid showing a refused action succeed, fail or
  land.
- **FR-010** (merge condition): DB tests MUST replay run 1 seq 52-58 and seq 73-92 and assert that
  the opposed check rolls with no `UNKNOWN_COMBATANT` verdict.
- **FR-011**: The Director contract (`specs/031-dm-runtime/contracts/director.md`) MUST record the
  monster arrival rows.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): the change runs inside the DM turn job; no human-only path.
- **CR-004** (IV. Event sourcing): a monster arrival reaches the log only as a `combatant.add`
  mechanics submission from resolve. The Director writes nothing.
- **CR-005** (VI. Engine boundary): the opposed DC comes from the engine and the monster's SRD
  stats. The model names only an opponent and a rule.
- **CR-006** (VII. Structured first): a reveal is a typed Director field checked by code. A refused
  action is a typed outcome. No narration prose is parsed.

### Key Entities

- **Director `arrivals`**: unchanged shape; now also holds unseen monster ids.
- **Plan input `joining`**: unchanged shape; now also holds the beat's monster arrivals.
- **Run encounter**: derived from the projections and the ledger; no new state.

## Success Criteria *(mandatory)*

- **SC-001**: the seq 52-58 replay ends with the parley `applied`, one `check.resolved` row opposed
  by `goblin-3`, and zero `UNKNOWN_COMBATANT` verdicts.
- **SC-002**: both seq 73-92 variants end with the encounter started, `goblin-3` once in the order,
  the coin parley's check resolved, and zero `UNKNOWN_COMBATANT` verdicts.
- **SC-003**: every refused action in the facts tests renders "did not happen" and no follow-up.
- **SC-004**: the adjudicate, step-grammar, audit and chronicle prompt versions are unchanged.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 a revealed encounter monster is a snapshot actor interpret can name by its combatantId; test replays seq 52-58 | FR-001 to FR-005, FR-010; Story 1. The combatantId path, not a display-name map (OQ-1). |
| #2 acting on it before the encounter starts resolves (pull-in or encounter start per the Director), and the opposition check rolls; test | FR-003 to FR-007, FR-010; Stories 1 and 2 |
| #3 a refused action's outcome is not voiced as resolved; test | FR-008, FR-009; Story 3 |

## Open questions (operator)

- **OQ-1 — How an unseen monster becomes nameable.** (a) Extend spec 078's Director `arrivals` to
  unseen monsters. An arrival adds the monster as a combatant, so snapshot rule 4 holds it by
  combatantId from then on (recommended: reuses 078, no new snapshot rule, no prose parsing).
  (b) List every unseen monster in the snapshot as `absent` and flip it on arrival. Every prompt
  would then see hidden monsters, and the claim gate would refuse prose such as "the lookout turns"
  before the arrival lands. (c) A plan-gate display-name map. It guesses ids from words.
- **OQ-2 — Monster arrivals in turn mode.** (a) Legal only in free mode; dropped with an override
  otherwise (recommended: each seed holds one encounter, and a mid-fight arrival needs an
  initiative rule). (b) Also legal in turn mode, joining initiative. New card.
- **OQ-3 — A check on refused-attempt prose.** (a) Fact wording plus a narrate rule only
  (recommended: no prose parsing; the audit prompt is the TASK-0240 and TASK-0203 lane).
  (b) Also an audit rule or code check that refuses prose voicing a refused attempt. New card,
  after 0240 and 0203.
- **OQ-4 — The Director misses a reveal.** (a) No backstop. The refusal stays visible and Story 3
  keeps the narration honest (recommended). (b) The plan gate pulls in an unseen monster an action
  names. Interpret would need the unseen list, which shows hidden monsters to the reader. New card.

## Assumptions

- Specs 075, 078 and 084 are merged. TASK-0244, TASK-0242 and TASK-0203 merge before this task's
  implementation; Phase 1 checks the seams they move.
- This spec bumps the director, interpret and narrate prompt versions one past whatever `main` holds
  at implementation.
- No migration. No new dependency. Frozen contracts untouched.
