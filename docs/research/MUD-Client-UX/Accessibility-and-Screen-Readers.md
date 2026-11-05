---
title: Accessibility and Screen Readers
aliases: []
tags: [mud, accessibility]
type: note
created: 2026-11-04
updated: 2026-11-04
related: [[MUD-Client-UX]]
---

# Accessibility and Screen Readers

_MUDs are described in sources as well suited to screen readers._

- Blind players use text MUDs because screen readers handle plain text; VIPMud (built for blind players, works with JAWS and NVDA or self-voices) and Mudlet recur in community accounts. Alter Aeon notes client choice is painful because screen readers are finicky ([Alter Aeon](https://www.alteraeon.com/articles/mudding_clients.html)).
- SmartMonsters reports about 80% of players on its game Dungeon identify as blind or visually impaired, and that it works with VIPMud, TinTin++ and Mudlet ([SmartMonsters](https://www.smartmonsters.com/Dungeon/accessibility.jsp)).
- A 2013 Mudlet forum thread reports 2.1 Windows lacked the Qt accessibility plugin; testers from VIPMud missed fast-forwarding the reading cursor through arriving text ([Mudlet forum](https://forums.mudlet.org/viewtopic.php?t=2616&start=20)).
- Mudlet 4.17 (Dec 2024) made the main display and editor readable; an `enable-accessibility` package clears the command line after send, stops echoing sent commands, and adds a Ctrl+Tab input/output switch; `mudlet access reader` sets up a TTS plugin for macOS VoiceOver. 4.20 (2026) fixed output search for screen readers ([4.17](https://www.mudlet.org/2024/12/4-17-now-more-screenreader-friendly/); [package](https://packages.mudlet.org/packages/enable-accessibility); [4.20](https://www.mudlet.org/2026/02/4-20-a-mudlet-release-for-2026/)).
- The Mudlet manual advises games to offer an explicit command for a screen-reader mode rather than auto-detecting, and notes ASCII art hinders screen readers ([Screen Readers manual](https://wiki.mudlet.org/w/Manual:Screen_Readers)). Discworld keeps an accessibility help page ([wiki](https://dwwiki.mooo.com/wiki/Accessibility_Help)).
- Mudlet-web keeps Tab for focus when the line is empty or ends in a space, citing WCAG 2.1.2 ([PR #400](https://github.com/Mudlet/mudlet-web/pull/400)).

## Grounding

- [[_grounding]] — passes C7
