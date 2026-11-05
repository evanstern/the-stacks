---
title: Output Organization, Channels and Spam
aliases: []
tags: [mud, output, channels]
type: note
created: 2026-11-04
updated: 2026-11-04
related: [[MUD-Client-UX]]
---

# Output Organization, Channels and Spam

_How clients and servers separate chat from room and combat text, and reduce volume._

- **Windowed output.** Nexus offers separate windows for main output, inventory, communication and map, with movable tabs. Evennia offers draggable tabbed panes with per-pane output types and saved layouts. TinTin++ splits input, output and status areas. See [[Web-and-Commercial-Clients]].
- **Channel capture.** In Mudlet a trigger copies a line to a miniconsole and `deleteLine()` removes it from the main window; EMCO (a tabbed chat class) wraps this, with `addGag` patterns and automatic logging in the AchaeaChatTabs package. `deleteLine()` is visual only; triggers still fire, and gagged lines can leave extra prompt lines ([UI Functions](https://wiki.mudlet.org/w/Manual:UI_Functions); [EMCO](https://demonnic.github.io/mdk/current/classes/EMCO.html); [AchaeaChatTabs](https://packages.mudlet.org/packages/achaeachattabs); [gagging thread](https://forums.mudlet.org/viewtopic.php?t=1741)).
- **Server-sent channel data.** Aardwolf `gmcpchannels` and Mudlet-side `Comm.Channel` let the client route channels without parsing text ([Aardwolf GMCP](https://www.aardwolf.com/wiki/index.php/Clients/GMCP); [Icesus package](https://github.com/Icesus-mud/mudlet-package)). Grapevine adds cross-game channels ([[Web-and-Commercial-Clients]]).
- **Server-side verbosity.** Discworld has `brief` and `verbose` per event type, plus `suppress_evade` to hide avoided attacks. Dune MUD has `briefme`, `verybriefme`, `briefmon all`. JediMUD has per-character brief toggles and a configurable prompt ([Discworld accessibility help](https://dwwiki.mooo.com/wiki/Accessibility_Help); [Dune newbies](https://dunemud.net/newbies); [JediMUD basics](https://jedimud.fandom.com/wiki/MUD_Basics)).
- **Client gag lists.** CMud and zMUD users keep a phrase list and one trigger gags all entries ([Genesis forum](https://www.genesismud.org/forums/viewtopic.php?f=14&t=3993)).
- **Combat pacing.** A Dark Room attaches a cooldown to every action ([[Adjacent-Text-Games]]). Discworld `monitor on` shows HP, guild points and XP gained in combat ([Discworld getting started](https://discworld.starturtle.net/lpc/playing/getting_started.html)).
- **Scrollback and logging.** MUSHclient and TinTin++ list large or searchable scrollback; AchaeaChatTabs logs chat automatically ([MUSHclient](https://www.mushclient.com/mushclient/); [TinTin++](https://tintin.mudhalla.net/features.php)).
- **Notifications.** Evennia tab notifications fire when the window is unfocused ([Evennia #614](https://github.com/evennia/evennia/issues/614)).

## Grounding

- [[_grounding]] — passes C4, C5
