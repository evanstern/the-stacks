# Feature Specification: First Scene — DM runtime (turn jobs, pipeline nodes, Director, companions)

**Feature Branch**: `task-0046-dm-runtime`

**Created**: 2026-10-26

**Status**: Draft

**Input**: Board card TASK-0046 ("First Scene: DM runtime — turn jobs, pipeline nodes,
Director, companions"), M2 First Scene sweep, lane 4. Grounding: architecture A5, A7, A9, A10,
A11, A12; decision-0005 (jobs queue), decision-0007 (provider-agnostic gateway),
decision-0014, decision-0015, decision-0016, decision-0017, decision-0018, decision-0019,
decision-0020, decision-0021; constitution 2.0.0; the gate contracts in
`specs/029-proposal-gate/contracts/`; the session-model contracts in
`specs/028-session-model/contracts/`; the SRD contracts in `specs/027-srd-data/contracts/`;
the engine contracts in `specs/026-dnd5e-engine/contracts/`; tabletop-dm at commit `fe2c29b`
(MIT, Copyright (c) 2026 Brad Bush), its `SKILL.md` and `reference/dm-style.md`.

**Clarify pass**: skipped. Every point the card leaves open has a default that an existing
artifact settles: node order and purposes from decision-0017 and A11; Director scope from
decision-0018; the beat rule from A12; the arithmetic split from the engine contract (R8);
commit authority and policies from the gate contracts; the scene's shape from decision-0009
and A5; the doctrine source from decision-0021. Defaults are listed under Assumptions. Choices
the operator may want to revisit are listed under Open Questions, each with the default this
spec builds.

## Context

The gate (TASK-0045) is the one write path to the session log. The engine (TASK-0042) owns
every number. The SRD package (TASK-0043) gives compact lookup records. Nothing yet plays the
DM: no code reads a committed action and answers it.

This feature adds **the DM runtime**, the third of the four runtime layers (decision-0017).
It is an actor like any player. It holds every LLM call in play.

- A committed action **enqueues a turn job** on the existing Postgres jobs queue, with its
  claim, lease and fencing.
- A turn job runs a **fixed pipeline of nodes**: assemble, director, interpret, adjudicate
  (when needed), resolve, narrate, audit. Each node is a plain async function from a turn
  context to a node result.
- **Only resolve writes.** It turns node output into proposals and submits them to the gate.
  Adjudicate and interpret supply mechanics inputs as data; the engine computes every outcome.
- **Narrate receives facts.** It never calls the engine or the dice. Dice lines are rendered
  by code from the ledger.
- **Audit checks narration against the ledger.** On a mismatch it regenerates (bounded) and
  records a flag. It never ships a mismatch silently.
- **The Director** owns the scene goal, the secret trackers, table-mode switches and beat
  timing. Its decisions reach the log only as proposals that resolve submits.
- **AI companions** declare and commit actions through the same gate path as a human.
- **Chronicle** runs off the hot path as its own job and writes journal entries as proposals.
- The scene comes from a **hand-authored, Zod-validated scene seed**: original content plus
  SRD 5.2.1 monsters. M4 replaces it with codex entities (TASK-0060).

The "users" are four kinds of caller: the human player, whose committed actions the DM
answers; the operator, who starts a scene and seats the human; the AI companions, which the
runtime plays as their own actors; and the playtest harness (TASK-0048), which drives whole
scenes against a scripted gateway and scripted dice.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A committed action gets an honest DM turn (Priority: P1)

Tamsin's player commits "I search the ferry-house for whoever cut the bell rope." A turn job
runs. The Director keeps the beat moving and advances the "Dusk falls" tracker. Interpret
reads a Perception check against the seed's DC. Resolve sends the check to the gate; the
engine rolls 14 against DC 12, a success. Narrate describes the clawed tracks in the mud.
Audit confirms the prose agrees with the ledger. The player sees the narration and a dice
line generated from the roll.

**Why this priority**: this is the M2 demo's core loop and the card's merge condition.

**Independent Test**: on the task's own stack, append a scene start and a committed action.
Run the DM worker with the scripted gateway and scripted dice. Assert the log holds, in
order, the director's tracker change, the check batch, `action.resolved`, and one narration
whose dice line matches the ledger; assert the turn job's audit record says `pass`.

**Acceptance Scenarios**:

1. **Given** an AI DM seat and a committed action, **When** the gate appends
   `action.committed`, **Then** exactly one queued turn job exists for that session.
2. **Given** a claimed turn job, **When** it runs, **Then** its nodes run in the order
   assemble, director, interpret, adjudicate (only when interpret asks), resolve, narrate,
   audit, and the job records each node's result.
3. **Given** the check in the story, **When** resolve submits it, **Then** the roll, the
   comparison and the outcome come from the engine; no model output contains a computed
   total or a success verdict.
4. **Given** the resolved check, **When** narrate runs, **Then** its input holds the roll
   as a fact and its prose holds no digits; the dice line is rendered by code from the ledger.

---

### User Story 2 - Narration that contradicts the dice never ships silently (Priority: P1)

The scripted narrator first writes "the goblin's blade misses you" after the engine recorded
a hit for 6 damage. Audit catches the mismatch, records a flag, and asks narrate to
regenerate with the issue named. The second narration agrees and ships. In another run every
attempt fails; audit ships a plain factual summary built from the ledger and adds a DM-only
journal flag.

**Why this priority**: ordering and audit are the anti-cheat (decision-0017). A silent
mismatch breaks the trust the M2 demo exists to prove.

**Independent Test**: script `dm.narrate` with a contradicting text then a correct one, and
`dm.audit` with `fail` then `pass`. Assert one narration row with the second text and an
audit record listing the failed attempt. Repeat with three failures and assert the fallback
narration plus the DM-only flag entry.

**Acceptance Scenarios**:

1. **Given** narration that contradicts the ledger, **When** audit runs, **Then** it fails
   the attempt and narrate regenerates with the issues as input.
2. **Given** three failed attempts, **When** the loop ends, **Then** the shipped narration is
   the code-built factual summary, and a `dm`-visibility journal entry records the flag.
3. **Given** any failed attempt, **When** the turn job finishes, **Then** its audit record
   lists every attempt, its issues, and how the turn resolved it.

---

### User Story 3 - The Director runs the scene (Priority: P1)

The operator starts the "Bell at Greyhollow Ford" seed. The Director sets the scene and its
goal, creates the hidden trackers, and opens in free mode. When the party reaches the goblin
camp it switches to turn mode: resolve adds the goblins from SRD records, rolls initiative
through the engine, and hands the turn to the first combatant. When the last goblin falls,
the Director ends the encounter and returns to free mode. When the ferry runs again, it ends
the scene.

**Why this priority**: decision-0018 makes pacing its own node from day 1; the M2 demo's
three beats depend on it.

**Independent Test**: run the scripted scene through its three beats. Assert the
`scene.changed`, `tracker.changed`, `table-mode.changed` and initiative rows each come from a
Director decision submitted by resolve, and that tracker rows are `dm`-visible only.

**Acceptance Scenarios**:

1. **Given** a start request, **When** the scene-start turn runs, **Then** the log holds the
   scene, the party members, their combatants, the trackers (`dm` only) and an opening
   narration, all written through the gate.
2. **Given** a Director decision to enter turn mode, **When** resolve runs, **Then** it adds
   the encounter's monsters, rolls initiative through the engine, and sets the turn-mode
   active actor from the encounter order.
3. **Given** a Director decision to hold the beat for companions in free mode, **When** the
   turn job ends, **Then** no action resolves, a companion job is queued, and the next turn
   job resolves the beat whatever the Director then decides.

---

### User Story 4 - Commits during a resolving turn wait for the next beat (Priority: P2)

While the turn for Tamsin's search is resolving, Kestrel (an AI companion) commits "I climb
the bell tower to look downriver," and the human commits a second action. Neither joins the
running beat. Both resolve in the next beat, in log sequence order.

**Why this priority**: A12's concurrency rule; nothing is cancelled.

**Independent Test**: hold a turn job inside resolve, append two commits, release it. Assert
one queued turn job, and that its beat resolves the two actions in commit order.

**Acceptance Scenarios**:

1. **Given** a running turn job, **When** another action commits, **Then** it is not in the
   running beat, and at most one queued turn job exists for the session.
2. **Given** a beat of several committed actions, **When** resolve runs, **Then** it resolves
   them in ascending commit `seq`.

---

### User Story 5 - AI companions act through the gate (Priority: P2)

In turn mode the order reaches Brother Odo, an AI companion. A companion job runs the
`dm.companion` purpose. Odo says one line in his voice, declares "I swing my mace at the
goblin by the fire," and commits it. The gate checks commit authority exactly as it would for
a human. The commit enqueues the next turn job.

**Why this priority**: decision-0014 and A11: companions are actors, not DM puppets.

**Independent Test**: set turn mode with an AI companion active. Run the companion job.
Assert `talk`, `action.declared` and `action.committed` rows whose actor is
`ai:companion:odo`, a commit authority of `active-player`, and a queued turn job.

**Acceptance Scenarios**:

1. **Given** an active AI companion in turn mode, **When** its job runs, **Then** it declares
   and commits exactly one character action through `gate.submit` with an
   `ai:companion:<characterId>` proposer.
2. **Given** a companion that is not the active actor in turn mode, **When** it tries to
   commit, **Then** the gate refuses `COMMIT_NOT_ALLOWED` and the job records the refusal.

---

### User Story 6 - Adjudicate gives a cited ruling (Priority: P2)

Tamsin's player wants to swing across the flooded room on the bell rope. Interpret marks it
for adjudication. Adjudicate calls M1 retrieval, rules that it is a Strength (Athletics) check
at DC 13, and cites the passage it relied on. Resolve records the ruling as a `dm`-visibility
journal entry and submits the check.

**Why this priority**: constitution V; A11 names adjudicate's citations.

**Independent Test**: ingest a fixture book, script `dm.adjudicate` with a ruling citing a
quote from it. Assert the citation verifies against the stored passage and the ruling entry
carries its anchor. Script an unverifiable quote and assert the ruling is marked improvised.

**Acceptance Scenarios**:

1. **Given** an action marked for adjudication, **When** adjudicate runs, **Then** it calls
   retrieval once with the rules question and returns a ruling whose citations each verify
   against a retrieved passage or an SRD record.
2. **Given** no verifiable citation, **When** the ruling ships, **Then** it is marked
   improvised in its text and in the turn record (constitution V: improvisation is said).

---

### User Story 7 - Chronicle keeps the journal off the hot path (Priority: P3)

After a turn's narration lands, a chronicle job runs later and proposes a journal entry: "The
party found goblin tracks leading into the reeds." The entry applies through the gate.

**Why this priority**: decision-0017 puts chronicle off the hot path; it improves memory but
does not gate play.

**Independent Test**: finish a turn; assert a queued chronicle job; run it; assert a
`journal.entry.added` row whose `sourceActionIds` name the turn's actions.

**Acceptance Scenarios**:

1. **Given** a finished turn job that applied narration, **When** it ends, **Then** at most
   one queued chronicle job exists for the session, and no turn job waits for it.

---

### User Story 8 - A crashed worker's turn is reclaimed without double writes (Priority: P2)

The worker dies after resolve applied the attack batch but before the damage. Its lease
expires. Another worker claims the job, resumes from the job's checkpoint, skips the applied
attack, applies the damage, narrates, and audits. A stale worker that wakes up is fenced out
and writes nothing more.

**Why this priority**: AC #1 names claim, lease and fencing; decision-0017 relies on them for
crash recovery.

**Independent Test**: inject a failure after the first gate append in resolve; expire the
lease; claim again; assert one attack batch, one damage batch and one narration in the log.

**Acceptance Scenarios**:

1. **Given** an expired lease, **When** a worker claims, **Then** it gets the same job with a
   new claim token and an incremented attempt count.
2. **Given** a fenced-out worker, **When** it tries its next stage write or gate submit,
   **Then** the fence check fails first and nothing reaches the gate.

---

### Edge Cases

- **Empty beat.** A turn job whose beat holds no unresolved, unnarrated action and no NPC
  turn succeeds at once with outcome `empty-beat` and makes no LLM call.
- **Engine refusal.** A step the engine refuses (for example `TARGET_DEAD`) resolves its
  action `refused` with the engine's code; narrate receives the refusal as a fact.
- **Gate `CONFLICT`.** Resolve resubmits a refused-for-conflict proposal at most twice more;
  then the turn fails and a `dm`-visibility talk row from `ai:dm` states the failure.
- **Unclear intent.** Interpret asks one short clarifying question (doctrine). Resolve
  resolves the action `no-effect`; narrate asks the question.
- **Human DM seat.** Proposals route by the session's policy. A `pending` or `suggested`
  result stops that action's step chain. The action stays committed. Approval or rejection
  enqueues a turn job, which re-plans the rest of the action from the ledger.
- **Twice-rejected action.** After two rejected proposals for one action, the runtime stops
  re-planning it and leaves it to the seated human DM.
- **Missing purpose config.** An unconfigured `dm.*` purpose fails its node; the turn fails
  and a `dm`-visibility talk row states which purpose is missing.
- **Invalid model JSON.** A node re-asks once with the parse issues; a second failure fails
  the node.
- **Audit model unavailable.** The prose is not shipped; the factual summary ships with a
  flag.
- **Combat-starting beat.** Actions in the beat that switches to turn mode resolve
  `no-effect`; narration names them as cut short by initiative (Open Question 1).
- **Scene already started.** A second start request for a session with a scene is refused
  `409 conflict`.
- **Ingestion.** The ingest worker never claims a DM job, and the library job list never
  shows one.

## Requirements *(mandatory)*

### Functional Requirements

Each requirement names the card acceptance criterion (AC) it serves.

**Turn jobs (AC #1, AC #9)**

- **FR-001**: A gate append that includes an `action.committed` row MUST enqueue a turn job
  for that session on the existing jobs queue, unless a queued turn job already exists for
  it. (AC #1)
- **FR-002**: The DM worker MUST claim jobs with the queue's claim, lease and fencing: one
  atomic claim with `SKIP LOCKED`, a new claim token per claim, a heartbeat that refreshes
  the lease, and a fence check on every later write. (AC #1)
- **FR-003**: At most one turn or companion job MUST run per session at a time, and at most
  one turn job MUST be queued per session. (AC #1, AC #9)
- **FR-004**: A turn job MUST freeze its beat at assemble: the committed, unresolved actions
  visible at that moment, plus resolved actions no narration names yet. Later commits MUST
  wait for the next beat. (AC #9)
- **FR-005**: Resolve MUST resolve a beat's actions in ascending commit `seq`. (AC #9)
- **FR-006**: A reclaimed turn job MUST resume from its checkpoint: recorded node outputs are
  reused, recorded steps are skipped, and the step that was in flight is skipped when the
  ledger already holds its marker. (AC #1)
- **FR-007**: The ingest worker MUST claim only ingest jobs, and the library job list MUST
  show only ingest jobs. (AC #1)
- **FR-008**: On worker start, the runtime MUST enqueue a turn job for every session that has
  a committed, unresolved action and no active turn job. (AC #1)

**Pipeline (AC #2, AC #3)**

- **FR-010**: A turn job MUST run assemble, director, interpret, adjudicate, resolve,
  narrate and audit in that order. Adjudicate MUST run only when interpret marks at least one
  action for adjudication. (AC #2)
- **FR-011**: Each node MUST be a plain async function from a turn context to a node result.
  The runner MUST be the only code that sequences nodes. (AC #3)
- **FR-012**: A node failure MUST stop the pipeline, fail the job, and append a
  `dm`-visibility talk row from `ai:dm` that names the node and the error kind. (AC #2)

**Gateway purposes (AC #4)**

- **FR-020**: Every model call in the runtime MUST name exactly one of `dm.director`,
  `dm.interpret`, `dm.adjudicate`, `dm.narrate`, `dm.audit`, `dm.chronicle`,
  `dm.companion`. Retrieval's embedding call keeps its own configured purpose. (AC #4)
- **FR-021**: Each node MUST call only its own purpose; a test MUST assert the purpose of
  every recorded call in a full scripted turn. (AC #4)

**Writes (AC #5, AC #6)**

- **FR-030**: Only resolve (and the companion and chronicle jobs, as their own actors) MUST
  submit to the gate. No runtime module MUST import a log writer. (AC #5)
- **FR-031**: Interpret and adjudicate MUST output mechanics inputs as data: expressions,
  roll modes, DCs, ACs, damage types, defense sets, `autoFail`. They MUST NOT output a total,
  an amount after defenses, or a hit, miss, success or failure verdict. (AC #5)
- **FR-032**: Resolve MUST branch only on engine events: a `check.resolved` outcome selects
  the success or failure effects; an `attack.resolved` hit or critical hit triggers the damage
  step with `critical` set exactly on a critical hit. (AC #5)
- **FR-033**: Narrate MUST receive resolved results as facts and MUST NOT import or call the
  engine, the RNG or the gate. A test MUST prove the import boundary. (AC #6)
- **FR-034**: Narrate's prose MUST contain no digits. Code MUST render the dice lines from
  the ledger and append them to the prose. (AC #6, AC #7)

**Audit (AC #7)**

- **FR-040**: Audit MUST run deterministic checks and one `dm.audit` call on each narration
  attempt.
- **FR-041**: On a failed attempt audit MUST record the issues and regenerate, at most three
  attempts in total.
- **FR-042**: When every attempt fails, or the audit call itself fails, the runtime MUST ship
  the code-built factual summary and append a `dm`-visibility journal flag.
- **FR-043**: Every turn job MUST record an audit record: each attempt, its verdict, its
  issues and the final resolution. An operator route MUST list these records per session.

**Director (AC #8)**

- **FR-050**: The Director MUST set the scene and its goal at scene start, and MUST decide
  when the scene ends.
- **FR-051**: The Director MUST create and advance the seed's secret trackers; tracker rows
  MUST be `dm`-visible only.
- **FR-052**: The Director MUST switch table modes. Entering turn mode MUST add the
  encounter's monsters and roll initiative through the engine.
- **FR-053**: The Director MUST decide whether a beat resolves now or holds once for named
  AI companions in free mode. A held beat MUST resolve on the next turn job.
- **FR-054**: Director decisions MUST reach the log only as proposals that resolve submits.

**Companions (AC #10)**

- **FR-060**: An AI companion MUST declare, comment and commit with an
  `ai:companion:<characterId>` proposer through `gate.submit`, subject to the same permission
  and commit-authority checks as a human.
- **FR-061**: In turn mode, when the active actor is an AI companion, the runtime MUST queue a
  companion job for it; the companion MUST declare and commit one character action.
- **FR-062**: When the active combatant has no party controller, the runtime MUST queue an
  NPC turn job; the AI DM acts for the monster with mechanics proposals and no action
  lifecycle.

**Adjudicate (AC #11)**

- **FR-070**: Adjudicate MUST call M1 retrieval once per adjudicated action with a rules
  question and the configured retrieval settings.
- **FR-071**: Each citation MUST verify against a retrieved passage (quote location as in M1)
  or name an existing SRD record and its page. Unverified citations are dropped.
- **FR-072**: A ruling with no verified citation MUST be marked improvised.
- **FR-073**: Resolve MUST record each ruling as a `dm`-visibility journal entry carrying
  its citations' anchors.

**Chronicle (AC #12)**

- **FR-080**: A turn job that applied narration MUST enqueue one chronicle job per session,
  unless one is already queued. No turn job MUST wait on chronicle.
- **FR-081**: Chronicle MUST write journal entries only as `journal` proposals through the
  gate, naming the actions they summarize.

**Scene seed (AC #13)**

- **FR-090**: The runtime MUST load a scene seed file and validate it with a Zod schema;
  an invalid seed MUST fail the start request with the issues listed.
- **FR-091**: The seed MUST carry the scene goal, the location, the NPCs, the player
  characters, the encounters and the trackers. NPCs and characters MUST carry identity,
  portrayal and hooks sections (A5 shape).
- **FR-092**: Seed monsters MUST name SRD 5.2.1 records; the runtime MUST build their
  combatants from those records in code.
- **FR-093**: The shipped seed MUST be original content plus SRD 5.2.1 monsters
  (constitution VIII); its header MUST say so.

**Doctrine (AC #14)**

- **FR-100**: DM-style prompts MUST state doctrine as right/wrong pairs adapted from
  tabletop-dm at commit `fe2c29b`.
- **FR-101**: The doctrine module and a notice file MUST carry the MIT notice naming
  tabletop-dm and its copyright holder, Brad Bush; a test MUST guard both.

**Tests (AC #15)**

- **FR-110**: Tests MUST run a full turn against the fake gateway adapter with scripted dice
  on the task's own database stack.
- **FR-111**: The fake gateway MUST accept a purpose-keyed script. The script format MUST be
  a JSON document TASK-0048 can reuse unchanged.

**Operator entry points (AC #8, AC #13)**

- **FR-120**: An operator MUST be able to start a scene from a seed, seat the human player's
  character, re-enqueue a turn, and list turn records, over HTTP.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The harness (TASK-0048) MUST drive a scene through the
  operator HTTP routes and the WebSocket gate requests a human uses. AI companions MUST use
  `gate.submit`, the server-side form of the same request path.
- **CR-002** (II. Content contract): Seed NPCs and characters MUST carry `identity`,
  `portrayal` and `hooks`, and an agent given one NPC and its linked neighbours MUST be able
  to voice it. The seed is a stand-in; codex entities replace it in TASK-0060.
- **CR-003** (V. Citations): Every ruling drawn from the library MUST carry a verified source
  anchor. A ruling without one MUST say it is improvised.
- **CR-004** (VI. 5e engine boundary): The runtime MUST reach mechanics only through gate
  proposals that the engine executes. No model may roll or compute a number.
- **CR-005** (VIII. Operator-owned content): The seed MUST hold only original text and SRD
  5.2.1 references. Prompts MUST NOT include book text beyond retrieved passages shown to the
  operator's own DM pipeline. Retrieved passages MUST NOT be written to a public row.
- **CR-006** (IV. Event-sourced play): LLM output MUST reach the log only as typed proposals.
  Trackers and rulings MUST be `dm`-visibility rows.
- **CR-007** (IX. Self-hostable): The runtime MUST add no service and no dependency; the
  seven purposes are config entries.

### Key Entities *(include if feature involves data)*

- **Turn job**: one row on the jobs queue, kind `turn`, for one session and one beat. It
  carries a trigger, a checkpoint and a result with the audit record.
- **Companion job**: kind `companion`; plays named AI companions once.
- **Chronicle job**: kind `chronicle`; writes journal proposals for recent turns.
- **Beat**: the ordered set of actions one turn job resolves, frozen at assemble.
- **Turn context**: the immutable input each node receives: the job, the seed, the DM
  projections, the beat, and earlier nodes' results.
- **Node result**: a node's typed output or its typed error.
- **Step**: one mechanics input, as data, that resolve turns into an engine command.
- **Fact**: a resolved result handed to narrate: who did what, which roll, which outcome,
  which change.
- **Audit record**: the attempts, verdicts, issues and final resolution of one turn's
  narration.
- **Scene seed**: the hand-authored scene: goal, location, NPCs, characters, encounters,
  trackers, opening.
- **Doctrine**: the right/wrong pairs the prompts carry, with the MIT notice.
- **DM script**: the purpose-keyed fake-gateway script plus the dice faces.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: One full turn runs end to end on the task's own stack against the fake gateway
  with scripted dice; the PR records its ledger and audit result (merge condition).
- **SC-002**: In every scripted test turn, 100% of model calls name a `dm.*` purpose that
  belongs to the calling node.
- **SC-003**: In every scripted test turn, every number shown to players comes from an
  engine event; narration prose holds zero digits.
- **SC-004**: In the audit tests, 100% of contradicting narrations are caught, and none ships
  without a recorded flag.
- **SC-005**: In the reclaim test, a crash at any resolve step produces exactly the rows an
  uninterrupted turn produces.
- **SC-006**: The scripted Greyhollow Ford scene reaches its end through an exploration
  beat, a social beat and a fight, with one human seat and two AI companions.
- **SC-007**: A typical free-mode turn makes at most six model calls on the hot path, and its
  assembled prompts stay under the token budget in `contracts/nodes.md`.

## Assumptions

- The AI DM seat is the M2 default; every DM kind applies `auto` (decision-0015). The human
  seat works under policy and is proven at scale by TASK-0053.
- One DM worker loop per process claims one job at a time. M2 runs one table.
- Positions, ranges and movement are narrative in M2; maps arrive with TASK-0071.
- Reactions and opportunity attacks are adjudicated as ordinary steps; no reaction timing
  exists in M2.
- Monster stats come from SRD records as data; the seed's player characters are pregenerated
  with simple stats until PC sheets land (TASK-0058).
- Group sign-off for several humans is TASK-0049; M2 seats one human (decision-0014).
- Real-provider runs are an operator checkpoint (cost). All tests use the fake gateway.

## Open Questions

Each question names the default this spec builds.

1. **Combat-starting beat.** Default: actions in the beat that enters turn mode resolve
   `no-effect`, and the player re-declares on their turn. Alternative: resolve them before
   initiative as an opening move.
2. **Where audit flags live.** Default: the turn job's audit record, plus a `dm`-visibility
   journal entry when the fallback ships. Alternative: a new catalog type `audit.flagged`
   (a session-model and gate contract change).
3. **Audit model unavailable.** Default: ship the factual summary with a flag (strict).
   Alternative: ship the prose when the deterministic checks pass.
4. **Where rulings live.** Default: `dm`-visibility journal entries titled "Ruling: …".
   Alternative: `dm`-visibility out-of-character talk.
5. **Seed file location.** Default: `apps/server/seeds/`, copied into the runtime image.
6. **Hold scope.** Default: one hold per beat, free mode only, AI companions only.

## Acceptance-criteria traceability

| Card AC | Requirements | Proved by (tasks.md) |
|---|---|---|
| #1 turn job on the jobs queue, claim/lease/fencing | FR-001, FR-002, FR-003, FR-006, FR-007, FR-008 | Phase 1 queue suites; Phase 6 reclaim test |
| #2 node order | FR-010, FR-012 | Phase 3 runner tests; Phase 6 full turn |
| #3 plain async node functions | FR-011 | Phase 3 seam test |
| #4 one gateway purpose per call | FR-020, FR-021 | Phase 6 purpose assertion |
| #5 resolve is the only writer, via the gate | FR-030, FR-031, FR-032 | Phase 5 boundary tests; Phase 4 resolve tests |
| #6 narrate gets facts, no engine or dice | FR-033, FR-034 | Phase 4 narrate import test |
| #7 audit regenerates and flags | FR-040 – FR-043 | Phase 4 audit tests; Phase 6 full turn |
| #8 Director: goal, trackers, modes, beats | FR-050 – FR-054, FR-120 | Phase 4 resolve tests; Phase 6 scene test |
| #9 commits during a turn queue into the next beat | FR-003, FR-004, FR-005 | Phase 1 queue suite; Phase 6 beat test |
| #10 companions through the gate | FR-060 – FR-062 | Phase 5 companion tests |
| #11 adjudicate: retrieval and a cited ruling | FR-070 – FR-073 | Phase 3 adjudicate tests |
| #12 chronicle off the hot path, as proposals | FR-080, FR-081 | Phase 5 chronicle tests |
| #13 Zod-validated scene seed | FR-090 – FR-093 | Phase 2 seed tests |
| #14 doctrine with MIT attribution | FR-100, FR-101 | Phase 2 attribution guard |
| #15 full turn, fake gateway, scripted dice | FR-110, FR-111 | Phase 6 merge-condition run |
