# Attribution

This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by
Wizards of the Coast LLC and available at
https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under
the Creative Commons Attribution 4.0 International License available at
https://creativecommons.org/licenses/by/4.0/legalcode.

## Source

- URL: https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf
- SHA-256: `2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0`

## Extraction

Text was extracted once at authoring time with:

```
pdftotext -raw SRD_CC_v5.1.pdf SRD_CC_v5.1.txt
```

`-raw` mode was used (rather than the default reading-order mode or `-layout`) because it is
the only poppler mode that preserves a correct, non-interleaved reading order for this PDF's
two-column pages (notably the spell descriptions and monster stat blocks); the other two modes
intersperse text from adjacent columns.

## Changes (CC-BY-4.0 §3(a)(1)(B))

The words of the SRD are reproduced verbatim. The only changes made:

- Rejoined line breaks introduced by the PDF's page layout (including mid-word hyphenation
  artifacts).
- Removed running page headers ("System Reference Document 5.1") and page numbers.
- Added Markdown structure: `#`/`##`/`###` headings for section titles, `-` for bulleted lists,
  `|` rows for tables, and numbered lists for step sequences. Table content is the same
  cost/weight/damage/stat values printed in the source tables, reformatted as Markdown tables.
- For `equipment.md`, `monsters.md`, and `spells.md`, only a representative subset of the
  source material is included (the Armor, Weapons, and Adventuring Gear sections; 12 stat
  blocks plus the Monsters chapter's introductory rules; 40 spell descriptions spanning levels
  0–5), per the corpus size budget. No wording within an included passage was altered.

## Corpus documents

| File | SRD section |
|---|---|
| `using-ability-scores.md` | Using Ability Scores (checks, saves, skills, advantage) |
| `adventuring.md` | Adventuring (time, movement, environment, resting) |
| `combat.md` | Combat (order, actions, attacks, cover, damage, healing) |
| `spellcasting.md` | Spellcasting rules (slots, components, areas, concentration) |
| `spells.md` | 40 spell descriptions, chosen across levels 0–5 |
| `equipment.md` | Armor, Weapons, Adventuring Gear (including their tables) |
| `conditions.md` | Appendix PH-A: Conditions |
| `monsters.md` | The "Monsters" rules intro plus 12 stat blocks |
