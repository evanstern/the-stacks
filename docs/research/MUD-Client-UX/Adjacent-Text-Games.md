---
title: MUD-Adjacent Text Games
aliases: []
tags: [text-games, interactive-fiction]
type: note
created: 2026-11-04
updated: 2026-11-04
related: [[MUD-Client-UX]]
---

# MUD-Adjacent Text Games

_Text-first games and tools that do not use the MUD client model._

## Fallen London (quality-based narrative)

- Storylets are bundles of text, usually a paragraph or two followed by a choice; their appearance is controlled by changeable state ("qualities"), e.g. a storylet may need 4 Jade and a location. Each option is a branch with outcome text ([Emily Short](https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/); [SimpleQBN](https://videlais.github.io/simple-qbn/qbn.html)).
- Failbetter's dev diary says every choice must describe its effects as quality changes. Writer guidelines call for "quality parsimony" because extra qualities complicate the economy and clutter the UI ([dev diary](https://www.failbettergames.com/news/storynexus-developer-diary-2-fewer-spreadsheets-less-swearing); [guidelines II](https://www.failbettergames.com/news/fallen-london-writer-guidelines-part-ii)).
- Short notes that scattered arcs make storylets hard to surface; later features let authors set page rank and colour important storylets ([Emily Short](https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/)).

## A Dark Room

- Opens with two lines of text and one button. Systems reveal over time rather than via tutorial. Layout: an activity feed, a main action pane, an inventory. Each action starts a cooldown during which it cannot be repeated. Cues are progress bars, words and screen dimming. Input is mostly buttons, not typed commands ([Wikipedia](https://en.wikipedia.org/wiki/A_Dark_Room); [PocketGamer.biz](https://pocketgamer.biz/feature/59277/shedding-light-the-making-of-a-dark-room); [review](https://www.thatsoftwaredude.com/content/1023/a-dark-room-text-game-review)).
- Some players report the cooldown as time-wasting, and tab switching between views as annoying ([review](https://www.thatsoftwaredude.com/content/1023/a-dark-room-text-game-review)).

## Interactive fiction: parser versus hyperlink

- Parser IF takes typed verb-noun commands ("take sword"); its known weakness is "guess the verb". Choice-based IF (Twine) shows options as a menu or in-text links, removing verb-guessing but making movement through large spaces click-heavy where a parser accepts "n n e n". It is described as a spectrum: choice-based games can add a parser ([IF Tech Foundation FAQ](https://iftechfoundation.org/frequently-asked-questions/); [intfiction thread](https://intfiction.org/t/parser-vs-hyperlinks/13004)).

## Discord roleplay and TTRPG bots

- Avrae handles D&D 5e dice and an initiative tracker in a text channel; Tupperbox deletes a user's bracketed message and reposts it via webhook with a custom name and avatar, driven by prefix commands ([bot roundup](https://www.myarchivist.ai/ai-dungeon-master/best-discord-bots-for-dnd-ttrpgs)).
- VibeBot's RPG feature resolves quests, combat and shopping through slash commands, buttons and embeds, with roleplay left to in-character channels ([VibeBot](https://www.vibebot.gg/features/rpg)).

## Grounding

- [[_grounding]] — passes C3 (adjacent games)
