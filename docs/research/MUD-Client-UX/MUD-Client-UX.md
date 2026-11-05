---
title: MUD Client UX
aliases: []
tags: [mud, ux, text-games]
type: moc
created: 2026-11-04
updated: 2026-11-04
related: [[Desktop-MUD-Clients]], [[Web-and-Commercial-Clients]], [[Adjacent-Text-Games]], [[Command-Line-and-Input-Aids]], [[Output-Organization-Channels-and-Spam]], [[Status-Vitals-Map-and-Room-Blocks]], [[Protocols-GMCP-MSDP-MXP-MSSP]], [[Accessibility-and-Screen-Readers]], [[Onboarding-and-Design-Writing]]
---

# MUD Client UX

_How popular MUD clients, MUD protocols and MUD-like text games present input, output, state and maps, gathered as inspiration for a minimalist web virtual table top (TASK-0236). Descriptive: no verdicts._

## Scope

In: Mudlet, MUSHclient, TinTin++, web clients (Mudlet Web, Evennia, Grapevine), Nexus/Achaea, Aardwolf, Discworld; Fallen London, A Dark Room, parser versus hyperlink IF, Discord bots; command line aids, channels and spam, status and maps, GMCP/MSDP/MXP/MSSP, accessibility, onboarding.

Out: any recommendation, the-stacks UI state, graphical MMO UI.

## What is known

- Clients converge on a typed command line plus scriptable side panels. See [[Command-Line-and-Input-Aids]] and [[Desktop-MUD-Clients]].
- Server-sent structured data (GMCP `Char.Vitals`, `Room.Info`, channel packages) drives gauges, maps and channel tabs beside the text. See [[Protocols-GMCP-MSDP-MXP-MSSP]] and [[Status-Vitals-Map-and-Room-Blocks]].
- Chat, room and combat text are separated by client-side capture and gag, or by server-side verbosity settings. See [[Output-Organization-Channels-and-Spam]].
- Web clients add draggable tabbed panes (Evennia), synced layouts (Nexus) and compatibility ports (Mudlet Web). See [[Web-and-Commercial-Clients]].
- MXP allows clickable nouns, hints and popup menus; Discworld lets exits be clicked. See [[Protocols-GMCP-MSDP-MXP-MSSP]].
- Text-first games outside MUD clients use buttons, storylets with state gates, progressive reveal and cooldowns. See [[Adjacent-Text-Games]].
- Blind players are a documented MUD audience; Mudlet made the main display screen-reader readable in 4.17. See [[Accessibility-and-Screen-Readers]].
- Onboarding sources describe help commands, a newbie channel and helpers. See [[Onboarding-and-Design-Writing]].

## Notes

- [[Desktop-MUD-Clients]] — Mudlet, MUSHclient, TinTin++
- [[Web-and-Commercial-Clients]] — Mudlet Web, Evennia, Grapevine, Nexus, Aardwolf, Discworld
- [[Adjacent-Text-Games]] — Fallen London, A Dark Room, IF, Discord bots
- [[Command-Line-and-Input-Aids]] — input, aliases, history, completion, links
- [[Output-Organization-Channels-and-Spam]] — panes, channels, gags, verbosity, pacing
- [[Status-Vitals-Map-and-Room-Blocks]] — prompt, gauges, exits, maps
- [[Protocols-GMCP-MSDP-MXP-MSSP]] — what the protocols carry
- [[Accessibility-and-Screen-Readers]] — screen-reader practice
- [[Onboarding-and-Design-Writing]] — new-player help and designer commentary

## Analyses

_None yet._

## Open questions

- No MUD-client-UX postmortem was found; Bartle's interface chapters are unread.
- GMCP package field conventions are per-game; no canonical spec was gathered.
- Mudlet Web's current limitations list was not read.

## Grounding

- [[_grounding]] — method, passes, sources and gaps
