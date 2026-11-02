# TASK-0188 design round 1 — brief

One chat stream for the play route. In character (IC) is how a character speaks and acts. Out of
character (OOC) is table talk. `@dm` flags the DM. Chat stays a view over the event log.

Source finding: alpha run 3, 2026-11-01, finding 2 (session `e8e8326d`, action `act-4c4727e0`).

## Binding constraints (every round is checked against these)

1. **No modals.** Use slide-out panels, inline chips and dropdowns (autocomplete) only.
2. **Chat is a view over the event log.** Every line on screen is one logged row or a fold of rows.
   The client never shows state that no row holds (no optimistic append).
3. **A VTT can drive the same events** (TASK-0072, decision-0013). Every player gesture maps to an
   existing gate request kind: `talk`, `action.declare`, `action.comment`, `action.commit`,
   `action.withdraw`, `floor`. A direction that needs a new kind or event says so as its risk.
4. **Frozen contracts change only on an operator ruling:** `specs/029-proposal-gate/contracts/`,
   `specs/030-play-route/contracts/proposal-seam.md`, and the `docs/wiki/ws-protocol.md` frame shapes.
5. **`ai:dm` never declares or withdraws a player action** (029 permission matrix).
6. **Only a committed action reaches the action pipeline** (D8). Talk cannot roll or move anything,
   except a D19 escalation into an unstarted encounter.
7. **D19 read rule:** a post is read only when it is `ic`, `public`, by a human or companion, under an
   AI DM seat, in free mode, under the chain cap of 2.
8. **Turn mode keeps its floor:** the active player acts on their turn (D8, TASK-0050).
9. **DM-only text never reaches a player** (decision-0026). An `@dm` answer reads `PlayerSeedView` only.
10. **Real copy only.** Use the `greyhollow-ford-duo` seed: Tamsin Vale and Kestrel are human seats,
    Brother Odo is an AI companion, Wenna Marsh is the ferry keeper hiding in the loft.

## Shared baseline (identical in every option, so the round compares one axis)

- **One composer.** A speaker chip sits left of the input: `Tamsin ▾`. Its dropdown lists the viewer's
  characters, `The party`, and `You (out of character)`. Typing `((` or `/ooc` at the start flips the
  chip to OOC. Typing `@` opens an autocomplete dropdown: `@dm`, then present characters and NPCs.
- **OOC posts** are `talk` rows with channel `ooc`. The DM never reads them, except `@dm` posts.
- **`@dm` posts** are OOC `talk` rows whose text mentions `@dm`. The AI DM answers once, as an OOC
  aside by `ai:dm`, from `PlayerSeedView`, with no state change. It covers TASK-0129 and TASK-0131.
  Under a human DM seat the post is highlighted in the DM's view and nothing is generated.
- **Sign-off becomes a hold window.** A declared deed starts a visible window (free mode 8 s). The
  window lapses into a commit. Any other present human can press **Hold** (one click, no text). A
  Hold stops the clock until that player presses **Release**, or the author amends or retracts.
  The author has **Retract** and **Amend**. Nobody can commit over a Hold except the DM. With no
  other human present, the author also has **Go now**. Party lines use the same window.
- **Turn mode.** The active player's deed commits after a 3 s undo window. Other players cannot
  Hold it. They can still talk and post OOC.
- **Event map for the baseline.** Hold is `action.comment` with stance `object` and empty text.
  Release is stance `approve`. Retract is `action.withdraw`. Amend is a withdraw, then a fresh
  declare with the old text prefilled. The window lapse is a floor-job commit by `ai:dm`. That
  commit needs a new `action.commit` override (`"window"`), which is a 029 amendment.

## The axis: who decides that a line is a deed?

### A — "Every line is a move" (the system decides)

- Every IC line is an `action.declare` (character scope, or party scope from `The party`).
- The interpreter sorts speech from deeds. A speech-only action runs the D19 reaction and resolves
  `no-effect`. A deed runs the full pipeline.
- Every IC line shows the hold window. Speech lines show it too, as a thin underline only.
- **Thesis:** nothing a character says is ever lost to the wrong mode. The DM sees everything.
- **Risk:** every IC line costs a full turn, including small talk. The D19 talk path no longer
  runs for human posts. Small talk waits 8 s before anyone answers.

### B — "The DM reads the room" (the DM decides)

- Every IC line is a `talk` row with channel `ic`, so D19 runs as built.
- The react call gains a fifth outcome: `intent`. It applies when a line reads as a deed that needs
  dice or a state change. The DM then whispers to the author only, as a narration row visible to
  that user: "Climbing to the loft? That's a Stealth check." The author gets a chip: **Do it** or
  **Just talking**. Do it declares the line as written and starts the hold window.
- **Thesis:** players just talk, like at a real table, and the DM asks "are you doing that?"
- **Risk:** a deed waits for the 3 s quiet window plus a model call before the window starts. The
  chip needs a structured marker: either a new event type, or an additive field on `narration`.
  Both are frozen-contract amendments. A player who ignores the chip does nothing.

### C — "Say or Do, chosen after you type" (the player decides)

- One input, a split send button: **Say** (Enter) and **Do** (Ctrl/Cmd+Enter, or the ▾ menu).
- Say sends an IC `talk` row (D19 runs). Do sends `action.declare` and starts the hold window.
- **Thesis:** the player decides after writing, not before. The closest to today's events.
- **Risk:** it is still a choice. Run 3 showed players default to the heavier one. Mitigation: the
  composer suggests Do when the line starts with "I " and suggests Say when it starts with a quote.

## States every option mocks (same order, same copy)

1. **Free-mode speech.** Tamsin (IC): "Wenna? We heard the bell's gone quiet. We're here to help."
2. **Free-mode deed, window running.** Kestrel (IC): "I climb the ladder to the loft, quiet as I can."
   Shown from Tamsin's view: the window counts down, and Hold is on offer.
3. **Held.** Tamsin presses Hold, then posts OOC: "((wait, let me talk her down first))".
   Kestrel's view shows "Held by Tamsin" with Retract and Amend.
4. **Amended.** Kestrel amends: "I wait at the foot of the ladder, bow unstrung." The old line is
   struck through, and the new line runs its own window.
5. **OOC chatter.** Kestrel: "((brb, coffee))". Shown as table talk, marked "DM doesn't read this".
6. **`@dm` question.** Tamsin: "@dm how high is the loft? Can I see up there from the door?"
   DM aside (OOC, by the DM): "About nine feet up, through a square hatch. From the door you see
   the hatch and dust sifting down, nothing more."
7. **Party line.** Tamsin as The party: "We follow the clawed tracks down to the causeway."
   Window running for both humans.
8. **Turn mode.** Kestrel's turn. Kestrel: "I shoot the goblin lookout." Committed after the 3 s
   undo. Tamsin's IC line on Kestrel's turn: "Odo, cover the boy!" (speech, not her turn).
9. **Refusal.** Tamsin is down at 0 HP and posts a deed. Inline notice under the composer:
   "Tamsin can't act right now." The draft is kept (TASK-0162).
10. **Human DM view.** The seated DM sees state 2 with Commit now and Hold, and sees state 6
    highlighted as a question for them.

Each option page ends with its event map: one table, gesture → request kind → logged rows.
