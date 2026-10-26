---
name: srd-data
description: The SRD 5.2.1 data package (packages/srd, TASK-0043) - five Zod-validated record kinds (monster, spell, class, equipment, condition) shipped as JSON, converted from Open5e at a pinned commit and repaired and checked against the SRD PDF, the provenance index, the id/name loader, the 120-token compact lookup form, the CC-BY-4.0 attribution file and /about surface, and the no-engine-import boundary rule. Read before touching SRD data, lookups, or attribution.
kind: concept
sources:
  - packages/srd/package.json
  - packages/srd/src/index.ts
  - packages/srd/src/loader.ts
  - packages/srd/src/compact.ts
  - packages/srd/src/tokens.ts
  - packages/srd/src/attribution.ts
  - packages/srd/src/schema/common.ts
  - packages/srd/ATTRIBUTION.md
  - packages/srd/provenance/source.json
  - packages/srd/scripts/convert-open5e.mjs
  - packages/srd/scripts/verify-against-pdf.mjs
  - apps/web/app/routes/about.tsx
  - biome.json
verified_against: 49c7de2be46b0cf6b94814c4ed0bb1bd4aa20bb7
---

# SRD data package

`packages/srd` (`@the-stacks/srd`) holds the System Reference Document 5.2.1 as validated,
read-only JSON data plus a small loader. It is versioned data, not a fourth data plane
([[overview]]). The engine ([[dnd5e-engine]]) may import it; it never imports the engine.

## Record kinds and schemas

Five kinds, one file each in `data/`: `monster`, `spell`, `class`, `equipment`, `condition`
(`SrdKind` in `src/schema/common.ts`). Each has a Zod schema under `src/schema/`, collected in
`RecordSchemas`, and the package exports the types. Every record shares a base:
`id` (kebab-case slug), `name`, and `source` - a strict `SourceRef` of
`{ document: "SRD 5.2.1", section, page }` with `page` 1..364. Shared building blocks are the six
`Ability` keys, a `Dice` string such as `3d6` or `10d10 + 30`, the 13 `DamageType` values and the
six `Size` values. Counts at the close of TASK-0043: 331 monsters, 339 spells, 12 classes,
206 equipment items, 15 conditions (903 records).

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
state is zero unresolved mismatches in 903 records, plus a hand spot-check of 25 records. A test
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
are dropped. `estimateTokens` (`src/tokens.ts`) is deterministic and dependency-free: letters count
`ceil(len/5)`, digits `ceil(len/3)`, other non-space characters 1 each. Measured medians are 48 to
105 tokens per kind, none above 120. A snapshot test pins the rendered forms.

## Attribution and /about

`ATTRIBUTION.md` and `src/attribution.ts` carry the exact CC-BY-4.0 statement from SRD 5.2.1 p.1
(`SRD_ATTRIBUTION`), a change notice (`SRD_CHANGE_NOTICE`, not an endorsement claim) and
`SRD_DATA_SOURCE` (Open5e name, URL, commit, license). Tests fail if the file is moved or its text
drifts. The package exposes them on the subpath `@the-stacks/srd/attribution`; the web `/about`
route (`apps/web/app/routes/about.tsx`, linked from the shell nav) imports only that subpath, so no
SRD data enters the client bundle ([[react-router-app]], [[chat-ui]]). The image ships `dist`, `data`
and `ATTRIBUTION.md` ([[container-image]]).

## Boundary rule

A Biome `noRestrictedImports` override on `packages/srd/**` forbids importing
`@the-stacks/dnd5e-engine`, `@the-stacks/server`, `@the-stacks/web`, and `apps/**` or
`dnd5e-engine/**` paths. The reverse direction is allowed. `pnpm check:boundaries` proves the rule
fires against `fixtures/boundary-violations/packages/srd/src/bad.ts` ([[ci-pipeline]],
[[monorepo-and-toolchain]]).
