# DDB parser fixtures — provenance

Synthetic pages shaped like real D&D Beyond exports (constitution VIII: no proprietary text
is committed here). Structure was checked against real Player's Handbook and Monster Manual
exports read-only, off-repo, on 2026-09-28 (see `specs/012-ddb-parser/research.md` R3); no
text from those exports appears below — only original text or SRD 5.1 text.

- `basic-rules.html` — **original text**, written for this fixture. Nested headings
  (including one skipped level, h2 → h4), prose, an ordered and an unordered list, one
  sidebar, and non-ASCII characters (em dash, curly quotes, an accented name).
- `equipment.html` — **original layout, SRD 5.1 mechanical data** (weapon costs/damage,
  coin values). Three tables: caption + header row, a header column (no header row), and a
  header row with a merged (`colspan`) cell.
- `bestiary.html` — **SRD 5.1 text**: the Goblin and Wolf stat blocks (name, size/type/
  alignment, AC, HP, speed, ability scores, skills, senses, languages, challenge, traits,
  and actions). The third stat block, "Cave Skitterer," is an **original**, deliberately
  malformed creature — it omits the ability-score grid to test that the parser still emits
  one whole block.

## SRD 5.1 attribution

Portions of `equipment.html` and `bestiary.html` are derived from the System Reference
Document 5.1 ("SRD 5.1"), available at https://dnd.wizards.com/resources/systems-reference-document,
and are licensed under the Creative Commons Attribution 4.0 International License
(https://creativecommons.org/licenses/by/4.0/legalcode).

## Rule

No text saved from a real D&D Beyond export may be committed to this directory. Real
exports belong only in the gitignored `fixtures/private/ddb/` (see
`apps/server/test/library/ddb.private.test.ts`).
