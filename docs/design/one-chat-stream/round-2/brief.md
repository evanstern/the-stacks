# TASK-0188 design round 2 — brief

Round 1 selection: C, "Say or Do" (operator, 2026-11-01). The operator then reworked how an action
gets settled. Their words are on the TASK-0188 card. In short:

- 2 s after the last message, an 8-segment ring appears and loses one segment per second (8 s).
- Any new message restarts the 2 s + 8 s window.
- When the ring empties, the AI DM reads the conversation and asks for a 👍: "Tamsin is going to
  look ahead using Stealth, is this correct?"
- The ring turns into a **Thinking** indicator while the DM reads.
- During Thinking, a player can still add an action, but must press an "I'm sure" control first. The
  control makes it clear they are interrupting the DM, and so discourages it.

This replaces round 1's hold window. The confirm is the check that the AI understood the action.

## Binding constraints (unchanged from round 1)

No modals. Chat is a view over the event log. A VTT can drive the same events. Frozen contracts
change only on an operator ruling. `ai:dm` never declares or withdraws a player action. Only a
committed action reaches the action pipeline. DM-only text never reaches a player. Real copy only,
from `greyhollow-ford-duo`.

## Shared baseline (both variants)

1. **The quiet window.** It runs on the server: the D19 `talk` turn's `notBefore` becomes the last
   post + 10 s. Clients draw the ring from the last post's arrival: blank for 2 s, then 8 segments
   that empty over 8 s. Any public IC post restarts it, and so does an `@dm` post. OOC chatter does
   not.
2. **Thinking.** When the turn is claimed, the ring becomes a pulsing "The DM is reading the table…"
   chip above the composer.
3. **One DM call reads everything since the last DM beat.** It returns one outcome. It can be a D19
   outcome (`none`, `reply`, `scene`, `escalate`), or the new **`confirm`**: one or more proposed
   actions.
4. **The confirm row** is a public row by the DM, set apart from narration. It holds one line per
   proposed action, for example: "Kestrel climbs to the loft, quietly — Stealth. Is this right?" Each
   line has **👍 Yes** and **Not quite**. Only the player who controls that character can press 👍.
   For a party line, any present human can press 👍 (OQ-R2).
5. **👍 commits.** The player declares the DM's wording and commits it, and the action resolves on
   the next beat. "Not quite" puts the cursor in the composer. The player types a correction, and
   the ring restarts.
6. **An unanswered confirm commits nothing.** It goes stale when a newer confirm row arrives.
7. **Interrupt during Thinking.** The Send button turns into "Send — interrupts the DM". The first
   press shows an inline strip under the composer: "The DM is reading the table. Sending now cancels
   that read and restarts the timer." with **I'm sure** and **Wait**. OOC posts never need it.
8. **`@dm` questions** keep their round-1 behavior: one read-only OOC answer. An `@dm` post also
   restarts the ring.
9. **Turn mode.** The active player's line runs the same ring, at 1 s + 4 s (OQ-R5). Other players'
   IC lines are talk.

## The axis: does the player still mark a deed?

### A — "Just talk" (one Send button)

- No Say/Do split. Every IC line is a `talk` row, and the DM finds the deeds.
- A player who wants a deed confirmed fast writes it and waits out the ring.
- **Thesis:** players talk like at a real table, and the DM always checks its reading before anything
  rolls.
- **Risk:** every deed waits at least 10 s plus a model call. A deed the DM misses never gets a
  confirm, so the player has to say it again more plainly.

### B — "Talk, or flag a deed" (Send with a Do flag)

- Send stays the default. A ▾ menu, or Cmd/Ctrl+Enter, sends the line as **Do**. A Do line is still a
  `talk` row, but it carries a deed flag, so the DM must answer it with a confirm.
- A Do line shows a small "deed" tag in the transcript.
- **Thesis:** the DM still words and checks every action, but the player can say "this one is a deed,
  don't miss it".
- **Risk:** it brings back a choice. The deed flag is a new field on `talk`, which is a frozen-contract
  amendment to `TalkV1`.

## States every option mocks (same order, same copy)

1. **Talking, ring hidden.** Tamsin (IC): "Wenna? We heard the bell's gone quiet. We're here to help."
   Less than 2 s since the post. No ring.
2. **Ring running.** Same, 5 of 8 segments left. The caption reads "The DM reads the table in 5 s.
   Keep talking to wait."
3. **Reset.** Kestrel (IC): "I'll get up there and see who's hiding." The ring is full again.
   (In B, Kestrel sends this as Do, and the line shows the deed tag.)
4. **Thinking.** The ring has become the "The DM is reading the table…" chip.
5. **Interrupt.** Tamsin starts typing "I grab Kestrel's arm, wait—" during Thinking. The Send button
   reads "Send — interrupts the DM", and the inline I'm sure / Wait strip is open.
6. **Confirm.** The DM row: "Kestrel climbs the ladder to the loft, quietly — Stealth. Is this right?"
   - Kestrel's view: 👍 Yes and Not quite.
   - Tamsin's view: the line reads "Waiting on Kestrel".
7. **Not quite.** Kestrel: "No, I call up first: 'We're not here to hurt you.'" The ring restarts.
   The old confirm is struck through and marked "Superseded".
8. **Speech outcome.** After the ring, the DM answers with a `reply` instead of a confirm. Wenna's
   voice: "Who's asking? …Three of you. Fine. Come up slow."
9. **Party confirm.** Party (via `The party` chip): "We follow the clawed tracks down to the
   causeway." Confirm: "The party follows the tracks to the causeway — Survival, Tamsin leading.
   Is this right?" Both humans see 👍 Yes. The first 👍 commits it.
10. **`@dm` question.** Tamsin: "@dm how high is the loft? Can I see up there from the door?" The
    answer is the same as in round 1. The ring restarted on the post.
11. **Turn mode.** Kestrel's turn. Kestrel: "I shoot the goblin lookout." Short ring (4 segments), then
    the confirm "Kestrel shoots the goblin lookout with her bow — attack. Is this right?" with 👍.
12. **Human DM view.** The seated human DM sees no ring and no Thinking. Each IC line has a
    **Confirm as action…** control that opens an inline editor. In it the DM writes the wording, then
    sends the confirm row.

## Event map (each page ends with this, red rows need a frozen-contract ruling)

| Gesture | Gate request | Rows |
|---|---|---|
| Talk (IC) | `talk` `{channel: "ic"}` | `talk` |
| B: Do | `talk` `{channel: "ic", deed: true}` — **red: `TalkV1` field** | `talk` |
| Ring / Thinking | none (derived from the last post's time and the queued job) | — |
| DM asks to confirm | **red: new DM kind `action.suggest`** | **red: new event `action.suggested`** `{suggestionId, characterId \| null, scope, text, check}` |
| 👍 Yes | `action.declare` `{…, suggestionId}`, then `action.commit` — **red: `suggestionId` on declare** | `action.declared`, `action.committed` |
| Not quite / correction | `talk` | `talk` |
| I'm sure (interrupt) | `talk` | `talk`; the running read is fenced and requeued |
| `@dm` | `talk` `{channel: "ooc"}` | `talk`; DM answer `talk` by `ai:dm` |

## Open questions to show on the index page

- **OQ-R1:** Does typing restart the ring, or only sending? Typing needs a new WS frame, and the
  protocol excludes typing indicators. Recommended: sending only.
- **OQ-R2:** Party confirm: the first 👍, or every present human? Recommended: the first.
- **OQ-R3:** Does an interrupt cancel the running read, or let it finish and then reread?
  Recommended: cancel and requeue.
- **OQ-R4:** Does Withdraw stay for a committed-but-unresolved action? Recommended: yes, for the
  declarer and the DM.
- **OQ-R5:** Turn-mode ring length. Recommended: 1 s + 4 s.
