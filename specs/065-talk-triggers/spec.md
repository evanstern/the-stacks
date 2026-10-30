# Feature Specification: In-character talk draws a reaction from the world

**Feature Branch**: `task-0180-talk-triggers`

**Created**: 2026-10-30

**Status**: Draft. decision-0027 (D19) is **proposed**. Open questions OQ-1 to OQ-16 await the
operator; each has a recommended default (a). This spec, plan.md and tasks.md are written against
every (a).

**Input**: TASK-0180. "When a PC, companion or NPC speaks in character, the DM reads the post for
triggers and decides what, if anything, happens next." Evidence: two-browser alpha run 2 item 1
(`docs/playtests/2026-10-28-two-browser-alpha.md`, session `166b8e59`).

`speckit-specify` ran as authoring guidance only: the spec dir was already claimed with a stub, so
its branch and directory creation steps were skipped. `speckit-clarify` was skipped. The card and
the code settle what must happen. The open questions below are operator design calls, which the
card itself requires (it amends decision-0016).

## Decision records and rules this card implements

- **decision-0016 (D8)**: amended by decision-0027 §1. Talk may draw a talk reaction. Talk still
  never reaches the action pipeline.
- **decision-0027 (D19)**, proposed: triggers (§3), outcomes (§4), chain cap and floor (§5), turn
  mode (§6), TASK-0052 (§7).
- **decision-0025 (D17)** rule 2.7: talk is flavour. A reaction may not enact a change or assert a
  state the snapshot does not hold. Rule 2.5: an encounter start passes because initiative is a
  roll. §3.4: the output claim gate checks shipped text.
- **decision-0026 (D18)** points 1 and 3: player-facing text reads the `PlayerSeedView` and states
  no DM-only item without a reveal fact.
- **Spec 036** (companion react) and **spec 049** (turn floor): their enqueue rules are unchanged.
- **Spec 064** (plan first step): unchanged. A talk turn runs no interpret, so no cut applies.

## Background: what happens today

1. A human or companion posts `talk` (channel `ic`). The gate appends it. `enqueue.ts` matches no
   rule for it, so no DM job queues.
2. The next DM turn runs only after a commit. Its narrate sees the talk in the transcript tail and
   may or may not voice an answer.
3. Companions speak (`say`) after each beat, prompted by the Director's `companionPrompts`.
   Nothing reads a companion's line either.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An addressed NPC answers (Priority: P1)

A player's character asks a present NPC a question in character. Within a few seconds the NPC
answers in its seed voice. No dice roll and no state changes.

**Why this priority**: the playtest failure (card AC #2, #3).

**Independent Test**: a scripted DM over the duo seed. Odo's line "Wenna, who's missing from this
house?" produces one narration row in Wenna's voice and no state-change row.

**Acceptance Scenarios**:

1. **Given** free mode, an AI DM seat and Wenna present, **When** a human posts an IC line naming
   Wenna, **Then** a talk turn queues with triggers `addressed: wenna`, and one narration row ships.
2. **Given** the same post, **When** the reply would state a DM-only seed item, **Then** the code
   check refuses it, the model regenerates once, and a second refusal ships nothing.
3. **Given** an OOC post, a whisper or a `dm`-visibility post, **When** it is appended, **Then** no
   talk turn queues.
4. **Given** two IC posts within the quiet window, **When** the window ends, **Then** one talk turn
   reads both.

### User Story 2 - The DM may decide nothing happens (Priority: P1)

Table chatter in character that touches no one draws no reaction.

**Why this priority**: card AC #3 ("no reaction"); keeps the DM from flooding the table.

**Independent Test**: a scripted `none` outcome ships no row and records its reason on the job.

**Acceptance Scenarios**:

1. **Given** a post the model reads as `none`, **When** the talk turn ends, **Then** no row is
   appended and the job result names the triggers and the reason.
2. **Given** no present non-party NPC and no question in the post, **When** it is read, **Then**
   code records `none` with no model call (OQ-16).

### User Story 3 - Reactions chain, then the floor returns (Priority: P1)

An NPC reply addressed to a companion prompts the companion, whose line is read in turn. After at
most two DM reactions with no human row between them, the AI side stops and the PCs have the floor.

**Why this priority**: card AC #4.

**Independent Test**: a DB test with a script whose replies keep prompting the companion. Exactly
two DM narration rows follow the human post; the third companion line queues no talk turn.

**Acceptance Scenarios**:

1. **Given** a reply that prompts Odo, **When** the turn ends, **Then** a companion `prompt` job
   queues for Odo.
2. **Given** two `ai:dm` narration rows since the latest human-authored row, **When** a companion
   posts IC talk, **Then** no talk turn queues.
3. **Given** the cap was reached, **When** a human posts again, **Then** the count resets and the
   post is read.
4. **Given** the reaction that reaches the cap, **When** its prompt is built, **Then** it allows no
   companion prompt and asks for a beat that hands the scene to the PCs.

### User Story 4 - A reaction that turns violent starts the encounter (Priority: P2)

A player provokes a seed NPC whose encounter has not started. The DM starts that encounter:
monsters join, initiative rolls, table mode becomes `turn`, and a narration row describes it.

**Why this priority**: card AC #5. P2 because it is the one part that may be cut before run 3
(plan.md "Cut line").

**Independent Test**: a scripted `escalate` outcome over the duo seed writes the same rows as the
Director's `turn` decision (combatant adds, initiative, `table-mode.changed`).

**Acceptance Scenarios**:

1. **Given** free mode and an unstarted seed encounter, **When** the outcome is `escalate`, **Then**
   resolve runs the encounter start as an opening move and the turn flow takes over.
2. **Given** an `escalate` naming an encounter that already started, ended or does not exist,
   **When** code checks it, **Then** it becomes `scene` and the table stays in free mode.
3. **Given** turn mode, **When** a player posts IC talk, **Then** no talk turn queues (OQ-12).

### User Story 5 - A queued beat absorbs the post (Priority: P2)

Talk posted while a committed action waits does not cause a second DM run.

**Acceptance Scenarios**:

1. **Given** a queued commit turn, **When** an IC post is appended, **Then** no talk turn is added;
   the commit beat runs as today.
2. **Given** a queued talk turn, **When** a commit is appended, **Then** the queued job becomes a
   commit turn and runs with no quiet wait.
3. **Given** a talk turn claimed with a committed beat in the projections (a reconcile race),
   **When** it runs, **Then** it runs the full pipeline as a commit turn.

### Edge Cases

- The DM seat is human: no talk turn queues (OQ-13).
- The post names a dead, downed or absent NPC: code drops that trigger. The claim gate refuses a
  reply in that NPC's voice.
- A seed NPC has no `voice`: the seed schema requires one, so this cannot happen.
- Two humans post at once: the quiet window coalesces them. One reply may answer both.
- A companion's prompted line addresses a human's character: it is read like any post; the
  outcome may be a `reply` that addresses the PC, which returns the floor.
- A talk turn fails (invalid output twice): the failure notice is the existing `dm`-visibility row.
  The table is not blocked; the next human row is read normally.
- Reclaim after a lease loss: the talk turn's checkpoint stores the react output, so the model is
  not called twice and the narration ships once (existing landed-narration check).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A `talk` row is read only when it is channel `ic`, visibility `public`, authored by a
  human or an AI companion, under an AI DM seat, in free mode, and under the chain cap
  (decision-0027 §2).
- **FR-002**: Code names the triggers `addressed`, `mentioned` and `overheard` from snapshot
  aliases, seed NPC role words and logged presence. Only present, non-dead actors match
  (decision-0027 §3, OQ-1).
- **FR-003**: A read post queues a turn job with trigger `talk` and the post's seq, after a quiet
  window (3 s, capped at 10 s from the first post). A queued non-talk turn absorbs it. A non-talk
  enqueue onto a queued talk turn replaces its trigger and drops the wait (OQ-4, OQ-14).
- **FR-004**: A human post that addresses only AI companions queues a companion `prompt` job and no
  talk turn (OQ-11).
- **FR-005**: A talk turn with an empty beat runs the talk path: assemble, one `react` call, an
  optional encounter start, code checks, ship. A talk turn with a non-empty beat runs the full
  pipeline (OQ-3).
- **FR-006**: The `react` call uses the `dm.narrate` purpose with prompt version `dm.react-v1`. Its
  input is the posts, their code triggers, the `fiction` snapshot view, the `PlayerSeedView` and
  the transcript tail. It never sees DM-only seed data (OQ-5, OQ-8).
- **FR-007**: The `react` output is one outcome: `none`, `reply`, `scene` or `escalate`, with the
  model's triggers, the speaking NPC (for `reply`), the text, the encounter id (for `escalate`), at
  most two companions to prompt, and a reason.
- **FR-008**: `reply`, `scene` and `escalate` text ships as one `narration` row by `ai:dm` with
  empty `actionIds` (OQ-6).
- **FR-009**: Shipped text passes `checkClaims` against the snapshot, the DM-only seed text check
  and the digit check. One refusal regenerates; a second ships nothing and records `none` (OQ-7).
- **FR-010**: No talk turn advances a tracker, ends a scene, or writes presence, attitude, a roll or
  a mechanics row, except the encounter start of FR-011.
- **FR-011**: `escalate` starts a seed encounter through the existing resolve opening move only
  when `encounterToStart` finds it unstarted and unended and the mode is free. Otherwise it becomes
  `scene` (OQ-9).
- **FR-012**: Chain cap: a post is not read when two `ai:dm` narration rows follow the latest
  human-authored row. The reaction that reaches the cap prompts no companion (OQ-10).
- **FR-013**: A completed talk turn queues a companion `prompt` job for its named companions,
  through the existing after-turn table. Its narration queues a chronicle job, as any narration does.
- **FR-014**: The job result records the code triggers, the model triggers, the outcome and the
  reason, so the debug page and the playtest auditor can read them.

### Card acceptance criteria map

| Card AC | Covered by | Evidence |
|---|---|---|
| #1 A decision record amends decision-0016 | decision-0027 §1 | `backlog/decisions/decision-0027 - …md` (proposed; accepted on the operator's ruling) |
| #2 The decision names the triggers | decision-0027 §3; FR-002, FR-007 | `talk-triggers.test.ts` |
| #3 How triggers become a next-beat outcome | decision-0027 §4; FR-005 to FR-011 | `talk-turn.integration.test.ts` (reply, none, refusal) |
| #4 Cap on AI-only chains; floor returns | decision-0027 §5; FR-012, FR-013 | chain-cap DB test |
| #5 When a reaction moves the table to turn mode | decision-0027 §6; FR-011 | escalate DB test |
| #6 A spec is written and implementation tasks carded | this spec set | the orchestrator cards the phases after the ruling |

### Key Entities

- **Read post**: a `talk` row that passes FR-001. Not a new event.
- **Trigger**: `{ kind, actorId | null }`. Lives in the turn checkpoint and job result only.
- **Talk turn**: a `turn` job with trigger `talk`.
- **Reaction**: the `react` output. Lives in the turn checkpoint.

## Open questions

Each has a recommended default (a). **Frozen** marks an option that changes a frozen contract
(`docs/wiki/ws-protocol.md` frames, `specs/029-proposal-gate/contracts/`,
`specs/030-play-route/contracts/proposal-seam.md`). No (a) touches a frozen contract.

- **OQ-1 — Who detects triggers.**
  (a) Code names `addressed`, `mentioned` and `overheard` from aliases and presence; the model adds
  `narrator` and `hostile` and decides. Deterministic, testable, cheap; role words ("innkeeper")
  need seed role matching.
  (b) The model detects all. Smallest code; triggers untestable without a paid call.
  (c) Code only. No model judgment on tone; misses "Does anyone answer?".
- **OQ-2 — The trigger set.**
  (a) `addressed`, `mentioned`, `overheard`, `narrator`, `hostile`. Covers the card plus questions
  to the world and provocation.
  (b) The card's three only. Leaner prompt; "Does anyone answer?" goes unread.
  (c) (a) plus `act-like` (talk that describes doing something prompts "declare it"). Helps new
  players; adds a nag the operator did not ask for.
- **OQ-3 — Pipeline shape.**
  (a) A short talk path inside the `turn` job: one model call, no Director, interpret or audit.
  Reuses the queue, fencing, checkpoint and one-beat-per-session rule; no migration.
  (b) The full pipeline (Director decides). Reuses every node; 3 to 5 calls per post, 30 s
  latency.
  (c) A new `talk` job kind. Cleanest separation; needs a migration for `jobs_kind_valid` and a
  claim-priority rule.
- **OQ-4 — Coalescing.**
  (a) A 3 s quiet window, capped at 10 s, as spec 036's react jobs. Two quick lines draw one reply.
  (b) No window. Fastest; a burst of lines draws a burst of calls.
  (c) A longer window (8 s). Cheaper; feels slow at a live table.
- **OQ-5 — Model purpose.**
  (a) Reuse `dm.narrate` with prompt version `dm.react-v1`. No hosted AI config change before
  run 3; the ledger still separates calls by version.
  (b) A new `dm.react` purpose. Separate model and cap choice; the vm-104 config must gain the
  entry first (an operator go per command).
- **OQ-6 — How a reply ships.**
  (a) A `narration` row that voices the NPC in prose. No UI or schema change.
  (b) A `talk` row by `ai:dm` with the NPC's id as `characterId`. Reads as dialogue; the play
  route labels it "the DM" until the view-model learns NPC names.
  (c) A new NPC-speaker field on `TalkV1`. Best transcript; **frozen** (029 `proposals.md`
  `TalkV1`, `ws-protocol.md` event frames).
- **OQ-7 — Checks on shipped text.**
  (a) Code checks only (claim gate, DM-only seed text, digits), one regenerate. One model call per
  reaction.
  (b) Add a `dm.audit` call. Better tone checks; doubles cost and latency.
- **OQ-8 — What a reply may reveal.**
  (a) Only player-facing seed data. An NPC asked about a DM-only item answers in character without
  stating it; the substance needs a declared Persuasion or Insight action. Keeps D18 point 1.
  (b) Give the react call the NPC's DM-only `knows`. Richer answers; leaks until TASK-0148 lands
  reveal facts.
  (c) Let the model judge. No guarantee; the leak check catches exact strings only.
- **OQ-9 — Escalation to turn mode.**
  (a) Only into an unstarted seed encounter, through the existing opening move. Reuses engine rows
  and rule 2.5.
  (b) Any fast action switches to turn mode, even with no monsters. Covers chases; turn mode with
  no combatants has no initiative order.
  (c) Never. The reaction narrates the threat; the next commit's Director starts the encounter.
  Smallest; card AC #5 is met by stating that rule.
- **OQ-10 — The cap.**
  (a) 2 `ai:dm` narration rows after the latest human-authored row. Counted from the projections;
  no new state.
  (b) 1. PCs drive harder; an NPC can never answer a companion's follow-up.
  (c) 3, or a per-session setting. Livelier; a setting is config for a value the alpha has not
  tested.
- **OQ-11 — A human post that addresses only a companion.**
  (a) Prompt that companion directly; no DM call. The companion answers in its own voice.
  (b) The DM call decides. One extra call; the DM may pre-empt the companion.
- **OQ-12 — Turn mode.**
  (a) Not read. Turn order owns pacing; the next beat's narrate sees the talk.
  (b) Read, `reply` only, never `escalate`. Livelier combat banter; races the turn flow.
- **OQ-13 — Human DM seat.**
  (a) Not read. The human DM voices the world.
  (b) Read, and offer the reply as a `suggest` narration on the approvals list. Helps a new human
  DM; adds a UI path.
- **OQ-14 — A post while a beat is queued.**
  (a) The queued beat absorbs it; narrate sees it in the tail. One DM run.
  (b) A separate talk turn after the beat. Every post answered explicitly; two runs.
- **OQ-15 — TASK-0052 (narrator chime-in).**
  (a) decision-0027 §7 covers it; the orchestrator closes it by that record, or re-scopes it.
  (b) Keep it open for a per-minute rate limit beside the cap.
- **OQ-16 — When code skips the model call.**
  (a) Skip only when no present non-party NPC exists and the post holds no `?`. Every other read
  post calls the model; the quiet window and the cap bound cost.
  (b) Call only when code finds `addressed` or `mentioned`, or the post holds a `?`. Cheaper;
  `overheard` and `hostile` only fire alongside them.
  (c) Always call. Simplest; pays for empty scenes.

## Frozen-contract impact

- `docs/wiki/ws-protocol.md` frame shapes: none. Only OQ-6 (c) would change them.
- `specs/029-proposal-gate/contracts/`: none. No new proposal kind, policy or refusal code.
- `specs/030-play-route/contracts/proposal-seam.md`: none. No UI change.
- Amended additively: `specs/031-dm-runtime/contracts/turn-jobs.md` (trigger `talk`, the talk
  enqueue rule, `notBefore` on turn jobs, the after-turn row), `nodes.md` and `node-seam.md` (the
  talk path), `purposes.md` (`dm.react-v1` under `dm.narrate`).
- The event catalog is unchanged. `TurnJobInput` gains optional fields in `jobs.input` JSON; no
  migration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the reply fixture, 1 narration row ships within one talk turn; 0 state-change rows.
- **SC-002**: In the chain fixture, exactly 2 `ai:dm` narration rows follow the human post; the
  next companion line queues 0 talk turns.
- **SC-003**: OOC, whisper, `dm`-visibility, turn-mode and human-seat posts queue 0 talk turns.
- **SC-004**: Every existing DM script and DB suite passes unchanged.
- **SC-005**: Stubbing trigger detection, the cap or the escalate legality check fails at least one
  test each; restoring leaves an empty diff.
- **SC-006**: In the script-mode live check, an IC line to Wenna draws her reply within 10 s of the
  quiet window ending.

## Assumptions

- Model judgment (which outcome, the reply's quality) is not provable without a paid call. The fake
  gateway proves the code path; alpha run 3 is the provider evidence.
- Earshot is the whole scene until TASK-0139 tracks position.
- Seed NPC role words come from `identity.role` (for example "innkeeper"). A role shared by two
  present NPCs matches both as `mentioned`, never `addressed`.
