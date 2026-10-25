# Implementation Plan: First Scene — SRD 5.2.1 baseline data with attribution

**Branch**: `task-0043-srd-data` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md) | **Board**: TASK-0043

**Input**: Feature specification from `specs/027-srd-data/spec.md`

**Operator checkpoints**: C1 (data source) is **PENDING OPERATOR APPROVAL**. C2 and C3 are
below. Phase 2 of tasks.md cannot start until C1 and C3 are resolved and recorded on the card.

## Summary

Ship SRD 5.2.1 monsters, spells, classes, equipment and conditions as Zod-validated JSON
records in a new package, `packages/srd` (`@the-stacks/srd`). The package provides a loader
(by id, by name), a compact lookup renderer with a deterministic token estimator, and the
exact CC-BY-4.0 attribution as one exported constant plus an `ATTRIBUTION.md` file. The web app
shows the attribution on a new `/about` route. A committed SRD 5.2.1 index (names and pages
extracted from the official PDF) and a verification report prove that every record comes from
SRD 5.2.1 and nothing else. The recommended upstream is the Open5e `srd-2024` dataset, pinned
to one commit and re-verified against the PDF (`research.md` R2–R4).

## Operator checkpoints

### C1 — Data source — **PENDING OPERATOR APPROVAL**

**Recommendation: Candidate C, Open5e `open5e-api` `data/v2/wizards-of-the-coast/srd-2024/`,
pinned to one commit, converted into our own record shape, and verified against the official
SRD 5.2.1 PDF.**

| Candidate | License of the data | Monsters | Spells | Classes | Equipment | Conditions | Main risk |
|---|---|---|---|---|---|---|---|
| **C. Open5e srd-2024 (recommended)** | CC-BY-4.0 (declared in `Document.json`; SRD content excluded from the repo's modified MIT) | 331, one to one with the PDF index plus embedded Giant Fly | 339 = PDF | 12 + 12 subclasses | 203 items, 38 weapons, 13 armor | 15 | Structured attack fields have an open bug — we parse attacks from the SRD text instead; label says "5.2" — closed by our PDF verification |
| A. Own transcription from the PDF (fallback) | CC-BY-4.0, direct | exact | exact | exact | exact | exact | Highest effort; every parser defect is ours; tables lose structure in text extraction |
| B. 5e-bits `5e-srd-api` 2024/en | MIT repo; README wrongly says OGL 1.0a for the underlying material | 341, with per-form records that are not SRD stat blocks; Octopus missing | 339 | 12 + 12 | 182 | 15 | Wrong license statement; shape diverges from the SRD; conditional damage flattened |
| D. downfallx Markdown | CC-BY-4.0 | prose only | prose only | prose only | prose only | prose only | One commit; not structured — rejected |

Why C: it is the only dataset whose monster list matches the SRD 5.2.1 stat-block index one
to one, its license metadata is correct, and its known defect is in fields we do not need to
trust. Full evidence: `research.md` R2–R3.

**If the operator picks A**, Phase 2 replaces the converter with a PDF parser; every other
phase, contract and test is unchanged. **If B**, the converter changes and the attribution's
data-source line names 5e-bits under MIT; the form-split monsters must be merged back into
one record each.

### C2 — Scope boundary on kinds — recommendation: confirm as scoped

The card and decision-0012 name five kinds. Magic items, species, backgrounds, feats, and
rules-glossary entries other than conditions are **not built** by this feature. This is a
scope boundary, not a deferral. If the operator wants any of them, the orchestrator cards it
on the board (decision-0020); nothing in this spec defers it as prose.

### C3 — Fetching the PDF and the upstream dataset at implementation time

Phase 2 needs the official PDF and a checkout of the chosen dataset at its pinned commit, in a
scratch directory outside the repository. Downloading is a permissioned action: the
orchestrator obtains the operator's go-ahead and records it on the card before dispatching
Phase 2. Neither file is ever committed.

## Technical Context

**Language/Version**: TypeScript 5.9, Node 22 (repo toolchain).

**Primary Dependencies**: `zod` ^4.6.5 (already in the workspace). No new runtime dependency.

**Dev dependencies**: `vitest` ^5.0.1 added to `packages/srd` devDependencies (already the
workspace's test runner in `apps/server`; same version). `pdftotext` (poppler) as a host
tool for the two provenance scripts only (`research.md` R8).

**Storage**: JSON files in `packages/srd/data/` (one per kind). No database.

**Testing**: vitest in `packages/srd/test/`; `node --test` for the web SSR case
(`apps/web/test/ssr.test.mjs`); the existing `no-dialog` test; `pnpm check:boundaries` with a
new fixture.

**Target Platform**: Node 22 server process and the web SSR build; the loader is Node-only.

**Project Type**: workspace library package plus one web route.

**Performance Goals**: first `list(kind)` reads and validates one JSON file (a few MB at most
for monsters) once per process; later calls are map lookups.

**Constraints**: no SRD data in the client bundle (web imports the attribution subpath
only); compact forms at or under 120 estimated tokens; no import of the engine package.

**Scale/Scope**: about 330 monsters, 339 spells, 12 classes, about 250 equipment entries, 15
conditions.

## Constitution Check (pre-research)

- [x] **I. Agent-operable** — the loader API (`contracts/loader.md`) is the one interface for
      agents and code; the About page renders an exported constant an agent can read too.
- [x] **II. Content contract** — n/a: SRD records are mechanics data, not codex entities.
      They become `identity` sections later (architecture A5). Records are still Zod-first.
- [x] **III. Data planes** — the SRD baseline is static, read-only package data, not state;
      it lives in no plane and crosses no plane seam. Imported mechanics records (TASK-0064)
      live in the library plane; that is not built here.
- [x] **IV. Event sourcing** — n/a: no play state.
- [x] **V. Citations** — n/a for library retrieval. Provenance is stronger here: every record
      carries document, section and page (FR-007).
- [x] **VI. 5e engine boundary** — the package holds data and lookup only; no dice, no
      computed numbers; it never imports `packages/dnd5e-engine`. Enforced by a Biome rule and
      a boundary fixture.
- [x] **VII. Structured first** — records are validated data; the compact form is a pure
      rendering of them.
- [x] **VIII. Operator-owned content** — ships only SRD 5.2.1 under CC-BY-4.0 with the exact
      statement guarded by a test; never reads `/Volumes/evan/dnd-sourcebooks` or
      `fixtures/private/`; AC #7 proven by index plus verification (`research.md` R4).
- [x] **IX. Self-hostable** — no new service or container; the Dockerfile copies the package
      into the runtime image.

**Stack conformance**: TypeScript, Zod, React Router 8 SSR. No departure.

## Constitution Check (post-design)

Unchanged. The design adds one package, one route, one Biome override and one boundary
fixture. No Complexity Tracking entry is needed.

## Project Structure

### Documentation (this feature)

```text
specs/027-srd-data/
├── spec.md
├── plan.md              # this file
├── research.md          # sources, license, attribution, AC #7 proof, estimator
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── records.md       # Zod schemas per kind
│   ├── loader.md        # by id, by name, list, compact
│   ├── compact.md       # compact form, estimator, the bound and its tests
│   └── attribution.md   # constant, ATTRIBUTION.md, About page, tests
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/srd/
├── package.json             # @the-stacks/srd; exports "." and "./attribution"; deps: zod; devDeps: vitest
├── tsconfig.json            # extends tsconfig.base.json; rootDir src; outDir dist
├── ATTRIBUTION.md           # exact statement + change notice + data source
├── src/
│   ├── index.ts             # public API (loader.md)
│   ├── attribution.ts       # SRD_ATTRIBUTION, SRD_CHANGE_NOTICE, SRD_DATA_SOURCE
│   ├── schema/              # records.md: common.ts, monster.ts, spell.ts, class.ts, equipment.ts, condition.ts, index.ts
│   ├── loader.ts            # list / getById / getByName / normalizeName / SrdDataError
│   ├── compact.ts           # toCompact per kind
│   └── tokens.ts            # estimateTokens
├── data/                    # monster.json spell.json class.json equipment.json condition.json (generated, committed)
├── provenance/
│   ├── srd-5.2.1-index.json # names + pages per kind, PDF sha256
│   ├── source.json          # upstream repo, commit, license, converter version, date
│   └── verification.json    # per-record PDF check results
├── scripts/                 # dev-time only, never run by CI
│   ├── extract-index.mjs    # <pdf> -> provenance/srd-5.2.1-index.json (uses pdftotext)
│   ├── convert-open5e.mjs   # <checkout dir> <commit> -> data/*.json + provenance/source.json
│   └── verify-against-pdf.mjs # <pdf> -> provenance/verification.json
└── test/
    ├── tsconfig.json        # noEmit; references ..
    ├── schema.test.ts       # every record validates; id uniqueness; attack/save parse rule; spell class refs
    ├── provenance.test.ts   # names in index; page ranges; counts = index; index sha256 constant; verification has zero mismatches
    ├── source-ref.test.ts   # AC #6: every record has a valid source
    ├── attribution.test.ts  # AC #2/#6: file present, exact statement, no other Wizards mention
    ├── loader.test.ts       # AC #4: by id, by name (case, apostrophes, spaces), not found, SrdDataError
    ├── tokens.test.ts       # estimator golden values
    └── compact.test.ts      # AC #5: bound over every record; snapshots per kind

apps/web/app/routes/about.tsx    # new route
apps/web/app/routes.ts           # + route("about", "routes/about.tsx")
apps/web/app/shell/shell.tsx     # + "About" NavLink for every role
apps/web/package.json            # + "@the-stacks/srd": "workspace:*"
apps/web/tsconfig.json           # + reference ../../packages/srd
apps/web/test/ssr.test.mjs       # + /about case

tsconfig.json                    # + references packages/srd, packages/srd/test
biome.json                       # + override for packages/srd/**; exclude packages/srd/data, packages/srd/provenance
fixtures/boundary-violations/packages/srd/src/bad.ts   # imports @the-stacks/dnd5e-engine; must be flagged
Dockerfile                       # + packages/srd/package.json in both install stages; + dist, data, ATTRIBUTION.md in runtime
```

**Structure Decision**: one new workspace package beside `packages/shared`, outside
`packages/dnd5e-engine` (TASK-0042), plus one web route. The footprint rule from the dispatch
holds: this package depends on nothing but `zod`.

### Boundary rule (biome.json override)

```json
{
  "includes": ["packages/srd/**", "fixtures/boundary-violations/packages/srd/**"],
  "linter": { "rules": { "style": { "noRestrictedImports": { "level": "error", "options": {
    "paths": {
      "@the-stacks/dnd5e-engine": "packages/srd must not import the engine; the engine may import srd, never the reverse (constitution VI).",
      "@the-stacks/server": "packages/srd must not import the server (constitution III).",
      "@the-stacks/web": "packages/srd must not import the web app (constitution III)."
    },
    "patterns": [{ "group": ["**/apps/**", "**/dnd5e-engine/**"], "message": "packages/srd must not import app or engine code by relative path." }]
  } } } } }
}
```

## New dependencies

| Package | Where | Kind | Why stdlib or an installed package does not cover it |
|---|---|---|---|
| `zod` ^4.6.5 | packages/srd | runtime | Already installed in the workspace; schemas are the contract (AC #1). Not new to the repo. |
| `vitest` ^5.0.1 | packages/srd | dev | Already the server's runner; reused for TS tests. Not new to the repo. |
| `@the-stacks/srd` workspace:* | apps/web | runtime | The attribution constant's single source (FR-013). |

No new third-party package enters the repository. Token counting uses the standard library
(`research.md` R5).

## Wiki re-grounding

These pinned sources change: `Dockerfile` ([[container-image]], [[runtime-stacks]]),
`biome.json` ([[ci-pipeline]], [[ddb-parser]], [[monorepo-and-toolchain]]), `tsconfig.json`
([[monorepo-and-toolchain]], [[test-suite]]), `apps/web/app/routes.ts`
([[react-router-app]]), `apps/web/app/shell/shell.tsx` ([[chat-ui]]). The sweep's
post-merge re-ground (`/grounding-wiki:wiki-update`) re-pins them and adds a note for
`packages/srd`. That step belongs to the sweep's merge procedure for this card.

## Complexity Tracking

None.
