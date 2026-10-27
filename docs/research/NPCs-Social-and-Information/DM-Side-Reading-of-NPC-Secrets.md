---
title: DM-Side Reading of NPC Secrets
aliases: []
tags: [npcs, secrets, task-0107]
type: note
created: 2026-10-26
updated: 2026-10-26
related: [[NPCs-Social-and-Information]]
---

# DM-Side Reading of NPC Secrets

_Gathered facts for the question TASK-0107 asks: should DM-side nodes such as the Director read NPC secrets through a DM-only seed view, and how would the Director's `goalNote`, which reaches narrate, be kept from carrying them? This note records facts. It rules on nothing. Code cites are at commit `b933a95`._

## The question as the card states it

TASK-0107 (To Do, Low, revisit): trigger is a captured run or the M2 demo showing the Director ignore an NPC's hidden motive, or a seed needing a villain's secret to drive pacing. Context: TASK-0106 (spec 034) moved Snag's motive from `portrayal.want` into `hooks.secrets` so player-facing prompts cannot leak it; no prompt reads `hooks.secrets`, so the Director lost the motive too. Acceptance criteria: a decision records whether DM-side nodes read NPC secrets, with the triggering evidence; if yes, a DM-only seed view feeds them and a test proves the `goalNote` path cannot carry a secret to player-facing prompts.

## Facts in the project

- The seed schema splits an NPC into `identity`, `portrayal` (voice, want, detail, appearance) and `hooks` (`knows`, `secrets`, `relationships`) (`apps/server/src/dm/seed/schema.ts:35-47`, `:48-`).
- The 034 contract classes `npcs[].hooks.knows`, `hooks.secrets`, `hooks.relationships`, `identity.srdMonsterId` and `identity.combatant` as DM-only, and classes every beat, encounter and tracker field as DM-only (`specs/034-narration-quality/contracts/player-facing-context.md`, Seed field classes).
- The same contract lists DM-side generators as `dm.director`, `dm.interpret`, `dm.adjudicate`, `dm.audit`. Its "Who gets what" table gives the Director "Full `SceneSeed` (unchanged)" and says "Neither DM-side node gains secrets" in the paragraph on the Director's `goalNote`.
- `seedEntries`, which the Director and Interpret prompts both use, renders the goal (with success and failure), the location, the active encounter, and each present NPC's name, role, voice and want. It does not render `hooks.knows`, `hooks.secrets`, or `hooks.relationships` (`apps/server/src/dm/prompts/common.ts:64-90`).
- The Director prompt adds seed beat summaries and encounter triggers (`apps/server/src/dm/prompts/director.ts`, beats and encounters sections). Beat `summary` is a DM-only field. In the shipped seed, the `the-keeper` beat summary states that Wenna hides in the loft and will tell what she saw and the safe path if persuaded (`apps/server/seeds/greyhollow-ford.json`, beat `the-keeper`).
- The Adjudicate prompt takes the seed only for `projectionEntries` (party sheets) and renders no NPC hook (`apps/server/src/dm/prompts/adjudicate.ts`, `buildAdjudicatePrompt`).
- Narrate and Companion receive `PlayerSeedView` (`apps/server/src/dm/seed/views.ts:9-38`, `:40-`; `apps/server/src/dm/nodes/narrate.ts:78,113`; `apps/server/src/dm/companion.ts:136`), which has no `knows` or `secrets` for NPCs.
- `goalNote` is a Director output field of at most 300 characters, described as "a private note for the narrator" (`apps/server/src/dm/prompts/director.ts:28`; `apps/server/src/dm/nodes/schemas.ts:246`). It is copied into narration facts (`apps/server/src/dm/facts.ts:96,478`) and rendered into the narrate prompt as a "Private note" (`apps/server/src/dm/prompts/narrate.ts:173`), and into the Interpret prompt (`apps/server/src/dm/prompts/interpret.ts:107`). The Director's `goalNote` is therefore model text that reaches a player-facing generator.
- Test evidence for the player-facing boundary: `apps/server/test/dm/player-facing-prompts.test.ts:208-211` checks that DM-only seed strings (from `dmOnlySeedText`, `views.ts:77-`) do not appear in assembled player-facing prompts. That test builds prompts from seed text; a `goalNote` is runtime model output and is not in the seed. No test found proves a `goalNote` cannot carry a secret.
- The playtest auditor's `hidden-info` check treats location and NPC `hooks.secrets` as hidden strings and flags a public row that repeats one (`apps/server/src/playtest/auditor/checks.ts:285-289`; `docs/wiki/playtest-harness.md:101`). Its prompt lists `[dm-only]` secrets for the auditor model (`apps/server/src/playtest/auditor/prompt.ts:80-82`). That check matches seed strings; a paraphrase in a `goalNote` is not matched by an exact-text comparison.
- Doctrine pair P16 `villains-believe` ("Antagonists have reasons and believe them") runs on nodes director and narrate (`apps/server/src/dm/doctrine/doctrine.ts:153-160`). The inventory notes its hidden motives live in `hooks.secrets`, which no prompt reads (DM-Craft-Map `The-Stacks-Doctrine-Today`, P16, G6).
- Why the move happened: TASK-0106 run evidence found companion Odo stating the DM-only motive (the bell wards off the river-things); the 034 research listed Snag's `portrayal.want` as leak L2 and the fix as moving the motive to `hooks.secrets` (`specs/034-narration-quality/research.md:211,234`; card TASK-0106 line 28).
- Seed examples of NPC secrets with behavioural content: Snag's secrets include a condition to trade ("He will trade the clapper for safe passage if two goblins fall") and the reason he keeps the clapper; Wenna's secret is a past payment to the goblins (`apps/server/seeds/greyhollow-ford.json`, npcs `snag`, `wenna`).
- Decision-0021 and X10: secret trackers are DM-only events (X10 in the DM-Craft-Map doctrine inventory; decision-0021:24; decision-0018:31). Trackers already give DM-side nodes a hidden-state channel that is visible to the Director through the projection.

## Facts in the sources

- DMG 2014 › Ch 4 › NPC Party Members › Optional Rule: Loyalty: the DM keeps the loyalty score secret, so a DM-side record of hidden NPC data is a standard book practice.
- DMG 2014 › Ch 4 › Detailed NPCs › Flaw or Secret and › Villain's Secret Weakness: the DM authors secrets and weaknesses so the players can discover them. Both are authored for the DM's use.
- Running Roleplay and Intrigue (https://slyflourish.com/running_intrigue_adventures.html): the DM notes what each NPC knows, wants and might reveal, and speaks and reacts from it.
- Player Trust (https://pooltime.bearblog.dev/player-trust-definitive-guide/): motives should be defined in advance, and behavior that conflicts with a known motive tips players off to a lie; a DM who lies with no defined motive plays unfairly.
- Don't Prep Plots (https://thealexandrian.net/wordpress/36383/roleplaying-games/dont-prep-plots-you-will-rue-this-day-heroes-the-principles-of-rpg-villainy) and Create Villains (https://slyflourish.com/creating_villains.html): villain goals and plans are prepared by the DM and drive off-screen activity and reactions.
- Roleplaying for the Beginning GM (https://thealexandrian.net/wordpress/52707/roleplaying-games/roleplaying-for-the-beginning-gm): an NPC reluctant to share a clue is played fully, but the DM does not use it to block the PCs.
- No gathered source describes a system where a pipeline of separate narrator and planner roles share an NPC's hidden motive; the sources describe one DM holding the hidden data.

## Open facts (not found)

- No capture of the Director ignoring a hidden motive is recorded in this branch. The trigger evidence the card names was not searched for in run captures here.
- The 034 text says the Director "keeps the full seed", while the prompt builder renders only selected fields. The contract wording and the code differ on what "full" means in practice.

## Grounding

- [[The-Stacks-NPCs-and-Information-Today]] — the wider project inventory
- [[Attitudes-as-Persistent-State]], [[NPC-Records-and-Motives]], [[NPC-Knowledge-Limits-and-Lying]]
- [[_grounding]]
