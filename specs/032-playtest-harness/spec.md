# Feature Specification: First Scene — scripted-dice playtest harness, auditor agent, milestone demo

**Feature Branch**: `task-0048-playtest`

**Created**: 2026-10-26

**Status**: Draft

**Input**: Board card TASK-0048 ("First Scene: scripted-dice playtest harness, auditor agent,
milestone demo"), M2 First Scene sweep, lane 5, the last card of milestone `m-2`. Grounding:
milestones.md M2 (the demo sentence), architecture A7 and A11, decision-0007 (provider-agnostic
gateway), decision-0020 (no unplanned "for now"), decision-0021 idea 6 (scripted-dice tests plus
playtests with an auditor agent), constitution 2.0.0, the DM runtime contracts in
`specs/031-dm-runtime/contracts/` (fake-gateway-script, doctrine, audit, dm-api, scene-seed,
purposes), the runbook `docs/design/m2-first-scene-sweep-runbook.md` (TASK-0048 lines and the
operator checkpoints).

**Clarify pass**: skipped. Every point the card leaves open is settled by an existing artifact:
the script format by `fake-gateway-script.md` ("binding for TASK-0048"), the doctrine pairs by
`doctrine.md`, the audit-record fields the demo reads by `audit.md`, the paid-run checkpoint and
the demo roles by the runbook, the provider-agnostic purpose rule by decision-0007. Defaults
for the remaining choices are under Assumptions; choices the operator may revisit are under
Open Questions, each with the default this spec builds.

## Context

The DM runtime (TASK-0046) plays a scene: it answers committed actions, rolls through the
engine, narrates from facts, and audits each narration before it ships. The play route
(TASK-0047) seats a human at the table. Nothing yet proves that a whole scene **plays well and
plays honestly**: that the story never contradicts the dice, that hidden things stay hidden,
and that the DM follows its doctrine across a full scene, not one turn.

This feature adds three things and runs one event:

1. **The playtest harness.** It plays a whole scene without a human at the keyboard. A
   **scenario** scripts the human seat's moves; the AI companions and the AI DM play as
   themselves; the dice are scripted or seeded. The harness saves the session's **transcript**
   and **roll ledger** to a **run directory**.
2. **The auditor agent.** A model call, under its own named gateway purpose, reads the
   transcript beside the ledger and the doctrine's right/wrong pairs, and writes a **report**
   of **findings**. Code checks run first and need no model.
3. **Two modes.** CI runs the harness and the auditor against the fake gateway adapter: no
   network, no cost, same result every run. On demand, an operator runs them against a
   configured provider, after an estimate and with a spend ceiling.
4. **The M2 milestone demo.** The operator plays the human seat in the browser; AI companions
   and the AI DM play "The Bell at Greyhollow Ford" through exploration, the social beat and the
   fight to its end. The auditor reports on that session. A committed **demo record** lists every
   audit failure and how it was resolved, with the report attached.

The harness's evidence also feeds TASK-0055 (the parked combat rules). This feature only
produces that evidence; it changes no combat rule.

The "users" are: the **CI pipeline** (runs the scripted playtest on every push), the
**operator** (runs paid playtests on demand, plays the demo, signs the demo record), the
**orchestrator** (drives the demo with the operator and writes the record), and the **TASK-0055
evaluator** (reads transcripts, ledgers and reports as evidence).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A whole scene plays itself and leaves its evidence (Priority: P1)

A developer runs one command. The harness creates an isolated session, starts the Greyhollow
Ford scene, and plays the human seat from a scenario: search the ferry-house, talk Wenna round,
advance on the reed camp, then strike whenever it is the human's turn in the fight. The AI
companions and the AI DM answer through the real DM runtime, the real gate and the real engine.
When the scene ends, the run directory holds the transcript, the ledger, the DM job records,
the usage records and a run manifest.

**Why this priority**: Without a full-scene run there is nothing to audit and no evidence. It
is AC #1 and the base of every other story.

**Independent Test**: Run the harness in CI mode against a database. Check that the scene
ended, that every committed action resolved, and that the run directory holds every artifact
with the expected row and roll counts.

**Acceptance Scenarios**:

1. **Given** a migrated database and the Greyhollow Ford scenario in CI mode, **When** the
   harness runs, **Then** the scene reaches its end through exploration, the social beat and
   the fight, and the run outcome is `ended`.
2. **Given** a finished run, **When** the run directory is read, **Then** it holds the
   transcript (every row of the session, in sequence order, DM view), the roll ledger, the DM
   job records with their audit records, the usage records and the run manifest.
3. **Given** CI mode, **When** the run ends, **Then** every scripted die face and every scripted
   DM response (chronicle passes excepted) was consumed, and the ledger's rolled faces equal the
   script's dice in order.
4. **Given** a scenario whose human moves run out before the scene ends, **When** the move cap
   is reached, **Then** the harness stops, records the outcome `stalled`, and still saves every
   artifact.
5. **Given** a DM turn job that fails, **When** the harness sees the failure, **Then** it stops,
   records the outcome `failed` with the job id, and still saves every artifact.

---

### User Story 2 - An auditor checks the transcript against the ledger and the doctrine (Priority: P1)

After a run, the auditor reads the transcript in segments, one per narration. For each segment
it runs code checks against the ledger (dice lines, digits in prose, life states, roll reasons,
hidden information), then asks the auditor model whether the narration and the companions' talk
agree with the ledger and follow the doctrine's right/wrong pairs. It writes a report: a verdict,
one finding per problem with the rows it cites, the DM runtime's own audit flags, and fight
statistics.

**Why this priority**: The milestone's promise is that "the narration never contradicts the
ledger" and that the auditor's report is attached. It is AC #2.

**Independent Test**: Audit a saved transcript that holds one planted contradiction (a dice line
that disagrees with the ledger, and prose that says a character fell when no row says so).
Check that the report's verdict is `fail` and that each planted problem is one finding citing the
right rows. Audit the clean CI run and check the verdict is `pass`.

**Acceptance Scenarios**:

1. **Given** a clean CI run, **When** the auditor runs in CI mode, **Then** the report verdict is
   `pass`, every narration is one audited segment, and the report lists the DM runtime's audit
   flags from the job records.
2. **Given** a transcript with a dice line that disagrees with the ledger, **When** the auditor
   runs, **Then** a code check reports a `ledger-contradiction` finding with severity `fail`,
   citing the narration row and the ledger rows, without a model call.
3. **Given** an auditor model answer that reports a doctrine breach, **When** the report is
   written, **Then** the finding carries the doctrine pair id, severity `warn`, and the cited
   rows.
4. **Given** an auditor model answer that is not valid against the output schema, **When** the
   segment is audited, **Then** the segment records an auditor error, the report verdict is
   `incomplete`, and no finding is invented.
5. **Given** any audit, **When** the report is written, **Then** it holds no secret, no API key,
   and no prompt text; it holds the narration and talk text it judged, because that text is
   already in the transcript.

---

### User Story 3 - CI runs free; a paid run is explicit and capped (Priority: P1)

CI runs the harness and the auditor against the fake gateway adapter on every push, inside the
existing test run. An operator runs the same harness against a configured provider by choosing
provider mode. Before any paid call, the harness prints an estimate (calls, tokens and dollars
per purpose) and stops unless the operator passed a spend ceiling. During the run, the harness
counts spend after every call and refuses further calls once the ceiling is reached.

**Why this priority**: AC #3, and the runbook's paid-run checkpoint. A harness that can spend
money by accident is not shippable.

**Independent Test**: Run provider mode with no spend ceiling and check that it prints the
estimate, makes no model call, and exits with the "spend not confirmed" code. Run it with the
`CI` environment variable set and check that it refuses. Run it against a priced fake provider
with a tiny ceiling and check that it stops with the outcome `budget-stopped`.

**Acceptance Scenarios**:

1. **Given** the CI pipeline, **When** `pnpm ci:check` runs with a database, **Then** the
   scripted playtest and its audit run against the fake adapter and must pass.
2. **Given** provider mode without a spend ceiling, **When** the operator runs the harness,
   **Then** it prints the estimate and exits without a model call.
3. **Given** provider mode with a purpose that has no configured model, or a model with no price,
   **When** the operator runs the harness, **Then** it refuses before any call and names the
   missing purpose or price.
4. **Given** provider mode and the `CI` environment variable set, **When** the harness runs,
   **Then** it refuses before any call.
5. **Given** provider mode with a spend ceiling, **When** the counted spend reaches the ceiling,
   **Then** every further model call fails as cancelled, the run stops with the outcome
   `budget-stopped`, and every artifact is still saved.

---

### User Story 4 - The operator plays the M2 demo (Priority: P2)

The orchestrator brings up the worktree stack with the operator's provider configuration. The
operator signs in at the play route in Brave and takes Tamsin's seat. The scene starts through
the DM route. The AI DM, Brother Odo and Kestrel play with the operator through exploration, the
social beat and the fight to the scene's end. The engine rolls every die.

**Why this priority**: AC #4 and the milestone's demo. It depends on stories 1 to 3 being merged
in the branch and green.

**Independent Test**: The demo record names the session id. Exporting that session shows a
scene-start row, at least one exploration check, a social exchange with Wenna, a fight that
enters and leaves turn mode, and a final scene-end row. Every committed action by the operator's
user id is resolved.

**Acceptance Scenarios**:

1. **Given** the worktree stack and an operator-approved provider configuration, **When** the
   operator plays, **Then** the session reaches the scene's end through all three beat kinds.
2. **Given** the demo session, **When** it is exported, **Then** every roll in the ledger came
   from the engine and every narration's dice lines match the ledger.

---

### User Story 5 - The demo record lists every audit failure and its resolution (Priority: P2)

After the demo, the orchestrator runs the auditor on the demo session and on the paid scripted
playtest. The demo record, committed in the repo, names both sessions, attaches both reports and
artifact sets, and lists every finding and every DM-runtime audit flag with a resolution: fixed
(with the commit), carded (with the task id), accepted or false positive (each with the
operator's reason).

**Why this priority**: AC #5 and the runbook's merge condition: the M2 demo has run and its
record is committed.

**Independent Test**: Count the findings and flags in the attached reports. Count the rows in
the record's failure table. The counts match, and no row lacks a resolution.

**Acceptance Scenarios**:

1. **Given** a report with findings, **When** the record is written, **Then** each finding id
   and each DM-runtime audit flag appears once in the record's failure table with a resolution.
2. **Given** a finding resolved as carded, **When** the record is committed, **Then** the card
   exists on the board, and a failed demo criterion's card blocks M2 close (runbook).

### Edge Cases

- **A model makes the DM ask a clarifying question.** The scenario's next move answers it as a
  normal action; the move cap still bounds the run.
- **The fight lasts longer than expected.** The human's combat move repeats on every turn the
  human is active, up to the move cap; the run then ends `stalled` and the report's fight
  statistics show the length (TASK-0055 evidence).
- **The human character drops to zero hit points.** The engine runs death saves; the scenario's
  combat move still commits on the human's turn (the engine refuses illegal acts; a refusal is
  recorded, not retried).
- **A gate refusal of a scripted move.** The harness records the refusal code in the run
  manifest and moves to the next move.
- **The app server's DM worker on the same database.** The harness runs in its own playtest
  database, so another worker cannot claim its jobs.
- **Two harness runs at once on one stack.** The second run refuses while the playtest database
  has another connection.
- **The auditor model is the same model as the narrator.** The report warns about it; it does
  not refuse.
- **An empty or missing ledger** (a session that never started). The auditor reports the verdict
  `incomplete` with one finding, `no-scene`.
- **A segment longer than the auditor's input cap.** Rows are truncated oldest first, the
  narration and its own turn's rows are never cut, and the segment records the truncation.
- **The provider stops mid-scene** (rate limit, outage). The DM runtime's own retries and
  fallback apply; a failed turn ends the run `failed`; the artifacts are saved.

## Requirements *(mandatory)*

### Functional Requirements

**Harness (AC #1)**

- **FR-001**: The harness MUST play one scene from a scenario document. The scenario names the
  seed, the human seat, the human's ordered free-mode moves, the human's combat move, a move cap
  and the dice source.
- **FR-002**: The harness MUST drive the human seat through the gate's request path as that
  seat's user (the same path the WebSocket gateway uses), and MUST start the scene with the DM
  runtime's scene-start trigger.
- **FR-003**: The harness MUST run the real DM runtime (worker, enqueuer, pipeline, companions,
  chronicle), the real gate and the real engine. It MUST NOT stub any node.
- **FR-004**: The harness MUST choose each next human move from the projections: the next
  free-mode move while the table is free, the combat move when the table is in turn mode and the
  human is the active combatant, and nothing while the scene is waiting on other actors.
- **FR-005**: The harness MUST stop when the scene ends, when the move cap is reached, when a DM
  job fails, when the spend ceiling is reached, or when a wall-clock limit passes. It MUST record
  which one as the run outcome: `ended`, `stalled`, `failed`, `budget-stopped` or `timed-out`.
- **FR-006**: The harness MUST use scripted dice in CI mode (the DM script's faces) and, in
  provider mode, the scenario's scripted faces first and then a seeded generator whose seed it
  records. No model may supply a number.
- **FR-007**: The harness MUST save, in the run directory: the transcript (every session row,
  DM view, sequence order), the roll ledger, a readable transcript of what a player saw, the DM
  job records, the usage records (no prompt or completion text), and a run manifest.
- **FR-008**: The harness MUST run in its own database, derived from the stack's database URL,
  recreated and migrated per run, on a loopback host only.
- **FR-009**: The harness MUST export a live session's transcript, ledger and DM job records from
  a named database without writing to it (the demo session).

**Auditor (AC #2)**

- **FR-010**: The auditor MUST split a transcript into segments, one per DM narration row, each
  holding the rows since the previous narration; trailing rows after the last narration form a
  tail segment when they hold any talk.
- **FR-011**: The auditor MUST run code checks per segment, with no model call: narration prose
  holds no digit; the narration's dice lines equal the lines rendered from the segment's ledger
  rows; prose naming a fall, a death or unconsciousness matches a recorded life-state change and
  every recorded one is told; every ledger roll carries a reason; no public row holds a
  DM-only secret from the seed or a secret tracker's name.
- **FR-012**: The auditor MUST call the model through the gateway under the purpose
  `playtest.audit`, once per segment, with the segment's rows, the seed's DM-only secrets, and
  every doctrine right/wrong pair. It MUST tell the model that the ledger rows are true and the
  narration and companion talk are on trial.
- **FR-013**: The auditor MUST validate the model's answer against a fixed output schema. An
  invalid answer or a failed call MUST make that segment's result an error and the report's
  verdict `incomplete`; it MUST NOT be retried more than once.
- **FR-014**: The auditor MUST write a report as data and as readable text. The report holds the
  verdict (`pass`, `fail` or `incomplete`), every finding with a stable id, its source (code
  check, auditor model, or DM-runtime audit flag), kind, severity, doctrine pair id when one
  applies, cited row sequence numbers and a detail line; fight statistics; the model per
  purpose; and the auditor's usage.
- **FR-015**: The verdict MUST be `fail` when any finding has severity `fail`. Kinds
  `ledger-contradiction`, `invented-mechanics`, `hidden-info-leak` and `player-agency` are
  `fail`; `doctrine` and `other` are `warn`; DM-runtime audit flags are `note`.
- **FR-016**: The auditor MUST list every DM job audit record with `flagged: true`, its `final`
  value and its job id, as a `note` finding.
- **FR-017**: The auditor MUST run without a model when asked (code checks only), and MUST record
  that the model pass was skipped.
- **FR-018**: The auditor prompt module MUST carry the doctrine's MIT notice sentence in its
  header, and the doctrine guard test MUST cover it.

**Modes and cost (AC #3)**

- **FR-019**: CI mode MUST answer every DM purpose from the existing DM script format and loader,
  unchanged, and MUST answer `playtest.audit` from a separate auditor script, both through the
  fake adapter in strict mode.
- **FR-020**: A database integration test MUST run the CI-mode playtest and its audit inside
  `pnpm test`, so `pnpm ci:check` and the CI workflow run it with `REQUIRE_DATABASE=1`.
- **FR-021**: Provider mode MUST be chosen explicitly. It MUST refuse when the `CI` environment
  variable is set, when any DM purpose or `playtest.audit` lacks a configured model, or when any
  used model lacks a price.
- **FR-022**: Before any provider call, the harness MUST print an estimate per purpose (expected
  and upper-bound calls, input and output tokens, dollars) and a total. Without a spend ceiling it
  MUST exit with a distinct code and make no call.
- **FR-023**: With a spend ceiling, the harness MUST refuse to start when the upper-bound estimate
  exceeds the ceiling, and MUST stop the run when counted spend reaches the ceiling, failing every
  further call as cancelled.
- **FR-024**: The harness MUST never read, print, log or write an API key; it MUST record only
  provider names, model names and prices.

**Demo (AC #4, AC #5)**

- **FR-025**: The project MUST hold a demo runbook: the stack, the provider configuration and its
  checkpoint, seating the operator in the human seat, starting the scene, what is recorded, and
  where the record lands.
- **FR-026**: The project MUST hold a demo record template with a failure table (finding or flag
  id, source, kind, severity, rows, resolution, evidence) and an attachments list.
- **FR-027**: The demo record MUST be committed at `docs/design/m2-demo.md` with its attachments
  under `docs/design/m2-demo/`: the demo session's transcript, ledger, job records and report,
  and the paid scripted playtest's run directory.
- **FR-028**: Every finding and DM-runtime audit flag in the attached reports MUST appear in the
  record's failure table with a resolution: `fixed` (commit), `carded` (task id), `accepted` or
  `false-positive` (each with the operator's reason).

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The harness MUST drive the human seat through the gate request
  path and start scenes through the DM runtime's scene-start trigger, the same interfaces a human
  and the `/dm` route use. The harness itself is a CLI and a module API an agent can run.
- **CR-004** (VI. 5e engine boundary): Every number in a playtest MUST come from the engine,
  through the scripted or seeded RNG the engine accepts. The auditor reads numbers only from
  the ledger and never computes a rule.
- **CR-005** (VIII. Operator-owned content): Fixtures and committed evidence MUST hold only the
  original seed content, SRD 5.2.1 material and generated play text. The CI retrieval fixture
  MUST be original text, not book text.
- **CR-006** (IX. Self-hostable, one model seam): Every auditor call MUST pass through the
  gateway under a named purpose; no vendor SDK or vendor name enters the source
  (decision-0007).
- **CR-007** (IV. Server authority): The harness MUST write session state only through the gate.
  It MUST NOT import a log writer; the write-boundary test MUST stay green.

### Key Entities

- **Scenario**: the scripted players. Seed id, the human seat and its user id, ordered free-mode
  moves (text, optional fixed action id), the combat move, the move cap, the dice source, the
  wall-clock limit, and the CI fixtures (DM script, auditor script, retrieval fixture).
- **Run directory**: one playtest's artifacts. Run manifest, transcript, readable transcript,
  ledger, job records, usage records, report (data and text).
- **Run manifest**: mode, scenario name, commit, seed and dice source, models per purpose
  (names only), start and end times, outcome, refusals of scripted moves, move count, spend.
- **Transcript**: every row of one session, DM view, in sequence order.
- **Segment**: one narration and the rows since the previous narration.
- **Finding**: one problem: id, source, kind, severity, doctrine pair id, cited rows, detail.
- **Report**: verdict, segments with their check and model results, findings, DM-runtime audit
  flags, fight statistics, model notes, auditor usage.
- **Demo record**: the committed account of the M2 demo, with its failure table and attachments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The CI-mode playtest of the full scene and its audit finish in under 60 seconds on
  the CI runner and give the same transcript (ignoring ids and times) on every run.
- **SC-002**: The auditor finds 100% of the planted problems in the doctored transcript fixture
  (at least one per code check), and reports zero `fail` findings on the clean CI run.
- **SC-003**: A provider-mode run without a spend ceiling makes zero model calls in 100% of tries.
- **SC-004**: A provider-mode run's total spend never exceeds its ceiling by more than one
  model call's cost.
- **SC-005**: The demo session reaches the scene's end through exploration, the social beat and
  the fight, with zero narrations whose dice lines disagree with the ledger.
- **SC-006**: The demo record's failure table has exactly one row per finding and flag in the
  attached reports, and zero rows without a resolution.

## Assumptions

- **Isolation.** The harness uses a `<base>_playtest` database, like the load bench's `_load`
  database. The app container's DM worker claims DM jobs from any session in its own database,
  so a shared database would let it steal the harness's jobs.
- **CI fixtures reuse the full-scene script.** CI mode plays `greyhollow-ford-full.json`
  unchanged (fake-gateway-script.md calls it TASK-0048's starting point). Its four human moves
  and their action ids become the CI scenario's moves.
- **Retrieval in CI** answers from an original-text fixture passage, as the scene test does. In
  provider mode, retrieval reads the stack's own library; an empty library makes the adjudicator
  improvise, which the ruling records.
- **One audit call per segment.** A full scene has eight to fifteen narrations. Per-segment calls
  keep each prompt bounded and each finding tied to rows.
- **The auditor model tier.** `playtest.audit` suggests a strong model, ideally from a different
  family than `dm.narrate`, so the judge does not share the narrator's blind spots. This is a
  configuration note; the code does not enforce it.
- **No new runtime dependency and no migration.** The harness reuses the server's packages, the
  gateway, the jobs table and the drizzle migrator.
- **No CI workflow edit.** The CI case rides `pnpm test` inside `ci:check`, as the DM suites do.
- **The demo is not dispatched.** Implementers build the harness, the auditor, the runbook and the
  record template. The orchestrator and the operator run the paid playtest, play the demo and
  write the record.
- **Scene start in the demo** uses `POST /dm/sessions/:id/start` from the operator's signed-in
  browser. The web app has no start control; the route is the agent-operable interface.
- **Combat rules are unchanged.** TASK-0055 decides the parked rules later from this card's
  fight statistics, transcripts and ledgers.

## Open Questions (each has a default; the operator may overrule)

1. **How many paid scripted playtests before the demo?** Default: one, under a ceiling the
   operator names at the checkpoint (the estimate prints first). More runs are cheap to add later
   as TASK-0055 evidence.
2. **Who plays the auditor in the demo?** Default: `playtest.audit` on a strong model from a
   different family than `dm.narrate`, if the operator's configuration has one.
3. **A web control to start a scene.** Default: none; the demo uses the `/dm` route from Brave's
   console. If the operator wants a control, it gets its own card at that point (decision-0020).
