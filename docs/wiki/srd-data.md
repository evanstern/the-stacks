---
name: srd-data
description: The SRD 5.2.1 data package (packages/srd, TASK-0043, TASK-0123) - six Zod-validated record kinds (monster, spell, class, equipment, condition, rule) as JSON, from Open5e at a pinned commit, repaired and checked against the PDF; the rule heading-index coverage oracle, id/name loader, 120-token compact form, CC-BY-4.0 attribution and the no-engine-import rule. Read before touching SRD data, lookups or attribution.
kind: concept
sources:
  - packages/srd/package.json
  - packages/srd/src/index.ts
  - packages/srd/src/loader.ts
  - packages/srd/src/compact.ts
  - packages/srd/src/tokens.ts
  - packages/srd/src/attribution.ts
  - packages/srd/src/schema/common.ts
  - packages/srd/src/schema/rule.ts
  - packages/srd/src/schema/index.ts
  - packages/srd/ATTRIBUTION.md
  - packages/srd/provenance/source.json
  - packages/srd/scripts/convert-open5e.mjs
  - packages/srd/scripts/verify-against-pdf.mjs
  - packages/srd/scripts/convert-rules.mjs
  - packages/srd/scripts/lib/rules.mjs
  - packages/srd/scripts/extract-index.mjs
  - apps/server/src/dm/nodes/schemas.ts
  - apps/web/app/routes/about.tsx
  - biome.json
verified_against: 389d2e32895a3b2143ee05f72f8b421f236a8bf7
---

# SRD data package

`packages/srd` (`@the-stacks/srd`) holds the System Reference Document 5.2.1 as validated,
read-only JSON data plus a small loader. It is versioned data, not a fourth data plane
([[overview]]). The engine ([[dnd5e-engine]]) may import it; it never imports the engine.

## Record kinds and schemas

Six kinds, one file each in `data/`: `monster`, `spell`, `class`, `equipment`, `condition`, `rule`
(`SrdKind` in `src/schema/common.ts`). Each has a Zod schema under `src/schema/`, collected in
`RecordSchemas`, and the package exports the types. Every record shares a base:
`id` (kebab-case slug), `name`, and `source` - a strict `SourceRef` of
`{ document: "SRD 5.2.1", section, page }` with `page` 1..364. Shared building blocks are the six
`Ability` keys, a `Dice` string such as `3d6` or `10d10 + 30`, the 13 `DamageType` values and the
six `Size` values. Counts at the close of TASK-0123: 331 monsters, 339 spells, 12 classes,
206 equipment items, 15 conditions and 117 rules (1020 records).

### The `rule` kind (TASK-0123)

`src/schema/rule.ts` defines `Rule` (strict). Its id is a **heading path**: slugs joined by `.`
(`RuleId`), for example `playing-the-game.d20-tests.ability-checks.difficulty-class`. Fields:
`id`, `name` (the full path joined by ` › `, so two records may share a bare `title`), `title`,
`path`, `parent`, `children`, `source` (`SourceRef`), `pageEnd`, and `blocks`. A block is `text`,
`list` or `table` (`title`, `columns`, `rows`; every row must match the column count). A refinement
requires `pageEnd >= source.page` and `id` to start with `parent + "."`. `SrdRecord<"rule">` and the
`RecordSchemas` registry include it. The 117 records cover the "Playing the Game" chapter and the
four Rules Glossary actions (Help, Influence, Search, Study).

## Source, repairs, verification

Records are converted by `scripts/convert-open5e.mjs` from the Open5e dataset
(`open5e/open5e-api`, directory `data/v2/wizards-of-the-coast/srd-2024`), **pinned to commit
`e69ac13b49dae6a9d84abf38fc674fe1db5b392b`**, licensed CC-BY-4.0. The converter also reads the SRD
PDF (`SRD_CC_v5.2.1.pdf`, SHA-256 `8974902d...3d87`) and uses it where the dataset is wrong or
missing: monster header lines, XP, proficiency bonus and legendary-action text; all equipment
(the dataset's equipment descriptions are not SRD text). Named repairs live in
`provenance/source.json` (`repairs`: Awakened Tree "Slam", Axe Beak "Beak", Black Pudding
"Parry" renamed "Split").

`provenance/srd-5.2.1-index.json` is the page index extracted from the PDF
(`scripts/extract-index.mjs`). `scripts/verify-against-pdf.mjs` checks every record against the PDF
page it cites and writes `provenance/verification.json` (`ok`, `missing` per record). The close-out
state of the five original kinds is zero unresolved mismatches in 903 records, plus a hand spot-check
of 25 records. **Rules sourcing is mixed.**
`scripts/convert-rules.mjs` (with `scripts/lib/rules.mjs`) takes dataset text where it equals the
PDF word for word and PDF text otherwise; headings, ids, page ranges, sidebars and PDF-only records
(`ruleFromPdf` in `source.json`) always come from the PDF. `extract-index.mjs` writes `kinds.rule`
(`{ id, path, page }`) into the page index, and that **heading index is the coverage oracle**: tests
require `kinds.rule` and `data/rule.json` to match one to one on id and page, and the chapter's
contents page was hand-checked (`ruleHeadingCheck`). `verify-against-pdf.mjs` now also checks every
rule block over `source.page..pageEnd`, with zero mismatches. `absentTopics` records card-named
topics the PDF does not print (contests and opposed checks). A test
asserts the index hash matches the pinned PDF hash. `data/` and `provenance/` are excluded from Biome.

## Loader

`src/loader.ts` exports `list(kind)`, `getById(kind, id)`, `getByName(kind, name)`, `compact(kind,
idOrName)`, `normalizeName`, and `SrdDataError`. A kind loads lazily on first use from
`data/<kind>.json`, is parsed record by record with its schema, and is cached with an id map and a
name map. Name lookup uses `normalizeName`: NFKC, curly apostrophe to `'`, lower case, trimmed,
inner whitespace collapsed. An unreadable file, a non-array file, an invalid record, a duplicate id
or a duplicate normalized name throws `SrdDataError` (kind, record id, issue path). A miss returns
`undefined`. `createLoader(dataDir)` is internal (tests inject a directory); it is not exported
from the entry.

## Compact form and the 120-token ceiling

`compact` returns a short text rendering of one record for prompt use, ending in a footer
`SRD 5.2.1 p.<page>`. `src/compact.ts` builds a header plus ordered units, then truncates whole
units so the estimate stays at or under `COMPACT_CEILING` (120), appending `+N more` when units
are dropped. A `rule` renders table rows first, then text sentences, then list items, then a
`See: <child titles>` line. `toCompact(kind, record, context?)` takes an optional `{ ruleTitle }`
lookup that the loader supplies (`getById("rule", id)?.title`); without it `See:` falls back to the
id's last slug. `estimateTokens` (`src/tokens.ts`) is deterministic and dependency-free: letters count
`ceil(len/5)`, digits `ceil(len/3)`, other non-space characters 1 each. Measured medians are 48 to
105 tokens per kind, none above 120. A snapshot test pins the rendered forms.

## Attribution and /about

`ATTRIBUTION.md` and `src/attribution.ts` carry the exact CC-BY-4.0 statement from SRD 5.2.1 p.1
(`SRD_ATTRIBUTION`), a change notice (`SRD_CHANGE_NOTICE`, not an endorsement claim) and
`SRD_DATA_SOURCE` (Open5e name, URL, commit, license). `ATTRIBUTION.md` also has one sentence
naming the six record kinds, and a test requires every `SrdKind` value to be named in it. Tests fail if the file is moved or its text
drifts. The package exposes them on the subpath `@the-stacks/srd/attribution`; the web `/about`
route (`apps/web/app/routes/about.tsx`, linked from the shell nav) imports only that subpath, so no
SRD data enters the client bundle ([[react-router-app]], [[chat-ui]]). The image ships `dist`, `data`
and `ATTRIBUTION.md` ([[container-image]]).

## Boundary rule

A Biome `noRestrictedImports` override on `packages/srd/**` forbids importing
`@the-stacks/dnd5e-engine`, `@the-stacks/server`, `@the-stacks/web`, and `apps/**` or
`dnd5e-engine/**` paths. The reverse direction is allowed. `apps/server` is now a consumer too (TASK-0046): its `package.json` depends on `@the-stacks/srd` and its tsconfig references it, and the DM runtime ([[dm-runtime]]) calls `getById`, `getByName`, `compact` and `estimateTokens`. `SrdKind` widened to include `rule`, which flows into the adjudicate citation schema (`apps/server/src/dm/nodes/schemas.ts`) and the pipeline types. `pnpm check:boundaries` proves the rule
fires against `fixtures/boundary-violations/packages/srd/src/bad.ts` ([[ci-pipeline]],
[[monorepo-and-toolchain]]).
