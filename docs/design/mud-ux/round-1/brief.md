# TASK-0236 design round 1 — brief

Input: `docs/research/MUD-Client-UX/Analysis-Table-View-Pattern-Adoption.md` (commit 0e918e5f).
Its thesis: keep the MUD architecture (one text stream plus server-pushed state beside it),
drop the MUD command grammar, and make the map a peer panel whose every fact also lands in the
stream as text.

## The axis

How much of the screen the text stream owns, versus panels and the map. Everything else is held
constant across the four options.

| Option | File | Thesis | Risk |
|---|---|---|---|
| A — Scroll | `a-scroll.html` | The stream is the whole table. State lives in a one-line status strip and inline expansions, like a MUD prompt. | Once a map exists it has nowhere to live, and spatial play degrades into prose. |
| B — Margin | `b-margin.html` | The stream owns most of the width. A slim right margin holds party, turn order and conditions, like Nexus gauges beside the output. The map opens as a slide-out panel. | At 390px the margin collapses, so it needs a persistent mini-strip anyway. |
| C — Split | `c-split.html` | Map and stream share the screen, docked side by side like Mudlet's mapper. Clicking a token or exit drafts a line in the composer. | At 390px one half must collapse, and the map competes with the conversation. |
| D — Board | `d-board.html` | The map and panels own the screen. The stream shrinks to a collapsible log, like Foundry. Most actions are clicks. | It abandons natural-language-first play and screen-reader parity. It is the bound for "too far". |

## Binding constraints (from the TASK-0236 card)

- No modals. Use the slide-out panel (right on desktop, bottom sheet at 390px), inline expansion, or an autocomplete dropdown. Never use `<dialog>`, `showModal`, or a centred overlay.
- Use the Daylight palette tokens from `docs/design/one-chat-stream/round-2/a-just-talk.html`, in light and dark (`prefers-color-scheme` plus a `[data-theme]` toggle). All text meets WCAG AA.
- Each file is self-contained HTML. No external fonts, scripts, images or CDNs. Draw the map as inline SVG.
- Keep the TASK-0188 one-chat-stream rules: the quiet ring, the DM confirm row with 👍 Yes / Not quite, and `@dm` read-only answers. `ai:dm` never declares a player action.
- DM-only text never reaches a player view.
- Every option works at 1280px and 390px.
- Every state a panel or map shows also appears as text in the stream (screen-reader parity), except in D, which shows the cost of dropping it.

## Shared MUD-derived baseline (all four options)

1. **One input line.** Up/Down recalls history. Typing `@` or `/` opens an autocomplete dropdown with the small closed command set: `@dm`, `/roll`, `/ooc`, `/help here`.
2. **Entity completion.** Tab after a partial name ("Sn") completes an entity from the scene: Snag, Wenna Marsh, the causeway. An empty line keeps Tab for focus.
3. **Clickable nouns.** Entity names in DM narration are links. A click opens an inline expansion with the player-safe facts (for Snag: "Goblin, carries a bell clapper on a thong"). It never opens a popup.
4. **Filter chips over one stream:** All · In character · Table talk · Rules. These are view filters, not separate panes.
5. **Rules detail level.** Roll and damage rows collapse to one line ("Kestrel — Stealth 17 ✓"). They expand inline to show the dice.
6. **Status strip** with the viewer's own HP, AC, conditions, and whose turn it is. Values are always text, never a bar alone.
7. **Room block.** Scene headers read like a MUD room: name, a short description, and the ways on ("Ways on: ladder to the loft · causeway downriver · ferry"). Each way on is clickable and drafts a line.

## Cast and copy (seed `greyhollow-ford-duo`)

- Viewer: **Kestrel** (Rogue, human seat, HP 9/9, AC 14). Other human: **Tamsin Vale** (Fighter, HP 13/13, AC 16). Companion: **Brother Odo** (Cleric, AI-run, HP 10/10, AC 16, two 1st-level slots).
- NPCs: **Wenna Marsh**, the ferry keeper ("Clipped river talk; drops the ends of words; swears by 'the old water'"). **Snag**, the goblin boss.
- Opening framing: "The party reaches Greyhollow Ford as the light goes amber. The ferry is chained, the ferry-house door hangs open, and the bell that should have rung for them is silent."
- Room: Greyhollow Ford ferry-house. "A slate-roofed ferry-house on stilts above a brown, fast river. Its bell rope hangs cut a yard above the floor."
- Encounter: the reed-camp, "A mud island thirty feet across, ringed by reeds; the fire gives half cover to anyone behind it". Combatants: Snag, Goblin with a pot-helm, Goblin lookout, Goblin by the fire.

## States every option mocks (same order, same copy)

Each page offers a state switcher (a row of buttons, not a modal) so the operator steps through:

1. **Arrival.** Room block for the ferry-house, the opening framing, and the status strip.
2. **Talk + ring.** Tamsin (IC): "Wenna? We heard the bell's gone quiet. We're here to help." The ring shows 5 of 8 segments left.
3. **Confirm.** DM row: "Kestrel climbs the ladder to the loft, quietly — Stealth. Is this right?" Kestrel sees 👍 Yes / Not quite.
4. **Roll + reply.** Collapsed roll row "Kestrel — Stealth 17 ✓", then Wenna's voice: "Who's asking? …Three of you. Fine. Come up slow."
5. **Autocomplete.** The composer holds "I ask Wenna about Sn", and the entity dropdown offers Snag. Show the `@`/`/` command dropdown on a second line, or as a sub-state.
6. **Clicked noun.** Snag's inline expansion is open in the stream.
7. **Combat.** The reed-camp. Initiative order: Kestrel, Snag, Tamsin, Goblin lookout, Odo, Goblin with a pot-helm, Goblin by the fire. It is Kestrel's turn. Kestrel typed "I shoot the goblin lookout". Show the short ring, then the confirm "Kestrel shoots the goblin lookout with her shortbow — attack. Is this right?". The action economy shows: Action ○, Bonus ○, Move 30 ft.
8. **390px.** States 3 and 7 at mobile width. Show them as a framed phone-width view on the same page, or let the page reflow at 390px. Screenshots will be taken at 390px either way.

## Delivery

- Write the four option files and an `index.html` in this folder. The index lists the options with their thesis and risk, the axis, and these open questions:
  - **OQ1:** Should the map be a view over the stream (the MUD auto-mapper idea), or an authored surface the stream reports on?
  - **OQ2:** Do filter chips earn their place over a single unfiltered stream?
  - **OQ3:** Should rules detail be a per-player setting, or a per-row expansion only?
  - **OQ4:** Should click-to-draft from the map or a way on put text in the composer, or go straight to a confirm row?
- Take screenshots at 1280 and 390, in light mode, for states 3 and 7 of every option. Use headless Brave, or Chrome if Brave is missing. Save them in `shots/`.
