# Implementation Plan: SRD 5.2.1 Playing the Game rules text

**Branch**: `task-0123-srd-rules-text` | **Date**: 2026-10-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/039-srd-rules-text/spec.md`

## Summary

Add a sixth record kind, `rule`, to `@the-stacks/srd`. It holds every heading of the SRD 5.2.1
"Playing the Game" chapter plus four Rules Glossary actions (Help, Influence, Search, Study), as
Zod-validated records with heading-path ids. Text comes from the pinned Open5e srd-2024
`Rule.json`/`RuleSet.json` where it verifies against the SRD PDF, and from the PDF otherwise. A
heading index extracted from the PDF is the coverage oracle. The existing loader, compact form,
provenance scripts and attribution carry the new kind. Research and the data model are inline
below; this card needs no separate research.md, data-model.md or contracts directory.

## Technical Context

**Language/Version**: TypeScript (repo toolchain), Node ESM dev scripts (`.mjs`).

**Primary Dependencies**: `zod` (installed, package runtime dependency). Dev-time only: poppler
`pdftotext` (already required by `scripts/lib/pdf.mjs`) and poppler `pdftohtml -xml` (same
poppler install) for heading font sizes. **No new runtime dependency.** No C5 checkpoint needed.

**Storage**: JSON file `packages/srd/data/rule.json`. No database. No migration.

**Testing**: vitest in `packages/srd/test/`. CI has no PDF; tests read committed provenance files.

**Target Platform**: library consumed by `apps/server` and later the engine.

**Project Type**: data package.

**Performance Goals**: lazy load per kind, as today. The `rule` file loads only on first use.

**Constraints**: compact form at or under 120 estimated tokens (`COMPACT_CEILING`); five existing
data files byte-identical; attribution statement byte-identical.

**Scale/Scope**: about 60 to 120 rule records (56 dataset rules plus sub-headings and PDF-only
headings). The heading index fixes the true count.

## Research (decisions)

- **D1 — Text source.** Open5e `Rule.json` at commit `e69ac13…392b` first, PDF fallback. The
  dataset covers 8 of the chapter's sections and has clean markdown tables, but lacks Rhythm of
  Play rules and every Rules Glossary entry. Rejected: PDF only (two-column extraction degrades
  tables); dataset only (incomplete). Precedent: monsters already mix dataset and PDF.
- **D2 — Scope of the dataset.** Use only rulesets inside Playing the Game: Rhythm of Play, The
  Six Abilities, D20 Tests, Proficiency, Social Interaction, Exploration, Combat, Damage and
  Healing. Ignore Create Your Character, Multiclassing and Trinkets (other chapters).
- **D3 — Granularity.** One record per printed heading, holding its own body only. A dataset
  rule's `## ` sub-headings split into child records. This keeps the DC table addressable alone
  and keeps compact forms under the ceiling.
- **D4 — Id form.** Heading slugs (the existing `slug()` in `scripts/lib/pdf.mjs`) joined by `.`.
  The `.` separator keeps the path readable and unambiguous, since slugs never contain `.`. The
  rule schema uses its own `RuleId` regex; the shared `RecordId` regex stays unchanged.
- **D5 — Name form.** `name` is the full path joined by ` › `. The loader rejects duplicate
  normalized names, and bare headings repeat ("Ability Checks" twice). The bare heading lives in
  `title`. The loader invariant stays unchanged.
- **D6 — Coverage oracle.** `scripts/extract-index.mjs` gains a `rule` pass: it reads heading
  lines and font sizes with `pdftohtml -xml` over the chapter pages and the four glossary entries,
  and writes `kinds.rule` entries `{ id, path, page }`. A maintainer hand-checks the list against
  the PDF once and records the check in `provenance/source.json`. Tests compare index and data.
- **D7 — Kind registration.** Add `rule` to `SrdKind`. Side effect: the server's
  `AdjudicateModelOutput` citation union reuses `SrdKind`, so it accepts `kind: "rule"`. The
  adjudicate prompt still lists five kinds, and citation resolution already uses `getById`, so a
  rule citation resolves correctly. No server file changes. Spec OQ-2 names the follow-up owner.
- **D8 — Compact form.** Header `<title> [rule/<id>]`. Units in order: each table row (first row
  prefixed with the table title), then prose sentences, then list items, then `See: <child
  titles>` when children exist. Rows are whole units, so truncation never splits a row.
- **D9 — Attribution.** The statement, change notice and data-source credit already cover every
  record in the package. Add one sentence to `ATTRIBUTION.md` naming the six record kinds,
  including rule text from "Playing the Game" and "Rules Glossary". The added sentence must not
  name Wizards (the existing test forbids it outside the statement).

## Data model

```ts
RuleId = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/

RuleBlock =
  | { type: "text"; text: string }                       // one paragraph, verbatim
  | { type: "list"; items: string[] }                    // min 1 item
  | { type: "table"; title: string | null;
      columns: string[]; rows: string[][] }              // every row length == columns length

Rule = {
  id: RuleId;
  name: string;              // path.join(" › ")
  title: string;             // path.at(-1)
  path: string[];            // min 1; slug(path[i]) joined by "." == id
  parent: RuleId | null;     // when set: id starts with parent + "."
  children: RuleId[];        // document order; each child's parent == this id
  source: SourceRef;         // section "Playing the Game" | "Rules Glossary"; page = first page
  pageEnd: number;           // >= source.page, <= 364
  blocks: RuleBlock[];       // may be empty for a heading with only sub-headings
}  // .strict()
```

Cross-record invariants (id-path agreement, parent/children symmetry) are checked by a test over
the shipped file, not by the per-record schema.

Glossary records: `path` is `["Rules Glossary", "Help [Action]"]`, id `rules-glossary.help-action`,
`parent: null`. No `rules-glossary` root record ships (OQ-1 decides the rest of the glossary).

## Constitution Check (2.0.0)

- [x] **I. Agent-operable** — agents use the existing `list`, `getById`, `getByName`, `compact`
      calls. No new interface.
- [x] **II. Content contract** — no codex entity. N/A by construction (SRD data, not codex).
- [x] **III. Data planes** — versioned package data, as the other five kinds. No new plane.
- [x] **IV. Event sourcing** — no play state. N/A.
- [x] **V. Citations** — every record carries document, section and page; verification checks
      them. No retrieval change, so no retrieval eval.
- [x] **VI. 5e engine boundary** — data only. Table cells stay strings; the engine parses
      numbers in its own cards. The Biome rule forbidding engine imports stays in force.
- [x] **VII. Structured first** — records are Zod-validated before any render.
- [x] **VIII. Operator-owned content** — ships only CC-BY-4.0 SRD 5.2.1 text, under the exact
      attribution guarded by `test/attribution.test.ts`. No PDF, nothing from
      `/Volumes/evan/dnd-sourcebooks` or `fixtures/private/`, is read into data or committed.
- [x] **IX. Self-hostable** — the image already ships `data/`; `rule.json` rides along. No new
      container.

**Stack conformance**: TypeScript and Zod only. No departure.

## Files touched

New:

- `packages/srd/src/schema/rule.ts` — `RuleId`, `RuleBlock`, `Rule`.
- `packages/srd/data/rule.json` — generated records.
- `packages/srd/scripts/convert-rules.mjs` — `node scripts/convert-rules.mjs <open5e-checkout>
  <commit> <pdf>`; writes `data/rule.json` and the `rule` entries of `provenance/source.json`.
  A separate script so the 903 existing records are never regenerated.
- `packages/srd/scripts/lib/rules.mjs` — dataset markdown to blocks, PDF heading reader.
- `packages/srd/test/rule.test.ts` — DC table, d20-test sections, pinned downstream ids,
  path/parent/children invariants, compact ceiling.

Changed:

- `packages/srd/src/schema/common.ts` — add `"rule"` to `SrdKind`.
- `packages/srd/src/schema/index.ts` — export and register `Rule` in `RecordSchemas`.
- `packages/srd/src/compact.ts` — `ruleUnits` and the `rule` case in `toCompact`.
- `packages/srd/scripts/extract-index.mjs` — `rule` pass; other kinds' output unchanged.
- `packages/srd/scripts/verify-against-pdf.mjs` — `rule` checks over `page..pageEnd`.
- `packages/srd/provenance/srd-5.2.1-index.json` — adds `kinds.rule`.
- `packages/srd/provenance/verification.json` — adds rule entries.
- `packages/srd/provenance/source.json` — `usedFor.rule`, `ruleFromPdf`, repairs,
  `absentTopics`, `ruleHeadingCheck` (hand-check record).
- `packages/srd/ATTRIBUTION.md` — one sentence naming the covered kinds.
- `packages/srd/test/provenance.test.ts` — page ranges and index bijection for `rule`.
- `packages/srd/test/loader.test.ts` — the per-kind sample table gains `rule`.
- `packages/srd/test/attribution.test.ts` — every `SrdKind` is named in `ATTRIBUTION.md`.
- `packages/srd/test/compact.test.ts` and `test/__snapshots__/` — rule compact snapshots.
- `packages/srd/test/schema.test.ts`, `test/schema-fixtures.test.ts` — rule fixtures, if those
  files enumerate kinds.
- `docs/wiki/srd-data.md`, `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md` — wiki phase.

Not touched: `apps/server/**`, `apps/web/**`, `packages/dnd5e-engine/**`, `biome.json` (no new
boundary rule), root `package.json` (the scripts are dev-time, not host-run, so
`check:host-scripts` is unchanged). No migration.

## Gates

- `pnpm ci:check` green in the worktree. The server suites run too, because `SrdKind` widens.
- Wiki freshness: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs
  freshness . docs/wiki` prints `OK`.
- Spec-bridge: `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
  exits 0.
- `git diff --stat origin/main -- packages/srd/data/{monster,spell,class,equipment,condition}.json`
  is empty (SC-006).
- No database work: `REQUIRE_DATABASE` stacks are not needed.

## Project Structure

```text
specs/039-srd-rules-text/
├── spec.md
├── plan.md
├── tasks.md
└── checklists/requirements.md

packages/srd/
├── ATTRIBUTION.md
├── data/rule.json                 (new)
├── provenance/{source,srd-5.2.1-index,verification}.json
├── scripts/{convert-rules,extract-index,verify-against-pdf}.mjs
├── scripts/lib/rules.mjs          (new)
├── src/{compact.ts, schema/{common,index,rule}.ts}
└── test/{rule,provenance,loader,attribution,compact}.test.ts
```

**Structure Decision**: everything lands inside `packages/srd`, matching the runbook's C2 scope
("`packages/srd` only"), plus the wiki phase.

## Open questions

- **OQ-1** (spec): coverage of the remaining Rules Glossary. Orchestrator cards or rules it out.
- **OQ-2** (spec): which card offers `rule` citations in the adjudicate prompt.
- **OQ-3** (spec): the SRD PDF on disk for dev-time scripts. Operator supplies or approves the
  download from the pinned public URL.
- **C5 (runtime dependency)**: none proposed. `pdftohtml` is a dev-time poppler tool from the
  same install as the already-required `pdftotext`. If the host lacks it, the implementer stops
  and reports rather than adding a package.

## Complexity Tracking

No constitution violations.
