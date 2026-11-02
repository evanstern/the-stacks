---
id: decision-0028
title: >-
  D20 One chat stream: players talk, the DM reads the table after a quiet ring
  and asks them to confirm each action (amends D8, D19)
date: '2026-11-02 04:25'
status: accepted
---
## Context

Two-browser alpha run 3, 2026-11-01, finding 2 (session `e8e8326d`, action `act-4c4727e0`):

- **Sign-off has no teeth.** A declarer commits at once, so nobody can weigh in. Approve and Object
  stay disabled until a comment is typed. An objection does not block Commit.
- **The Talk/Action split makes players pick a mode before they speak.** Every in-character line in
  run 3 was posted as an Action, so the D19 talk path (TASK-0180) never ran.

The gate explains the first point. Under specs/029 `policy-and-authority.md`, step 5, the declarer
of a free-mode character action commits alone; no stance by anyone else is consulted. Only a
party-scope action with two or more humans needs the sign-off quorum (TASK-0049, specs/044).

The operator proposed one chat stream: in character is an action, out of character is table talk,
and `@dm` flags the DM. Chat stays a view over the event log, so a later VTT (TASK-0072) can drive
the same events.

Design rounds, `docs/design/one-chat-stream/`:

- **Round 1** asked who decides that a line is a deed. The operator picked C, "Say or Do". The
  operator then asked for the AI DM to confirm its reading of each action before anything rolls,
  behind a visible quiet ring.
- **Round 2** mocked that UX in two variants. The operator picked A, "Just talk".

**Status: accepted** (2026-11-02). The operator ruled every open question (a) and approved the
section 8 amendments.

## Decision

### 1. Chosen direction: round 2 A, "Just talk"

Option file: `docs/design/one-chat-stream/round-2/a-just-talk.html`.

- The play route has **one composer and one Send button.** A speaker chip sits left of the input.
  Its dropdown lists the viewer's characters, `The party`, and `You (out of character)`. Typing `((`
  or `/ooc` at the start of a line flips the chip to out of character.
- Typing `@` opens an autocomplete dropdown: `@dm` first, then present characters and NPCs.
- Players never mark a line as an action. **The DM finds the actions** in what the table says, and
  asks the player to confirm each one.
- The Talk/Action radios, the scope radios, Declare, the action card's comment form, Approve,
  Object, Commit and the sign-off rows are removed from the player's view.

### 2. What each post means to the DM

| Post | Logged as | What the DM does |
|---|---|---|
| In character | `talk`, channel `ic`, public | Reads it after the quiet ring (section 3). Answers with one outcome: `none`, `reply`, `scene`, `escalate` (D19), or `confirm` (section 4). |
| Out of character | `talk`, channel `ooc` | Never reads it. The transcript marks it "Table talk". It does not restart the ring. |
| `@dm` (out of character, text holds `@dm`) | `talk`, channel `ooc` | Answers once, read-only (section 6). Restarts the ring. |

### 3. The quiet ring

1. **The server owns the clock.** A readable post (D19 section 2, as amended here) queues or moves
   the session's `talk` turn to `notBefore = post time + 10 s`. Every later readable post moves it
   again. D19's `firstPostAt + 10 s` cap is removed.
2. **The client draws the ring** from the latest readable post's time. The ring is blank for 2 s.
   Then 8 segments appear and one empties per second. Caption: "The DM reads the table in N s. Keep
   talking to wait."
3. **Only a sent post restarts the ring (OQ-R1).** Typing does not. A typing signal would need a new
   frame, and `ws-protocol.md` excludes typing indicators.
4. **Thinking.** When the turn is claimed, the ring becomes the chip "The DM is reading the table…".
   The client learns of the claim from a `presence.recorded` marker with a new purpose, `read`. The
   worker appends it when it claims a `talk` turn.
5. **Interrupt.** During Thinking, Send reads "Send — interrupts the DM". Pressing it opens an inline
   strip under the composer: "The DM is reading the table. Sending now cancels that read and
   restarts the timer." The strip offers **I'm sure** and **Wait**. I'm sure sends the post. The
   running read is fenced and requeued at post time + 10 s (OQ-R3). Out-of-character posts never
   show the strip.
6. **Turn mode (OQ-R5).** The active player's in-character post runs a short ring: 1 s blank, then
   4 segments, so `notBefore = post time + 5 s`. Other players' in-character posts in turn mode are
   read by the next beat's narrate only, as D19 says today.

### 4. The confirm row replaces group sign-off (amends D8)

1. **A read may return `confirm`.** It names one or more proposed actions, each with a character or
   `party` scope, the DM's wording, and the check it expects (for example "Stealth" or "attack"). A
   read can mix `confirm` with no other outcome. Speech gets a `reply`, a deed gets a `confirm`.
2. **The confirm row** is a public `action.suggested` row by the DM, drawn apart from narration and
   from `@dm` asides. One line per proposed action: "Kestrel climbs the ladder to the loft, quietly —
   Stealth. Is this right?" Each line offers **👍 Yes** and **Not quite**.
3. **Who may press 👍.** A character line: the player who controls that character. A party line: any
   present human party member. The first 👍 commits it (OQ-R2). Everyone else sees "Waiting on
   <name>".
4. **👍 commits atomically.** 👍 sends one `action.accept` request. The planner appends
   `action.declared` (the DM's wording, with `suggestionId`) and `action.committed` in one batch. The
   authority is `declarer`, `active-player` or `group`. The action reaches the pipeline on the next
   beat, as a committed action does today.
5. **Not quite** puts the cursor in the composer. The player's correction is an ordinary post, so it
   restarts the ring. Nothing is logged for the button itself.
6. **A confirm goes stale** when a later read by the DM lands: a newer `action.suggested` row, or a
   talk-turn narration. The client marks a stale line "Superseded". A 👍 on a stale line is refused
   `SUGGESTION_STALE`. An unanswered confirm commits nothing.
7. **Retract.** The declarer or the DM may withdraw an action that is committed but not yet resolved
   (OQ-R4). Today the planner refuses that with `ACTION_NOT_OPEN`, so this widens `action.withdraw`.
8. **A human DM** sees no ring and no Thinking. Each in-character line carries a **Confirm as
   action…** control. It opens an inline editor where the DM writes the wording, then sends
   `action.suggest`. The DM may also commit or withdraw any action, as today.
9. **The AI DM** never presses 👍 for a player. `ai:dm` still never declares or withdraws a player
   action.
10. **Companions** are unchanged. An AI companion declares and commits its own actions as today.
11. **Direct declares stay in the gate (OQ-11).** `action.declare`, `action.comment` and
    `action.commit` keep today's rules, including the 044 quorum, for a VTT adapter and for API use.
    The web composer stops sending them.

After this record, decision-0016's two message concepts read:

> **Talk:** everything a player types. Out-of-character talk is never read, except `@dm`. The DM
> reads in-character talk after a quiet ring, and answers with a reaction (decision-0027) or a
> **confirm**: its own wording of an action it heard.
>
> **Action:** a confirmed, committed deed. Its lifecycle is suggested, accepted (declared and
> committed in one step), resolved. A player confirms with 👍. Only a committed action reaches the DM
> pipeline.

Its commit-authority table gains a first row:

| Mode | Who commits | Everyone else |
|---|---|---|
| Any mode, a DM-suggested action | The player who controls the character presses 👍. For the party, the first present human party member. | Talk |

The other rows stand for direct declares (section 4.11).

### 5. Events (VTT parity, TASK-0072)

| Gesture | Gate request | Logged rows |
|---|---|---|
| Talk, in or out of character | `talk` | `talk` |
| The ring | none. It is drawn from the latest readable post's time. | none |
| Thinking | none. The worker records the claim. | `presence.recorded` (`read`) |
| DM asks to confirm | **new DM kind `action.suggest`** | **new event `action.suggested`** `{ suggestionId, readSeq, items: [{ itemId, characterId \| null, scope, text, check \| null }] }` |
| 👍 Yes | **new request `action.accept`** `{ suggestionId, itemId }` | `action.declared` (+ `suggestionId`), `action.committed` |
| Not quite, a correction, I'm sure | `talk` | `talk` (an interrupt also fences the running read) |
| Retract | `action.withdraw` | `action.withdrawn` |
| `@dm` answer | `talk` from `ai:dm`, channel `ooc` | `talk` |

A VTT emits `talk` for chat, draws its own ring from the same post times, renders
`action.suggested` with its own buttons, and sends `action.accept`. It may still declare directly
(section 4.11).

### 6. `@dm` questions (amends D19)

1. A post is an `@dm` post when it is `talk`, channel `ooc`, public, by a human, and its text holds
   the token `@dm`.
2. Under an AI DM seat, an `@dm` post queues the read like any readable post. The read answers the
   question as an OOC `talk` row by `ai:dm`, public (OQ-7), alongside its other outcome.
3. The answer reads the `fiction` snapshot view, the `PlayerSeedView` and the transcript tail. It
   passes the same code checks as a D19 reply (`checkClaims`, the DM-only seed text check, the digit
   check). The answer changes no state.
4. `@dm` posts are answered in free and turn mode (OQ-10).
5. Under a human DM seat nothing is generated. The DM's transcript highlights the post.
6. This covers TASK-0129 and TASK-0131.

### 7. Amendments to D19 (decision-0027)

- Section 2, rule 1: an `@dm` OOC post is read too.
- Section 2, rule 4: in turn mode the active player's in-character post is read too (section 3.6).
- Section 4: the outcomes gain `confirm` (section 4). A read may also carry one `@dm` answer.
- Section 5: a confirm row and an `@dm` answer do not count toward the chain cap. A confirm prompts
  no companion.
- Consequences: the quiet window becomes post time + 10 s, moved by every readable post, with no cap
  (section 3.1).

### 8. Frozen-contract amendments this record asks for (operator ruling required)

1. **specs/029 `proposals.md`:**
   - a new DM kind `action.suggest`, policy `auto`;
   - a new player request `action.accept`;
   - `action.withdraw` also accepts a committed, unresolved action.
2. **specs/029 `policy-and-authority.md`:**
   - `action.accept` authority: the controller of the item's character, or for `party` any present
     human party member;
   - new refusal codes: `SUGGESTION_STALE` and `SUGGESTION_NOT_FOUND`.
3. **specs/029 `proposal-events.md` and the session-model catalog:**
   - new event `action.suggested`;
   - `action.declared` gains an optional `suggestionId`;
   - `presence.recorded` gains purpose `read`.
4. **specs/030 `proposal-seam.md`:** `ActionCardView.signoff` leaves the player view. A new
   `ConfirmView` (the items, who may accept, stale) rides the transcript.
5. **specs/031 DM-runtime contracts (additive):** the `confirm` outcome, the `@dm` answer, the ring
   window and the read marker.
6. **No change:** the `ws-protocol.md` frame shapes and `TalkV1`.

### 9. Rejected directions

- **Round 1 A, "Every line is a move".** Every in-character line would cost a full DM turn, and the
  D19 talk path would stop running for human posts.
- **Round 1 B, "The DM reads the room" (private chip).** The chip was private, and a player who
  ignored it did nothing. Round 2 kept B's idea (the DM finds the deed) but made the check public and
  ran it after a visible quiet ring.
- **Round 1 C, "Say or Do", and its 8 s hold window.** The operator picked C, then replaced the hold
  window with the DM confirm, because a confirm also checks that the AI read the action right.
- **Round 2 B, "Talk, or flag a deed".** It brought back the choice before speaking, and it needed a
  `TalkV1` field.

## Open questions (operator rules; (a) is recommended)

- **OQ-R1 What restarts the ring.** (a) A sent post only. (b) Typing too, which needs a new frame.
- **OQ-R2 Party confirm.** (a) The first 👍 from a present human party member commits. (b) Every
  present human must 👍.
- **OQ-R3 Interrupt.** (a) Cancel the running read and requeue it. (b) Let the read finish, then read
  again.
- **OQ-R4 Retract after 👍.** (a) The declarer or the DM may withdraw until the action resolves.
  (b) Retract only before 👍, as today.
- **OQ-R5 Turn-mode ring.** (a) 1 s + 4 s for the active player. (b) The same 2 s + 8 s as free mode.
- **OQ-7 Who sees an `@dm` answer.** (a) The whole table. (b) The asker only.
- **OQ-10 `@dm` in turn mode.** (a) Answered in both modes. (b) Free mode only.
- **OQ-11 Direct declares.** (a) They stay in the gate with today's rules, for VTT and API use; the
  web composer stops sending them. (b) They are removed, so every player action goes through a
  confirm.

## Consequences

- The TASK-0049 sign-off UI leaves the web client. Its quorum stays in the gate for direct declares
  only (OQ-11).
- The 120 s stall commit (TASK-0050) still covers direct party declares. A confirm needs no stall
  path, because nothing commits without a 👍.
- Every deed now waits at least 10 s plus one model call. A deed the DM misses gets no confirm, so
  the player says it again more plainly.
- Interacts with TASK-0162 (keep a refused draft) and TASK-0072 (VTT adapter).
- A spec under `specs/` is written against this record once it is accepted. Its implementation
  tasks are carded then.

## Ruling

- Round 1 selection, 2026-11-01, the operator in the TASK-0188 design session: "C, Say or Do".
- Feedback that started round 2, 2026-11-01: recorded verbatim in the TASK-0188 card notes, opening
  "I'm conflicted -- I feel like I'd rather have #1 be "after 8s the DM asks explicitly for a 👍".
- Round 2 selection, 2026-11-01: "A, just talk".
- Open questions and the section 8 amendments, 2026-11-02, the operator in the TASK-0188 design
  session: "All (a), amend". This rules OQ-R1 to OQ-R5, OQ-7, OQ-10 and OQ-11 as (a), and approves
  the section 8 frozen-contract amendments.
