---
title: Web and Commercial Clients
aliases: []
tags: [mud, clients, web]
type: note
created: 2026-11-04
updated: 2026-11-04
related: [[MUD-Client-UX]]
---

# Web and Commercial Clients

_Browser-based clients and the clients bundled with commercial or large MUDs._

## Mudlet Web (formerly mudix)

- A browser edition of Mudlet speaking the telnet protocol stack, with Lua 5.1 compiled to WebAssembly (wasmoon), PCRE2 and SQLite in WASM; React and TypeScript. It targets compatibility with Mudlet packages, maps and profiles, and is not a rewrite of desktop Mudlet. Hosted at web.mudlet.org ([repo](https://github.com/Mudlet/mudlet-web); [search result summary](https://web.mudlet.org/)).
- Its pull requests port desktop command-line behaviour (Tab pool, history, password mode, Escape) ([PR #400](https://github.com/Mudlet/mudlet-web/pull/400)).

## Evennia webclient

- Evennia 0.9 added a golden-layout web client: tabbed panes that can be dragged into any grid position, per-pane tab names, data tags and output types, and any number of input panes each with its own history ([Evennia webclient discussion](https://github.com/evennia/evennia/issues/614); [0.9.5 brainstorm](https://www.evennia.com/docs/0.x/Webclient-brainstorm.html)).
- Pane layouts can be saved and restored (0.9.5). EvMenu output defaults to a "menu" message type, which can be routed to its own pane. Tab notifications fire when the window is unfocused. A `history.js` plugin gives arrow-key command history ([Evennia changelog](https://www.evennia.com/docs/4.x/Coding/Changelog.html)).
- EveLite, a third-party lightweight Evennia client, keeps history across page reloads and has built-in channel tabs ([EveLite](https://github.com/InspectorCaracal/evelite-client)).

## Grapevine

- A MUD chat network and game directory with a web client that games can enable (custom play domain via CNAME). Games connect over a websocket and subscribe to channels (public: gossip, testing, moo); players chat from the web ([About](https://grapevine.haus/about); [Docs](https://grapevine.haus/docs); [repo](https://github.com/oestrich/grapevine)).
- Other named web clients: MudPortal, mud-web-client, Mudslinger, DecafMUD (old, unmaintained) ([awesome-muds](https://github.com/maldorne/awesome-muds)).

## Iron Realms Nexus (Achaea and sibling games)

- A free official client for all Iron Realms games, in browser or desktop (Windows, Linux, Mac) and native mobile apps. Triggers, aliases, keybindings and layouts are stored on the company's servers and follow the player across devices ([Nexus overview](https://www.ironrealms.com/the-nexus-client/); [Nexus 3.0 overview](https://nexus.ironrealms.com/Nexus_Client_3.0_Overview)).
- Output is windowed (main output, inventory, communication, graphical map); windows can be added, moved, resized, and tabs moved between windows. Below main output sit gauges, a customizable avatar and a row of F-key buttons; on Achaea a Battlerage button highlights when usable. On mobile, swipes reach special windows ([F-Keys, Gauges, and Avatars](https://nexus.ironrealms.com/F-Keys,_Gauges,_and_Avatars)).
- Scripting has "Simplified" and "Advanced" modes. A player-made package, nexGui, adds missing-defence displays, countdown timers and self/target state panes ([nexGui thread](https://forums.achaea.com/index.php?p=%2Fdiscussion%2F7702%2Fnexus-khaseems-nexus-gui-nexgui)).

## Aardwolf

- The Aardwolf MUSHclient package ships Stats Monitor, Status Bars, In-Game Map, Graphical Mapper and Chat/Channels Capture miniwindows. The GMCP mapper builds a map as the player moves, is searchable, supports point-and-click run-to and zoom ([GMCP mapper](https://www.aardwolf.com/wiki/index.php/Clients/GMCPMapper); [plugins](https://www.aardwolf.com/play/plugins.htm)).
- `gmcpchannels on/off` sends channel text over GMCP only, so the client decides where it appears ([Aardwolf GMCP](https://www.aardwolf.com/wiki/index.php/Clients/GMCP)).

## Discworld MUD

- Requires a client; the site lists a browser client and a downloadable one. Clients with MCCP compression get priority near the player limit. In clients that allow it, an exit can be clicked instead of typed ([Getting started](https://discworld.starturtle.net/lpc/playing/getting_started.html)).
- GMCP is sent including Char.Vitals with every command, like a prompt ([Discworld GMCP doc](https://discworld.starturtle.net/lpc/playing/documentation.c?path=%2Fconcepts%2Fgmcp)).

## Grounding

- [[_grounding]] — passes C2 (web and commercial clients)
