---
title: SRD 5.2.1 Rules Pass
aliases: []
tags: [dm-craft, srd]
type: note
created: 2026-10-26
updated: 2026-10-26
related: [[DM-Craft-Map]]
---

# SRD 5.2.1 Rules Pass

_Inventory of the DM-facing adjudication material that the repo holds from System Reference Document 5.2.1 (CC-BY-4.0). Neutral and descriptive._

## Attribution

This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. (Text from `packages/srd/ATTRIBUTION.md`.)

## Scope finding

The request named the SRD Playing the Game material: d20 tests, ability checks, DCs and the difficulty table, advantage and disadvantage, contests, saving throws, the Influence, Search and Study actions, exploration and social rules. `packages/srd/` does not hold that text. It holds five validated record kinds: `class`, `condition`, `equipment`, `monster`, `spell` (index counts: 12 class, 15 condition, 206 equipment, 331 monster, 339 spell). The only DM-facing adjudication material present is the 15 condition records under the section Rules Glossary. The SRD 5.2.1 PDF itself (url and sha256 below) is not in the repo and was not read in this pass.

- Records: `packages/srd/data/condition.json`; index: `packages/srd/provenance/srd-5.2.1-index.json`.
- Provenance: records were converted from the Open5e srd-2024 dataset (open5e-api commit e69ac13b49dae6a9d84abf38fc674fe1db5b392b, CC-BY-4.0) and checked against the SRD 5.2.1 PDF `https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf` (sha256 8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87), per `packages/srd/provenance/source.json`.
- Condition records are `usedFor: dataset` per the provenance file.
- Separate item: `apps/server/bench/retrieval/corpus/using-ability-scores.md` and sibling files are a retrieval-benchmark corpus labelled SRD 5.1 (task commit 1a8e6fa). They are outside the `packages/srd/` scope given for this pass and were not inventoried. See open questions.

## Conditions inventory

Citation form: `SRD 5.2.1 › Rules Glossary › <condition> (p. <page>)`. Effect names are the record's effect entries. Tags were assigned by a mechanical rule over each record's effect text: conditions-effects for all; ability-checks if the text names ability checks; saves if it names saving throws; combat-running if it names attack rolls, Initiative or Critical Hits; social-interaction if it names social interaction.

- SRD 5.2.1 › Rules Glossary › Blinded (p. 177) — Condition record with effect entries: Can’t See; Attacks Affected. Effect text touches: ability checks, attack rolls. _[conditions-effects, ability-checks, combat-running]_
- SRD 5.2.1 › Rules Glossary › Charmed (p. 178) — Condition record with effect entries: Can’t Harm the Charmer; Social Advantage. Effect text touches: ability checks. _[conditions-effects, ability-checks, social-interaction]_
- SRD 5.2.1 › Rules Glossary › Deafened (p. 181) — Condition record with effect entries: Can’t Hear. Effect text touches: ability checks. _[conditions-effects, ability-checks]_
- SRD 5.2.1 › Rules Glossary › Exhaustion (p. 181) — Condition record with effect entries: Exhaustion Levels; D20 Tests Affected; Speed Reduced; Removing Exhaustion Levels. Effect text touches: D20 Tests. _[conditions-effects]_
- SRD 5.2.1 › Rules Glossary › Frightened (p. 182) — Condition record with effect entries: Ability Checks and Attacks Affected; Can’t Approach. Effect text touches: ability checks, attack rolls. _[conditions-effects, ability-checks, combat-running]_
- SRD 5.2.1 › Rules Glossary › Grappled (p. 182) — Condition record with effect entries: Speed 0; Attacks Affected; Movable. Effect text touches: attack rolls. _[conditions-effects, combat-running]_
- SRD 5.2.1 › Rules Glossary › Incapacitated (p. 184) — Condition record with effect entries: Inactive; No Concentration; Speechless; Surprised. Effect text touches: initiative. _[conditions-effects, combat-running]_
- SRD 5.2.1 › Rules Glossary › Invisible (p. 184) — Condition record with effect entries: Surprise; Concealed; Attacks Affected. Effect text touches: attack rolls, initiative. _[conditions-effects, combat-running]_
- SRD 5.2.1 › Rules Glossary › Paralyzed (p. 186) — Condition record with effect entries: Incapacitated; Speed 0; Saving Throws Affected; Attacks Affected; Automatic Critical Hits. Effect text touches: saving throws, attack rolls, critical hits. _[conditions-effects, saves, combat-running]_
- SRD 5.2.1 › Rules Glossary › Petrified (p. 186) — Condition record with effect entries: Turned to Inanimate Substance; Incapacitated; Speed 0; Attacks Affected; Saving Throws Affected; Resist Damage; Poison Immunity. Effect text touches: saving throws, attack rolls. _[conditions-effects, saves, combat-running]_
- SRD 5.2.1 › Rules Glossary › Poisoned (p. 186) — Condition record with effect entries: Ability Checks and Attacks Affected. Effect text touches: ability checks, attack rolls. _[conditions-effects, ability-checks, combat-running]_
- SRD 5.2.1 › Rules Glossary › Prone (p. 186) — Condition record with effect entries: Restricted Movement; Attacks Affected. Effect text touches: attack rolls. _[conditions-effects, combat-running]_
- SRD 5.2.1 › Rules Glossary › Restrained (p. 187) — Condition record with effect entries: Speed 0; Attacks Affected; Saving Throws Affected. Effect text touches: saving throws, attack rolls. _[conditions-effects, saves, combat-running]_
- SRD 5.2.1 › Rules Glossary › Stunned (p. 189) — Condition record with effect entries: Incapacitated; Saving Throws Affected; Attacks Affected. Effect text touches: saving throws, attack rolls. _[conditions-effects, saves, combat-running]_
- SRD 5.2.1 › Rules Glossary › Unconscious (p. 191) — Condition record with effect entries: Inert; Speed 0; Attacks Affected; Saving Throws Affected; Automatic Critical Hits. Effect text touches: saving throws, attack rolls, critical hits. _[conditions-effects, saves, combat-running]_

## Short attributed quotations (SRD 5.2.1 only)

- SRD 5.2.1 › Rules Glossary › Blinded (p. 177): the Can't See effect states you "automatically fail any ability check that requires sight."
- SRD 5.2.1 › Rules Glossary › Charmed (p. 178): the Social Advantage effect gives the charmer "Advantage on any ability check to interact with you socially."
- SRD 5.2.1 › Rules Glossary › Exhaustion (p. 181): when you make a D20 Test, "the roll is reduced by 2 times your Exhaustion level."
- SRD 5.2.1 › Rules Glossary › Paralyzed (p. 186): "You automatically fail Strength and Dexterity saving throws."

## Related

- [[Adjudication-and-Dice|Adjudication and Dice]] — where these records sit among adjudication entries
- [[Brief-and-Assumptions|Brief and Assumptions]] — SRD baseline against the 2014 books

## Grounding

- [[_grounding]] — method and sources
- [[DM-Craft-Map]] — the branch entry
