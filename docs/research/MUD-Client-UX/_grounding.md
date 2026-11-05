---
title: MUD Client UX — Grounding
aliases: []
tags: [grounding]
type: source
created: 2026-11-04
updated: 2026-11-04
related: [[MUD-Client-UX]]
---

# MUD Client UX — Grounding

> Source-of-truth artifact. Records method, passes and sources. Notes cite into this file. No conclusions here.

**Research question:** What UX patterns do popular MUD clients, MUD protocols and MUD-adjacent text games use (input, output organization, status display, mapping, accessibility, onboarding), as inspiration for a minimalist web virtual table top (TASK-0236)?
**Method:** web-search fan-out, 24 parallel searches by angle, 2026-11-04. Claims are limited to what search result summaries stated; pages were not fetched in full. Where a summary lacked detail the note says so.

---

## Passes

- C1 desktop clients: Mudlet Geyser/GMCP/mapper, MUSHclient features, TinTin++ features.
- C2 web and commercial clients: Mudlet Web, Evennia webclient, Grapevine, Nexus/Achaea, Aardwolf, Discworld.
- C3 adjacent games: Fallen London (QBN), A Dark Room, parser versus hyperlink IF, Discord bots.
- C4 interaction patterns: command line, history, tab completion, channels, gagging, verbosity.
- C5 combat spam and pacing.
- C6 protocols: GMCP, MSDP, MXP, MSSP.
- C7 accessibility: VIPMud, Mudlet screen-reader work.
- C8 onboarding and design writing: Discworld help, Koster, Bartle.

## Known gaps

- Search summaries only; no primary protocol spec for GMCP exists in the results (each game documents its own).
- No MUD-client-UX postmortem found. Bartle's book chapters on interface were not read.
- Mudlet-web details come from repository pages and PRs and may have changed.
- Discord bot findings come from roundup pages, not official documentation.

## Sources

- https://wiki.mudlet.org/w/manual:geyser
- https://moremoremuds.org/guides/gmcp-guide-gmcp-with-mudlet/
- https://github.com/Icesus-mud/mudlet-package
- https://wiki.mudlet.org/w/Manual:General_Features
- https://wiki.mudlet.org/w/Manual:UI_Functions
- https://wiki.mudlet.org/w/Manual:Supported_Protocols
- https://wiki.mudlet.org/w/Manual:Screen_Readers
- https://www.mudlet.org/2024/12/4-17-now-more-screenreader-friendly/
- https://www.mudlet.org/2026/02/4-20-a-mudlet-release-for-2026/
- https://packages.mudlet.org/packages/enable-accessibility
- https://packages.mudlet.org/packages/achaeachattabs
- https://demonnic.github.io/mdk/current/classes/EMCO.html
- https://forums.mudlet.org/viewtopic.php?t=2616&start=20
- https://forums.mudlet.org/viewtopic.php?t=1741
- https://github.com/Mudlet/mudlet-web ; https://web.mudlet.org/ ; https://github.com/Mudlet/mudlet-web/pull/400
- https://github.com/Vyttle-LLC/mudling/pull/5
- https://www.gammon.com.au/scripts/doc.php?general=features ; https://www.mushclient.com/mushclient/
- https://tintin.mudhalla.net/features.php ; https://tintinplusplus-unoffical-documentation.readthedocs.io/en/latest/contents/features/mapper/01_getting-started.html
- https://github.com/evennia/evennia/issues/614 ; https://www.evennia.com/docs/0.x/Webclient-brainstorm.html ; https://www.evennia.com/docs/4.x/Coding/Changelog.html ; https://github.com/InspectorCaracal/evelite-client
- https://grapevine.haus/about ; https://grapevine.haus/docs ; https://github.com/oestrich/grapevine ; https://github.com/maldorne/awesome-muds
- https://www.ironrealms.com/the-nexus-client/ ; https://nexus.ironrealms.com/Nexus_Client_3.0_Overview ; https://nexus.ironrealms.com/F-Keys,_Gauges,_and_Avatars ; https://forums.achaea.com/index.php?p=%2Fdiscussion%2F7702%2Fnexus-khaseems-nexus-gui-nexgui
- https://www.aardwolf.com/wiki/index.php/Clients/GMCPMapper ; https://www.aardwolf.com/wiki/index.php/Clients/GMCP ; https://www.aardwolf.com/play/plugins.htm ; https://github.com/fiendish/aardwolfclientpackage/wiki/Why-Should-I-Use-This%3F
- https://discworld.starturtle.net/lpc/playing/getting_started.html ; http://discworld.starturtle.net/lpc/playing/documentation.c?path=%2Fnewbie%2Fessentials ; https://discworld.starturtle.net/lpc/playing/documentation.c?path=%2Fconcepts%2Fcreator%2Fnewbie_channel ; https://discworld.starturtle.net/lpc/playing/documentation.c?path=%2Fconcepts%2Fgmcp ; https://dwwiki.mooo.com/wiki/Accessibility_Help
- https://theforsakenlands.com/wiki/GMCP ; https://github.com/jnoecker/AmbonMUD/blob/main/docs/GMCP_PROTOCOL.md
- https://www.zuggsoft.com/zmud/mxp.htm ; https://tintin.mudhalla.net/protocols/msdp/ ; https://mudstandards.org/mud/mssp/ ; https://www.mudverse.com/mud-protocols ; https://www.mudverse.com/mud-protocols/mssp
- https://jedimud.fandom.com/wiki/MUD_Basics ; https://dunemud.net/newbies ; https://www.zuggsoft.com/forums/viewtopic.php?p=91475 ; https://www.genesismud.org/forums/viewtopic.php?f=14&t=3993
- https://www.alteraeon.com/articles/mudding_clients.html ; https://www.smartmonsters.com/Dungeon/accessibility.jsp ; https://en.wikipedia.org/wiki/Sequent_(MUD)
- https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/ ; https://videlais.github.io/simple-qbn/qbn.html ; https://www.failbettergames.com/news/storynexus-developer-diary-2-fewer-spreadsheets-less-swearing ; https://www.failbettergames.com/news/fallen-london-writer-guidelines-part-ii
- https://en.wikipedia.org/wiki/A_Dark_Room ; https://pocketgamer.biz/feature/59277/shedding-light-the-making-of-a-dark-room ; https://www.thatsoftwaredude.com/content/1023/a-dark-room-text-game-review
- https://iftechfoundation.org/frequently-asked-questions/ ; https://intfiction.org/t/parser-vs-hyperlinks/13004
- https://www.myarchivist.ai/ai-dungeon-master/best-discord-bots-for-dnd-ttrpgs ; https://www.vibebot.gg/features/rpg
- https://www.raphkoster.com/2006/09/19/in-the-newbies-shoes/ ; https://www.raphkoster.com/games/interviews-and-panels/the-art-of-liveops-raph-koster/ ; https://archive.org/details/richard-bartle-designing-virtual-worlds ; https://mud.co.uk/richard/International%20Handbook%20of%20Internet%20Research.pdf
