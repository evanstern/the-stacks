---
title: NPCs, Social Interaction and Information — Grounding
aliases: []
tags: [grounding]
type: source
created: 2026-10-26
updated: 2026-10-26
related: [[NPCs-Social-and-Information]]
---

# NPCs, Social Interaction and Information — Grounding

> Source-of-truth artifact for the branch. It records method, sources and gaps for the gathered passes. Notes cite into this file. No conclusions here.

**Research question:** How does a DM run NPCs and the information they carry: attitude as persistent state, social checks and DCs, NPC knowledge limits and lying, the clue economy, and who on the DM side may read an NPC's secrets (TASK-0107)?
**Method:** four gather passes (B1 books and SRD, B2 web, A3 project, plus TASK-0107 facts), all dated 2026-10-26, assembled into notes on 2026-10-26.

---

## Method

1. Pass B1 — books and SRD. The SRD 5.2.1 PDF was downloaded on 2026-10-26 and text-extracted with pdftotext. The operator's local DMG 2014 extracts (Chapters 3, 4 and Running the Game) and the TCoE, XGtE and VRGtR Dungeon Master tool extracts were converted to text and read by heading path.
2. Pass B2 — web. Articles were fetched with a page-fetch summarizer that answered a paraphrase prompt per page. Claims in the notes are limited to what each summary stated. Where a page exceeded the fetch window the unread tail is recorded below. Searches supplied leads.
3. Pass A3 — project. Seed schema, prompt builders, nodes, doctrine, the 034 contract and research, the shipped seed and the auditor were read at commit `b933a95`. See [[The-Stacks-NPCs-and-Information-Today]].
4. Assembly — one note per sub-question, a project note, a TASK-0107 fact note, a brief and a MOC.

### Source-handling rules applied

- Books are paraphrased and cited by heading path; no quotation, table or stat block is reproduced. DC and attitude table values are described, not copied as tables.
- SRD 5.2.1 (CC-BY-4.0) is cited as SRD p.N with a section name. Short quotations carry the attribution SRD 5.2.1, CC-BY-4.0.
- Web articles are paraphrased with the URL at the claim.
- Excluded: Matt Colville (operator ruling, TASK-0115), pdfcoffee.com.
- Forum and Q&A pages named by search results (EN World, Burning Wheel forums, Pathfinder rules site, itch.io supplements, World Anvil, Substack posts) were not fetched. They are search leads only and no note relies on them for more than the one-line search summaries marked as such.

## Sources

### SRD 5.2.1

- SRD 5.2.1 PDF (CC-BY-4.0), downloaded 2026-10-26: https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf
- SHA-256 of the downloaded file: 8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87. It matches the hash recorded in the sibling branches.
- License text: https://creativecommons.org/licenses/by/4.0/legalcode
- Sections cited: Actions table, Roleplaying, Social Interaction (p.10-11); Rules Glossary: Charmed (p.178), Friendly (p.182), Hostile (p.183), Indifferent and Influence (p.184), Search (p.187), Study and Areas of Knowledge (p.189); spells Detect Thoughts (p.123), Zone of Truth (p.175).

### Books (heading paths)

- DMG 2014: Ch 3 > Adventure Types (Event-Based Adventures, Mysteries: Victim, Suspects, Clues; Intrigue); Ch 4 > Designing NPCs (Quick NPCs, Detailed NPCs and each element, Monsters as NPCs), NPC Party Members (Low-Level Followers, Adventurer NPCs, Optional Rule: Loyalty), Contacts, Patrons, Hirelings, Extras, Villains (Villain's Secret Weakness); Ch 8 > Social Interaction (Resolving Interactions steps 1-4, Changing Attitude, Determining Characteristics, Aiding the Check, Multiple Checks, Roleplaying, Engaging the Players).
- TCoE: DM's Tools > Parleying with Monsters (Monster Research table).
- XGtE: Downtime Revisited > Rivals, Creating a Rival.
- VRGtR: Horror Adventures > Running Horror Games > Horror Pacing > Reliability and Trust.
- Title-level entries from the DM-Craft-Map inventory only (not re-read): DMG Ch 6 Foreshadowing, TCoE Puzzles > Running Puzzles, CoS Adventure Structure, VRGtR Undermine Reality.

### Web articles read (through the fetch summarizer)

The Alexandrian
- https://thealexandrian.net/wordpress/1118/roleplaying-games/three-clue-rule (last 9,651 characters of 109,651 unread)
- https://thealexandrian.net/wordpress/46338/roleplaying-games/random-gm-tips-making-clues
- https://thealexandrian.net/wordpress/49225/roleplaying-games/running-mysteries-the-null-result
- https://thealexandrian.net/wordpress/49595/roleplaying-games/running-mysteries-returning-to-the-scene-of-the-crime
- https://thealexandrian.net/wordpress/8202/roleplaying-games/advanced-node-based-design-part-5-the-two-prongs-of-mystery-design
- https://thealexandrian.net/?p=50021 (Random D&D Tip: Reactions & Relationships)
- https://thealexandrian.net/wordpress/37916/roleplaying-games/universal-npc-roleplaying-template
- https://thealexandrian.net/wordpress/46250/roleplaying-games/advanced-npc-templates
- https://thealexandrian.net/wordpress/36383/roleplaying-games/dont-prep-plots-you-will-rue-this-day-heroes-the-principles-of-rpg-villainy
- https://thealexandrian.net/wordpress/52707/roleplaying-games/roleplaying-for-the-beginning-gm

The Angry GM
- https://theangrygm.com/resolving-social-actions/
- https://theangrygm.com/declaring-social-actions/
- https://theangrygm.com/social-conflict-not-really-defined/
- https://theangrygm.com/help-my-players-are-talking-to-things/

Sly Flourish
- https://slyflourish.com/running_intrigue_adventures.html
- https://slyflourish.com/creating_villains.html
- https://slyflourish.com/eight_steps_2023.html
- https://slyflourish.com/player-generated_secrets.html

Other
- https://pooltime.bearblog.dev/player-trust-definitive-guide/ (Pool Time, Player Trust: A Definitive Guide)

### Web search summaries used as leads (not read in full)

- Sly Flourish secrets and clues: https://www.goodreads.com/author_blog_posts/24034659-re-using-secrets-and-clues ; https://www.goodreads.com/author_blog_posts/21409111-types-of-secrets ; https://www.goodreads.com/author_blog_posts/24177753-the-eight-steps-of-the-lazy-dm-2023-review
- GUMSHOE: https://pelgranepress.com/2018/01/03/see-page-xx-improv-and-gumshoe-scenario-structure/ and https://pelgranepress.com/2021/05/17/core-vs-alternate-scenes/ (both returned HTTP 403 on fetch; claims come from the search summary only); https://en.wikipedia.org/wiki/Gumshoe_System (listed by the search, not fetched)
- NPC lies and detection: https://pooltime.bearblog.dev/player-trust-definitive-guide/ (fetched); the Burning Wheel forum, EN World, Pathfinder rules and itch.io leads named in the search result were not fetched.
- Reaction and reputation: https://www.worldanvil.com/sheet/214262/view , https://grinningrat.substack.com/p/thoughts-six-thoughts-in-august/comments , https://glaucus.itch.io/your-reputation-precedes-you , https://www.enworld.org/threads/3-5-npc-initial-attitude-chart.284690/ (not fetched; used only through the search summary in [[Attitudes-as-Persistent-State]]).

### Project

- Repo files cited by file and line in [[The-Stacks-NPCs-and-Information-Today]] and [[DM-Side-Reading-of-NPC-Secrets]], at commit `b933a95`. Cards TASK-0119, TASK-0107, TASK-0106, TASK-0115; DM-Craft-Map notes `The-Stacks-Doctrine-Today` and `Analysis-Refactor-Risk-and-Deep-Dive-Order`.

## Gaps

### Books and SRD
- DMG 2014 Ch 6 (Foreshadowing, downtime "sowing rumors"), Ch 5 Urban Encounters, CoS and LMoP NPC text were not re-read.
- The 2014 Player's Handbook Chapter 8 social text was not in the extracted set; the DMG cites it as the base.
- No 2024 DMG. SRD 5.2.1 sections outside the pages listed were not read; spells that affect NPC speech or memory beyond Detect Thoughts, Zone of Truth, Charm Person, Suggestion and Command were not read.
- No SRD or book rule on NPC lying or on limits to NPC knowledge was found.

### Web
- The summarizer, not the raw text, was read. Nuances, examples and comments beyond the summaries are unread.
- The Three Clue Rule page has an unread tail of 9,651 characters (comments, probably).
- The original Node-Based Scenario Design article was not retrieved; node-design claims come from the two-prongs article and a search summary.
- Both Pelgrane Press GUMSHOE pages returned HTTP 403; the GUMSHOE rulebook text was not read.
- No fetched source gives a worked procedure for tracking an NPC's attitude across sessions beyond the Alexandrian's reaction tip and the Angry GM's Disposition model.
- No source gathered here addresses an AI or split narrator-and-planner arrangement.
- Angry GM and Alexandrian pages already read for the Resolution and Outcome branch were re-read only where they bear on NPCs; Matt Colville excluded.

### Project
- No run capture was searched for the trigger evidence TASK-0107 names (Director ignoring a hidden motive).
- The inventory entries P14, P16, P22 and G6 were re-verified in code; other ids are taken from the DM-Craft-Map inventory.
