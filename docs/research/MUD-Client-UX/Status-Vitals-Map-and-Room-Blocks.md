---
title: Status, Vitals, Map and Room Blocks
aliases: []
tags: [mud, status, map]
type: note
created: 2026-11-04
updated: 2026-11-04
related: [[MUD-Client-UX]]
---

# Status, Vitals, Map and Room Blocks

_Persistent state shown beside the text stream._

- **Prompt line.** A server-sent line after output showing state. JediMUD's prompt is configurable by format codes (health, mana, movement, melee status). zMUD users suggest stripping prompts from the output window into a status bar ([JediMUD basics](https://jedimud.fandom.com/wiki/MUD_Basics); [zMUD forum](https://www.zuggsoft.com/forums/viewtopic.php?p=91475)).
- **Gauges and bars.** Mudlet Geyser gauges fed by `Char.Vitals`; MUSHclient Stats Monitor and Status Bars miniwindows; Nexus gauges under main output with an avatar and F-key buttons; Icesus HUD adds monster health bars, a casting bar and a status-effects strip. A Dark Room uses progress bars as its main visual cue ([[Desktop-MUD-Clients]], [[Web-and-Commercial-Clients]], [[Adjacent-Text-Games]]).
- **Cooldown buttons.** MUSHclient miniwindows and Nexus (Battlerage highlight) show action availability ([MUSHclient features](https://www.gammon.com.au/scripts/doc.php?general=features); [Nexus](https://nexus.ironrealms.com/F-Keys,_Gauges,_and_Avatars)).
- **Room description and exits.** GMCP `Room.Info` carries id, name, area/zone, exits (direction to room id) and optional environment and coordinates, sent on look or movement, letting a client draw exits separately from the text ([Forsaken Lands](https://theforsakenlands.com/wiki/GMCP); [MoreMoreMUDs](https://moremoremuds.org/guides/gmcp-guide-gmcp-with-mudlet/)). Sequent MUD added shorter alternate room descriptions, cutting text about half ([Sequent (MUD)](https://en.wikipedia.org/wiki/Sequent_(MUD))).
- **Auto-mapper.** Mudlet Geyser.Mapper (4.8+), TinTin++ map drawn in the split area, Aardwolf GMCP mapper (searchable, click to run to, zoom, `mapper find`), Nexus graphical map window ([[Desktop-MUD-Clients]], [[Web-and-Commercial-Clients]]).
- **Server-side image maps.** MXP can append click coordinates to a command for an image inside `<SEND>` ([MXP spec](https://www.zuggsoft.com/zmud/mxp.htm)).

## Grounding

- [[_grounding]] — passes C2, C4, C6
