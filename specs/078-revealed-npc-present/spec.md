# Feature Specification: An NPC the DM reveals is present in the state

**Feature Branch**: `task-0206-revealed-npc-present`

**Created**: 2026-11-02

**Status**: Draft. Open questions OQ-1 to OQ-4 carry defaults (a); see Open questions.

**Input**: TASK-0206. Card outcome: "when the DM puts an NPC on screen, the state agrees. The NPC
becomes present, and an attack on a present hostile from the seed's encounter starts that
encounter (or pulls the NPC in), instead of being refused." Evidence:
`docs/playtests/2026-11-02-runbook-a-playtest.md` (run 1, session 9296c653) findings 5, 6, 9
and 10. Merge condition (runbook B): "a test replays run 1 seq 40 (reveal sets Snag and Pell
present)."

`speckit-clarify` was skipped. The card, the run 1 log and the merged spec 075 settle what must
happen. The open questions below are design calls with a safe default, not card ambiguities.

## Background: what happens today

1. The reed-camp seed (and the duo, trio and solo greyhollow seeds) declares Snag and Pell
   `absent` in the first beat. Scene start logs a `dm`-visibility `scene-presence.changed`
   row, reason `removed`, for each (run 1 seq 11–12; spec 050).
2. The only code paths that log an NPC `arrived` are the encounter-start seed-presence group
   (spec 050) and a `presence` effect a plan step writes (spec 048).
3. Run 1 seq 33–43: Tamsin's Perception check succeeded and the narration put Snag and Pell on
   screen (seq 40). Interpret wrote no `presence` effect, and the Director started no
   encounter. Both stayed logged `absent`.
4. Run 1 seq 45: Kestrel's "I take aim and shoot at Snag" was refused `UNKNOWN_COMBATANT`
   (`not-a-combatant`). Since spec 075 (TASK-0210, merged #112) the same state fails as
   `absent`. Spec 075's replay passes only because its script writes the `presence` effect that
   run 1 did not.
5. Run 1 seq 51: the chronicle saw "Snag (npc): gone" and "Pell Marsh (npc): gone" in its
   fiction-view state and wrote "Pell Marsh and Snag have since departed".
6. The Director runs before any dice. It cannot record a reveal that a roll in the same beat
   produces. It reads the recent transcript on the next turn, which already shows the reveal.
7. A latent gap, found while specifying: the plan gate's `arriving` list (spec 058) feeds only
   the claim diff. An encounter start marks Snag `arrived`, but the absent check still reads S0,
   so an attack on Snag in the same beat fails `absent`.

## What spec 075 already delivers for card AC #2

Spec 075 (OQ-1 (a)) delivers "joins initiative and resolves" in turn mode and "resolves" in free
mode, for a present NPC: the plan gate passes the attack, resolve pulls the NPC in, and the
engine resolves it. It does not make a revealed NPC present, so in run 1's state it refuses
`absent`. It never starts an encounter.

This spec narrows AC #2 as follows. Code does not start the seed encounter on an attack. Encounter
start stays the Director's `tableMode` decision (spec 075 OQ-1 (a), decision-0025 §4). Two reasons:
the seed carries no disposition, so code cannot tell a hostile from a captive (Pell is in the same
beat); and the Director already may start `reed-camp` in the beat that holds the attack, because
it decides from each beat item's first stage. This spec makes both branches work: the free-mode
pull (once AC #1 records the NPC present), and a same-beat encounter start (by closing gap 7). OQ-2
records the narrowing.

## Terms

- **Seed NPC**: an entry in the seed's `npcs`.
- **Offstage**: a seed NPC whose logged presence (`scenePresence`, no entry means `present`) is
  `absent`.
- **Reveal**: the transcript or the beat to resolve puts an offstage NPC on screen: seen, heard
  or met. A mention or an expectation is not a reveal.
- **Arrivals**: a new Director output field, the seed NPC ids the Director reports revealed.
- **Arriving ids**: the plan gate's `arriving` input: the encounter-start arrivals (spec 058)
  plus the Director's legal arrivals.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The NPC the DM revealed is in the scene (Priority: P1)

The narration reveals Snag and Pell at the reed camp. On the next turn the state shows both
present, the player sees that they arrived, and every NPC list includes them.

**Why this priority**: it is card AC #1 and the runbook merge condition. Every later failure in
finding 6 follows from the stale `absent`.

**Independent Test**: replay run 1 seq 33–45 on a scripted DM. Turn 1 is the Perception check
whose narration reveals Snag and Pell, with no `presence` effect (as in run 1). On turn 2 the
Director reports `arrivals: ["snag", "pell"]`. Assert one public `scene-presence.changed` row,
reason `arrived`, for each, before any action-group row.

**Acceptance Scenarios**:

1. **Given** Snag and Pell offstage after turn 1, **When** turn 2's Director reports both in
   `arrivals`, **Then** the log holds one public `arrived` row for each, written as Director
   opening moves before the action groups.
2. **Given** the same state, **When** the Director reports `wenna` (present) or `ghoul-9` (no
   seed NPC), **Then** legality drops the id, records an `arrivals` override, and logs nothing.
3. **Given** a `scene-start` trigger, **When** the Director reports arrivals, **Then** legality
   drops them all; scene start logs only the seed declaration.

---

### User Story 2 - Shoot the goblin the DM revealed (Priority: P1)

After the reveal, Kestrel shoots Snag. In free mode the attack pulls Snag in and resolves. If the
Director starts the reed-camp encounter in the same beat, the encounter starts and the attack
resolves inside it.

**Why this priority**: it is card AC #2, run 1 seq 45.

**Independent Test**: the turn 2 of Story 1, with Kestrel's attack on Snag in the beat. Two
variants: the Director stays in free mode, or it moves to turn mode with `encounterId:
"reed-camp"`.

**Acceptance Scenarios**:

1. **Given** Story 1's turn 2 in free mode, **When** Kestrel's attack on `snag` resolves,
   **Then** the verdict is `ok` with `pull: ["snag"]`, the `arrived` row precedes
   `combatant.added` for `snag`, which precedes `attack.resolved` with `targetId: "snag"`, and
   the action resolves `applied`.
2. **Given** the same turn, **When** the Director also moves to turn mode for `reed-camp`,
   **Then** the encounter starts, Snag and Pell each get exactly one `arrived` row, Snag is in
   the order once, the gate refuses no presence row, and the attack resolves `applied`.
3. **Given** the encounter-start variant with arrivals empty, **When** the encounter start marks
   Snag `arrived`, **Then** the same-beat attack on `snag` passes the plan gate (gap 7 closed).
4. **Given** no reveal (arrivals empty, free mode), **When** the attack names `snag`, **Then** it
   is still refused `UNKNOWN_COMBATANT`, reason `absent` (spec 075 control unchanged).

---

### User Story 3 - The chronicle never sends a revealed NPC away (Priority: P2)

The journal never says a revealed, present NPC departed, and never infers a departure from the
state alone.

**Why this priority**: card AC #3. It misleads the players' own record of the scene.

**Independent Test**: build the chronicle prompt from a state where Snag is offstage and the
transcript reveals him. Assert the state section has no line for Snag and the system text forbids
an untold departure.

**Acceptance Scenarios**:

1. **Given** Snag offstage, **When** the chronicle prompt is built, **Then** its state section
   lists no offstage actor.
2. **Given** Snag present after arrivals, **When** the chronicle prompt is built, **Then** its
   state section lists Snag as present.
3. **Given** any state, **When** the chronicle prompt is built, **Then** the system text says to
   write a departure only when the transcript tells it.

### Edge Cases

- A reveal and its check in the same beat: the Director runs before the roll, so the arrival
  lands on the next turn. A `presence` `arrived` effect on the check's `onSuccess` (spec 048)
  still records it in the same beat; this spec does not change interpret.
- The chronicle runs between the reveal turn and the next turn: Snag is still offstage, the
  state omits him, and the chronicle writes from the transcript, which shows him present.
- The Director reports an NPC the encounter start also marks: the arrivals group runs first, and
  the encounter-start group reads fresh projections and skips him. One row each.
- A yielded NPC in arrivals: dropped. Arrivals only bring back an offstage NPC.
- A hold beat: the opening moves run, so arrivals land.
- A talk turn: it runs no Director. A reveal inside a `react` reply is out of scope (OQ-3).
- A reclaim: each arrival is a keyed submission (`director:arrival:<npcId>`); `findLanded`
  covers a row that landed before its checkpoint.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (AC #1): The Director output MUST carry an optional `arrivals` list of at most 4
  seed NPC ids. An omitted list reads as empty.
- **FR-002** (AC #1): Director legality MUST drop every arrival that is not an offstage seed NPC,
  drop duplicates, drop all arrivals on `scene-start`, and record one `arrivals` override when it
  drops any.
- **FR-003** (AC #1): The Director prompt MUST list the offstage seed NPCs and tell the Director
  to name in `arrivals` each one the recent transcript or the beat to resolve puts on screen, and
  never one only mentioned or expected.
- **FR-004** (AC #1): Resolve MUST log one public `scene-presence` proposal, reason `arrived`,
  `actionId: null`, per legal arrival, as the first Director opening move after the scene-start
  branch, keyed `director:arrival:<npcId>`.
- **FR-005** (AC #2): The plan gate MUST receive the legal arrivals in `arriving`, together with
  the encounter-start arrivals, without duplicates.
- **FR-006** (AC #2): The plan gate MUST treat an arriving id as not absent in its absent check.
- **FR-007** (AC #2): The encounter-start seed-presence group MUST read projections loaded after
  the arrivals group, so it never proposes a presence row that does not change the value.
- **FR-008** (AC #2): Code MUST NOT start an encounter because of an attack. Encounter start
  stays the Director's `tableMode` decision.
- **FR-009** (AC #3): The chronicle prompt's state section MUST omit every actor that reads
  `absent`, and its system text MUST forbid writing a departure the transcript does not tell.
- **FR-010** (merge condition): A DB test MUST replay run 1 seq 40–45 and assert Stories 1 and 2.
- **FR-011**: The Director contract (`specs/031-dm-runtime/contracts/director.md`) and the 058
  plan-reason-gate contract MUST record the new field, its legality row and the arriving rule.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): the change runs inside the DM turn job; no human-only path.
- **CR-004** (IV. Event sourcing): arrivals reach the log only as `gate.submit` proposals from
  resolve. The Director writes nothing.
- **CR-006** (VII. Structured first): a reveal is a typed Director field checked by code, never
  parsed from narration prose.

### Key Entities

- **Director output**: gains optional `arrivals: npcId[]` (max 4).
- **Director override**: gains decision kind `arrivals`.
- **Plan input `arriving`**: unchanged shape; now also exempts its ids from the absent check.

## Success Criteria *(mandatory)*

- **SC-001**: the seq 40–45 replay ends with Snag and Pell present and Kestrel's shot `applied`,
  with zero `UNKNOWN_COMBATANT` refusals.
- **SC-002**: the encounter-start variant writes exactly one `arrived` row per NPC and no gate
  stop.
- **SC-003**: no chronicle prompt in the test suite shows an offstage actor in its state section.
- **SC-004**: the interpret, adjudicate, step-grammar and narrate prompt versions are unchanged.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 a Director or narration reveal records the NPC present; test replays seq 40 | FR-001 to FR-004, FR-010; Story 1 |
| #2 an attack on a present seed-encounter hostile starts that encounter or joins initiative, and resolves; test replays seq 45 | FR-005 to FR-008, FR-010; Story 2; narrowed per "What spec 075 already delivers" and OQ-2 |
| #3 the chronicle never calls a revealed, present NPC departed | FR-009; Story 3 |

## Open questions (operator)

- **OQ-1 — Where a reveal is detected.** (a) A structured Director field, `arrivals`, applied
  by code on the next Director call (recommended: code, not prose; the Director already reads the
  transcript and the seed; one field, one legality row). (b) A post-narration scan that logs
  `arrived` for an offstage NPC named or aliased in shipped narration. It records the reveal in
  the same turn, but it parses prose and would fire on a mention. (c) Both.
- **OQ-2 — Encounter start on an attack.** (a) No code start. The Director may start the
  encounter in the attack's beat, and this spec makes that path resolve (recommended: no
  disposition model exists; Pell shares the beat). (b) Code starts the NPC's seed encounter when
  a free-mode attack names a seed-encounter monster. That needs a hostility rule and belongs to a
  new card.
- **OQ-3 — Talk-turn reveals.** (a) Out of scope; a talk turn's `react` reply names only present
  NPCs (spec 065), and the next Director call can report an arrival (recommended). (b) Add
  `arrivals` to `react`. New card.
- **OQ-4 — Offstage actors in the narrate prompt.** The narrator's fiction view also renders an
  offstage NPC as "gone". (a) Leave narrate unchanged; the output claim gate already blocks an
  absent actor acting (recommended: narrate prompt work belongs to TASK-0113 and TASK-0205).
  (b) Apply the chronicle's omission to narrate too.

## Assumptions

- Spec 075 is merged (#112): the plan gate pulls a present non-combatant attack target.
- TASK-0113 (spine #3) merges before this task's implementation. It bumps `dm.director-v4` to
  `v5`. This spec bumps one version past whatever `main` holds at implementation.
- No knowledge ledger (TASK-0172). No migration. No new dependency. Frozen contracts untouched.
