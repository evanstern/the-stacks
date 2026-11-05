# Feature Specification: Reveal waits for the dice

**Feature Branch**: `task-0237-reveal-waits-for-dice`

**Created**: 2026-11-05

**Status**: Draft. Open questions OQ-1 to OQ-5 carry defaults (a); see Open questions.

**Input**: TASK-0237. Card outcome: "a reveal that depends on a check happens only when the
check's band allows it. The Director does not pre-decide an outcome the dice decide." Evidence:
runbook B playtest run 1 (`docs/playtests/2026-11-03-runbook-b-playtest.md`, session `729a6c5c`),
finding 12 (seq 43-51) and finding 17 (seq 63-72). Runbook:
`docs/design/m3-runbook-b2-playtest-fixes.md`, merge spine #6 (last of the fixes), lane note for
TASK-0237.

Authored against the Spec Kit templates in `.specify/templates/`. The spec dir was claimed with a
stub, so the skills' branch and directory steps do not apply. `speckit-clarify` was skipped: the
runbook lane note picks the AC #2 fix (both halves: arrivals that hang on a check wait for resolve,
and the goal note states no result), and the run 1 log plus specs 070, 078 and 080 settle the rest.
The open questions below are design calls with a safe default, not card ambiguities.

## Background: what happens today

1. The pipeline order is assemble, director, interpret, adjudicate, resolve, narrate, audit
   (`pipeline/runner.ts`). The Director runs before interpret and before any dice.
2. Spec 078 (TASK-0206) added `arrivals` to the Director output. Resolve submits each legal
   arrival as a public `scene-presence` `arrived` row, keyed `director:arrival:<npcId>`, as the
   first opening move, before any action group (`nodes/resolve.ts`, "arrivals (spec 078)"). The
   plan gate counts every arrival as arriving, so the NPC is not `absent` to it.
3. Spec 070 (TASK-0127) and spec 080 (TASK-0170) make each check declare `stakes` before the
   dice: `success`, `cost`, `failure`, `severe`, plus an optional `reveals` clue. Facts carry the
   applied band's text as `consequence`, and the clue text as `revealed` on a success band only.
4. Run 1 seq 43-51. Kestrel: "I look and listen across the reeds for anything moving." The
   Director set `arrivals: ["pell"]` and the goal note "Reward the scan with one true thing: Pell
   alive at the post". Interpret declared `stakes.success` "She spots Pell alive…" and
   `stakes.failure` "The reeds and dusk give up nothing clear". Kestrel rolled 3+3 = 6 vs DC 15, a
   severe failure. Seq 46 still set Pell present (the opening move ran before the roll). The prose
   told the severe outcome AND "Yet the reeds give one mercy first … Pell, alive". The audit
   passed it.
5. Run 1 seq 63-72. The goal note promised the leader clue ("who holds command here") before
   Kestrel's Perception (9 vs DC 15, severe failure). Attempt 2's prose delivered the clue. The
   model audit refused it (ledger-mismatch, actor Kestrel) and the fallback told the severe
   outcome. The backstop worked once; the goal note was the source both times.
6. The audit facts show the applied band's text only. On a failure band the auditor never sees
   the success text, so it cannot tell that the prose delivered it, except by inference.

## Scope

In scope: the Director's arrivals that a check this beat decides (AC #1, AC #2 second half), the
goal note on a beat whose check failed (AC #2 first half), and an audit check for a success outcome
delivered on a failure band (AC #3).

Unchanged: the declared outcomes of specs 070 and 080 (stakes, `reveals`, `consequence`,
`revealed`); the Director's `arrivals` field, its legality table and its unconditional path from
spec 078; the pipeline node order; the fallback; the interpret prompt.

## Terms

- **Arrival**: an id in the Director's legal `arrivals` (spec 078).
- **Stake texts**: a check step's `stakes.success`, `stakes.cost`, `stakes.failure` and
  `stakes.severe`.
- **Names**: a text names an NPC when it contains one of the NPC's snapshot aliases as a whole
  word, case-insensitive.
- **Dependent arrival**: an arrival that the stake texts of at least one check step in this beat's
  readings or rulings name. Every other arrival is an **unconditional arrival**.
- **Band texts**: the stake texts the applied band delivers, mirroring `effectsForBand`:
  `success` → success; `success-at-cost` → success, cost; `failure` → failure; `severe-failure` →
  failure, severe (severe falls back to failure). Any other band, or no band, has none.
- **Unmet success**: a check's `stakes.success` when its applied band is `failure` or
  `severe-failure`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An NPC the dice reveal arrives only when the dice allow it (Priority: P1)

**Why this priority**: card AC #1 and the runbook merge condition (replay seq 43-51, no Pell on a
severe failure).

**Independent Test**: replay seq 43-51 through the worker with scripted model calls and dice. The
Director names `pell` in arrivals; interpret declares a Perception check whose `stakes.success`
names Pell. With a severe-failure roll, no `arrived` row for Pell lands and Pell stays absent in
S1. With a success roll, one `arrived` row lands after the `check.resolved` row.

**Acceptance Scenarios**:

1. **Given** Pell offstage and a Director arrival `pell`, **When** this beat's check names Pell in
   `stakes.success` and lands `severe-failure`, **Then** no `scene-presence` row for Pell is
   written, and the S1 snapshot shows Pell `absent`.
2. **Given** the same state, **When** the check lands `success` or `success-at-cost`, **Then** one
   public `arrived` row for Pell lands after the check's rows and before the closing moves.
3. **Given** the same state, **When** the check's `stakes.failure` names Pell ("Pell cries out
   from the reeds") and the check lands `failure`, **Then** Pell arrives.
4. **Given** a Director arrival that no check this beat names (spec 078's transcript reveal),
   **When** the turn resolves, **Then** the arrival lands as the first opening move, as today.
5. **Given** a dependent arrival, **When** its check is refused by the plan gate or waits for a
   human DM, **Then** the arrival does not land this turn.

---

### User Story 2 - The goal note promises no result the dice decide (Priority: P1)

**Why this priority**: card AC #2. The goal note was the source in both run 1 cases.

**Independent Test**: the Director prompt carries the new rule (prompt test). The narrate inputs
for a beat whose check failed carry no goal note (pure test replaying seq 63-72).

**Acceptance Scenarios**:

1. **Given** the Director prompt, **Then** the `goalNote` shape text says it states no result a
   roll this beat could decide (no thing found, person reached or fact learned), and the arrivals
   rule says a dependent arrival is held for the dice.
2. **Given** a beat where any check landed `failure` or `severe-failure` and a non-empty goal note,
   **When** narrate builds its inputs, **Then** the goal note is withheld ("") and one advisory
   `doctrine` issue records it.
3. **Given** a beat where every check succeeded, or no check ran, **Then** the goal note reaches
   narrate unchanged (subject to the existing withholds of specs 051 and 085).

---

### User Story 3 - The audit flags a success outcome told on a failure band (Priority: P1)

**Why this priority**: card AC #3. Finding 12's prose passed the audit.

**Independent Test**: the reconstructed seq 43-51 prose fails the deterministic checks with a
`ledger-mismatch` and skips the `dm.audit` call. The audit prompt for seq 63-72 lists the unmet
success and the rule.

**Acceptance Scenarios**:

1. **Given** a severe-failure check whose unmet success names Pell, Pell absent in S1, **When** the
   prose names Pell outside a negated clause, a question or quoted speech, **Then** the
   deterministic checks add a blocking `ledger-mismatch` and the `dm.audit` call is skipped.
2. **Given** the same facts, **When** the prose says "no sign of Pell" or "Where is Pell?", **Then**
   no issue is added.
3. **Given** a failure-band check with an unmet success, **When** the audit prompt is built,
   **Then** it carries a "Success outcomes that did not happen" section with that text, and rule 7
   says delivering it is `ledger-mismatch`.
4. **Given** a success-band check, **Then** facts carry no unmet success and the section is absent.

---

### Edge Cases

- Two checks name the same NPC: the arrival lands when any landed check's band texts name it.
- The NPC is named in both the success and the failure texts: it lands on every rolled band.
- A Director arrival that the transcript already showed, and a check this beat also names it: it
  is dependent and follows the band. An NPC already present is not offstage, so spec 078's
  legality already drops it.
- A hold beat (no readings): every arrival is unconditional.
- A free retry with no roll lands `success`, so a dependent arrival lands.
- A reclaimed job: the held arrival keeps its key `director:arrival:<npcId>`; the band comes from
  the replayed submission.
- A reveal by description only ("a small figure at the post") does not name the NPC: the arrival is
  unconditional and the code check passes it. The model audit's rule 7 still sees the unmet
  success. Ceiling recorded in plan D1 and D6.
- A clue reveal (seq 63-72) names no actor: the code check does not apply; the goal-note withhold
  and the audit prompt carry it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Resolve MUST split the legal arrivals into dependent and unconditional arrivals before
  the opening moves, from this beat's check steps (readings and rulings) and the S0 snapshot
  aliases.
- **FR-002**: Unconditional arrivals MUST land as today (spec 078): first opening move, counted as
  arriving by the plan gate.
- **FR-003**: Dependent arrivals MUST NOT be counted as arriving by the plan gate and MUST NOT land
  in the opening moves.
- **FR-004**: After the action groups and the NPC group, before the closing moves, resolve MUST
  submit each dependent arrival whose NPC the band texts of at least one landed check submission
  name, with the spec 078 key and row shape.
- **FR-005**: A dependent arrival with no such check MUST be dropped and logged
  (`dm.arrival.held`, job id and NPC id). No ledger row is written for it.
- **FR-006**: The Director prompt's `goalNote` shape text MUST say the note states no result a roll
  this beat could decide. The arrivals rule MUST say a reveal the beat's own roll decides is held
  for the dice. The Director prompt version MUST bump.
- **FR-007**: The narrate node MUST withhold a non-empty goal note when any roll fact this beat has
  band `failure` or `severe-failure`, and record one advisory `doctrine` issue.
- **FR-008**: A roll fact MUST carry `unmetSuccess` (the declared `stakes.success`) on a `failure`
  or `severe-failure` band, and null otherwise.
- **FR-009**: A pure claim check MUST report each absent S1 actor that an unmet success names, its
  applied band texts do not name, and the prose names in a clause that is not negated, not a
  question and not quoted speech.
- **FR-010**: The audit node MUST add each FR-009 report as a blocking `ledger-mismatch` in the
  deterministic checks, so the `dm.audit` call is skipped.
- **FR-011**: The audit prompt MUST list each unmet success in its own section, and rule 7 MUST say
  that delivering it is `ledger-mismatch`. The audit prompt version MUST bump.
- **FR-012**: The declared-outcome behavior of specs 070 and 080 (`consequence`, `revealed`,
  `reveals`) and the spec 078 legality table MUST NOT change.

### Constitution-Driven Requirements *(mandatory)*

- **I. Agent-operable**: the DM pipeline is the agent; every rule is code or prompt text it reads.
- **IV. Event sourcing**: the arrival is still a typed `scene-presence` proposal through the gate.
  A dropped arrival writes nothing.
- **VI. Engine boundary**: the engine still owns the band; resolve reads it from the landed row.
- **VII. Structured first**: `unmetSuccess` is a typed fact; the checks are pure functions.

### Key Entities

- **Dependent arrival** (in-memory, resolve): an arrival id held until the action groups land.
- **`FactRoll.unmetSuccess`** (narration facts): the success text on a failed band.
- **`ClaimKind` `reveal`** (claims): a success outcome told on a failure band.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The seq 43-51 replay writes no Pell `arrived` row on a severe failure and one on a
  success.
- **SC-002**: The reconstructed seq 43-51 prose blocks deterministically with `ledger-mismatch`.
- **SC-003**: The seq 63-72 replay narrate inputs carry no goal note, and its audit prompt lists the
  unmet success.
- **SC-004**: `revealed-npc.integration.test.ts` (spec 078) passes unchanged.
- **SC-005**: At runbook B2's playtest, the "Failed reveal check" scenario keeps Pell unrevealed in
  prose and in the ledger on a failure band.

## Assumptions

- Interpret names the NPC in the stake texts when the check's stake is the NPC (true in run 1 and
  the shape spec 080 asks for). A check that reveals an NPC by description only is the ceiling.
- The S0 snapshot holds every seed NPC with its aliases, absent ones included (`snapshot/build.ts`).
- The merged changes of TASK-0244, 0238, 0203, 0240 and 0246 move seams in `nodes/resolve.ts`,
  `prompts/director.ts`, `prompts/audit.ts`, `nodes/audit.ts` and `claims.ts`. Phase 1 re-reads
  them before any edit.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 a reveal on a check happens only on a band whose outcome includes it; test replays seq 43-51 | FR-001 to FR-005; Story 1; plan D1-D3; tasks Phase 2 |
| #2 the goal note promises no dice result (prompt rule plus test), or dependent arrivals wait for resolve | both halves per the lane note: FR-006, FR-007 (Story 2, Phase 3) and FR-003, FR-004 (Story 1, Phase 2) |
| #3 the audit flags success prose on a failure band (ledger-mismatch), with a test | FR-008 to FR-011; Story 3; plan D5-D8; tasks Phase 4 |

Runbook merge condition: seq 43-51 (no Pell on a severe failure) is T011, T015 and T024; seq 63-72 is
T015 and T024.

## Open questions (each with a recommended default)

- **OQ-1 — How code tells that an arrival hangs on a check.** (a) *Default*: a check step this beat
  whose stake texts name the NPC by a snapshot alias. Deterministic, no model change, no interpret
  edit. (b) A new interpret field naming the NPC a check reveals. Exact, but a model and prompt
  change in `prompts/interpret.ts`, which 0238 also edits.
- **OQ-2 — Goal-note withhold scope.** (a) *Default*: withhold on any beat where a check landed
  `failure` or `severe-failure`. Correct by construction; costs a pacing hint on failed beats.
  (b) Withhold only when the note shares a word with the failed check's success text. Keeps more
  notes; lexical, so it misses paraphrase (seq 63-72's note paraphrased the clue).
- **OQ-3 — Narrate sees the unmet success.** (a) *Default*: no; only the audit prompt lists it. A
  "did not happen" line could prime the narrator. (b) Yes, as a "did not happen" fact line.
- **OQ-4 — Encounter monsters on the arrivals path.** If TASK-0238 routes revealed encounter
  monsters through `arrivals`, (a) *Default*: the same dependent rule applies to every arrival id.
  (b) Monsters stay unconditional. Settled at the Phase 1 seam check.
- **OQ-5 — Record of a held arrival.** (a) *Default*: a `dm.arrival.held` log event only. (b) A
  dm-visibility journal row, visible on the debug ledger.
