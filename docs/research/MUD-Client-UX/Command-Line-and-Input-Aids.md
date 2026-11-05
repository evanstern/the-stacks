---
title: Command Line and Input Aids
aliases: []
tags: [mud, input]
type: note
created: 2026-11-04
updated: 2026-11-04
related: [[MUD-Client-UX]]
---

# Command Line and Input Aids

_The typed command line as the primary input, and the aids built around it._

- **Primary input.** Parser IF and MUDs take typed commands; Discworld's help lists commands by `help command_list` and `syntax <command>` shows usage ([Discworld getting started](https://discworld.starturtle.net/lpc/playing/getting_started.html); [IF FAQ](https://iftechfoundation.org/frequently-asked-questions/)).
- **Aliases and macros.** MUSHclient aliases expand shorthand (e.g. CLW to "cure light wounds") with wildcard arguments or regex; TinTin++ aliases bundle several commands; Nexus has F-key buttons and stored aliases ([MUSHclient features](https://www.gammon.com.au/scripts/doc.php?general=features); [TinTin++](https://tintin.mudhalla.net/features.php); [Nexus](https://nexus.ironrealms.com/F-Keys,_Gauges,_and_Avatars)).
- **Command history.** Mudlet: Up/Down browse with an empty line; with typed text, Up attempts autocompletion from history. MUDling keeps the last 500 commands and skips consecutive repeats. Evennia gives each input pane its own history; EveLite preserves history across reloads ([Mudlet manual](https://wiki.mudlet.org/w/Manual:General_Features); [MUDling PR](https://github.com/Vyttle-LLC/mudling/pull/5); [Evennia](https://www.evennia.com/docs/0.x/Webclient-brainstorm.html); [EveLite](https://github.com/InspectorCaracal/evelite-client)).
- **Tab completion.** Mudlet completes from the last 100 output lines; newer desktop behaviour uses `addCmdLineSuggestion` entries and output words, and keeps Tab for focus when the line is empty or ends in a space (WCAG 2.1.2). MUDling completes from history words, then known words, cycling on repeat ([Mudlet manual](https://wiki.mudlet.org/w/Manual:General_Features); [mudlet-web PR #400](https://github.com/Mudlet/mudlet-web/pull/400)).
- **Password mode.** While the server has telnet ECHO on, Mudlet-web runs no command-line action and stores nothing in history ([mudlet-web PR #400](https://github.com/Mudlet/mudlet-web/pull/400)).
- **Clickable text.** MXP `<SEND>` makes text send a command on click, put it on the command line (`prompt`), show a hover hint, or open a popup menu of several commands; `<EXPIRE>` removes links from a previous room. See [[Protocols-GMCP-MSDP-MXP-MSSP]]. Discworld lets exits be clicked in clients that support it.
- **Button input.** A Dark Room and Discord bots replace typing with buttons or slash commands ([[Adjacent-Text-Games]]).

## Grounding

- [[_grounding]] — passes C4
