---
title: Resolution and Outcome — Grounding
aliases: []
tags: [grounding]
type: source
created: 2026-10-26
updated: 2026-10-26
related: [[Resolution-and-Outcome]]
---

# Resolution and Outcome — Grounding

> Source-of-truth artifact for the branch. It records method, sources and gaps for the gathered passes. Notes cite into this file. No conclusions here.

**Research question:** How does a DM decide what the dice decide versus what the player decides, and how is each narrated? Widened by operator approval on 2026-10-26 to cover outcome richness beyond pass and fail, DC and modifier derivation, contests, group checks and retries, and out-of-character questions to the DM.
**Method:** three gather passes (B1, B2, A3), all dated 2026-10-26, assembled into notes on 2026-10-26.

---

## Method

1. Pass B1 — books and SRD. The SRD 5.2.1 PDF was downloaded on 2026-10-26 and text-extracted with pdftotext. The operator's local extracts of DMG 2014, XGtE, TCoE and VRGtR were read by heading path. Output is organized by sub-question Q1-Q9, with a list of edition divergences between DMG 2014 and SRD 5.2.1.
2. Pass B2 — web. Twenty-nine articles from The Angry GM, The Alexandrian and Sly Flourish were fetched and read in full, organized by Q1-Q9, with a section of disagreements and gaps.
3. Pass A3 — project. The-stacks AI DM components, stated doctrine, gaps and commit pin were read from the repo. This branch carries only what bears on Q1-Q9. See [[The-Stacks-Resolution-Today]].
4. Assembly — one note per sub-question, grouped by source, plus a project note, a brief and a MOC.

### Source-handling rules applied

- Books (DMG 2014, XGtE, TCoE, VRGtR) are not open-licensed. Notes paraphrase and cite by heading path. They hold no quotation.
- Web articles are cited by URL, paraphrased, with no quotation.
- SRD 5.2.1 (CC-BY-4.0) is cited as SRD p.N with a section name. Short quotations carry the attribution SRD 5.2.1, CC-BY-4.0.
- Excluded: Matt Colville (operator ruling), pdfcoffee.com, forums.
- Every divergence between DMG 2014 and SRD 5.2.1 that B1 listed appears in the relevant note with the label Edition divergence.

### Citation forms

- SRD p.N: the SRD 5.2.1 PDF page; the printed page equals the PDF page. The PDF has 364 pages.
- Book abbreviations: DMG 2014 = Dungeon Master's Guide (2014); XGtE = Xanathar's Guide to Everything (2017); TCoE = Tasha's Cauldron of Everything (2020); VRGtR = Van Richten's Guide to Ravenloft (2021).

## Sources

### SRD 5.2.1

- SRD 5.2.1 PDF (CC-BY-4.0), downloaded 2026-10-26: https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf
- SHA-256 of the downloaded file: 8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87. The hash matches the one recorded in the DM-Craft-Map branch grounding.
- License text: https://creativecommons.org/licenses/by/4.0/legalcode
- Sections cited: Rhythm of Play (p.5); D20 Tests, Ability Checks, Difficulty Class (p.6); Saving Throws, Attack Rolls, Advantage/Disadvantage (p.7-8); Proficiency Bonus, Skill Proficiencies, Equipment Proficiencies (p.8-9); Actions, Roleplaying, One Thing at a Time (p.10); Social Interaction (p.11); Interacting with Objects, Finding Hidden Objects, Travel Pace, Vision and Light (p.11-12); Initiative, Travel, Surprise (p.13); Communicating, Unseen Attackers, Doing Nothing on Your Turn (p.14); Opportunity Attacks, Cover (p.15); Critical Hits, Half Damage, Mounted Combat (p.16); Knocking Out a Creature, Bloodied, Dropping to 0 Hit Points, Death Saving Throws, Stabilizing (p.17-18); Rules Glossary conditions (p.177-191); Gameplay Toolbox: Travel Terrain, Demonic Possession, Narrative Curses, Cackle Fever, Fear and Mental Stress (p.192-196); spells Charm Person (p.115), Command (p.116), Dominate Person (p.126), Suggestion (p.166).

### Books (heading paths)

- DMG 2014: Ch 8 Running the Game > Using Ability Scores (Ability Checks, Difficulty Class, Typical DCs, Variant: Automatic Success, Proficiency, Multiple Ability Checks, Contests, Attack Rolls, Saving Throws, Resolution and Consequences, Success at a Cost, Degrees of Failure, Critical Success or Failure); Ch 8 > The Role of Dice; Ch 8 > Advantage and Disadvantage; Ch 8 > Social Interaction (Resolving Interactions, Determining Characteristics, Changing Attitude, Aiding the Check, Repeat?, Roleplaying, Engaging the Players); Ch 8 > Table Rules (Dice Rolling, Table Talk, Metagame Thinking, Rules Discussions, Missing Players, Small Groups, Rolling Attacks and Damage); Ch 8 > Exploration (Tracking, Noticing Other Creatures, Travel Pace); Ch 8 > Combat (Tracking Monster Hit Points, Monsters and Critical Hits, Handling Mobs, Improvising Damage, Using and Tracking Conditions, Chases, Areas of Effect, Tracking Initiative, Reaction Timing, Combining Game Effects); Ch 8 > Madness; Ch 8 > Inspiration; Ch 9 DM's Workshop > Ability Options (Hero Points, Proficiency Dice); Ch 9 > Combat Options (Injuries, Massive Damage, Hitting Cover, Cleaving, Morale, Action Options); Ch 9 > Adventuring Options (Plot Points, Fear and Horror); Ch 9 > New Ability Scores (Honor and Sanity).
- XGtE: Ch 2 DM's Tools > Spellcasting (Identifying a Spell, Perceiving a Caster at Work, Invalid Spell Targets); Ch 2 > Sleep (Waking Someone, Going without a Long Rest); Ch 2 > Simultaneous Effects.
- TCoE: DM's Tools > Parleying with Monsters (including Monster Research); DM's Tools > Environmental Hazards (Emotional Echoes, Haunted, Psychic Resonance, Magical Phenomena); DM's Tools > Session Zero (Social Contract, Hard and Soft Limits, Game Customization / House Rules).
- VRGtR: Horror Adventures > Running Horror Games (Horror Pacing, Describing Horror, Horror Gameplay: Ask Permission and Content Tools, Engaging Players); Horror Adventures > Fear and Stress (Fear, Stress); Horror Adventures > Preparing for Horror (Session Zero, Horror Content Survey).

### Web articles read in full

The Angry GM

- https://theangrygm.com/adjudicate-actions-like-a-boss/
- https://theangrygm.com/tao-of-dice/
- https://theangrygm.com/five-simple-rules-for-dating-my-teenaged-skill-system/
- https://theangrygm.com/declare-determine-describe/
- https://theangrygm.com/how-to-talk-to-players-the-art-of-narration/
- https://theangrygm.com/resolving-social-actions/
- https://theangrygm.com/problematic-actions/
- https://theangrygm.com/help-my-players-are-talking-to-things/
- https://theangrygm.com/declaring-social-actions/
- https://theangrygm.com/inviting-pcs-to-act/

The Alexandrian

- https://thealexandrian.net/wordpress/4238/roleplaying-games/the-art-of-rulings
- https://thealexandrian.net/wordpress/38313/roleplaying-games/the-art-of-rulings-part-8-let-it-ride
- https://thealexandrian.net/wordpress/39142/roleplaying-games/art-of-rulings-12-hidden-vs-open-difficulty-numbers
- https://thealexandrian.net/wordpress/38798/roleplaying-games/gm-dont-list-2-rolling-to-failure
- https://thealexandrian.net/wordpress/46186/roleplaying-games/failure-for-the-beginning-gm
- https://thealexandrian.net/wordpress/48452/roleplaying-games/random-gm-tip-rolling-for-riddles
- https://thealexandrian.net/wordpress/49225/roleplaying-games/running-mysteries-the-null-result (about empty investigation results; the article does not discuss dice and yields no claim)
- https://thealexandrian.net/wordpress/49184/roleplaying-games/random-gm-tip-dogpiling-the-check
- https://thealexandrian.net/wordpress/40309/roleplaying-games/rulings-in-practice-perception-type-tests
- https://thealexandrian.net/wordpress/49547/roleplaying-games/pacing-for-the-beginning-gm
- https://thealexandrian.net/wordpress/43352/roleplaying-games/ptolus-running-the-campaign-firewalling-player-knowledge

Sly Flourish

- https://slyflourish.com/ability_check_toolbox.html
- https://slyflourish.com/group_skill_checks.html
- https://slyflourish.com/let_characters_auto_succeed.html
- https://slyflourish.com/one_quarter_succeed.html
- https://slyflourish.com/running_intrigue_adventures.html
- https://slyflourish.com/understanding_dnds_core_interaction.html
- https://slyflourish.com/roll_to_target.html (about rolling to choose a monster's target)
- https://slyflourish.com/empowering_player_storytelling.html

### Project

- The-stacks repo files cited by file and line in [[The-Stacks-Resolution-Today]], taken at the commit pin stated there. TASK-0113 and TASK-0115 cards (operator ruling and approval).

## Gaps

### Books and SRD (B1 not-read list)

- SRD spell chapter beyond Charm Person, Command, Suggestion and Dominate Person.
- SRD monster chapter.
- DMG Ch 6.
- XGtE chapters 5-8.
- TCoE chapter 1 and the sidekick and puzzle sections.
- VRGtR chapters other than 7 and 28 (Horror Adventures was read for pacing, description, consent, fear and stress).
- The 2014 Player's Handbook was not in the extracted set. Comparisons of Help, surprise and passive-score adjustment with the 2014 PHB were not made.
- No SRD group-check rule was found in the sections read. SRD chase rules were not located in the sections read.

### Web (B2)

- No fetched article gives a worked procedure for a roll that takes control of a PC's actions (charm, fear, dominate).
- No fetched article covers critical successes or failures on ability checks, or natural 1 and 20 as an outcome shape. The 5e crit rule is not covered by these articles.
- Matt Colville and non-approved sites were not used.
- Two articles appeared in search results and were not fetched: Sly Flourish, When and How to Cheat when Running RPGs; The Alexandrian, Art of Rulings 13: Hidden vs. Open Stakes.
- The Alexandrian article Running Mysteries: The Null Result does not discuss dice and yields no claim.

### Project (A3)

- The playtest harness source (TASK-0048) is not in this worktree's tree; only its evidence reports are cited.
- Topics with no stated rule found are listed in [[The-Stacks-Resolution-Today]].
