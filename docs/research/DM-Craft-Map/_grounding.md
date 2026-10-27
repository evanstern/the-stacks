---
title: DM Craft Map — Grounding
aliases: []
tags: [grounding]
type: source
created: 2026-10-26
updated: 2026-10-26
related: [[DM-Craft-Map]]
---

# DM Craft Map — Grounding

> Source-of-truth artifact for the branch. It records method, sources and gaps for the gathered inventories. Notes cite into this file. No conclusions here.

**Research question:** What does the DM craft cover across the operator's books, a set of web sources, the SRD 5.2.1 records in the repo, and the-stacks project doctrine, so that later deep-dive branches can be scoped?
**Method:** three gather passes plus one SRD pass, all dated 2026-10-26, assembled into notes on 2026-10-26.

---

## Method

1. Pass A1 — book section inventory. Each book export (zip of chapter files) was read by heading path; each section got a paraphrased one-line description and craft tags. Paraphrase only: no quotation, no tables, no stat blocks.
2. Pass A2 — web inventory. Index pages of four DM-advice sources were read; some articles were skimmed. Each entry records a read level: `skim` (an article was read and paraphrased) or `title-only` (title, URL and tags only).
3. Pass A3 — project inventory. Components (C1-C21), stated doctrine, known gaps (G1-G24) and the commit pin of the-stacks AI DM were read from the repo. See [[The-Stacks-Doctrine-Today|The Stacks Doctrine Today]].
4. SRD pass — `packages/srd/` was inventoried for DM-facing adjudication material. See [[SRD-5.2.1-Rules-Pass|SRD 5.2.1 Rules Pass]].
5. Assembly — entries were grouped into craft-area notes by tag, counts were computed by script, and the notes were generated from the gathered files.

### Source-handling rules applied

- Books (DMG 2014, XGtE, TCoE, VRGtR, CoS, LMoP) are not open-licensed. Notes paraphrase and cite by heading path. They hold no quotation, table or stat block.
- Web entries with `read: title-only` keep only title, URL, date and tags. Any content guess made by a gatherer was dropped.
- Two source classes were excluded: the pdfcoffee.com domain and the enworld.org forum thread. See the exclusions section.
- SRD 5.2.1 (CC-BY-4.0) is cited by heading path and page; short attributed quotations are permitted and used.

### Tag vocabulary

The gather passes shared one tag vocabulary. Each tag and its meaning:

- `ability-checks` — ability checks, skill and tool use
- `adjudication` — how the DM resolves what happens when a character attempts something
- `adventure-design` — adventure structure, hooks, types, complications
- `combat-narration` — describing combat
- `combat-running` — procedures for running a fight
- `conditions-effects` — status conditions and imposed effects
- `contests` — opposed rolls
- `dc-setting` — choosing difficulty numbers
- `description-narration` — scene description and narrated delivery
- `encounter-design` — building and balancing encounters
- `exploration` — dungeon, wilderness and settlement movement
- `fail-forward` — failure that changes the situation instead of stalling it; consequences of failure and loss
- `hazards-traps` — environmental hazards and traps
- `horror` — horror play, dread and fear
- `house-rules` — optional, variant and house rules
- `improvisation` — improvising at the table
- `multiple-players` — several players or groups at one table
- `npcs` — non-player characters, villains, followers
- `pacing` — tempo of scenes, sessions and adventures
- `player-agency` — player choice and its limits
- `players-and-expectations` — player types, motivations, expectations, table behavior
- `prep` — session and adventure preparation
- `puzzles` — puzzles and riddles
- `rewards` — treasure, experience, boons, downtime rewards
- `rulings-vs-rules` — DM rulings, rule text, rules discussions and mistakes
- `safety-tools` — content-safety tools and boundaries
- `saves` — saving throws
- `secrets-information` — hidden information, clues, mysteries
- `session-zero` — pre-campaign agreements and character review
- `social-interaction` — social encounters and their resolution
- `spotlight` — distribution of attention among players
- `success-failure-narration` — describing the result of a success or failure
- `table-talk` — conversation, interruptions and rules talk at the table
- `time-tracking` — travel time, rests, calendars and clocks
- `tone` — mood and atmosphere
- `when-to-roll` — deciding whether an action needs a roll at all
- `world-building` — setting, cosmology, factions

## Sources

### Books (operator's library)

- **Dungeon Master's Guide (2014)** (DMG 2014) — edition: 5th Edition (2014). Zip path: /Volumes/coda/dnd-sourcebooks/dmg-zip.zip. Entries: 234. Scope: Out of scope per brief: magic-item lists, Appendix B (monster lists), Appendix C (maps), Credits. The DMG introduction (player types) is not present in this export. Chapters 1-2 are heading-level only.
- **Xanathar's Guide to Everything** (XGtE) — edition: 5th Edition (2017). Zip path: /Volumes/coda/dnd-sourcebooks/xanathars-guide-to-everything.zip. Entries: 44. Scope: The export splits the DM chapter into four zips; all are covered. Character-option, spell, and magic-item-table zips are out of scope.
- **Tasha's Cauldron of Everything** (TCoE) — edition: 5th Edition (2020). Zip path: /Volumes/coda/dnd-sourcebooks/tcoe.zip. Entries: 38. Scope: Group Patrons and Magical Miscellany are player/DM options but not DM-craft procedure; not inventoried.
- **Van Richten's Guide to Ravenloft** (VRGtR) — edition: 5th Edition (2021). Zip path: /Volumes/coda/dnd-sourcebooks/van-richtens-guide-to-ravenloft.zip. Entries: 84. Scope: Per-domain gazetteer chapters, character options, and monster chapters are out of scope. Domain-specific setting lore (chapters 8 onward) skipped; Travelers in the Mists and Domains of Ravenloft were only skimmed and found to be setting content.
- **Curse of Strahd** (CoS) — edition: 5th Edition (2016). Zip path: /Volumes/coda/dnd-sourcebooks/curse-of-strahd.zip. Entries: 13. Scope: Only the foreword and Introduction (running guidance, Marks of Horror) inventoried. Location chapters and appendices skipped. No explicit DC-presentation convention appears in the Introduction.
- **Lost Mine of Phandelver** (LMoP) — edition: 5th Edition (2014). Zip path: /Volumes/coda/dnd-sourcebooks/lost-mines-of-phandelver-zip.zip. Entries: 10. Scope: Only the Introduction inventoried; parts 1-4 and appendices skipped as location content.

Citation form: `<abbreviation> › <heading path>`, for example `DMG 2014 › Ch 8 Running the Game › Using Ability Scores`.

### SRD 5.2.1 (repo)

- `packages/srd/data/condition.json` (15 records), `packages/srd/provenance/source.json`, `packages/srd/provenance/srd-5.2.1-index.json`, `packages/srd/ATTRIBUTION.md`.
- Upstream: Open5e srd-2024 dataset, open5e-api commit e69ac13b49dae6a9d84abf38fc674fe1db5b392b (CC-BY-4.0). PDF: https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf (sha256 8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87), not read here.
- License: CC-BY-4.0, https://creativecommons.org/licenses/by/4.0/legalcode. Attribution text is in [[SRD-5.2.1-Rules-Pass|SRD 5.2.1 Rules Pass]].

### Project (repo)

- the-stacks repository at the commit pin in [[The-Stacks-Doctrine-Today|The Stacks Doctrine Today]]; branch `claude/agitated-goldberg-bff213`.

### Web sources and URLs used

#### The Alexandrian

- Fetch date: 2026-10-26. Index page https://thealexandrian.net/gamemastery-101 (titles and links only), plus one article skimmed. License: none noted on pages read.
- Entries: 47 (1 skim, 46 title-only).
- Entry URLs:
  - [The Art of Rulings](https://thealexandrian.net/wordpress/4238/roleplaying-games/the-art-of-rulings) — undated; read: skim
  - [The Art of Pacing](https://thealexandrian.net/wordpress/31509/roleplaying-games/the-art-of-pacing) — undated; read: title-only
  - [The Art of the Key](https://thealexandrian.net/wordpress/35180/roleplaying-games/the-art-of-the-key) — undated; read: title-only
  - [The Railroading Manifesto](https://thealexandrian.net/wordpress/36900/roleplaying-games/the-railroading-manifesto) — undated; read: title-only
  - [GM Don't List #1: Morphing Reality](https://thealexandrian.net/wordpress/37571/roleplaying-games/gm-dont-list-1-morphing-reality) — undated; read: title-only
  - [Three Clue Rule](https://thealexandrian.net/wordpress/1118/roleplaying-games/three-clue-rule) — undated; read: title-only
  - [Don't Prep Plots](https://thealexandrian.net/wordpress/4147/roleplaying-games/dont-prep-plots) — undated; read: title-only
  - [Don't Prep Plots: Prepping Scenario Timelines](https://thealexandrian.net/wordpress/4154/roleplaying-games/dont-prep-plots-prepping-scenario-timelines) — undated; read: title-only
  - [Don't Prep Plots: Tools, Not Contingencies](https://thealexandrian.net/wordpress/37422/roleplaying-games/dont-prep-plots-tools-not-contingencies) — undated; read: title-only
  - [Don't Prep Plots: The Principles of RPG Villainy](https://thealexandrian.net/wordpress/36383/roleplaying-games/dont-prep-plots-you-will-rue-this-day-heroes-the-principles-of-rpg-villainy) — undated; read: title-only
  - [Smart Prep](https://thealexandrian.net/?p=39885) — undated; read: title-only
  - [Managing Prep Load](https://thealexandrian.net/wordpress/52735/roleplaying-games/random-gm-tip-managing-prep-load) — undated; read: title-only
  - [Prep Tips for the Beginning DM](https://thealexandrian.net/wordpress/25696/roleplaying-games/thought-of-the-day-prep-tips-for-the-beginning-dm) — undated; read: title-only
  - [How to Prep a Module](https://thealexandrian.net/wordpress/46523/roleplaying-games/how-to-prep-a-module) — undated; read: title-only
  - [Failure for the Beginning GM](https://thealexandrian.net/wordpress/46186/roleplaying-games/failure-for-the-beginning-gm) — undated; read: title-only
  - [Pacing for the Beginning GM](https://thealexandrian.net/?p=49547) — undated; read: title-only
  - [Roleplaying for the Beginning GM](https://thealexandrian.net/wordpress/52707/roleplaying-games/roleplaying-for-the-beginning-gm) — undated; read: title-only
  - [Universal NPC Roleplaying Template](https://thealexandrian.net/wordpress/37916/roleplaying-games/universal-npc-roleplaying-template) — undated; read: title-only
  - [Advanced NPC Roleplaying Templates](https://thealexandrian.net/wordpress/46250/roleplaying-games/advanced-npc-templates) — undated; read: title-only
  - [Quick NPC Template](https://thealexandrian.net/?p=50635) — undated; read: title-only
  - [Node-Based Scenario Design (Part 1)](https://thealexandrian.net/wordpress/7949/roleplaying-games/node-based-scenario-design-part-1-the-plotted-approach) — undated; read: title-only
  - [Advanced Node-Based Design (Part 1)](https://thealexandrian.net/wordpress/8171/roleplaying-games/advanced-node-based-design-part-1-moving-between-nodes) — undated; read: title-only
  - [The Secret Life of Nodes](https://thealexandrian.net/?p=45263) — undated; read: title-only
  - [Xandering the Dungeon](https://thealexandrian.net/wordpress/13085/roleplaying-games/xandering-the-dungeon) — undated; read: title-only
  - [Game Structures](https://thealexandrian.net/wordpress/15126/roleplaying-games/game-structures) — undated; read: title-only
  - [Hexcrawls](https://thealexandrian.net/wordpress/17308/roleplaying-games/hexcrawl) — undated; read: title-only
  - [5E Hexcrawls](https://thealexandrian.net/wordpress/46020/roleplaying-games/5e-hexcrawl) — undated; read: title-only
  - [Running the Hexcrawl](https://thealexandrian.net/wordpress/48073/roleplaying-games/hexcrawl-addendum-running-the-hexcrawl) — undated; read: title-only
  - [Game Structure: Thinking About Wilderness Travel](https://thealexandrian.net/?p=43899) — undated; read: title-only
  - [Running the City](https://thealexandrian.net/wordpress/48182/roleplaying-games/running-the-city) — undated; read: title-only
  - [Random GM Tips: Running Combat](https://thealexandrian.net/wordpress/591/roleplaying-games/random-gm-tips-running-combat) — undated; read: title-only
  - [Framing Combat Encounters](https://thealexandrian.net/?p=49718) — undated; read: title-only
  - [Combat Timers](https://thealexandrian.net/?p=53328) — undated; read: title-only
  - [Revisiting Encounter Design](https://thealexandrian.net/wordpress/2050/roleplaying-games/revisiting-encounter-design) — undated; read: title-only
  - [Breathing Life Into the Wandering Monster](https://thealexandrian.net/wordpress/7897/roleplaying-games/breathing-life-into-the-wandering-monster) — undated; read: title-only
  - [Standoffs & Surprise](https://thealexandrian.net/?p=50409) — undated; read: title-only
  - [Getting the Players to Care](https://thealexandrian.net/wordpress/4124/roleplaying-games/random-gm-tips-getting-the-players-to-care-collected) — undated; read: title-only
  - [Making Clues](https://thealexandrian.net/wordpress/46338/roleplaying-games/random-gm-tips-making-clues) — undated; read: title-only
  - [The Null Result](https://thealexandrian.net/?p=49225) — undated; read: title-only
  - [Returning to the Scene of the Crime](https://thealexandrian.net/wordpress/49595/roleplaying-games/running-mysteries-returning-to-the-scene-of-the-crime) — undated; read: title-only
  - [Rolling for Riddles](https://thealexandrian.net/wordpress/48452/roleplaying-games/random-gm-tip-rolling-for-riddles) — undated; read: title-only
  - [Running Horror](https://thealexandrian.net/wordpress/45246/roleplaying-games/random-gm-tip-running-horror) — undated; read: title-only
  - [Session 0 Modules](https://thealexandrian.net/wordpress/52118/roleplaying-games/session-0-modules) — undated; read: title-only
  - [Music in Roleplaying Games](https://thealexandrian.net/?p=51711) — undated; read: title-only
  - [Opening Your Game Table](https://thealexandrian.net/wordpress/1223/roleplaying-games/opening-your-game-table) — undated; read: title-only
  - [Open Table Manifesto](https://thealexandrian.net/wordpress/38643/roleplaying-games/open-table-manifesto) — undated; read: title-only
  - [Game Structure: Sector Crawl / Pointcrawls / Depthcrawls (grouped)](https://thealexandrian.net/wordpress/48666/roleplaying-games/pointcrawls) — undated; read: title-only

#### The Angry GM

- Fetch date: 2026-10-26. Index pages https://theangrygm.com/ , https://theangrygm.com/how-to-run-a-game/ , https://theangrygm.com/true-game-mastery/ , https://theangrygm.com/tag/gming-basically/ , https://theangrygm.com/how-to-fing-gm/ ; two articles skimmed. License: none noted.
- Entries: 33 (2 skim, 31 title-only).
- Entry URLs:
  - [Adjudicate Actions Like a Motherf$&%ing Boss!](https://theangrygm.com/adjudicate-actions-like-a-boss/) — undated; read: skim
  - [The Tao Of Dice](https://theangrygm.com/tao-of-dice/) — 2023-03-07; read: skim
  - [The Declare-Determine-Describe Cycle](https://theangrygm.com/declare-determine-describe/) — 2023-02-27; read: title-only
  - [Dealing with Problematic Actions](https://theangrygm.com/problematic-actions/) — 2023-03-21; read: title-only
  - [Professor Angry's Office Hours: Dealing with Problematic Actions](https://theangrygm.com/angry-office-hours-1/) — 2023-03-28; read: title-only
  - [5 Simple Rules for Dating My Teenaged Skill System](https://theangrygm.com/five-simple-rules-for-dating-my-teenaged-skill-system/) — undated; read: title-only
  - [The Third Lesson: Costly Opportunities and Harsh Realities](https://theangrygm.com/the-third-lesson-costly-opportunities-and-harsh-realities/) — undated; read: title-only
  - [Help! My Players are Talking to Things!](https://theangrygm.com/help-my-players-are-talking-to-things/) — undated; read: title-only
  - [Resolving Social Interactions: Social Conflict Not Really Defined](https://theangrygm.com/social-conflict-not-really-defined/) — 2023-08-31; read: title-only
  - [Declaring Your Players' Social Actions](https://theangrygm.com/declaring-social-actions/) — 2023-09-27; read: title-only
  - [Resolving Social Actions](https://theangrygm.com/resolving-social-actions/) — 2023-10-27; read: title-only
  - [What It Means to Master a Game](https://theangrygm.com/master-a-game/) — 2023-01-17; read: title-only
  - [Game Mastering Makes No Sense](https://theangrygm.com/game-mastering-makes-no-sense/) — 2023-01-24; read: title-only
  - [Better Narration Through Visualization: A Lifestyle Guide](https://theangrygm.com/narration-through-visualization/) — 2023-01-31; read: title-only
  - [Inviting the Principle Character to Act](https://theangrygm.com/inviting-pcs-to-act/) — 2023-02-07; read: title-only
  - [How to Talk to Players: The Art of Narration](https://theangrygm.com/how-to-talk-to-players-the-art-of-narration/) — undated; read: title-only
  - [Mastering the Thousand Cuts](https://theangrygm.com/mastering-the-thousand-cuts/) — 2023-09-30; read: title-only
  - [The Power of Editing](https://theangrygm.com/the-power-of-editing/) — undated; read: title-only
  - [How to Run Encounters... NOT!](https://theangrygm.com/how-to-run-encounters-not/) — 2023-04-14; read: title-only
  - [Everyone Doing Everything All At Once](https://theangrygm.com/everything-all-at-once/) — 2023-04-28; read: title-only
  - [It's a Trap!](https://theangrygm.com/its-a-trap/) — 2023-06-19; read: title-only
  - [Tactical Infiltration Action](https://theangrygm.com/tactical-infiltration-action/) — 2023-12-18; read: title-only
  - [Roll Initiative!](https://theangrygm.com/roll-initiative/) — 2023-05-12; read: title-only
  - [How to Manage Combat Like a True Game Master](https://theangrygm.com/manage-combat-like-a-master/) — 2023-05-31; read: title-only
  - [Angry Story Time: The Big Battle Example](https://theangrygm.com/big-battle-example/) — 2023-07-10; read: title-only
  - [Professor Angry's Office Hours: How Players Play](https://theangrygm.com/angry-office-hours-2/) — 2023-07-24; read: title-only
  - [Professor Angry's Office Hours: How Game Masters Don't Play](https://theangrygm.com/angry-office-hours-3/) — 2023-07-31; read: title-only
  - [How to Wilderness Right](https://theangrygm.com/how-to-wilderness-right/) — undated; read: title-only
  - [Exploring by the Rules](https://theangrygm.com/exploring-by-the-rules/) — undated; read: title-only
  - [Maps: What's On Your Table?](https://theangrygm.com/maps-whats-on-your-table/) — undated; read: title-only
  - [Jumping the Screen: How to Run Your First RPG Session](https://theangrygm.com/jumping-the-screen-how-to-run-your-first-rpg-session/) — undated; read: title-only
  - [Ask Angry: Doorbreaking and Lockpicking](https://theangrygm.com/ask-angry-doorbreaking-and-lockpicking/) — undated; read: title-only
  - [True Campaign Managery](https://theangrygm.com/true-campaign-managery/) — undated; read: title-only

#### Sly Flourish

- Fetch date: 2026-10-26. Index pages https://slyflourish.com/ and https://slyflourish.com/archive.html (listing; fetch truncated). https://slyflourish.com/articles.html returned 404. The home page states the Lazy DM series material is released under a Creative Commons Attribution license; free older books are listed as Creative Commons. The Lazy GM's Resource Document license was not confirmed (see gaps).
- Entries: 43 (2 skim, 41 title-only).
- Entry URLs:
  - [Top Tips for Gamemasters](https://slyflourish.com/top_advice.html) — 2021-10-25; read: skim
  - [Roll to Target](https://slyflourish.com/roll_to_target.html) — 2026-06-01; read: skim
  - [The Lazy GM's Resource Document](https://slyflourish.com/lazy_gm_resource_document.html) — undated; read: title-only
  - [The Eight Steps for Lazy Gamemasters](https://slyflourish.com/eight_steps_2023.html) — 2023; read: title-only
  - [Return of the Lazy Dungeon Master](https://slyflourish.com/returnofthelazydm/) — undated; read: title-only
  - [Running Session Zeros](https://slyflourish.com/running_session_zeros.html) — undated; read: title-only
  - [Two Minute Session Zeros for Single Session Adventures](https://slyflourish.com/two_minute_session_zero.html) — 2026-10-05; read: title-only
  - [Safety Tools](https://slyflourish.com/safety_tools.html) — undated; read: title-only
  - [Pause for a Minute](https://slyflourish.com/pause_for_a_minute.html) — undated; read: title-only
  - [Review the Characters](https://slyflourish.com/step_zero_reviewing_pcs.html) — undated; read: title-only
  - [Start Strong](https://slyflourish.com/starting_strong.html) — undated; read: title-only
  - [Scenes - The Catch-all Step](https://slyflourish.com/scenes_catch_all_step.html) — undated; read: title-only
  - [Secrets and Clues](https://slyflourish.com/sharing_secrets.html) — undated; read: title-only
  - [Using The Eight Steps At the Table](https://slyflourish.com/using_the_8_steps_at_the_table.html) — undated; read: title-only
  - [Lazy World Building](https://slyflourish.com/lazy_world_building.html) — undated; read: title-only
  - [Scenes and Situations](https://slyflourish.com/scenes_and_situations.html) — 2026-10-19; read: title-only
  - [Three Choices](https://slyflourish.com/three_choices.html) — 2026-10-12; read: title-only
  - [Procedures](https://slyflourish.com/procedures.html) — 2026-09-07; read: title-only
  - [Manage Rests](https://slyflourish.com/handling_rests.html) — 2026-10-26; read: title-only
  - [Elective Action Order](https://slyflourish.com/elective_action_order.html) — 2026-09-21; read: title-only
  - [Just Use Bears](https://slyflourish.com/just_use_bears.html) — 2026-09-28; read: title-only
  - [Move Steps Forward](https://slyflourish.com/move_steps_forward.html) — 2026-08-24; read: title-only
  - [What Excites You?](https://slyflourish.com/what_excites_you.html) — 2026-09-14; read: title-only
  - [Create Villains](https://slyflourish.com/creating_villains.html) — undated; read: title-only
  - [Build a Unique Faction List](https://slyflourish.com/build_a_faction_list.html) — undated; read: title-only
  - [Upward and Downward Beats](https://slyflourish.com/upward_and_downward_beats.html) — undated; read: title-only
  - [Spiral Campaign Building](https://slyflourish.com/spiral_campaign_building.html) — undated; read: title-only
  - [Prep Three Quests](https://slyflourish.com/prep_three_quests.html) — undated; read: title-only
  - [Because of X, You Know Y](https://slyflourish.com/because_of_x_you_know_y.html) — undated; read: title-only
  - [Build Single-Encounter Situations](https://slyflourish.com/building_situations.html) — undated; read: title-only
  - [Dungeon Crawls](https://slyflourish.com/running_dungeon_crawls.html) — undated; read: title-only
  - [Investigations and Mysteries](https://slyflourish.com/running_investigations_and_mysteries.html) — undated; read: title-only
  - [Overland Exploration and Travel](https://slyflourish.com/running_travel.html) — undated; read: title-only
  - [Roleplay and Intrigue](https://slyflourish.com/running_intrigue_adventures.html) — undated; read: title-only
  - [The Lazy Encounter Benchmark](https://slyflourish.com/the_lazy_encounter_benchmark.html) — undated; read: title-only
  - [Running "Theater of the Mind" Combat](https://slyflourish.com/guide_to_narrative_combat.html) — undated; read: title-only
  - [Abstract Battlemaps](https://slyflourish.com/the_abstract_battlemap.html) — undated; read: title-only
  - [Dials of Monster Difficulty](https://slyflourish.com/dials_of_monster_difficulty.html) — undated; read: title-only
  - [Lightning Rods](https://slyflourish.com/lightning_rods.html) — undated; read: title-only
  - [Improve Boss Fights](https://slyflourish.com/improving_boss_fights.html) — undated; read: title-only
  - [Run Easy Battles](https://slyflourish.com/run_easy_battles.html) — undated; read: title-only
  - [Defending Out of the Fun](https://slyflourish.com/defending_out_of_the_fun.html) — undated; read: title-only
  - [Greed, Heroism, and Wonder](https://slyflourish.com/greed_heroism_wonder.html) — undated; read: title-only

#### Matt Colville, Running the Game (video series; index pages only)

- Fetch date: 2026-10-26. Index pages https://podcast.app/running-the-game-matt-colville-p1841011 (podcast feed) and https://castbox.fm/channel/Matthew-Colville:-Running-the-Game-id1383373 (partial). The official YouTube playlist page could not be read. https://mcdm.fandom.com/wiki/Running_the_Game was blocked (HTTP 402). Videos are the author's copyright. No per-episode YouTube URLs were obtained.
- Entries: 11 (0 skim, 11 title-only).
- Entry URLs:
  - [Let's Start In A Tavern!](https://castbox.fm/channel/Matthew-Colville:-Running-the-Game-id1383373) — 2017-09-14; read: title-only
  - [Dice Math](https://castbox.fm/channel/Matthew-Colville:-Running-the-Game-id1383373) — 2017-10-02; read: title-only
  - [On Rails](https://castbox.fm/channel/Matthew-Colville:-Running-the-Game-id1383373) — 2018-05-28; read: title-only
  - [Surrender](https://castbox.fm/channel/Matthew-Colville:-Running-the-Game-id1383373) — 2019-04-23; read: title-only
  - [Vecna & Running Epic Bad Guys](https://podcast.app/running-the-game-matt-colville-p1841011) — 2021-02-22; read: title-only
  - [Hobgoblins and Low Level Play](https://podcast.app/running-the-game-matt-colville-p1841011) — 2021-02-25; read: title-only
  - [Range and Altitude in Three Dimensions](https://podcast.app/running-the-game-matt-colville-p1841011) — 2021-02-27; read: title-only
  - [Metagaming](https://podcast.app/running-the-game-matt-colville-p1841011) — 2021-02-28; read: title-only
  - [Stealth Checks](https://podcast.app/running-the-game-matt-colville-p1841011) — 2021-02-28; read: title-only
  - [Problem Players](https://podcast.app/running-the-game-matt-colville-p1841011) — 2021-03-01; read: title-only
  - [Making Travel Interesting](https://podcast.app/running-the-game-matt-colville-p1841011) — 2021-03-02; read: title-only

## Exclusions

- Any URL on the pdfcoffee.com domain is excluded as a source. The gatherer used one pdfcoffee.com page as the Colville summary source; those summaries are dropped.
- The enworld.org forum thread cited by the Angry GM pass is excluded. One recorded comparison (Angry GM versus a 5e community view on who triggers a check) rested on it and is dropped.
- Two further Colville comparisons rested on the excluded summaries (failure handling; railroad and story versus the Alexandrian) and are dropped.

### Colville — titles without a readable source

These 34 video titles have no legitimate URL after the exclusion. They carry no content claim. Tags are the gatherer's title-based assignment.

- Starting _[prep, players-and-expectations]_
- Starting the First Session _[pacing, players-and-expectations]_
- Running Your First Dungeon _[exploration, encounter-design, description-narration]_
- Dead Ends _[secrets-information, adventure-design]_
- Sociology of the Game _[players-and-expectations, safety-tools]_
- The DM Screen _[prep, rulings-vs-rules]_
- Types of Players _[players-and-expectations, multiple-players]_
- Sandbox vs. Railroad _[player-agency, adventure-design]_
- Catastrophic Failure _[fail-forward, success-failure-narration]_
- Bad Guys _[npcs, adventure-design]_
- Random Encounters _[encounter-design, exploration]_
- Story vs. Adventure _[player-agency, adventure-design]_
- Information _[secrets-information, description-narration]_
- Skill Challenges _[ability-checks, adjudication, social-interaction]_
- NPC _[npcs, social-interaction]_
- Politics 101 / Politics, Central Tension, War, Peace _[world-building, npcs]_
- NPCs, Followers, DMPCs _[npcs, multiple-players]_
- Sandbox _[world-building, player-agency]_
- 4e to Make 5e Combat More Fun _[combat-running, house-rules]_
- Fantasy vs. Fiction _[world-building, player-agency]_
- Engaging vs. Explaining _[description-narration, secrets-information]_
- The West Marches _[player-agency, multiple-players, exploration]_
- Time _[pacing, table-talk]_
- Slog _[pacing, players-and-expectations]_
- Losing _[fail-forward, success-failure-narration]_
- Time and Calendars _[time-tracking, world-building]_
- Funhouse Dungeons _[hazards-traps, puzzles, adventure-design]_
- Prepping an Adventure _[prep]_
- Alternative Initiative Rules _[combat-running, house-rules]_
- Cinematics _[description-narration, player-agency]_
- Diplomacy _[social-interaction, npcs]_
- Monkeying with Monsters _[encounter-design]_
- Challenge Rating _[encounter-design, improvisation]_
- Mistakes _[rulings-vs-rules, players-and-expectations]_

Two further Colville titles (Let's Start In A Tavern!, Dice Math) keep a podcast index URL but lost their summaries and are listed title-only in the notes.

## Gaps on record

- DMG Introduction (player types) is absent from the export, so the book's own player-type material is not inventoried. DMG chapters 1 and 2 are heading-level only.
- Web depth is title-level. Of 168 web entries, 5 were skimmed; the rest carry title, URL and tags only.
- Colville videos were not watched. Readable index pages gave titles only; 34 titles have no readable source after exclusion.
- The Lazy GM's Resource Document license is unconfirmed. Only the site-wide Creative Commons Attribution statement for the Lazy DM series was read; the document's package and repository (https://github.com/mshea/lazy_gm_tools) license were not read.
- Edition mismatch: DMG is the 2014 edition and the other books are 2014-ruleset 5e; the project's rules baseline is SRD 5.2.1 (2024 rules). Observed divergences are listed in the Adjudication and Dice note.
- SRD 5.2.1 Playing the Game text (d20 tests, DC table, advantage and disadvantage, contests, Influence, Search, Study, exploration and social rules) is not in `packages/srd/`; only 15 condition records were inventoried. The PDF was not read.
- A gatherer comparison that relied on the excluded enworld.org thread, and two that relied on the excluded pdfcoffee.com summaries, were dropped; related disagreement coverage is thinner as a result.
- Alexandrian and Angry GM disagreement entries rest on one skim each; the gatherers marked them as emphasis differences.
- Book citations are heading paths from the export; no page numbers were captured for the books. The SRD records carry page numbers.
- Project component C21 (playtest harness and auditor, TASK-0048) is not in this worktree's source tree; it is inventoried from the card and evidence reports.

## Grounding use

Craft-area notes, the SRD pass, the doctrine note and the coverage matrix cite into this file. See [[DM-Craft-Map]] for the list.
