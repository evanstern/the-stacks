---
title: Protocols: GMCP, MSDP, MXP, MSSP
aliases: []
tags: [mud, protocols]
type: note
created: 2026-11-04
updated: 2026-11-04
related: [[MUD-Client-UX]]
---

# Protocols: GMCP, MSDP, MXP, MSSP

_Telnet-layer protocols that let a client render more than plain text._

## GMCP

- A telnet subnegotiation extension (option 201) carrying JSON with a dot-separated package name (`Room.Info`, `Char.Vitals`). The client opts in with `Core.Supports.Set`. There is no single canonical spec; each game documents its packages, and field names vary (e.g. `maxhp` versus `maxHp`) ([Forsaken Lands](https://theforsakenlands.com/wiki/GMCP); [AmbonMUD](https://github.com/jnoecker/AmbonMUD/blob/main/docs/GMCP_PROTOCOL.md); [Mudlet protocols](https://wiki.mudlet.org/w/Manual:Supported_Protocols)).
- Mudlet stores received data under `gmcp.<Package>` and raises a matching event ([MoreMoreMUDs](https://moremoremuds.org/guides/gmcp-guide-gmcp-with-mudlet/)).

## MSDP

- Server data on a separate channel from text; bidirectional; variables, reports, lists, arrays, tables; telnet option 69 ([MSDP](https://tintin.mudhalla.net/protocols/msdp/)).

## MXP

- Markup tags in the stream. `<SEND>` makes clickable text (send, prompt-fill, hint, expire), supports popup menus and image maps. Open versus Secure line modes limit which tags text may use. Mudlet supports links, popup menus, custom elements and line modes ([MXP spec](https://www.zuggsoft.com/zmud/mxp.htm); [Mudlet protocols](https://wiki.mudlet.org/w/Manual:Supported_Protocols)).

## MSSP

- Server status for crawlers (NAME, PLAYERS, UPTIME and others) over telnet option 70; public metadata. Mudlet uses it to find an SSL port ([MSSP](https://mudstandards.org/mud/mssp/); [mudverse](https://www.mudverse.com/mud-protocols/mssp)).

## Others named in sources

- MCCP compression (Discworld deprioritizes clients without it near the player cap); NAWS, TTYPE ([Discworld getting started](https://discworld.starturtle.net/lpc/playing/getting_started.html); [mudverse](https://www.mudverse.com/mud-protocols)).

## Grounding

- [[_grounding]] — passes C6
