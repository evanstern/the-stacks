# Feature Specification: One chat stream — players talk, the DM confirms each action

**Feature Branch**: `task-0188-one-chat-stream`

**Created**: 2026-11-02

**Status**: Draft, **amended 2026-11-11 against Intent contract v1.1** (see "Amendment (2026-11,
Intent contract v1.1)"). Operator C-AMD ruling 2026-11-11: "Approve all" (the amendment `282eb567`, the
split, C-1 to C-9 at C-GATE, and OQ-2 to OQ-9 as recommended). **Scope since the split: the server
half.** The web half is TASK-0315 (see "Split out to TASK-0315"). Where the amendment and the 2026-11-02 text disagree, the amendment wins.
Original status: written against an accepted decision. decision-0028 (D20) is **accepted**
(2026-11-02). The operator ruled every open question (a) and approved the section 8 frozen-contract
amendments: "All (a), amend". This spec has no open question of its own. Three gaps the record
leaves open are settled under "Decision gaps settled here", each without a new frozen-contract
change.

**Input**: TASK-0188. Two-browser alpha run 3, finding 2 (`docs/playtests/2026-11-01-two-browser-alpha-run-3.md`,
session `e8e8326d`, action `act-4c4727e0`). Design rounds: `docs/design/one-chat-stream/`. Chosen
option: round 2 A, "Just talk" (`docs/design/one-chat-stream/round-2/a-just-talk.html`).

`speckit-specify` ran as authoring guidance only: the branch and the spec number were already
claimed, so its branch and directory steps were skipped. `speckit-clarify` was skipped: the decision
record and its ruling settle every design question.

## Amendment (2026-11, Intent contract v1.1)

Amended 2026-11-11 for TASK-0199 by the R1 sweep spec author. Operator review: C-AMD 2026-11-11, "Approve all".
Authored against `origin/main` `9e51c948`: spec 092 contract `intent-schema.md` v1.1, spec 102
(`86d425b6`, merged), spec 104 (`f61a0bac`, merged).

**Sources.** P-04 (approved 2026-11-07: quiet ring in exploration only; combat uses explicit turns;
human-DM tables may turn the ring off). decision-0030 (D22, Intent contract v1 frozen; v1.1 at
C-CON 2026-11-08). Spec 092 plan "Downstream amendments (specs 066 and 091)". CP-5 ruling F2
(2026-11-08): this card owns the combat Enter-commit rule; TASK-0275 builds the banner, pips,
action bar and off-turn refusal on top. Constitution 3.0.0 IX ("Exploration may use the quiet
ring. Combat MUST use explicit turns").

**What changes.**

- **A1 — The ring runs in exploration only.** Free mode is exploration and social play. Turn mode
  is combat: no ring, no read for speech or a declared Intent. The 5 s turn-mode ring (OQ-R5 (a),
  the 2026-11-02 US7) is withdrawn.
- **A2 — The composer sends Intents.** Send runs `parse(text, ctx)` from `@the-stacks/intent`
  (contract §8). Plain text is `say`; `((…))` and `/ooc` are `ooc`; `@dm …` is `ask_dm`; `/do` is
  `attempt`; any other verb is its kind. Free mode sends `declared`. Turn mode sends `confirmed`.
- **A3 — The readable-post rule reads Intent kinds** (`p.intents`), not `talk.channel`. A legacy
  companion `talk` row stays readable until TASK-0299 moves companions to Intents.
- **A4 — The confirm row carries Intent bodies.** Each `action.suggested` item holds one Intent at
  commit `declared` (contract §7 rule 3). The read builds an item in code, with no model call, for
  a player's own declared Intent.
- **A5 — 👍 moves the Intent from `declared` to `confirmed`.** `action.accept` plans the item's
  Intent as `confirmed` through the spec 102 Intent path. The batch is engine rows (or a ruling
  request) plus one `intent.recorded` row. The `action.declared` + `action.committed` pair and
  `suggestionId` on `action.declared` are withdrawn.
- **A6 — In combat, the active player's Enter commits** (F2). A parsed Intent goes as `confirmed`.
  Plain prose goes as `action.declare` then `action.commit` (authority `active-player`), and
  interpret turns it into Intent stages (spec 104). TASK-0275 owns everything built on this rule.
- **A7 — `ask_dm` is served.** The gate stops refusing it `KIND_UNSERVED`. The question and its
  answer are visible to the asker and the DM only (contract §4, channel `dm`). The answer changes
  no state.
- **A8 — The human-DM ring-off setting is the DM seat** (OQ-5). A human seat reads no post, so no
  ring and no talk turn appear.
- **A9 — Withdrawn from the 2026-11-02 design:** retract after 👍 (US9, old FR-018, FR-019, gap 3),
  the widened `action.withdraw`, the `INVALID_PROPOSAL` refusal for a declare carrying
  `suggestionId`, the `The party` speaker (OQ-8), and the turn-mode ring.
- **A10 — Kept unchanged in intent:** one Send, the speaker chip, the `@` dropdown, the ring and
  Thinking visuals, the interrupt strip, the chain cap, the stale rule, the `read` marker, the human
  DM's inline confirm editor, and the removal of the sign-off and comment UI.
- **A11 — Prompt:** `dm.react-v3` becomes `dm.react-v4`. No purpose change.

**Card acceptance criteria (TASK-0199 after the split, numbering of 2026-11-11).**

| Card AC | Covered by | Evidence |
|---|---|---|
| #1 The quiet ring runs on the Intent `declared` state | A1, A3; FR-006, FR-007 | `read-rule.test.ts`, `enqueue-talk.integration.test.ts` |
| #2 Exploration: a declared Intent waits for the ring, then a reaction or a confirm row | A4; FR-010 to FR-013 | `talk-turn.integration.test.ts` |
| #3 👍 moves the Intent from declared to confirmed and sends it to the gate | A5; FR-016, FR-018 | `gate-suggest.test.ts`, `gate.intent.integration.test.ts` |
| #4 A human-DM setting turns the ring off, with a test | A8; FR-027 | `read-rule.test.ts` (human seat) |
| #5 `@dm` yields one read-only `ask_dm` answer that changes no state, with a test | A7; FR-013, FR-028 | `gate-ask-dm.test.ts`, `talk-turn.integration.test.ts` |
| #6 Spec 066 amended against v1.1 and reviewed at C-AMD | this section; plan.md | `282eb567`; the 2026-11-11 ruling |
| #7 A direct `intent` request queues a coalesced turn that narrates its facts | OQ-3 (b); FR-031 | `enqueue-intent.integration.test.ts` |

## Split out to TASK-0315

Ruled 2026-11-11 (OQ-1). TASK-0315 is the web half: one composer, one Send, and the combat Enter
commit. Its card ACs are TASK-0199's old #4 (Enter commits in combat, with a test) and #7 (one
composer and one Send, verified live in Brave). It owns plan Phase 4 (the web), the web share of
the wiki phase (`play-route`, `chat-ui`, the `turn-floor` UI lines, plus its INDEX/CAPSULES line), and the web
share of verification (the Brave live check at 1280 px and 390 px, the accessibility check, the
screenshots). It takes FR-001 to FR-005, FR-015, FR-017, FR-019's client half, FR-022 to FR-026
and SC-005, SC-008 as written here. It draft-holds until TASK-0199 merges. This card ships no
`apps/web` change.

**Open questions** (each needs a ruling before the implementation dispatch; recommendations
follow).

Ruled 2026-11-11: "Approve all" (each as recommended). Homes: OQ-1 → TASK-0315; OQ-3 (b) →
this card's AC #7; OQ-4 → TASK-0314 merges first; OQ-5 → TASK-0316; OQ-7 → TASK-0317.

- **OQ-1 — Split.** The amended task list is 70 tasks in 7 phases across the server talk path and the web
  composer. **Recommend:** split into 0199-server (this card) and 0199-web (TASK-0315)
  (plan.md "Split check").
- **OQ-2 — TASK-0275 (F2) seam.** 0199 sends the active player's Enter as a commit and removes the
  active player's Commit button from the action card. 0199 shows an off-turn refusal with the
  existing generic refusal label only. Combat prose rides `action.declare` + `action.commit` so
  interpret (spec 104) still turns "I shoot the goblin" into an `attack`. **Recommend:** adopt.
  TASK-0275 adds no commit control; it owns the banner, pips, legal-action bar and the worded
  off-turn reason. Alternative: send combat prose as `attempt`; rejected, because every prose
  attack would become a ruling instead of an attack.
- **OQ-3 — TASK-0247 (spec 091) overlaps.** (a) Send must parse `((`, `/ooc`, `@dm` and `/do`, which
  are contract grammar, so 0199 sends every parsed slash verb. That covers most of 0247 AC #3.
  **Recommend:** narrow 0247 AC #3 to pills, Tab completion and inline `PARSE_*` refusal wording,
  and amend spec 091 against this design. (b) 0247 AC #10 says a direct `intent` request queues a
  coalesced turn that narrates it. 0199 ships the first direct producers: 👍 and the combat Enter.
  Without that rule, a 👍'd check settles its fact rows but nothing narrates them until 0247 lands.
  **Recommend:** move 0247 AC #10 into 0199-server: one enqueue rule and a new turn trigger
  `intent` (an additive 031 amendment, plan.md row C-8). Alternative: keep it on 0247 and accept
  un-narrated 👍 results in the 0199 live check.
- **OQ-4 — TASK-0314 (a human DM's ruling queues the resume turn).** A 👍'd `attempt` under a human
  seat yields `needs_ruling` and a DM proposal. The human DM's ruling then settles with no turn
  queued; that is the TASK-0314 bug. Both cards edit `dm/enqueue.ts`. **Recommend:** merge 0314
  before 0199-server. If OQ-3 (b) is adopted, the `intent` rule also fires on the human ruling's
  carrier row. The one-queued-turn index coalesces the two queues, so the overlap is harmless.
  Each card keeps its own test.
- **OQ-5 — What "a human-DM table setting" is (AC #4).** **Recommend:** the human DM seat is the
  setting. A human seat reads no post (FR-027), with a test. No new event or request. Alternative:
  a `quietRing` table toggle a human DM can turn on as a pacing cue. That needs a new request and
  event (a frozen-contract amendment); card it as an R2 revisit with trigger "a human-DM table asks
  for a pacing cue".
- **OQ-6 — `ask_dm` visibility.** D20 drew the question and answer for the whole table. Contract §6.2
  fixes channel `dm` ("the DM seat only"). **Recommend:** follow the contract: both rows carry
  visibility = the asker's user id, which `canSee` already shows to that user and the DM.
- **OQ-7 — Withdrawing a declared Intent (spec 102 OQ-7 sends it here).** With A5, a 👍 settles at
  once, so nothing waits after a confirm. A suggestion item never reaches `p.intents` until 👍. A
  player's own declared Intent stays `declared` if nobody confirms it. **Recommend:** no withdraw
  request in this card. Stale suggestions are derived (FR-018). Card "withdraw a declared Intent"
  as a revisit with trigger "a player needs to retract a declared slash Intent before the read".
- **OQ-8 — The `The party` speaker.** A `say` Intent needs a `pc` actor, and contract kind `party`
  means party-only table talk, not a party voice. **Recommend:** drop the speaker. Party deeds come
  from the read (`attempt` with scope `party`) or from `/do +party`.
- **OQ-9 — Runner declares are not posts.** Spec 104's runner declares a player's Intent under that
  player inside a turn job, then confirms it. Read naively, that row would queue a read.
  **Recommend:** FR-006 rule 2 skips a declared Intent whose id starts with an existing action id
  and a dot (the runner's id form `<actionId>.<n>`). It is pure and testable.

## Decision records and rules this card implements

- **decision-0028 (D20)**, accepted: the whole feature. Section numbers below cite it as "D20 §n".
- **decision-0016 (D8)**: amended by D20 §4. Its Talk and Action concepts read as D20 §4 states. Its
  commit-authority table gains a first row for a DM-suggested action. The other rows stand for
  direct declares (D20 §4.11).
- **decision-0027 (D19)**: amended by D20 §7. The readable-post rule, the outcomes, the chain cap and
  the quiet window change as listed there.
- **decision-0025 (D17)** rule 2.7 and **decision-0026 (D18)** points 1 and 3: a confirm line and an
  `@dm` answer are player-facing text. They read the `PlayerSeedView` only and pass the same code
  checks as a D19 reply.
- **Spec 044** (group sign-off) and **spec 049** (turn floor, stall commit): their gate rules stay
  for direct declares (D20 §4.11, Consequences). Spec 044's client sign-off rows leave the web.
- **Spec 065** (talk triggers): extended. Its talk turn becomes "the read".

## Background: what happens today

1. The composer has Talk and Action radios. Action shows scope radios and a Declare button. A
   declared action shows an action card with a comment form, Approve, Object and Commit, and, for a
   party action with two or more humans, per-player sign-off rows.
2. A free-mode character action commits at the declarer's word alone. Sign-off gates only a party
   action with two or more humans. In run 3 every in-character line went out as an Action, so the
   D19 talk path never ran.
3. A public in-character `talk` post under an AI seat queues a `talk` turn after a 3 s quiet window,
   capped at 10 s from the first post (spec 065). Code skips the model call when no NPC is named and
   the post holds no `?`. The talk turn ships at most one narration row.
4. Out-of-character talk is never read by the talk path, but it reaches every player-facing prompt
   through the transcript tail.

## User Scenarios & Testing *(mandatory)*

The scenarios use the round 2 states and copy, over the `greyhollow-ford-duo` seed (Tamsin and
Kestrel are human, Brother Odo is an AI companion, Wenna Marsh is a present NPC).

### User Story 1 - The DM finds a deed and asks the player to confirm it (Priority: P1)

Kestrel says what she does, in character, with no mode to pick. After a visible quiet ring the DM
reads the table and asks, in its own words, whether it understood the action. Kestrel presses
👍 Yes and the action commits.

**Why this priority**: run 3 finding 2. This is the replacement for sign-off and the reason the
feature exists.

**Independent Test**: a scripted DM over the duo seed. Kestrel's line "I'll get up there and see
who's hiding." draws one `action.suggested` row whose item holds a `declared` `hide` Intent.
Kestrel's `action.accept` plans that Intent as `confirmed`: one batch of engine rows and one
`intent.recorded` row (amended 2026-11, A5).

**Acceptance Scenarios**:

1. **Given** free mode under an AI seat, **When** Kestrel sends an in-character line, **Then** a
   `say` Intent is recorded (a `talk` row, channel `ic`, plus its `intent.recorded` row) and a talk
   turn queues with `notBefore` = the post's `ts` + 10 s (round 2 state 1).
2. **Given** the post is 5 s old, **When** any viewer looks at the table, **Then** the ring shows 5
   of 8 segments and the caption "The DM reads the table in 5 s. Keep talking to wait." (state 2).
3. **Given** the read returns `confirm`, **When** it ships, **Then** one public `action.suggested`
   row by `ai:dm` holds one item: a `declared` `hide` Intent, actor `pc:kestrel`, text "Kestrel
   climbs the ladder to the loft, quietly".
4. **Given** that row, **When** Kestrel views it, **Then** the line reads "Kestrel climbs the ladder
   to the loft, quietly — Stealth. Is this right?" with **👍 Yes** and **Not quite** (state 6a).
5. **Given** that row, **When** Tamsin views it, **Then** the line reads "Waiting on Kestrel" and
   offers no button (state 6b).
6. **Given** Kestrel presses 👍 Yes, **When** the gate plans it, **Then** the item's Intent is
   planned as `confirmed`: the engine's Stealth rows and one `intent.recorded` row (id
   `<suggestionId>.i1`) land in one append, and the line reads "Confirmed".
7. **Given** a confirm that nobody answers, **When** a later read lands, **Then** nothing was
   committed and the line reads "Superseded".

### User Story 2 - Talk keeps the ring running; the DM waits for a pause (Priority: P1)

Players talk among themselves in character. Each readable post restarts the ring, so the DM reads
only after a pause. Out-of-character chatter neither restarts the ring nor reaches the DM.

**Why this priority**: D20 §3. Without the ring the DM reads half a plan.

**Independent Test**: a DB test. Two IC posts 4 s apart leave one queued talk turn with `notBefore`
= the second post's `ts` + 10 s. An OOC post leaves `notBefore` unchanged.

**Acceptance Scenarios**:

1. **Given** a running ring after Tamsin's post, **When** Kestrel posts in character, **Then** the
   ring is full again and the server's `notBefore` moves to Kestrel's post + 10 s (state 3).
2. **Given** a running ring, **When** Tamsin posts out of character, **Then** the ring and
   `notBefore` are unchanged, and the line is marked "Table talk".
3. **Given** a stream of IC posts every 5 s for a minute, **When** each lands, **Then** `notBefore`
   moves each time. No cap forces a read (D20 §3.1).
4. **Given** a player is typing, **When** no post is sent, **Then** the ring is unchanged
   (OQ-R1 (a)).
5. **Given** a human DM seat, **When** any post lands, **Then** no ring, no talk turn and no Thinking
   appear.

### User Story 3 - Thinking, and interrupting it on purpose (Priority: P1)

When the read starts the ring becomes "The DM is reading the table…". A player can still post, but
an in-character post first shows an inline strip that warns it cancels the read.

**Why this priority**: D20 §3.4 and §3.5. A silent interrupt wastes a model call and confuses the
table.

**Independent Test**: a DB test. A readable post while a talk turn is running in the talk path ends
that job (fenced, result `interrupted`) and leaves a queued talk turn at the post + 10 s. A markup
test shows the strip copy and its two buttons.

**Acceptance Scenarios**:

1. **Given** the worker claims a talk turn, **When** it starts, **Then** it appends one
   `presence.recorded` row with purpose `read`, and every client shows the Thinking chip (state 4).
2. **Given** Thinking, **When** Tamsin types an in-character line, **Then** Send reads "Send —
   interrupts the DM" (state 5).
3. **Given** that state, **When** Tamsin presses Send, **Then** the strip opens under the composer:
   "The DM is reading the table. Sending now cancels that read and restarts the timer." with
   **I'm sure** and **Wait**. Nothing is sent yet.
4. **Given** the strip, **When** Tamsin presses I'm sure, **Then** the line is sent, the running read
   is fenced and ships nothing, and a new read queues at the post + 10 s (OQ-R3 (a)).
5. **Given** the strip, **When** Tamsin presses Wait, **Then** the strip closes and the draft stays.
6. **Given** Thinking, **When** Tamsin sends an out-of-character line, **Then** no strip shows.
7. **Given** Thinking, **When** the read ships any row by `ai:dm`, **Then** Thinking ends.

### User Story 4 - "Not quite", and speech that is only speech (Priority: P1)

The player corrects a wrong reading by talking. A line that is only speech draws a D19 reply, not a
confirm.

**Why this priority**: D20 §4.5 and §4.1. The confirm is a check on the AI's reading; it must be
cheap to refuse.

**Acceptance Scenarios**:

1. **Given** Kestrel's confirm line, **When** Kestrel presses Not quite, **Then** the cursor moves to
   the composer and nothing is logged (state 7).
2. **Given** Kestrel then posts "No, I call up first: 'We're not here to hurt you.'", **When** it
   lands, **Then** the ring restarts.
3. **Given** that read returns `reply`, **When** it ships, **Then** one narration row in Wenna's
   voice lands ("Who's asking? …Three of you. Fine. Come up slow."), no confirm row appears, and
   the earlier confirm line reads "Superseded" (state 8).
4. **Given** the stale line, **When** Kestrel presses 👍 on it from a stale client, **Then** the gate
   refuses `SUGGESTION_STALE` and the composer shows "The DM has read the table again. Answer the
   newer line."

### User Story 5 - A party confirm (Priority: P2)

A player speaks for the party with the `The party` chip. The DM confirms a party action. The first
present human party member to press 👍 commits it.

**Acceptance Scenarios**:

1. **Given** Tamsin's character speaker, **When** Tamsin posts "We follow the clawed tracks down to
   the causeway.", **Then** a `say` Intent lands, and the read may confirm an `attempt` with scope
   `party` (state 9; the `The party` speaker is withdrawn, OQ-8).
2. **Given** a confirm with one `party` item, **When** Tamsin and Kestrel view it, **Then** both see
   **👍 Yes**.
3. **Given** Kestrel presses 👍 first, **When** the gate plans it, **Then** the `attempt` Intent
   (scope `party`, actor re-stamped to Kestrel's character) is planned as `confirmed`, no sign-off
   marker is written, and Tamsin's later 👍 is refused `INTENT_EXISTS` (OQ-R2 (a); amended A5).

### User Story 6 - `@dm` questions (Priority: P2)

A player asks the DM an out-of-character question with `@dm`. The DM answers once, to the whole
table, from what the characters can see.

**Acceptance Scenarios**:

1. **Given** Tamsin's post "@dm how high is the loft? Can I see up there from the door?",
   **When** it lands under an AI seat, **Then** it is an `ask_dm` Intent whose `talk` row is
   visible to Tamsin and the DM only, and the ring restarts (state 10; amended A7, OQ-6).
2. **Given** the read, **When** it answers, **Then** one `talk` row by `ai:dm`, channel `ooc`,
   `characterId` null, visibility Tamsin's user id, ships, and it is drawn as a "DM aside".
3. **Given** the answer text leaks a DM-only seed item, **When** the spec 103 narration check runs,
   **Then** the leaking sentences are dropped, and an empty answer ships nothing.
4. **Given** turn mode, **When** an `ask_dm` lands, **Then** it is answered with no ring
   (window 0; OQ-10 (a), amended A1).
5. **Given** a human DM seat, **When** an `@dm` post lands, **Then** nothing is generated and the
   human DM's transcript highlights the post.
6. **Given** an `@dm` answer, **When** the state is compared before and after, **Then** no state
   changed.

### User Story 7 - Combat: Enter commits (Priority: P1; amended 2026-11, A6)

In combat there is no ring. On Kestrel's turn her Enter commits what she typed.

**Why this priority**: P-04 and TASK-0315 AC (old TASK-0199 AC #4; F2). Built by TASK-0315 after the split.

**Acceptance Scenarios**:

1. **Given** turn mode with Kestrel active, **When** Kestrel sends `/attack @goblin-1 with
   shortbow`, **Then** one `intent` request with `commit: "confirmed"` is sent, the gate plans it,
   and no ring or read appears.
2. **Given** turn mode with Kestrel active, **When** Kestrel sends "I shoot the goblin lookout.",
   **Then** the client sends `action.declare` then `action.commit`, the action commits with
   authority `active-player`, and interpret (spec 104) plans its Intent stages.
3. **Given** turn mode, **When** Tamsin (not active) sends plain text, **Then** a `say` Intent lands,
   no ring and no talk turn appear, and the next beat's narrate reads it (D19 §2 rule 4).
4. **Given** turn mode, **When** Tamsin (not active) sends a slash Intent, **Then** the gate refuses
   `NOT_YOUR_TURN` and the composer shows the refusal label. The worded reason is TASK-0275's.

### User Story 8 - The human DM confirms by hand (Priority: P2)

A seated human DM sees no ring and no Thinking. Each in-character line offers **Confirm as
action…**, which opens an inline editor. The DM writes the wording and sends the confirm row.

**Acceptance Scenarios**:

1. **Given** a human DM seat, **When** the DM views an IC line, **Then** it carries **Confirm as
   action…** (state 12).
2. **Given** the DM presses it, **When** the editor opens inline under the line, **Then** it holds
   the line's wording, its character (or party when the line has none) and an empty check field,
   with **Send confirm** and **Cancel**. No modal.
3. **Given** the DM presses Send confirm, **When** the gate applies it, **Then** one public
   `action.suggested` row by the DM's user id lands (an `attempt` item with the DM's wording, or the
   parsed Intent when the wording starts with `/`), and the player sees 👍 Yes as in US1.
4. **Given** a player's `declared` slash Intent under a human seat, **When** the DM views it,
   **Then** it carries **Confirm**, which sends the same Intent as `confirmed` (spec 102 FR-007).
5. **Given** any action, **When** the DM uses the action card, **Then** the DM may commit or
   withdraw it, as today.

### User Story 9 - Retract after 👍 (withdrawn 2026-11, A9)

Withdrawn. A 👍 now plans the Intent at once, so no committed-but-unresolved window remains. See
OQ-7 for declared-Intent withdrawal.

### Edge Cases

- **A deed the DM misses** gets no confirm. The player says it again more plainly (D20
  Consequences).
- **A confirm naming a companion, an NPC, an absent or a downed character**: code drops that item. A
  confirm with no item left ships nothing and records outcome `none`.
- **A read with a confirm and an `@dm` answer**: both ship, the answer first. Neither counts toward
  the chain cap. A confirm prompts no companion (D20 §7).
- **A companion's line during the ring**: it is readable, so it restarts the ring.
- **A post that addresses only AI companions**: the companion prompt queues as in spec 065, and the
  read queues too (gap 2 below).
- **A read that returns `none`**: it ships nothing, so Thinking ends by its time bound (gap 1 below).
- **A commit lands during the ring**: the queued talk turn becomes a commit turn (spec 065 US5 #2).
  The commit narration ends the ring's purpose: the ring finishes and hides, and no Thinking shows.
- **A reload during the ring**: the ring is drawn from the post's `ts`, so it resumes where it was.
- **Fixture routes**: fixture rows carry old `ts` values, so no ring or Thinking shows.
- **Two humans press 👍 on a party line at once**: the per-session write queue orders them. The
  first is planned; the second gets `INTENT_EXISTS`.
- **An interrupt after the read already shipped a row**: the shipped row stands. The new read
  starts after it, because its cutoff is the latest DM read output.
- **A 👍 after the table enters combat**: the suggestion is stale (FR-018) and refused
  `SUGGESTION_STALE`.
- **A spec 104 runner declare** (`<actionId>.<n>`): never a readable post (FR-006 rule 2, OQ-9).
- **A direct declare from a VTT or the API**: today's rules, including the 044 quorum and the 120 s
  stall commit, still hold (OQ-11 (a)).

## Requirements *(mandatory)*

### Functional Requirements

Rewritten in place by the 2026-11 amendment. Numbers changed; the 2026-11-02 list is in git
history (`3aaf8279`).

**Composer and transcript (D20 §1, §2; A2)**

- **FR-001**: The play route MUST have one composer with one Send button. A speaker chip left of
  the input opens an inline dropdown: the viewer's characters and `You (out of character)`. A line
  starting `((` or `/ooc` flips the chip to out of character.
- **FR-002**: Typing `@` MUST open an inline autocomplete dropdown: `@dm` first, then the party's
  characters, then present named combatants. Choosing an entry inserts its token.
- **FR-003**: Send MUST run `parse(text, { id, actor, source: "composer", commit })`. A parse
  refusal shows inline under the composer and sends nothing. Otherwise Send sends one `intent`
  request. `commit` is `declared` in free mode and `confirmed` in turn mode. The out-of-character
  chip sends `ooc`. FR-022 covers the active player's prose in turn mode.
- **FR-004**: An `ooc` line MUST be drawn as "Table talk". An `ask_dm` answer MUST be drawn as a
  "DM aside". A confirm row MUST be drawn apart from both and from narration.
- **FR-005**: The player view MUST NOT show Talk/Action radios, scope radios, a Declare button, the
  action comment form, Approve, Object or sign-off rows. The web client MUST NOT send
  `action.comment`. It sends `action.declare` only under FR-022. Commit shows for the DM viewer only.

**The read (D20 §2, §3, §6, §7; A1, A3, A4)**

- **FR-006**: `readablePosts(p)` in `@the-stacks/session-model` (pure, shared by server and client)
  MUST return, under an AI seat only:
  1. a `say`, `say_to` or `emote` Intent by a human or an AI companion, in free mode;
  2. a `declared` mechanical Intent by a human, in free mode, still `declared`, whose id does not
     start with an existing action id and a dot (OQ-9);
  3. an `ask_dm` Intent by a human, in any mode;
  4. a public `ic` `talk` row by an AI companion whose batch holds no `intent.recorded` row, in free
     mode (legacy; until TASK-0299).
  The D19 chain cap MUST still apply.
- **FR-007**: A readable post MUST queue or move the session's talk turn to `notBefore` = the post's
  `ts` + 10 s, or the post's `ts` for rule 3 in turn mode. Every later readable post moves it again.
  There is no cap.
- **FR-008**: A readable post that lands while a read runs, before the read ships anything, MUST
  cancel it: the job is fenced, finishes with outcome `interrupted`, and ships nothing. The gate
  MUST refuse an `ai:dm` `action.suggest` whose `readSeq` is older than the latest readable post
  (`SUGGESTION_STALE`).
- **FR-009**: When the worker claims a `talk` turn it MUST append one `presence.recorded` row with
  purpose `read`, in place of the `director` marker.
- **FR-010**: The read MUST take every readable post after the latest DM read output (an `ai:dm`
  narration, an `action.suggested` row, or an `ai:dm` `ooc` `talk` row). It MUST make one model call
  when a read post is rule 1, 3 or 4 and human-authored. A read of rule 2 posts only MUST make no
  call. It returns one outcome (`none`, `reply`, `scene`, `escalate`, `confirm`) and at most one
  `ask_dm` answer.
- **FR-011**: A `confirm` MUST hold 1 to 4 items. A model item is an acting character id (or null
  for party scope), an Intent body from the interpret body schema (spec 104: its kinds, no `dc`),
  and the DM's wording. Code stamps id `<suggestionId>.i<n>`, actor `pc:<id>`, source `ai` and
  commit `declared`, and validates it with `IntentSchema`. A party item is `attempt` with scope
  `party`, actor the first human party member. Code drops an item for a companion, an NPC, an absent
  or downed character, or a character no human controls. Each rule 2 post becomes one item in code,
  with its own id and body.
- **FR-012**: Confirm wording and the answer MUST pass the spec 103 narration check (leak and
  contradiction). A failing item is dropped. Failing answer sentences are dropped; an empty answer
  ships nothing.
- **FR-013**: A `confirm` MUST ship as an `action.suggest` proposal through `gate.submit` as
  `ai:dm`. An answer MUST ship as a `talk` proposal by `ai:dm`, channel `ooc`, `characterId` null,
  visibility the asker's user id. Neither counts toward the chain cap. A confirm prompts no
  companion.
- **FR-014**: No player-facing prompt may see `ooc` talk. `ask_dm` rows are not public, so the
  public filter already drops them. The read (DM side) sees them.

**The confirm row (D20 §4; A4, A5)**

- **FR-015**: A confirm line MUST offer **👍 Yes** and **Not quite** to whoever may accept it: the
  human controller of the item's `pc` actor, or any human party member for a party item. Every
  other viewer sees "Waiting on <name>" ("the party" for a party item).
- **FR-016**: 👍 Yes MUST send one `action.accept` `{ suggestionId, itemId }`. The planner checks,
  in order: the item exists (`SUGGESTION_NOT_FOUND`); not stale (`SUGGESTION_STALE`); the acceptor
  may accept (`NOT_AUTHORIZED`); the character can act (`CHARACTER_UNABLE`). It then plans the item's
  Intent with `commit: "confirmed"` and `source: "composer"` through `planIntent` (spec 102). For a
  party item the actor is re-stamped to the acceptor's first controlled character. A second 👍 is
  refused `INTENT_EXISTS`. A line reads "Confirmed" once an `intent.recorded` row with its id exists.
- **FR-017**: Not quite MUST move focus to the composer. It logs nothing.
- **FR-018**: A suggestion is **stale** when a later public `action.suggested` row, a later public
  `narration` row with no `actionIds`, or a later `table-mode.changed` into turn mode exists. A
  stale line reads "Superseded". A confirmed item reads "Confirmed" whatever its staleness. An
  unanswered confirm plans nothing.
- **FR-019**: A human DM viewer MUST see no ring and no Thinking. Each `say` line carries **Confirm
  as action…**, an inline editor that sends `action.suggest` (an `attempt` item with the DM's
  wording, or the parsed Intent when the wording starts with `/`). Each `declared` Intent line
  carries **Confirm**, which sends that Intent as `confirmed`. `ask_dm` posts are highlighted. The
  DM keeps commit and withdraw on every action card.
- **FR-020**: `ai:dm` MUST NOT send `action.accept`, `action.declare` or `action.withdraw`.
- **FR-021**: `action.declare`, `action.comment`, `action.commit` and `action.withdraw` MUST keep
  today's rules, the 044 quorum and the 049 stall commit included.

**Combat (P-04; F2; A6)**

- **FR-022**: In turn mode no ring or read MUST run for FR-006 rules 1, 2 and 4. The active
  player's Enter commits: a parsed non-`say` Intent goes as `confirmed`; plain prose goes as
  `action.declare` (scope `character`) then `action.commit`, authority `active-player`. A non-active
  player's prose goes as `say`. A non-active player's slash Intent goes as `confirmed`; the gate
  refuses it `NOT_YOUR_TURN`, and the composer shows the refusal label.
- **FR-023**: The active player's Commit control MUST leave the action card. Enter replaces it.

**The ring and Thinking in the client (D20 §3)**

- **FR-024**: Under an AI seat, in free mode, the client MUST draw the ring from the latest readable
  post's `ts` and the client clock: blank for 2 s, then 8 segments, one emptying per second.
  Caption: "The DM reads the table in N s. Keep talking to wait." Typing does not restart it. A
  remaining time above the window is clamped. The ring hides on a later `read` marker or `ai:dm`
  row, in turn mode, under a human seat, and for a DM viewer.
- **FR-025**: Thinking MUST show "The DM is reading the table…" from the latest `read` marker until
  the first of: a later row by `ai:dm`, a later readable post, or 30 s after the marker's `ts`.
- **FR-026**: During Thinking, in free mode, with a character speaker, Send MUST read "Send —
  interrupts the DM". Pressing it opens the inline strip with **I'm sure** and **Wait**. I'm sure
  sends; Wait closes the strip and keeps the draft. An `ooc` or `ask_dm` line never opens it.

**Human-DM tables (P-04; A8)**

- **FR-027**: The human DM seat MUST be the ring-off setting. Under a human seat `readablePosts`
  returns nothing, so no talk turn, ring or Thinking appears (OQ-5).

**`ask_dm` (A7)**

- **FR-028**: The gate MUST serve `ask_dm`: one `talk` row (`ooc`, the text, `characterId` null) and
  its `intent.recorded` row, both with visibility the proposer's user id. The answer (FR-013)
  changes no projection except `transcript`, `throughSeq`, `diagnostics` and `intents`.

**Frozen-contract amendments (plan.md "Frozen-contract amendments"; C-GATE ruled 2026-11-11, "Approve all")**

- **FR-029**: The TASK-0188 amendment blocks (2026-11-02) are re-amended per plan.md rows C-1 to
  C-10. `TalkV1` and the `ws-protocol.md` frame shapes stay unchanged (D20 §8.6; spec 092
  "FR-031 holds").

**Direct Intents are narrated (OQ-3 (b); card AC #7)**

- **FR-031**: An `intent.recorded` row with outcome `settled`, or with a `stopped` refusal, appended
  outside a turn job MUST queue one coalesced `turn` job with trigger `intent`. A row a running turn
  job appended queues nothing. The turn narrates the row's facts through the spec 104 narrate window.
  The rule sits beside TASK-0314's human-ruling resume rule in `dm/enqueue.ts`, and the
  one-queued-turn index coalesces them.

**VTT parity (D20 §5)**

- **FR-030**: Every gesture MUST be a gate request a VTT can send: `intent`, `action.accept`,
  `action.suggest`, or the existing kinds. The ring and Thinking derive from logged rows and are
  never logged.

### Card acceptance criteria map

Superseded by the table in "Amendment (2026-11, Intent contract v1.1)". The 2026-11-02 card ACs
were re-authored by replan-2026-11.

### Key Entities

- **Readable post**: an entry `readablePosts(p)` returns (FR-006). Not a new event.
- **Read**: a `turn` job with trigger `talk` (spec 065's talk turn). It ends with one outcome.
- **Read marker**: `presence.recorded` with purpose `read`.
- **Suggestion**: an `action.suggested` row `{ suggestionId, readSeq, items[] }`; each item Intent id is `<suggestionId>.<itemId>`.
- **Item**: `{ itemId, text, intent }`; `intent` is a full Intent at commit `declared`. Its id is
  `<suggestionId>.<itemId>`, or a player's declared Intent id (FR-011).
- **Confirm view**: the client's view of one suggestion: its lines, who may accept each, and
  whether each is open, confirmed or superseded.

## Decision gaps settled here

Each is settled inside the ruled scope. None adds a frozen-contract change beyond D20 §8.

1. **When Thinking ends after a `none` read.** D20 logs the start of a read but nothing for a read
   that ships nothing. Settled: the client ends Thinking at the first later `ai:dm` row, the next
   readable post, or 30 s after the marker's `ts` (FR-024). A logged end marker would be a further
   `presence.recorded` purpose, which §8 does not list.
2. **Spec 065's model-skip and companion-only shortcuts.** Under D20 a deed needs no NPC name and no
   `?`, so code skip (D19 OQ-16) would hide every plain deed. A companion-only post that skipped the
   read would leave a ring with no read behind it. Settled: a read with a human-authored post always
   calls the model (FR-009). A companion-only post still queues the companion prompt, and the read
   queues too.
3. *(Withdrawn 2026-11, A9.)* **What a withdrawal after 👍 does to a running beat.** D20 §4.7 widens `action.withdraw` but says
   nothing about a beat that already froze the action. Settled: resolve skips a withdrawn action
   when its group runs, and reconcile ignores it (FR-019). Rows already landed stand.

Smaller readings, recorded so a reviewer can check them:

- The round 2 mock marks a confirm "Superseded" as soon as the correction posts (state 7). D20 §4.6
  says it goes stale when the next read lands. This spec follows D20 (FR-017).
- An already-accepted item is refused `INTENT_EXISTS` (amended A5), because its Intent id is
  derived. D20 §8.2 adds only the two `SUGGESTION_*` codes.
- `ActionCardView.signoff` and the action comment form are removed outright, for the DM viewer
  too: nothing in the web sends a direct declare any more, the DM's commit ignores the quorum, and
  D20 gives the DM commit and withdraw only. The Commit button shows for the DM viewer only.
- An `@dm` post is out of character, so it never shows the interrupt strip (D20 §3.5). It is still
  readable, so during Thinking it cancels the running read like any readable post (FR-007).
- Removing the direct-declare controls also changes the 030 `table-source.md`, `live-frames.md`
  and `ui-surfaces.md` contracts and the 049 `ui-floor.md` action-card lines. These follow from
  D20 §1, which the ruling accepted; their amendment blocks cite it.
- The player view loses the action comment form (D20 §1), so a human can no longer object to an
  AI companion's open action from the web. Spec 036's react trigger stays in the server for VTT and
  API use. D20 §4.10 keeps companion behaviour unchanged; this is the one reach it loses.
- The `@` dropdown lists present combatants by name, not every present seed NPC: the client
  projection holds no seed NPC names. A public NPC-name source is follow-up work, not this card.
- FR-013 removes OOC talk from every player-facing prompt's transcript tail, not only the read's:
  D20 §2 says the DM never reads it. DM-side prompts keep the full tail.
- *(Superseded 2026-11, A4.)* The check is now the Intent kind and its params (`check`, `hide`,
  `search`, `attack`…), validated by `IntentSchema`. The model writes no DC.
- The confirm line shows the item's `text` plus a code-rendered kind label (for example
  "Stealth check"), not `toText(intent)`: slash form reads badly to a player.

## Non-goals

- **No typing frame or typing indicator.** Only a sent post restarts the ring (OQ-R1 (a));
  `ws-protocol.md` excludes typing indicators.
- **No `TalkV1` change.** A party voice is IC talk with `characterId` null. An `@dm` post is
  ordinary OOC talk.
- **No `ws-protocol.md` frame change.** New requests ride the existing `send` frame; new rows ride
  the existing event frame.
- No Do flag or deed marker (round 2 B, rejected).
- No removal of direct declares, comments, commits or the 044 quorum from the gate (OQ-11 (a)).
- No banner, economy pips, legal-action bar or worded off-turn reason (TASK-0275, F2).
- No Intent pills, Tab completion or clickable nouns (TASK-0247).
- No withdraw of a declared Intent (OQ-7). No quiet-ring toggle event (OQ-5).
- No new DM purpose, no hosted AI config change, no migration, no new runtime dependency.
- No change to companion behaviour (D20 §4.10), to the 049 stall commit or to its 120 s window.
- No VTT adapter (TASK-0072); this card only keeps the events VTT-drivable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the confirm fixture, one IC deed yields exactly 1 `action.suggested` row, and one
  👍 yields exactly 1 `intent.recorded` row with `commit: "confirmed"` and 0 `action.declared` rows.
- **SC-002**: OOC posts move `notBefore` 0 times; each readable post moves it exactly once; 12 posts
  5 s apart force 0 reads before the last post + 10 s.
- **SC-003**: An interrupt during the talk path ships 0 rows from the fenced read and leaves exactly
  1 queued talk turn.
- **SC-004**: `ai:dm` `action.accept`, `action.declare` and `action.withdraw` are refused 3 of 3
  times. A 👍 on a stale suggestion is refused 1 of 1 times. In turn mode a readable-rule test
  returns 0 posts for rules 1, 2 and 4, and under a human seat 0 posts for every rule.
- **SC-004a**: An `ask_dm` and its answer leave `engine`, `actions`, `party`, `encounter` and
  `tableMode` deep-equal before and after.
- **SC-005**: The player view's markup holds 0 of these names: "Message type", "Scope", "Declare",
  "Approve", "Object", "Commit", "Comment on this action". `apps/web/test/no-dialog.test.mjs` is
  green.
- **SC-006**: Every existing DM script, DB suite and web markup test passes, amended only where
  this spec changes the rule it checks.
- **SC-007**: Stubbing the readable rule, the stale rule, the accept authority or the interrupt
  fence fails at least one test each; restoring leaves an empty diff.
- **SC-008**: In the script-mode live check in Brave, two browsers see one composer with one Send,
  the ring, Thinking, the confirm row (👍 for Kestrel, "Waiting on Kestrel" for Tamsin), the
  `intent.recorded` row after 👍, and no ring in turn mode, with no modal at 1280 and 390 px and an
  accessibility check passed.

## Assumptions

- Model judgment (finding the deed, its wording) is not provable without a paid call. The fake
  gateway proves the code path; the next alpha run is the provider evidence.
- Server and client clocks agree to about a second (both NTP-synced). A skew shows as a ring that
  ends a little early or late; the clamp in FR-023 bounds a client that runs behind.
- A read costs one `dm.narrate`-class call of 10 to 20 s on hosted dev (spec 065 measurement), so a
  confirm lands about 20 to 30 s after the last post.
