# Feature Specification: One chat stream — players talk, the DM confirms each action

**Feature Branch**: `task-0188-one-chat-stream`

**Created**: 2026-11-02

**Status**: Draft, written against an accepted decision. decision-0028 (D20) is **accepted**
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
who's hiding." draws one `action.suggested` row. Kestrel's `action.accept` appends
`action.declared` (with `suggestionId`) and `action.committed` in one batch, and a commit turn
queues.

**Acceptance Scenarios**:

1. **Given** free mode under an AI seat, **When** Kestrel sends an in-character line, **Then** a
   `talk` row (channel `ic`) is logged and a talk turn queues with `notBefore` = the post's `ts`
   + 10 s (round 2 state 1).
2. **Given** the post is 5 s old, **When** any viewer looks at the table, **Then** the ring shows 5
   of 8 segments and the caption "The DM reads the table in 5 s. Keep talking to wait." (state 2).
3. **Given** the read returns `confirm`, **When** it ships, **Then** one public `action.suggested`
   row by `ai:dm` holds one item: Kestrel, scope `character`, "Kestrel climbs the ladder to the
   loft, quietly", check "Stealth".
4. **Given** that row, **When** Kestrel views it, **Then** the line reads "Kestrel climbs the ladder
   to the loft, quietly — Stealth. Is this right?" with **👍 Yes** and **Not quite** (state 6a).
5. **Given** that row, **When** Tamsin views it, **Then** the line reads "Waiting on Kestrel" and
   offers no button (state 6b).
6. **Given** Kestrel presses 👍 Yes, **When** the gate plans it, **Then** `action.declared`
   (Kestrel's actor, the DM's wording, `suggestionId`) and `action.committed` (authority
   `declarer`) land in one append, and the line reads "Confirmed".
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

1. **Given** the speaker chip set to `The party`, **When** Tamsin posts "We follow the clawed tracks
   down to the causeway.", **Then** a `talk` row (channel `ic`, `characterId` null) lands (state 9).
2. **Given** a confirm with one `party` item, **When** Tamsin and Kestrel view it, **Then** both see
   **👍 Yes**.
3. **Given** Kestrel presses 👍 first, **When** the gate plans it, **Then** the action commits with
   authority `group`, no sign-off marker is written, and Tamsin's later 👍 is refused
   `ACTION_EXISTS` (OQ-R2 (a)).

### User Story 6 - `@dm` questions (Priority: P2)

A player asks the DM an out-of-character question with `@dm`. The DM answers once, to the whole
table, from what the characters can see.

**Acceptance Scenarios**:

1. **Given** Tamsin's OOC post "@dm how high is the loft? Can I see up there from the door?",
   **When** it lands under an AI seat, **Then** the ring restarts (state 10).
2. **Given** the read, **When** it answers, **Then** one public `talk` row by `ai:dm`, channel
   `ooc`, `characterId` null, ships, and it is drawn as a "DM aside".
3. **Given** the answer text states a DM-only seed item, **When** code checks it, **Then** it is
   refused, regenerated once, and a second refusal ships no answer.
4. **Given** turn mode, **When** an `@dm` post lands, **Then** it is answered too (OQ-10 (a)).
5. **Given** a human DM seat, **When** an `@dm` post lands, **Then** nothing is generated and the
   human DM's transcript highlights the post.
6. **Given** an `@dm` answer, **When** the state is compared before and after, **Then** no state
   changed.

### User Story 7 - Turn mode (Priority: P2)

On Kestrel's turn her in-character line runs a short ring, then the DM confirms her attack.

**Acceptance Scenarios**:

1. **Given** turn mode with Kestrel active, **When** Kestrel posts "I shoot the goblin lookout.",
   **Then** the ring is 1 s blank then 4 segments, and `notBefore` = the post + 5 s (state 11a,
   OQ-R5 (a)).
2. **Given** the read returns `confirm`, **When** Kestrel presses 👍, **Then** the action commits
   with authority `active-player` (state 11b).
3. **Given** turn mode, **When** Tamsin (not active) posts in character, **Then** no ring and no talk
   turn; the next beat's narrate reads it (D19 §2 rule 4).

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
   `action.suggested` row by the DM's user id lands, and the player sees 👍 Yes as in US1.
4. **Given** any action, **When** the DM uses the action card, **Then** the DM may commit or
   withdraw it, as today.

### User Story 9 - Retract after 👍 (Priority: P2)

A player who confirmed by mistake withdraws the action before it resolves.

**Acceptance Scenarios**:

1. **Given** Kestrel's committed, unresolved action, **When** Kestrel presses Withdraw, **Then** the
   gate appends `action.withdrawn` and the card reads "Withdrawn" (OQ-R4 (a)).
2. **Given** a resolved action, **When** anyone tries to withdraw it, **Then** the gate refuses
   `ACTION_NOT_OPEN`.
3. **Given** a withdrawn committed action, **When** the worker restarts, **Then** reconcile queues no
   turn for it.
4. **Given** the action was in a running beat, **When** resolve reaches it after the withdrawal,
   **Then** resolve skips it and records the skip. Rows already landed for it stand.

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
  first commits; the second gets `ACTION_EXISTS`.
- **An interrupt after the read already shipped a row**: the shipped row stands. The new read
  starts after it, because its cutoff is the latest DM read output.
- **A direct `action.declare` that carries `suggestionId`**: refused `INVALID_PROPOSAL`. Only
  `action.accept` links an action to a suggestion.
- **A direct declare from a VTT or the API**: today's rules, including the 044 quorum and the 120 s
  stall commit, still hold (OQ-11 (a)).

## Requirements *(mandatory)*

### Functional Requirements

**Composer and transcript (D20 §1, §2)**

- **FR-001**: The play route has one composer with one Send button. A speaker chip left of the input
  opens an inline dropdown: the viewer's characters, `The party`, and `You (out of character)`. A
  line starting `((` or `/ooc` flips the chip to out of character, and the prefix is removed.
- **FR-002**: Typing `@` opens an inline autocomplete dropdown: `@dm` first, then the party's
  characters, then present named combatants. Choosing an entry inserts its token.
- **FR-003**: The player view shows no Talk/Action radios, scope radios, Declare button, action
  comment form, Approve, Object, Commit or sign-off rows. The web client never sends
  `action.declare`, `action.comment` or a player `action.commit`.
- **FR-004**: An out-of-character line is drawn as "Table talk". An `@dm` answer is drawn as a "DM
  aside". A confirm row is drawn apart from both and from narration.

**The read (D20 §2, §3, §6, §7)**

- **FR-005**: A post is **readable** when it is a public `talk` row under an AI seat and one of
  these holds:
  1. channel `ic`, by a human or an AI companion, in free mode;
  2. channel `ic`, in turn mode, by the active actor when that actor is a human;
  3. channel `ooc`, by a human, its text holds the token `@dm`, in any mode.
  The D19 chain cap still applies. The rule is one pure function in `@the-stacks/session-model`,
  shared by the server and the client.
- **FR-006**: A readable post queues or moves the session's talk turn to `notBefore` = the post's
  `ts` + 10 s, or + 5 s for rule 2. Every later readable post moves it again. There is no cap.
- **FR-007**: A readable post that lands while a read runs, before the read ships anything,
  cancels it: the job is fenced, finishes with outcome `interrupted`, and ships nothing. The post
  queues a fresh read by FR-006. The gate refuses an `ai:dm` `action.suggest` whose `readSeq` is
  older than the latest readable post (`SUGGESTION_STALE`), so a confirm never lands against a
  reading the table has moved past, even in the race between the fence and the ship.
- **FR-008**: When the worker claims a `talk` turn it appends one `presence.recorded` row with
  purpose `read`, in place of the `director` marker.
- **FR-009**: The read takes every readable post after the latest DM read output (an `ai:dm`
  narration, an `action.suggested` row, or an `ai:dm` OOC `talk` row). It makes one model call
  whenever a read post is human-authored. It returns one outcome: `none`, `reply`, `scene`,
  `escalate` or `confirm`, and at most one `@dm` answer.
- **FR-010**: A `confirm` holds 1 to 4 items. Each has a character id or null, a scope (`character`
  or `party`), the DM's wording, and a check or null. Code keeps a `character` item only when it
  names a present, conscious party member controlled by a human. A `party` item needs at least one
  human party member. In turn mode code keeps only items for the active character. Each item
  becomes one confirm line.
- **FR-011**: Confirm wording and the `@dm` answer pass `checkClaims`, the DM-only seed text check
  and the digit check. One refusal regenerates once; a second ships neither.
- **FR-012**: A `confirm` ships as an `action.suggest` proposal through `gate.submit` as `ai:dm`. An
  `@dm` answer ships as a `talk` proposal by `ai:dm`, channel `ooc`, `characterId` null, public.
  Neither counts toward the chain cap. A confirm prompts no companion.
- **FR-013**: No player-facing prompt sees out-of-character talk, except `@dm` posts and `ai:dm`
  answers.

**The confirm row (D20 §4)**

- **FR-014**: A confirm line offers **👍 Yes** and **Not quite** to whoever may accept it: the
  human controller of the item's character, or any human party member for a `party` item. The
  acceptor counts as present, as the spec 044 committer does, so no presence read is needed. Every other
  viewer sees "Waiting on <name>" (a `party` item names "the party").
- **FR-015**: 👍 Yes sends one `action.accept` `{ suggestionId, itemId }`. The planner appends
  `action.declared` (actor the acceptor, id `<suggestionId>.<itemId>`, text the DM's wording plus
  " — <check>" when a check is set, scope, character, `suggestionId`) and `action.committed` in one batch. Authority: `declarer` in free
  mode, `active-player` in turn mode, `group` for a `party` item. No sign-off marker is written.
- **FR-016**: Not quite moves focus to the composer. It logs nothing.
- **FR-017**: A suggestion is **stale** when a later public `action.suggested` row or a later public
  `narration` row with no `actionIds` exists. A stale line reads "Superseded". An accepted item
  reads "Confirmed" whatever its staleness. A 👍 on a stale suggestion is refused
  `SUGGESTION_STALE`. An unanswered confirm commits nothing.
- **FR-018**: `action.withdraw` also accepts a `committed` action that has not resolved. The
  declarer and the seated human DM may withdraw it. The card's Withdraw shows until it resolves.
- **FR-019**: Resolve skips a beat action that is withdrawn when its group runs. Reconcile skips a
  committed action with a later `action.withdrawn`.
- **FR-020**: A human DM viewer sees no ring and no Thinking. Each IC line carries **Confirm as
  action…**, which opens an inline editor and sends `action.suggest`. The human DM keeps commit and
  withdraw on every action card. The human DM's transcript highlights `@dm` posts.
- **FR-021**: `ai:dm` never sends `action.accept`, `action.declare` or `action.withdraw`. AI
  companions declare and commit their own actions as today.
- **FR-022**: `action.declare`, `action.comment` and `action.commit` keep today's rules, the 044
  quorum and the 049 stall commit included. A direct `action.declare` carrying `suggestionId` is
  refused `INVALID_PROPOSAL`.

**The ring and Thinking in the client (D20 §3)**

- **FR-023**: Under an AI seat the client draws the ring from the latest readable post's `ts` and
  the client clock: blank for 2 s, then 8 segments, one emptying per second (turn-mode rule 2: 1 s,
  then 4). Caption: "The DM reads the table in N s. Keep talking to wait." Typing does not restart
  it. A remaining time above the window is clamped to the window. The ring hides when a later
  `read` marker or a later `ai:dm` row exists.
- **FR-024**: Thinking shows "The DM is reading the table…" from the latest `read` marker until the
  first of: a later row by `ai:dm`, a later readable post, or 30 s after the marker's `ts`.
- **FR-025**: During Thinking, with the chip on a character or the party, Send reads "Send —
  interrupts the DM". Pressing it opens the inline strip with **I'm sure** and **Wait**. I'm sure
  sends; Wait closes the strip and keeps the draft. An out-of-character line never opens it.

**Frozen-contract amendments (decision-0028 §8; operator ruling 2026-11-02: "All (a), amend")**

- **FR-026** (§8.1, `specs/029-proposal-gate/contracts/proposals.md`): a new DM kind
  `action.suggest`, policy `auto`. A new player request `action.accept`. `action.withdraw` also
  accepts a committed, unresolved action.
- **FR-027** (§8.2, `policy-and-authority.md`): `action.accept` authority is the controller of the
  item's character, or for `party` any present human party member. New refusal codes
  `SUGGESTION_STALE` and `SUGGESTION_NOT_FOUND`.
- **FR-028** (§8.3, `proposal-events.md` and the session-model catalog): a new event
  `action.suggested`. `action.declared` gains optional `suggestionId`. `presence.recorded` gains
  purpose `read`.
- **FR-029** (§8.4, `specs/030-play-route/contracts/proposal-seam.md`): `ActionCardView.signoff`
  leaves the view. A new `ConfirmView` (the items, who may accept, stale) rides the transcript.
- **FR-030** (§8.5, `specs/031-dm-runtime/contracts/`, additive): the `confirm` outcome, the `@dm`
  answer, the ring window and the read marker.
- **FR-031** (§8.6): no change to the `ws-protocol.md` frame shapes or to `TalkV1`.

**VTT parity (D20 §5)**

- **FR-032**: Every gesture maps to D20 §5's table. The ring and Thinking are derived from logged
  rows and their arrival, never logged themselves.

### Card acceptance criteria map

| Card AC | Covered by | Evidence |
|---|---|---|
| #1 What an IC, an OOC and an `@dm` post mean to the DM | D20 §2, §6; FR-004, FR-005, FR-009, FR-012, FR-013 | `read-rule.test.ts`, `enqueue-talk.integration.test.ts`, `talk-turn.integration.test.ts` |
| #2 What replaces sign-off; how a player retracts or amends | D20 §4; FR-003, FR-014 to FR-020 | `gate-suggest.test.ts`, `gate-plan.test.ts`, `confirm-row.test.tsx` |
| #3 How the model maps onto events a VTT could emit | D20 §5; FR-026 to FR-032 | the contract amendments; `catalog.test.ts` |
| #4 A spec is written against the decision; implementation tasks are carded | this spec set | the orchestrator cards the phases of `tasks.md` |

### Key Entities

- **Readable post**: a `talk` row that passes FR-005. Not a new event.
- **Read**: a `turn` job with trigger `talk` (spec 065's talk turn). It ends with one outcome.
- **Read marker**: `presence.recorded` with purpose `read`.
- **Suggestion**: an `action.suggested` row `{ suggestionId, readSeq, items[] }`.
- **Item**: `{ itemId, characterId | null, scope, text, check | null }`. Its action id is
  `<suggestionId>.<itemId>`.
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
3. **What a withdrawal after 👍 does to a running beat.** D20 §4.7 widens `action.withdraw` but says
   nothing about a beat that already froze the action. Settled: resolve skips a withdrawn action
   when its group runs, and reconcile ignores it (FR-019). Rows already landed stand.

Smaller readings, recorded so a reviewer can check them:

- The round 2 mock marks a confirm "Superseded" as soon as the correction posts (state 7). D20 §4.6
  says it goes stale when the next read lands. This spec follows D20 (FR-017).
- An already-accepted item is refused with the existing code `ACTION_EXISTS`, because its action id
  is derived (FR-015). D20 §8.2 adds only the two `SUGGESTION_*` codes.
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
- `check` rides into the declared text (FR-015), so interpret reads it as part of the action. It
  does not bind adjudicate. Code keeps it only when it is a closed-list skill or `attack`; any
  other value becomes null.

## Non-goals

- **No typing frame or typing indicator.** Only a sent post restarts the ring (OQ-R1 (a));
  `ws-protocol.md` excludes typing indicators.
- **No `TalkV1` change.** A party voice is IC talk with `characterId` null. An `@dm` post is
  ordinary OOC talk.
- **No `ws-protocol.md` frame change.** New requests ride the existing `send` frame; new rows ride
  the existing event frame.
- No Do flag or deed marker (round 2 B, rejected).
- No removal of direct declares, comments, commits or the 044 quorum from the gate (OQ-11 (a)).
- No new DM purpose, no hosted AI config change, no migration.
- No change to companion behaviour (D20 §4.10), to the 049 stall commit or to its 120 s window.
- No VTT adapter (TASK-0072); this card only keeps the events VTT-drivable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the confirm fixture, one IC deed yields exactly 1 `action.suggested` row, and one
  👍 yields exactly 1 `action.declared` and 1 `action.committed` in one batch.
- **SC-002**: OOC posts move `notBefore` 0 times; each readable post moves it exactly once; 12 posts
  5 s apart force 0 reads before the last post + 10 s.
- **SC-003**: An interrupt during the talk path ships 0 rows from the fenced read and leaves exactly
  1 queued talk turn.
- **SC-004**: `ai:dm` `action.accept`, `action.declare` and `action.withdraw` are refused 3 of 3
  times. A 👍 on a stale suggestion is refused 1 of 1 times.
- **SC-005**: The player view's markup holds 0 of these names: "Message type", "Scope", "Declare",
  "Approve", "Object", "Commit", "Comment on this action". No `<dialog>` or `aria-modal` under
  `app/play/`.
- **SC-006**: Every existing DM script, DB suite and web markup test passes, amended only where
  this spec changes the rule it checks.
- **SC-007**: Stubbing the readable rule, the stale rule, the accept authority or the interrupt
  fence fails at least one test each; restoring leaves an empty diff.
- **SC-008**: In the script-mode live check in Brave, two browsers see the ring, Thinking, the
  confirm row (👍 for Kestrel, "Waiting on Kestrel" for Tamsin), and the commit after 👍, with no
  modal at 1280 and 390 px.

## Assumptions

- Model judgment (finding the deed, its wording) is not provable without a paid call. The fake
  gateway proves the code path; the next alpha run is the provider evidence.
- Server and client clocks agree to about a second (both NTP-synced). A skew shows as a ring that
  ends a little early or late; the clamp in FR-023 bounds a client that runs behind.
- A read costs one `dm.narrate`-class call of 10 to 20 s on hosted dev (spec 065 measurement), so a
  confirm lands about 20 to 30 s after the last post.
