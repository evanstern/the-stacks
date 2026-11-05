# Decision: MUD-inspired table layout (TASK-0236 design rounds)

- **Status:** direction accepted by the operator, 2026-11-04. Open questions OQ1–OQ4 are not yet ruled.
- **Task:** TASK-0236 (Design round: MUD-inspired minimalist table UX)
- **Research:** `docs/research/MUD-Client-UX/` (EMBED fb4cba36), analysis `Analysis-Table-View-Pattern-Adoption.md` (0e918e5f)
- **Rounds:** [round 1](round-1/index.html) (caa45005)

## Chosen

**Direction B, "Margin", with Direction C's click-to-draft on the map.**

- Layout and states: [round-1/b-margin.html](round-1/b-margin.html).
- Map interaction: [round-1/c-split.html](round-1/c-split.html), the click-to-draft behaviour only.

The operator's words: "a slide-out map + the ability to interact with it."

### Shape

- The text stream owns most of the width. It is the table and the record.
- A slim right margin shows the party (HP, AC), the turn order and conditions. At 390px the margin collapses to a persistent mini-strip above the composer.
- The map lives in the project's slide-out panel component. It opens from an **Open map** button in the margin. It slides from the right on desktop and is a bottom sheet at 390px.
- The map is interactive. Clicking a token or a way on drafts a line into the composer, for example "I shoot the goblin lookout". The draft never sends itself. The player edits it or sends it, and the normal ring → DM confirm → 👍 flow follows.
- The round-1 shared MUD baseline holds:
  - one input line with Up/Down history;
  - an `@`/`/` autocomplete dropdown with a small closed command set;
  - Tab completion of scene entities;
  - clickable nouns that open inline expansions;
  - filter chips over the one stream;
  - one-line roll rows that expand inline;
  - a status strip;
  - MUD-style room blocks with clickable ways on.

## Rejected

- **A — Scroll.** It gives the map nowhere to live. The end goal is a VTT, so spatial play would degrade into prose.
- **C — Split as a layout.** A permanently docked map competes with the conversation, and at 390px one half must collapse anyway. Only its click-to-draft survives.
- **D — Board.** It turns the product into the Foundry-style VTT it means to differ from. It drops natural-language-first play and screen-reader parity. It stays on file as the "too far" bound.
- **From the analysis:** MUD verb-noun command grammar, player-written triggers, aliases and gags, draggable multi-pane layouts, and cloud-synced layouts are all rejected. See the analysis table for reasons.

## Constraints the implementation must keep

- No modals. The map uses the slide-out panel component (TASK-0028 decision).
- Daylight palette tokens in light and dark. All text meets WCAG AA, checked with a contrast tool (round 1 did not run one).
- Chat is a view over the session event log. Map state comes from the same events (decision-0013).
- TASK-0188 one-chat-stream rules: the quiet ring, the DM confirm row with 👍, `@dm` read-only answers. `ai:dm` never declares a player action, and a map click never commits one.
- Screen-reader parity: every fact the margin or the map shows also appears as text in the stream (initiative, positions, conditions).
- DM-only text never reaches a player view.
- The layout works at 1280px and 390px.

## Open questions (operator to rule before the spec)

- **OQ1:** Is the map a view derived from stream events (the MUD auto-mapper idea), or an authored surface the stream reports on? *Recommendation:* authored geometry, with token positions driven by events.
- **OQ2:** Do the filter chips earn their place over one unfiltered stream? *Recommendation:* keep them, since they are cheap view filters.
- **OQ3:** Is rules detail a per-player setting, or a per-row expansion only? *Recommendation:* per-row expansion first, and add the setting if playtests ask for it.
- **OQ4:** Does click-to-draft put text in the composer, or go straight to a confirm row? **Ruled by this selection:** it drafts into the composer.

## Sequencing note

Maps and the table view sit after the codex on the milestone ladder (vision.md). The margin and the MUD input baseline can land on today's table without a map. The slide-out map lands once map data exists. The spec should split along that line.
