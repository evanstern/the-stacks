---
title: Desktop MUD Clients
aliases: []
tags: [mud, clients]
type: note
created: 2026-11-04
updated: 2026-11-04
related: [[MUD-Client-UX]]
---

# Desktop MUD Clients

_What three long-lived desktop clients (Mudlet, MUSHclient, TinTin++) provide, as their own documentation describes it. Descriptive only._

## Mudlet

- Mudlet's Geyser is an object-oriented layout framework for GUI elements; windows under Geyser control resize with the main window. Modules include Container, Label, Gauge, Button, HBox, MiniConsole, ScrollBox, CommandLine, UserWindow and Mapper ([Geyser manual](https://wiki.mudlet.org/w/manual:geyser)).
- The manual's GMCP gauge example for Iron Realms games calls `setValue` on a gauge from `gmcp.Char.Vitals` (hp, maxhp). The documented pattern is an event handler on `gmcp.Char.Vitals` that updates gauges from stored Lua tables ([Geyser manual](https://wiki.mudlet.org/w/manual:geyser); [MoreMoreMUDs GMCP guide](https://moremoremuds.org/guides/gmcp-guide-gmcp-with-mudlet/)).
- `Geyser.Mapper` exists from Mudlet 4.8 and can be docked or embedded. For GMCP-driven mapping the server sends `Room.Info` with room id, name, area and exits; the mapper needs consistent numeric room ids and an environment type ([MoreMoreMUDs GMCP guide](https://moremoremuds.org/guides/gmcp-guide-gmcp-with-mudlet/)).
- A community package for Icesus MUD is a full GMCP-driven HUD: HP/SP/EP gauges, monster health bars, momentum buttons, a casting bar, a status-effects strip and a channel feed ([Icesus package](https://github.com/Icesus-mud/mudlet-package)).
- Mudlet's command line completes from the last 100 lines of output and from command history; Up/Down browse history, and with text typed, Up attempts an autocomplete ([General Features manual](https://wiki.mudlet.org/w/Manual:General_Features)). See [[Command-Line-and-Input-Aids]].
- Triggers and aliases are scripted in Lua; chat capture is commonly built from a trigger that copies a line to a console and `deleteLine()` ([Geyser manual](https://wiki.mudlet.org/w/manual:geyser); [UI Functions](https://wiki.mudlet.org/w/Manual:UI_Functions)). See [[Output-Organization-Channels-and-Spam]].

## MUSHclient

- Triggers match incoming text and run actions or scripts; aliases are shorthand for commands with wildcards or regular expressions; timers run once or periodically ([MUSHclient features](https://www.gammon.com.au/scripts/doc.php?general=features)).
- Miniwindows (added July 2008) are scriptable GUI elements: health and experience bars, maps, action buttons with cooldowns, inventory or quest displays. Most exist as plugins ([MUSHclient features](https://www.gammon.com.au/scripts/doc.php?general=features)).
- Plugins bundle triggers, aliases, timers, variables and scripts, shareable across worlds, in four scripting languages. Settings are saved as XML. The client lists a large scrollback, command history, keypad navigation, speed-walking and screen-reader (JAWS) use ([MUSHclient](https://www.mushclient.com/mushclient/)).
- The Aardwolf client package is built on MUSHclient and adds GMCP, GMCP-only channels, a GMCP-driven mapper and easy miniwindows ([Aardwolf plugins](https://www.aardwolf.com/play/plugins.htm); [package wiki](https://github.com/fiendish/aardwolfclientpackage/wiki/Why-Should-I-Use-This%3F)).

## TinTin++

- A console client. Its features page lists a split screen (input, output and status areas), aliases, actions (triggers), highlights (256 colour and true colour), and an auto-mapper that can draw in the split area ([TinTin++ features](https://tintin.mudhalla.net/features.php); [unofficial docs](https://tintinplusplus-unoffical-documentation.readthedocs.io/en/latest/contents/features/mapper/01_getting-started.html)).
- Also listed: regex triggers, gags, substitutions, macros, timers, events, multiple sessions, searchable scrollback and tab completion; it is reported to work with most screen readers ([TinTin++ features](https://tintin.mudhalla.net/features.php)).

## Grounding

- [[_grounding]] — passes C1 (desktop clients)
