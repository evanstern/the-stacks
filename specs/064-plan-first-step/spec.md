# Feature Specification: Resolve only the first step of a plan declaration

**Feature Branch**: `task-0182-plan-first-step`

**Created**: 2026-10-29

**Status**: Draft. Open questions OQ-1 to OQ-7 await the operator; each has a recommended default (a).

**Input**: TASK-0182. "When a player declares a plan, a movement or approach, and conditional
follow-ups in one post, the DM resolves only the first step. It narrates the arrival and returns
the floor before any follow-up resolves." Evidence: two-browser alpha run 2 item 4
(`docs/playtests/2026-10-28-two-browser-alpha.md`), session `166b8e59`, action `act-197dae73`.

`speckit-clarify` was skipped. The code and the card settle what must happen. The open questions
below are operator judgment calls about player-facing behaviour, not ambiguities in the card.

## Decision records and rules this card implements

- **decision-0025 (D17)** §2.1: plot moves only through a recorded fact. A follow-up that assumes
  the approach worked is plot with no recorded fact behind it. This card stops it resolving in the
  approach's beat.
- **decision-0025 §2.5**: Director stage changes need a basis in state. This card holds the
  Director's stage changes in a beat whose plan was cut (OQ-3). It does not implement §2.5 in full;
  TASK-0145 owns that.
- **decision-0025 §3.4**: the output claim gate covers text that reaches narrate. Follow-up text
  reaches narrate under this card, so it passes the same check (FR-009).
- **decision-0026 (D18)**: not touched. No NPC attitude or knowledge moves here.
- **Spec 057** (resume a paused plan): a resumed reading keeps its follow-ups. No resume rule
  changes.
- **Spec 058** (roll reasons at the plan gate): unchanged. Cut steps never reach the plan gate,
  because the cut runs on the interpret and adjudicate outputs, before resolve.
- **TASK-0180** (talk reactions, decision-0016) runs next and edits the same Director and interpret
  prompts. This card adds one rule line to each prompt and one optional field to the reading. It
  takes none of TASK-0180's scope.

## Background: what happens today

1. One committed action is one beat item. The Director (`dm.director`) runs first and decides
   table mode, tracker advances and scene end from the declared text. It runs before any dice.
2. Interpret (`dm.interpret`) writes every step the post describes into one reading.
3. Resolve runs the Director's `turn` decision as an opening move (monsters join, initiative
   rolls, table mode flips), then every step of every action group, then the tracker advances.
4. Nothing marks a step as depending on an earlier one. A failed check does not stop later steps.

In run 2 one post held a plan (diplomacy, then force), an approach (Tamsin walks openly; Kestrel
and Odo follow hidden in the reeds) and a contingency (attack on Tamsin's signal). The Director
opened the reed-camp encounter and advanced `alarm` and `dusk` before the party arrived. Interpret
assumed Tamsin had already been hailed. No stealth check stood between the party and the camp.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The approach resolves alone (Priority: P1)

A player posts a plan with an approach and follow-ups. The DM resolves the approach only, with its
stealth or movement checks. The follow-ups do not roll and change nothing.

**Why this priority**: it is the card's core (AC #1, #3). Without it the approach cannot fail.

**Independent Test**: a scripted DM turn over the plan-approach-contingency fixture shows dice only
for the approach checks and no ledger row for any follow-up.

**Acceptance Scenarios**:

1. **Given** free mode and a post with an approach and conditional follow-ups, **When** the DM
   turn resolves, **Then** only the approach's steps run, including its stealth or movement checks.
2. **Given** interpret returned a persuasion check and an attack after the stealth checks, **When**
   the turn resolves, **Then** neither the persuasion check nor the attack rolls.
3. **Given** a post with one search over two places using the same skill, **When** the turn
   resolves, **Then** both checks run (a run of checks sharing kind, ability and skill is one stage).
4. **Given** turn mode, **When** a turn's steps chain (shove, then attack), **Then** nothing is cut
   (OQ-5).

### User Story 2 - The DM narrates the approach and returns the floor (Priority: P1)

The narration tells what the approach led to and stops before any follow-up. The players decide
the next step with the result in front of them.

**Why this priority**: AC #2. A follow-up resolved without the players' say removes their choice.

**Independent Test**: the narration facts for the fixture turn list the follow-ups as "not yet
attempted", and the narrate prompt tells the model not to show them.

**Acceptance Scenarios**:

1. **Given** a cut plan, **When** narrate runs, **Then** its facts carry each follow-up as not yet
   attempted and the prompt forbids showing it start.
2. **Given** the turn ends, **When** the players look at the table, **Then** the action shows as
   resolved and the floor is open for the next post.
3. **Given** a follow-up text that contradicts actor state, **When** narrate runs, **Then** that
   text is withheld from the facts.

### User Story 3 - Stage changes wait for resolved steps (Priority: P1)

The Director's table-mode and tracker decisions apply only for steps that resolved. An encounter
opens only after the approach has landed on the log.

**Why this priority**: AC #4. The run 2 encounter opened before the party arrived.

**Independent Test**: the fixture's scripted Director asks for turn mode and two tracker advances.
The turn writes no initiative, no monster, no table-mode row and no tracker row, and records the
held decisions as Director overrides.

**Acceptance Scenarios**:

1. **Given** a cut plan and a Director decision to start the reed-camp encounter, **When** the turn
   resolves, **Then** table mode stays free and no monster joins.
2. **Given** a cut plan and Director tracker advances, **When** the turn resolves, **Then** no
   tracker changes (OQ-3 (a)).
3. **Given** a beat with no cut plan, **When** the Director asks for turn mode or a tracker advance,
   **Then** it applies as today.

### User Story 4 - The fixture guards the behaviour (Priority: P2)

A test fixture built from the `act-197dae73` post covers the declaration end to end, with a
mutation guard.

**Why this priority**: AC #5. It keeps the behaviour from regressing.

**Independent Test**: stubbing the cut or the hold makes the fixture tests fail.

**Acceptance Scenarios**:

1. **Given** the fixture, **When** the cut is stubbed out, **Then** the fixture tests fail.
2. **Given** the fixture, **When** the stage hold is stubbed out, **Then** the table-mode and tracker
   assertions fail.

### Edge Cases

- The model writes no stealth check for the approach. Code cannot invent one. The prompt rule asks
  for it; alpha run 3 is the provider-mode evidence (Assumptions).
- The model writes follow-ups in `followUps` and no cut is needed. The hold still applies, because
  the reading has follow-ups.
- The plan has no check at all ("we walk to the camp and hail them"). Code cuts nothing. The prompt
  rule asks the model to put the hail in `followUps`.
- A reading needs adjudication. The ruling's steps take the same cut, and its cut reasons join the
  follow-ups.
- A reclaimed turn reuses the stored, already-cut readings and the already-held Director decision.
  Re-applying the hold adds no override.
- A resumed reading (spec 057) keeps its follow-ups, so the hold applies to the resumed beat too.
- A Director `hold` beat runs no interpret. The cut and the hold do not run.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In free mode, an action group resolves only its first stage. The first stage is every
  step up to and including the first run of `check` steps that share kind, ability and skill. Steps
  after that run are cut (OQ-4).
- **FR-002**: The cut applies to interpret readings and to adjudicate rulings, before the plan gate
  and resolve see them. The stored turn checkpoint records the cut result.
- **FR-003**: The reason of each cut step becomes a follow-up on the reading or ruling. A reading may
  also carry follow-ups the model wrote. Follow-ups are short text, deduplicated, at most six.
- **FR-004**: No follow-up rolls, writes a ledger row or changes state in the beat that cut it.
- **FR-005**: In a beat where any reading or ruling carries a follow-up, the Director's `turn`
  decision, tracker advances and scene end are held: they become `stay`, none and `continue`. Each
  held decision is recorded as a Director override (OQ-3).
- **FR-006**: In a beat with no follow-up, Director decisions apply as today.
- **FR-007**: The interpret prompt tells the model to plan only the first stage of a post, including
  the check for anyone moving hidden or over hard ground, and to list later stages as follow-ups.
- **FR-008**: The Director prompt tells the model to decide table mode and trackers from each beat
  item's first stage alone. A trigger or tracker that depends on a roll this beat waits for the next
  beat.
- **FR-009**: Narration facts carry each action's follow-ups as "not yet attempted". The narrate
  prompt forbids showing them start. A follow-up text that the claim gate refuses is withheld.
- **FR-010**: The action resolves (`action.resolved`) when its first stage resolves. Follow-ups do
  not keep it open. The player re-declares any follow-up (OQ-2).
- **FR-011**: Turn mode is unchanged: a turn's steps are not cut (OQ-5).
- **FR-012**: The interpret, Director and narrate prompt versions are bumped (OQ-6).

### Card acceptance criteria map

| Card AC | Requirements | Evidence |
|---|---|---|
| #1 Only the approach resolves in its first beat, with its stealth or movement checks | FR-001, FR-002, FR-007 | Fixture DB test: two stealth rolls, no other roll |
| #2 The DM narrates the approach and returns the floor before any follow-up resolves | FR-009, FR-010 | Facts test; narrate prompt test; script-mode live check |
| #3 A follow-up that assumes an earlier step succeeded never resolves in that step's beat | FR-001, FR-003, FR-004 | Unit tests on the cut; fixture DB test |
| #4 Trackers and table mode change only for steps that resolved | FR-005, FR-006, FR-008 | Fixture DB test: no initiative, no table-mode row, no tracker row; control beat |
| #5 A test or fixture covers a plan-approach-contingency declaration | all | `test/dm/scripts/plan-approach.json`, its DB test, the mutation guard |

### Key Entities

- **Follow-up**: a later stage of a declared plan, as short text. It lives on the reading or ruling in
  the turn checkpoint and in the narration facts. It is not an event and not a proposal.
- **Cut beat**: a beat in which any reading or ruling carries a follow-up.

## Open questions

Each has a recommended default (a).

- **OQ-1 — Where the split happens.**
  (a) Code cuts the interpret and adjudicate outputs in free mode (FR-001). The interpret prompt asks
  for the first stage only. The runner holds the Director's stage changes in a cut beat. Code
  enforces AC #3 and #4 even when the model ignores the prompt.
  (b) Prompt rules only. Smallest diff; AC #3 and #4 rest on model compliance.
  (c) A plan-gate rule that refuses a group mixing a step with a dependent follow-up. A refused group
  runs no step, so the approach would not resolve either. That fails AC #1.
  (d) The Director names the stage each beat item resolves. It runs before interpret and cannot see
  the steps.
- **OQ-2 — How follow-ups survive.**
  (a) Follow-ups ride the stored reading and the narration facts. The action resolves. The player
  re-declares the next stage with the result in hand.
  (b) The action stays open and the next DM turn plans the remaining steps through "Already
  applied". It continues without the players' say, touches the action lifecycle, and a reconcile
  turn would re-run it at every boot.
  (c) Drop follow-ups. Narrate then sees only the full post text and may show them happening.
- **OQ-3 — What the Director hold covers in a cut beat.**
  (a) `turn`, tracker advances and scene end. The next beat's Director decides them from the
  recorded result. A tracker advance that was due for the approach (a slow approach on `dusk`) waits
  one beat.
  (b) `turn` only. Trackers rest on the prompt rule until TASK-0145 AC #2 (tracker advances cite a
  recorded fact) lands.
  (c) No code hold; the prompt rule only.
- **OQ-4 — The cut rule.**
  (a) Keep every step through the first run of `check` steps sharing kind, ability and skill; cut the
  rest. A group stealth check stays whole. Two independent checks with different skills lose the
  second to a follow-up; the player re-declares it.
  (b) Cut after the first `check` step. It splits a group stealth check across beats.
  (c) Keep all checks; cut only attacks and effects after a check. A persuasion check that assumes
  arrival still rolls.
- **OQ-5 — Turn mode.**
  (a) Out of scope. A turn's own chain (shove, then attack) is legal 5e and stays. The orchestrator
  cards a revisit task, triggered by a playtest turn that resolves a step whose premise failed.
  (b) Extend the cut to turn mode. It breaks multi-step turns.
- **OQ-6 — Prompt versions.**
  (a) Bump `dm.interpret-v5`, `dm.director-v4` and `dm.narrate-v6`. Each prompt text changes, and the
  usage ledger keys calls by version.
  (b) Bump interpret and Director only, and leave narrate to the facts line alone. Narrate then has
  no rule for the new line.
- **OQ-7 — Hosted evidence.**
  (a) Rebuild the fixture from the playtest log. Run no vm-104 command.
  (b) The operator approves one read of the failed `act-197dae73` job checkpoint on vm-104. Its
  stored Director output becomes a recorded fixture beside the rebuilt one.

## Frozen-contract impact

- `docs/wiki/ws-protocol.md` frame shapes: none.
- `specs/029-proposal-gate/contracts/`: none. No new proposal kind, policy or refusal code.
- `specs/030-play-route/contracts/proposal-seam.md`: none.
- Amended additively: `specs/031-dm-runtime/contracts/nodes.md` (reading `followUps`, the
  first-stage cut), `director.md` (the cut-beat hold row), `node-seam.md` (the runner's stage-hold
  step), and `specs/034-narration-quality/contracts/narration-facts.md` (`FactAction.followUps`, the
  "not yet attempted" line).
- The session event catalog is unchanged. The checkpoint gains optional fields in `jobs.result`
  JSON; no migration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the fixture turn, 2 of 2 rolls are approach checks and 0 rolls belong to a follow-up.
- **SC-002**: In the fixture turn, 0 initiative rolls, 0 monsters joined, 0 table-mode rows and 0
  tracker rows are written.
- **SC-003**: A beat with no follow-up keeps 100% of its Director decisions (existing scripts pass
  unchanged).
- **SC-004**: Stubbing the cut or the hold fails at least one fixture test each; restoring leaves an
  empty diff.
- **SC-005**: In the script-mode live check, the table stays in free mode after the approach and the
  narration ends before any follow-up.

## Assumptions

- The model's compliance with the new prompt rules (writing the stealth check, using `followUps`) is
  not provable without a paid call. The fake gateway proves the code path. Alpha run 3 is the
  provider-mode evidence.
- A free-mode post rarely chains two independent checks with different skills. When it does, the
  second becomes a follow-up, which costs one extra post.
- The playtest's own turns failed at interpret on the `<think>` prefix (TASK-0181). The fixture's
  interpret reading is reconstructed from the log's description of what interpret assumed.
