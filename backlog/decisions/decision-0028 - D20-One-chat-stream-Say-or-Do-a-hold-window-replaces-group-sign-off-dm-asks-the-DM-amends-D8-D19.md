---
id: decision-0028
title: >-
  D20 One chat stream: Say or Do, a hold window replaces group sign-off, @dm
  asks the DM (amends D8, D19)
date: '2026-11-02 04:25'
status: proposed
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

Design rounds: `docs/design/one-chat-stream/`. Round 1 compared three answers to one question: who
decides that a line is a deed? The answers were A (every IC line is a declare), B (the DM asks "Do
it / Just talking?") and C (the player picks Say or Do after typing).

**Status: proposed.** The operator rules OQ-1 to OQ-10 below. The text is written against each OQ's
recommendation (a). A different ruling changes the section that names that OQ.

## Decision

### 1. Chosen direction: C, "Say or Do"

Option file: `docs/design/one-chat-stream/round-1/c-say-or-do.html`.

The play route has **one composer**:

- A **speaker chip** sits left of the input. Its dropdown lists the viewer's characters,
  `The party`, and `You (out of character)`. Typing `((` or `/ooc` at the start of a line flips the
  chip to out of character.
- Typing `@` opens an autocomplete dropdown: `@dm` first, then present characters and NPCs.
- A **split send button**: **Say** (Enter) and **Do** (Ctrl/Cmd+Enter, or the ▾ menu). With the chip
  on out of character, only Say is offered.
- The composer **suggests** Do when an IC line starts with "I " or "We ", and Say when it starts with
  a quote mark. A suggestion only highlights a button. It never switches the send by itself (OQ-9).

Talk/Action radios, the scope radios and the action card's comment form are removed.

### 2. What each post means to the DM

| Post | Logged as | What the DM does |
|---|---|---|
| **Say**, in character | `talk`, channel `ic`, public | Reads it under D19 (decision-0027) and may react: `none`, `reply`, `scene` or `escalate`. Never rolls or moves anything outside D19's escalation. |
| **Do**, in character | `action.declare` (character scope, or party scope from `The party`) | Nothing until the action commits (section 3). A committed action runs the full pipeline. |
| **Out of character** | `talk`, channel `ooc` | Never reads it. The transcript marks it "Table talk". |
| **`@dm`** (out of character, text mentions `@dm`) | `talk`, channel `ooc` | Answers once, as an OOC `talk` row by `ai:dm`, public (OQ-7). The answer reads `PlayerSeedView` only and changes no state (section 5). |

### 3. The hold window replaces group sign-off (amends D8)

Approve, Object, the comment form and Commit are removed from player action cards. Sign-off rows
(specs/044) are removed. In their place:

1. **A declared action opens a hold window.** Free mode: **8 s** (OQ-1). The card shows a countdown.
2. **When the window lapses, the action commits.** The `floor` job commits it as `ai:dm`, with the
   stall override widened to cover any open action (OQ-3). Authority is recorded as `dm`.
3. **Hold.** Any other present human may press **Hold** on any open action, character or party
   scope (OQ-2). One click, no text. A Hold stops the clock. The card reads "Held by <name>".
4. **Release.** The holder presses **Release**. When no Hold remains, the clock restarts at the full
   window.
5. **Nobody commits over a Hold except the DM.** A Hold whose author leaves the table stops counting,
   as a sign-off stance does today.
6. **Go now.** The author may commit at once only when no other human is present (OQ-4). With another
   human present, the author's commit is refused `HOLD_WINDOW_OPEN`. Only the window lapse or the DM
   commits.
7. **Retract** is `action.withdraw`. The card shows the struck line.
8. **Amend** is `action.withdraw`, then a fresh `action.declare` with the old text in the composer
   (OQ-6). The new declare opens a new window. A Hold on the old action ends with it.
9. **Discussion happens in the stream,** in character or out of character. A card carries no thread
   (OQ-8).
10. **The DM** (human seat) sees **Commit now** and **Hold** on every open action. The AI DM never
    holds.

**Turn mode (OQ-5).** The active player's Do opens a **3 s undo window** with no Hold. Retract and
Amend work as in free mode. Another player's Do in turn mode declares as today and reads "Commits on
your turn". Its window opens when that player's turn starts.

**Companions.** A companion's own action keeps its window. A human Hold on a companion's action is an
`action.comment` with stance `object`. That queues the companion `react` run (specs/036), unchanged.

After this record, decision-0016's commit-authority table reads:

| Mode | Who commits | Everyone else |
|---|---|---|
| Turn mode | The active player's action commits after the 3 s undo window | Talk |
| Free mode, character or party scope | The hold window commits when it lapses with no Hold. The author commits at once only when no other human is present. | Hold or Release, and talk |
| Always | The DM (human or AI) may commit or override | none |

### 4. Events (VTT parity, TASK-0072)

Every gesture is an existing gate request kind. A VTT adapter emits the same requests. It may render
Hold as its own button and the window as its own timer, because the window is enforced server-side.

| Gesture | Gate request | Logged rows |
|---|---|---|
| Say | `talk` `{ channel: "ic" }` | `talk` |
| Out of character / `@dm` | `talk` `{ channel: "ooc" }` | `talk` |
| Do | `action.declare` | `action.declared` |
| Hold | `action.comment` `{ stance: "object", text: "" }` | `action.commented` |
| Release | `action.comment` `{ stance: "approve", text: "" }` | `action.commented` |
| Retract | `action.withdraw` | `action.withdrawn` |
| Amend | `action.withdraw`, then `action.declare` | `action.withdrawn`, `action.declared` |
| Window lapse | `action.commit` from `ai:dm`, `override: "stall"` | `presence.recorded` (`signoff`), `action.committed` (`dm`) |
| Go now / DM Commit now | `action.commit` | `action.committed` |
| `@dm` answer | `talk` from `ai:dm` `{ channel: "ooc" }` | `talk` |

No new event type. No frame shape changes. `TalkV1` is unchanged: `@dm` is read from the text.

### 5. `@dm` questions (amends D19)

1. A post is an `@dm` post when it is `talk`, channel `ooc`, public, by a human, and its text holds
   the token `@dm`.
2. Under an AI DM seat, an `@dm` post queues an `ask` turn: one model call, prompt version
   `dm.ask-v1` under the existing `dm.narrate` purpose. No new purpose. Free mode and turn mode both
   (OQ-10).
3. The answer reads the `fiction` snapshot view, the `PlayerSeedView` and the transcript tail. It
   passes the same code checks as a D19 reply (`checkClaims`, the DM-only seed text check, the digit
   check), so a number such as a DC never reaches the player.
4. The answer changes no state, and the D19 chain cap does not count it. One answer per post.
5. Under a human DM seat nothing is generated. The DM's transcript highlights the post as a question.
6. This card covers TASK-0129 and TASK-0131.

D19 section 2 is unchanged for IC posts. Its rule 1 ("OOC talk ... never read") gains: "except
an `@dm` post, which the ask path reads (decision-0028 §5)".

### 6. Frozen-contract amendments this record asks for (operator ruling required)

1. **specs/029 `policy-and-authority.md`, commit authority.**
   - Steps 4 and 5: a player's commit is refused `HOLD_WINDOW_OPEN` while another human is present.
     Turn mode is exempt: the active player commits.
   - The party-scope quorum (`GROUP_SIGNOFF_REQUIRED`) is replaced by the hold check.
   - The stall override covers any open action, character or party, and refuses while a present
     human's latest stance is `object`.
   - Add `HOLD_WINDOW_OPEN` to the refusal codes.
2. **specs/044 `signoff.md`:** superseded. `signoffState` becomes `holdState`: the present humans
   whose latest stance is `object`.
3. **specs/049 `floor-jobs.md`:** the `stall` check arms on every declare, not only multi-human party
   declares. Its window is 8 s (free mode) or 3 s (turn mode, active player), not 120 s. Re-arm on
   Release.
4. **specs/030 `proposal-seam.md`:** remove `ActionCardView.signoff`, and add `ActionCardView.hold`
   (holders, window end). `CommitAuthority` and `PendingProposalView` are unchanged.
5. **No change:** `docs/wiki/ws-protocol.md` frame shapes, `TalkV1`, the event catalog.

### 7. Rejected directions

- **A, "Every line is a move".** Rejected because every IC line would cost a full DM turn, small talk
  would wait out the window, and the D19 talk path would stop running for human posts.
- **B, "The DM reads the room".** Rejected because a deed waits for the 3 s quiet window plus a model
  call before its window opens. It also needs an `intent` outcome and a chip marker on narration (a
  frozen-contract amendment), and a player who ignores the chip does nothing.

## Open questions (operator rules; (a) is recommended)

- **OQ-1 Window length, free mode.** (a) 8 s. (b) 5 s. (c) 15 s.
- **OQ-2 What Hold covers.** (a) Every open action, character and party scope. (b) Party scope only.
- **OQ-3 Who commits at lapse.** (a) The server's `floor` job as `ai:dm`, with the stall override
  widened. (b) The author's client sends the commit. That needs no 029 amendment, but nothing commits
  once the author's tab closes, and a VTT must run its own timer.
- **OQ-4 Go now.** (a) Only when no other human is present. (b) Always, unless held.
- **OQ-5 Turn mode.** (a) A 3 s undo window and no Hold. (b) The same window and Hold as free mode.
- **OQ-6 Amend.** (a) Withdraw plus a fresh declare. (b) A new `action.amend` kind and event.
- **OQ-7 Who sees an `@dm` answer.** (a) The whole table (public). (b) The asker only.
- **OQ-8 Card comments.** (a) Removed. Discussion happens in the stream. (b) Kept as a thread on
  the card.
- **OQ-9 Say/Do suggestion.** (a) A highlight only. (b) No suggestion.
- **OQ-10 `@dm` in turn mode.** (a) Answered in both modes. (b) Free mode only.

## Consequences

- Supersedes the TASK-0049 sign-off UI and quorum. `signoff.ts` and `SignoffList` go.
- The stall commit stops being a 120 s safety net and becomes the normal path for every action.
- Covers TASK-0129 and TASK-0131 (Ask the DM). Interacts with TASK-0162 (keep a refused draft).
- A spec under `specs/` is written against this record once it is accepted. Its implementation
  tasks are carded then.

## Ruling

Round 1 selection, 2026-11-01, the operator in the TASK-0188 design session: "C, Say or Do".

OQ-1 to OQ-10 and the section 6 amendments: pending.
