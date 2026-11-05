---
title: Analysis — Table View Pattern Adoption
aliases: []
tags: [analysis, mud, ux, vtt]
type: analysis
created: 2026-11-04
updated: 2026-11-04
related: [[MUD-Client-UX]], [[Command-Line-and-Input-Aids]], [[Output-Organization-Channels-and-Spam]], [[Status-Vitals-Map-and-Room-Blocks]], [[Protocols-GMCP-MSDP-MXP-MSSP]], [[Accessibility-and-Screen-Readers]], [[Web-and-Commercial-Clients]], [[Adjacent-Text-Games]], [[Desktop-MUD-Clients]], [[Onboarding-and-Design-Writing]]
---

# Analysis — Table View Pattern Adoption

_Which MUD-client UX patterns should the-stacks' table view adopt, adapt, or reject, given it is a web virtual table top where an AI DM runs the game?_

## The frame (not from the corpus)

This branch is isolated from the repo, so the product is stated here as given by the task brief (TASK-0236). It is not a research finding.

- **Product.** Web table for D&D 5e. An AI DM or a human DM runs the scene.
- **Truth.** The server-side session event log is the only truth. The chat is a view over it. External VTTs (Foundry, Owlbear) can drive the same events.
- **One chat stream.** In-character lines are talk. After a quiet countdown ring (2 s blank, 8 s ring) the DM reads the table and proposes the action back ("Kestrel climbs to the loft, quietly — Stealth. Is this right?"). The player presses thumbs-up to commit. `@dm` asks an out-of-character question and gets a read-only answer.
- **Rules engine.** Coded; it owns dice, HP, conditions and initiative.
- **Roadmap.** Maps and a table view are not built. The end goal is a full VTT.
- **Standing UI rules.** No modals (slide-out panels, inline expansion, autocomplete dropdowns only). Works at 390 px. WCAG AA. Self-hosters.
- **Users.** Mostly natural-language typists, not command-syntax users.

## Verdict

**Working thesis.** Adopt the MUD *architecture* and reject the MUD *grammar*. The transferable core is "one text stream, plus server-pushed structured state rendered in panels beside it". The the-stacks event log is already the thing GMCP gives MUDs. The command grammar (verb-noun syntax, aliases, `syntax <cmd>`) mostly does not transfer, because the DM interprets natural language and proposes the action back for confirmation. That confirmation step is a better parser than "guess the verb".

How much minimalism survives a map: the **stream stays the primary surface and the record**. The map becomes a peer panel that never replaces the stream. A one-click click-to-act path (map token to a drafted line in the input) is the bridge. The corpus supports this: every long-lived client keeps text as the core and adds panels (see [[Desktop-MUD-Clients]], [[Web-and-Commercial-Clients]]). It does not show how a text stream should behave once the map is authoritative; that is a gap (see Confidence).

## Reasoning

### Pattern-by-pattern

| Pattern | Call | Reason | Corpus |
|---|---|---|---|
| Single typed input line as primary input | **Adopt** | Matches the one-chat-stream model and natural-language typists. Keep it the only input surface. | [[Command-Line-and-Input-Aids]]; Discworld/IF FAQ |
| Typed verb-noun grammar (`take sword`) | **Reject** | The DM interprets and proposes back. The corpus names "guess the verb" as the known parser weakness; proposal-and-confirm removes it. | [[Adjacent-Text-Games]] (IF FAQ, intfiction thread) |
| Slash/`@` prefix commands | **Adapt** (keep tiny) | `@dm` already exists. Prefix commands are familiar from Discord bots. Keep a small closed set shown in an autocomplete dropdown, not a syntax to learn. | [[Adjacent-Text-Games]] (VibeBot, Avrae); [[Command-Line-and-Input-Aids]] |
| Tab completion from recent output / history | **Adapt** | Complete *entities* (creature, item, exit, party name) from the event log into the dropdown. Keep Tab for focus when the line is empty or ends in a space (WCAG 2.1.2). | [[Command-Line-and-Input-Aids]] (Mudlet manual, mudlet-web PR #400) |
| Command history (Up/Down, persisted across reload) | **Adopt** | Cheap, expected. Persist across reload (EveLite does). Skip consecutive repeats. | [[Command-Line-and-Input-Aids]] (MUDling, EveLite) |
| Aliases / macros / F-key buttons | **Reject** (as user scripting) / **Adapt** (as suggested chips) | Player scripting presumes command-syntax users, which the product does not have. A short set of server-suggested quick-reply chips (e.g. the thumbs-up commit) serves the same speed goal. | [[Command-Line-and-Input-Aids]] (MUSHclient, Nexus) |
| Triggers/gags written by the player | **Reject** | Same reason; the log is canonical, so hiding is a *view* filter, not a deletion. | [[Output-Organization-Channels-and-Spam]] (`deleteLine()` is visual only) |
| Channel/tab separation of talk vs system | **Adapt** | Brief says one stream. Use *filter chips over one stream* (in-character / table talk / rules / `@dm`), not separate panes. Server tags each event, as Aardwolf `gmcpchannels` lets the client route without parsing text. | [[Output-Organization-Channels-and-Spam]]; [[Web-and-Commercial-Clients]] |
| Draggable multi-pane layout (Evennia, Nexus) | **Reject** now; **Adapt** later | Power-user layout fails at 390 px and without drag alternatives is an accessibility cost. Offer fixed named layouts first. | [[Web-and-Commercial-Clients]] |
| Server-side verbosity toggles (`brief`, `suppress_evade`) | **Adopt** | Rules-engine output (rolls, damage breakdowns) is the spam source. A per-player "rules detail" level collapses it inline. | [[Output-Organization-Channels-and-Spam]] (Discworld, Dune, JediMUD) |
| Structured state pushed beside text (GMCP) | **Adopt** | The event log already is the push channel. See the data section. | [[Protocols-GMCP-MSDP-MXP-MSSP]]; [[Status-Vitals-Map-and-Room-Blocks]] |
| Prompt line / status line | **Adapt** | MUD prompt is state glued to text. Here a compact status strip (own HP, conditions, whose turn) stays fixed; the stream stays clean. zMUD users already strip prompts into a status bar. | [[Status-Vitals-Map-and-Room-Blocks]] |
| Gauges and bars | **Adopt** (with text values) | HP bars are proven. Always render the number and state as text too. | [[Desktop-MUD-Clients]]; [[Status-Vitals-Map-and-Room-Blocks]] |
| Cooldown / availability buttons | **Adapt** | Fit D&D action economy (action, bonus, reaction, movement spent). The countdown ring is in this family; A Dark Room reports cooldown as sometimes time-wasting, so keep the ring skippable. | [[Adjacent-Text-Games]]; [[Status-Vitals-Map-and-Room-Blocks]] |
| MXP clickable nouns, hover hints, popup menus | **Adapt** | Clickable entities in DM text that open an inline expansion (stat block, condition text). No popup menus that behave as modals. Use MXP's `<EXPIRE>` idea: links from a past scene go inert. | [[Protocols-GMCP-MSDP-MXP-MSSP]]; [[Command-Line-and-Input-Aids]] |
| Click-an-exit instead of typing it | **Adapt** | Becomes click-a-map-token or click-a-suggested-action that drafts a line for confirmation, not an immediate send. | [[Web-and-Commercial-Clients]] (Discworld); [[Status-Vitals-Map-and-Room-Blocks]] (Aardwolf run-to) |
| Auto-mapper from room ids | **Adapt** | MUD maps are inferred graphs. A VTT map is authored geometry. Keep the *idea* that the map is a view fed by structured events, and that it is searchable. | [[Status-Vitals-Map-and-Room-Blocks]] |
| Room-description brevity (Sequent short alts) | **Adopt** | DM narration length is a cost on a one-stream design. Offer a short form of repeated scene text. | [[Status-Vitals-Map-and-Room-Blocks]] |
| Storylet/quality gating, choice buttons | **Adapt** | Useful for *proposals*: the proposal-back is effectively a one-option choice. Offering 2 to 3 alternative readings as buttons parallels choice-based IF. | [[Adjacent-Text-Games]] |
| Progressive reveal (A Dark Room) | **Adapt** | Show panels as the table needs them (initiative panel appears on combat). Reduces clutter at 390 px. | [[Adjacent-Text-Games]] |
| Notifications when unfocused (Evennia) | **Adopt** | Turn-based play with human latency needs it. Must not rely on colour or sound alone. | [[Output-Organization-Channels-and-Spam]] |
| Onboarding: `help`, helper channel, room help | **Adapt** | `help here` becomes inline "what can I do now" expansion. A human helper channel is out of scope for a self-hosted table. | [[Onboarding-and-Design-Writing]] |
| Koster: a good interface serves veterans and newbies alike | **Adopt** as a test | Use it as the acceptance bar for every pattern above. | [[Onboarding-and-Design-Writing]] |
| Per-user cloud-synced layouts (Nexus) | **Reject** | Self-hosters; layout belongs in local storage or a user setting. | [[Web-and-Commercial-Clients]] |

### The tension: free natural language versus command grammar

MUDs put the burden of exactness on the player: a closed verb set, nouns that must match, and aliases/completion to make the grammar cheap to type ([[Command-Line-and-Input-Aids]]). The brief's model moves the burden to the DM: the player types anything, the DM proposes a canonical reading, the player confirms. That is a real inversion, and it has a counter-intuitive consequence the corpus supports: **tab completion survives, but its job changes.** In MUDs it completes *what the parser requires*. Here it should *disambiguate references* ("the guard" versus "guard captain") so the proposal-back is right the first time. Mudlet already completes from recent output lines, which maps directly to "complete from the recent event log".

Second finding: the commit gesture is a *choice-based IF* move. The parser-versus-hyperlink debate in [[Adjacent-Text-Games]] says choice menus remove verb-guessing at the cost of click-heaviness in large spaces. The proposal-back with a thumbs-up gets the benefit of the menu (no verb guessing) while keeping free text for open-ended play. The corpus does not test this hybrid; it is an inference.

Third: keep the grammar *closed and tiny* so a command never becomes a hidden requirement. `@dm` plus at most a handful of prefixes, discoverable from the dropdown the moment the player types `@` or `/`, with no syntax page to read. Discworld's `syntax <command>` pattern is the thing to avoid reproducing.

### Structured data (the GMCP analogue) pushed to panels

GMCP is a JSON package per concern, opt-in, rendered by client panels ([[Protocols-GMCP-MSDP-MXP-MSSP]]). No canonical spec exists and field names drift (`maxhp` versus `maxHp`), so the lesson for the-stacks is to *define one schema and version it*, since external VTTs drive the same events. Candidate packages, mapped from the MUD set in [[Status-Vitals-Map-and-Room-Blocks]]:

- `Char.Vitals` analogue: HP, max HP, temp HP, conditions, concentration, spell slots, death saves. Feeds the status strip and party panel.
- `Room.Info` analogue: scene or location name, exits or points of interest, and later the map id plus token positions.
- `Comm.Channel` analogue: a tag on each event (in-character, ooc, rules, `@dm`). Drives filter chips.
- Turn/initiative state: order, active actor, action-economy flags. Feeds the initiative panel and cooldown-style buttons.
- Proposal state: pending proposal, who must confirm, countdown phase. Feeds the commit control and the ring, and lets a screen reader announce the phase as text.
- Roll results: structured (formula, dice, total, outcome), rendered collapsed or expanded per verbosity.
- Entity glossary: ids and names mentioned in a line, powering clickable nouns and completion.

Prefer MSDP-style *report on change* semantics over resend-everything. Discworld sends vitals with every command like a prompt ([[Web-and-Commercial-Clients]]), which suits a turn-based table less well than change events.

### Accessibility implications

- The corpus shows blind players are a documented MUD audience, and plain text is the reason ([[Accessibility-and-Screen-Readers]]). A VTT that makes the *map* the only place certain information lives breaks that. Rule: every fact in a panel or map also exists as a text event in the stream.
- Panels must be reachable by keyboard and not steal focus. Keep Tab for focus when the input is empty or ends in a space (mudlet-web, WCAG 2.1.2).
- Mudlet's accessibility package clears the line after send, stops echoing sent commands, and adds an input/output switch ([[Accessibility-and-Screen-Readers]]). Equivalent: a landmark jump between input, stream and panels.
- The Mudlet manual advises an *explicit* screen-reader mode over auto-detection and warns that ASCII art hinders screen readers. Provide a user setting, not sniffing, and no ASCII-art maps.
- Live-region announcements for the countdown ring phases and for new events need a verbosity control, or the stream becomes unusable read aloud. The `brief`/`verbose` precedent applies ([[Output-Organization-Channels-and-Spam]]).
- WCAG AA: gauges and ring state need text values and non-colour cues. The ring needs a reduced-motion variant. These are standards points from the brief's constraints, not corpus findings.

### Candidate UI directions for a mockup round

All four differ on **one axis: how much screen the text stream owns versus panels/map.** Same events, same data, same 390 px rule.

1. **Scroll** — *Stream owns the screen.*
   Thesis: the stream is the whole table; state lives in a one-line status strip and inline expandable blocks, like a MUD with a prompt.
   Risk: once a map exists, there is nowhere for it to live and spatial play degrades into prose.
2. **Margin** — *Stream dominant, slim panels.*
   Thesis: the stream takes most of the width with a slide-out side panel for party, initiative and conditions, as in Nexus gauges under the output.
   Risk: the panel drawer on 390 px hides the state players need mid-turn, so it needs a persistent mini-strip anyway.
3. **Split** — *Stream and map share the screen.*
   Thesis: a docked map above or beside the stream, with click-to-draft actions, like the TinTin++ split screen or Mudlet's docked mapper.
   Risk: at 390 px one of the two must collapse, and the map pulls attention from the conversation the product is built on.
4. **Board** — *Panels and map dominate; stream is a log.*
   Thesis: a Foundry-like board view where the stream shrinks to a collapsible log and actions are mostly clicks.
   Risk: it abandons the natural-language-first premise and the screen-reader-parity argument above, turning the product into the VTT it was meant to differ from.

My recommendation for the round: build 2 and 3 first. 1 is the control, 4 is the explicit "how far is too far" bound.

## Tensions & tradeoffs

- **Panels versus "one stream".** Every adopted panel is a second place the truth is shown. Mitigation: panels derive from events and mirror to text; this costs duplicate rendering work.
- **Closed command set versus discoverability.** Fewer commands means fewer hidden requirements, but power typists lose speed. The corpus's Koster line (veterans and newbies alike) cuts both ways.
- **Cooldown and ring.** A Dark Room's own reviewers call cooldown time-wasting; the 10 s ring is the same shape. The corpus has no data on whether it feels good at a table.
- **MUD minimalism is partly accident of its protocol.** Text-only was a transport limit as much as a design choice (Bartle's MUD1 history, [[Onboarding-and-Design-Writing]]). Reasoning from it to a VTT has a survivorship bias.

## Confidence & open questions

**Overall: medium.** High on adopting the stream-plus-structured-push architecture (it recurs in every client note). Medium on the natural-language inversion (inference across [[Command-Line-and-Input-Aids]] and [[Adjacent-Text-Games]], not tested). Low on map-era layout.

**Where the corpus is thin** (see [[_grounding]]):
- Everything rests on web-search *summaries*; pages were not fetched in full, so details may be incomplete or stale.
- No MUD-client-UX postmortem or user study; Bartle's interface chapters unread. Nothing measures whether any pattern *works*.
- No canonical GMCP spec; field conventions are per-game.
- Discord bot findings come from roundup pages, not official docs.
- Nothing on VTT clients (Foundry, Owlbear, Roll20), mobile layout beyond a Nexus swipe mention, AI-DM latency, or turn-based pacing. All VTT comparison here is from the brief or from my reasoning, not the corpus.
- Mudlet Web's limitations list was not read.

**What would change my mind:** playtest evidence that players *want* typed commands; an accessibility test showing live-region announcements are unusable at table pace; a mockup round where Split beats Margin at 390 px.

## Basis

- [[_grounding]] — method, summary-only sourcing, known gaps
- [[MUD-Client-UX]] — scope and open questions
- [[Command-Line-and-Input-Aids]], [[Adjacent-Text-Games]] — input and the parser/choice tension
- [[Output-Organization-Channels-and-Spam]], [[Status-Vitals-Map-and-Room-Blocks]], [[Protocols-GMCP-MSDP-MXP-MSSP]] — output, state and structured data
- [[Web-and-Commercial-Clients]], [[Desktop-MUD-Clients]] — panels and layout precedent
- [[Accessibility-and-Screen-Readers]], [[Onboarding-and-Design-Writing]] — accessibility and onboarding
