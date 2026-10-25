# Research: SRD 5.2.1 baseline data (TASK-0043)

**Date**: 2026-10-25. **Method**: read the candidates' web pages and repository listings
through the GitHub API; streamed record counts with `curl | jq` (nothing written to the
repo); extracted the official PDF's text with `pdftotext` into the session scratchpad, outside
the repo. No dataset or PDF was committed or copied into the worktree.

## R1. Ground truth: the official SRD 5.2.1 PDF

- **URL**: https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf, linked
  from https://www.dndbeyond.com/srd.
- **Identity as fetched 2026-10-25**: 364 pages, 6,031,375 bytes, SHA-256
  `8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87`, PDF ModDate
  2025-04-29.
- **Versions** (dndbeyond.com/srd): 5.2.1 English published 2025-05-01 is current; 5.2.0
  English (2025-04-22) is the previous release; 5.1 is OGL 1.0a or CC-BY-4.0. SRD 5.2 and
  later are CC-BY-4.0 only.
- **Chapters and page ranges** (from the PDF's contents page): Playing the Game 5; Character
  Creation 19; Classes 28–82; Character Origins 83; Feats 87; Equipment 89–103; Spells
  104–175 (Spell Descriptions from 107); Rules Glossary 176–191 (conditions are entries
  tagged `[Condition]`); Gameplay Toolbox 192; Magic Items 204–253; Monsters 254–343
  (Monsters A–Z from 258); Animals 344–364.
- **Measured counts** (pdftotext, approximate where the regex is approximate):
  339 spells (spell header lines); about 330 stat-block entries in the PDF's "Index of Stat
  Blocks"; 12 classes, each with exactly one subclass; 15 conditions.

### The attribution statement (Legal Information, page 1)

Extracted verbatim from page 1. The typographic quotes are part of the text. The line break
inside the license URL is PDF layout.

> This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

The page then says: "Please do not include any other attribution to Wizards or its parent or
affiliates other than that provided above." It allows a "compatible with fifth edition" or
"5E compatible" statement. This matches decision-0012's verification of the same page.

CC-BY-4.0 §3(a)(1)(B) also asks the licensee to indicate if the material was modified.
Restructuring prose into records is a modification, so the attribution file carries a change
notice (spec FR-010). A change notice is not attribution to Wizards, so it does not conflict
with the legal page's request.

## R2. Candidate data sources

### Candidate A — our own transcription from the official PDF

- **URL**: the PDF in R1.
- **License**: CC-BY-4.0 directly from Wizards. No intermediate license layer.
- **5.2.1 coverage**: exact by construction, for every kind.
- **Effort**: a parser over `pdftotext` output for about 330 two-column stat blocks, 339
  spells, 12 classes with level tables, the Equipment chapter's tables, and 15 conditions. A
  spot check shows the text is regular (for example, Goblin Warrior's "Scimitar. Melee
  Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage
  if the attack roll had Advantage."). Tables (class level tables, weapon and armor tables)
  lose their column structure in plain-text extraction and need per-table handling.
- **Risks**: highest effort and the most parser defects, all of them ours to find. Words are
  hyphenated across lines ("pro- vided"). Two-column flow can interleave sidebars. No
  community has reviewed the result.

### Candidate B — 5e-bits `5e-srd-api`, 2024 data

- **URL**: https://github.com/5e-bits/5e-srd-api, path
  `packages/5e-database/src/2024/en/` (the older `5e-bits/5e-database` repository is
  archived as of 2026-10-02 and points here).
- **License**: repository MIT (LICENSE.md). The package README says "The underlying material
  is released using the Open Gaming License Version 1.0a" — wrong for 2024 material, which
  Wizards released only under CC-BY-4.0. No file states the 2024 data's license correctly.
- **Maintenance**: active; last 2024-data commits 2026-10-24, 2026-10-15, 2026-10-11.
- **Coverage per kind (2024/en)**:

  | Kind | Records | Against SRD 5.2.1 |
  |---|---|---|
  | Monsters | 341 | Splits each lycanthrope and the Vampire into one record per form (for example "Werewolf, Wolf Form"); these are not SRD stat blocks. Octopus is missing. |
  | Spells | 339 | Count matches. |
  | Classes | 12 (+12 subclasses) | Count matches. |
  | Equipment | 182 | Plausible; not reconciled. |
  | Conditions | 15 | Count matches. |

- **Structure**: richest structured fields (`attack_bonus`, `damage_dice`, damage-type refs).
  But conditional extra damage is flattened: Goblin Warrior's "plus 2 (1d4) Slashing damage
  if the attack roll had Advantage" is stored as an unconditional second damage entry.
- **Version**: no record or commit claims SRD 5.2.1 specifically; a commit search for "5.2.1"
  finds only release-tool commits.
- **Risks**: license statement is wrong for this data; record shape diverges from the SRD's
  own stat blocks; the 5.2 versus 5.2.1 question is unanswered.

### Candidate C — Open5e `open5e-api`, document `srd-2024` (recommended)

- **URL**: https://github.com/open5e/open5e-api (default branch `staging`), path
  `data/v2/wizards-of-the-coast/srd-2024/`.
- **License**: `Document.json` declares `"licenses": ["cc-by-40"]` and author Wizards of the
  Coast. The repository's "Modified MIT License" expressly excludes "SRD content provided by
  3rd-parties", so the SRD data is under CC-BY-4.0 and not under Open5e's MIT terms.
- **Maintenance**: active; srd-2024 commits on 2026-10-15 and 2026-10-17 ("srd-2024 spells:
  Freezing Sphere upcast wording from the SRD"). Issues show active reconciliation against
  5.2.1: closed "Add the SRD 5.2.1 PDF and check the SRD 5.2 markdown source against it";
  closed "srd-2024 spells missing text compared with SRD 5.2.1".
- **Coverage per kind (srd-2024)**:

  | Kind | Source file(s) | Records | Against SRD 5.2.1 |
  |---|---|---|---|
  | Monsters | `Creature.json` (+ `CreatureAction`, `CreatureTrait`) | 331 | Names match the PDF's stat-block index one to one, plus Giant Fly, a stat block printed inside *Figurine of Wondrous Power* (PDF text line "Giant Fly"). |
  | Spells | `Spell.json` (+ `SpellCastingOption`) | 339 | Count matches the PDF. |
  | Classes | `CharacterClass.json` (+ `ClassFeature`, `ClassFeatureItem`) | 24 = 12 classes + 12 subclasses | Names match the SRD's 12 classes and 12 subclasses. |
  | Equipment | `Item.json`, `Weapon.json`, `Armor.json`, `ItemCategory.json` | 203 items; 38 weapons; 13 armor | Plausible; reconciled in conversion. |
  | Conditions | `ConditionDescription.json` | 15 | Count matches. |

- **Version**: `Document.json` names the document "System Reference Document 5.2" with a
  2024 placeholder date. The maintainers' reconciliation against the 5.2.1 PDF (issues above)
  narrows the gap, but the label alone does not prove 5.2.1. Our verification pass (R4) closes
  it.
- **Risks**:
  1. Open issue "[BUG] Creature attack damage dice, bonuses and extra damage are missing or
     wrong" (opened 2026-10-10) on the structured `CreatureActionAttack` table. Mitigation:
     the converter ignores those structured fields and parses attacks from the action text,
     which is the SRD's own wording.
  2. Open issue on srd-2024 magic items (wrong wand text, 15 items missing). Magic items are
     out of scope (checkpoint C2), so this does not touch us.
  3. Normalized Django-fixture shape: records join across files by key. The converter does
     the joins once; the shipped data is our own flat shape.
  4. The "5.2" label (above).

### Candidate D — downfallx `dnd-5e-srd-markdown` (rejected)

- **URL**: https://github.com/downfallx/dnd-5e-srd-markdown. CC-BY-4.0. Claims SRD 5.2.1.
- **Rejected**: one commit, no maintenance signal, and Markdown prose rather than records. It
  is no less work than Candidate A and adds an unreviewed intermediary.

### Also seen, not pursued

The DM's Toolkit "2024 SRD API" (apisearch.thedmstoolkit.com) lists 345 monsters and 342
spells; neither count matches the PDF, and the site states no license. Apify scrapers cover
SRD 5.1 only.

## R3. Recommendation and ranking

**Recommend Candidate C (Open5e srd-2024), pinned to one commit, with mandatory verification
against the official PDF.** Fallback: Candidate A.

- C is the only dataset whose monsters match the SRD 5.2.1 stat-block index one to one, and
  whose license metadata is correct (CC-BY-4.0, SRD content excluded from the code license).
- C's known defect sits in structured attack fields we do not need to trust: the action text
  is the SRD's wording, and parsing "Attack Roll: +N … Hit: X (dice) Type damage" is regular.
- B has the better structured fields but the wrong license statement, a stat-block shape
  that is not the SRD's, a missing monster, and lossy conditional damage.
- A has perfect provenance and the highest cost. It stays the fallback if the operator
  rejects any third-party intermediary.

This is an operator checkpoint (plan.md C1). It is **PENDING OPERATOR APPROVAL**.

## R4. Proving "no content from outside SRD 5.2.1" (AC #7)

Two layers. The first runs in CI. The second runs once per data change, by an implementer,
and commits its evidence.

1. **CI layer (tests, no network, no PDF)**:
   - `packages/srd/provenance/srd-5.2.1-index.json` lists, per kind, every name and page
     extracted from the official PDF, plus the PDF's SHA-256.
   - A test asserts every record's normalized name is in the index for its kind, every
     record's page lies in its kind's chapter range (R1), and per-kind counts equal the
     index counts.
   - A test asserts the index's recorded SHA-256 equals the constant in R1. Changing the
     ground truth is then a visible diff.
2. **Verification layer (script, needs the PDF locally)**:
   - `packages/srd/scripts/verify-against-pdf.mjs <pdf-path>` checks the PDF's SHA-256,
     extracts per-page text, and for each record confirms the name and its key numbers
     (monster AC, HP and CR; spell level and school; weapon damage; armor AC) occur on the
     cited page.
   - It writes `packages/srd/provenance/verification.json`. Zero unresolved mismatches is a
     merge precondition (spec SC-004). A reviewer can rerun it.
3. **Review layer**: the PR reviewer spot-checks five records per kind against the PDF and
   records the result in the PR description.

The converter reads only the `srd-2024` document directory. It never reads `srd-2014` or any
third-party document in the upstream repository.

## R5. Counting tokens without an LLM dependency (AC #5)

- **Decision**: a deterministic estimator in the package, using only the JavaScript standard
  library. The bound is defined in terms of this estimator, so the test is exact and stable.
- **Rule**: split text by `/[A-Za-z]+|[0-9]+|[^\sA-Za-z0-9]/g`. A letter run of length L
  counts `ceil(L / 5)`. A digit run of length L counts `ceil(L / 3)`. Each other non-space
  character counts 1. Whitespace counts 0.
- **Why this shape**: BPE tokenizers keep common short words as one token, split long words,
  group digits in short runs, and give most punctuation its own token. The rule tracks that
  pattern and errs high on dense stat text full of numbers and punctuation, which is what
  compact records are.
- **Alternatives rejected**:
  - `js-tiktoken` or `gpt-tokenizer`: a vendor tokenizer for another vendor's models. The
    gateway is provider-agnostic (decision-0007), so no single vendor tokenizer is "the"
    count; it would add a dependency and still be an estimate for Claude.
  - `characters / 4`: underestimates dense numeric text, which is exactly the compact form.
  - Calling a model's token-count endpoint: a network and model dependency in a unit test.
- **Golden tests** pin the estimator on fixed strings, so a change to the rule is a
  deliberate, reviewed diff.

## R6. Package placement and boundaries

- New package `packages/srd` (`@the-stacks/srd`). It depends only on `zod` (already used by
  `packages/shared` at `^4.6.5`). No new runtime dependency.
- It does not import `packages/dnd5e-engine` (TASK-0042, in flight), `packages/shared`, or
  any app. A Biome `noRestrictedImports` override plus a boundary-violation fixture enforce it,
  following the existing `packages/shared` pattern.
- `apps/web` imports only the subpath export `@the-stacks/srd/attribution`, which holds the
  statement constant and no data, so no SRD data enters the client bundle.
- The data lives as JSON under `packages/srd/data/`. The loader reads it with `node:fs`
  relative to `import.meta.url`, parses and validates once per kind, and caches. JSON imports
  were rejected: they bloat every consumer's build output and the TypeScript program.
- The runtime image needs the package: the Dockerfile copies `packages/srd/package.json` into
  both install stages and `packages/srd/dist` plus `packages/srd/data` into the runtime stage.

## R7. The About surface

- Route `/about` in `apps/web/app/routes.ts`, rendered inside the app shell. The shell's
  footer gets an "About" `NavLink` shown to every role (Settings is operator-only; About is
  not).
- No modal or dialog: `apps/web/test/no-dialog.test.mjs` already fails on `<dialog`,
  `showModal` or `AlertDialog`. The page is a plain route.
- The SSR test (`apps/web/test/ssr.test.mjs`) gains a case asserting the exact statement is
  in the server-rendered HTML of `/about` for a signed-in user.
- Visual check: a screenshot of `/about` in Brave (the operator's browser), attached to the PR.

## R8. Dev-time tools (not runtime dependencies)

- `pdftotext` (poppler) extracts PDF text for the index and verification scripts. It is a
  host tool, present at `/opt/homebrew/bin/pdftotext` on the operator's Mac, run only by
  those two scripts and never by CI or at runtime.
- The upstream Open5e checkout and the PDF live outside the repository (for example in a
  scratch directory). Fetching them needs the operator's go-ahead at implementation time;
  they are never committed.
