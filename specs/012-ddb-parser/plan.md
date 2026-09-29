# Implementation Plan: D&D Beyond export parser

**Branch**: `task-0025-ddb-parser` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-ddb-parser/spec.md`

## Summary

A pure function, `parseDdbExport({ book, pages })`, turns saved D&D Beyond pages into a
`ParsedBook`: one normalized text plus ordered blocks (heading, prose, list, table, stat
block, sidebar), each with a heading path and a `[start, end)` anchor into that text. HTML is
parsed with `parse5` (new dependency, operator checkpoint) and walked once; D&D Beyond's
class names live in one selector table so a format change is a one-file edit. Committed
fixtures are synthetic (original or SRD 5.1 text); a private-folder suite covers real
exports and skips visibly when absent.

## Technical Context

**Language/Version**: TypeScript on Node 22 (existing server workspace)

**Primary Dependencies**: `parse5` 8.x — **new, pending operator approval** (research R2);
`zod` (installed)

**Storage**: N/A — pure function; TASK-0022/0024 store its output

**Testing**: Vitest (existing), unit tests with committed fixtures; one private-folder suite

**Target Platform**: the server process (library plane)

**Project Type**: library module inside `apps/server`

**Performance Goals**: a ~300-page book parses in under 10 s (SC-004)

**Constraints**: no I/O inside the parser; deterministic; anchors are UTF-16 offsets

**Scale/Scope**: one book per call; four source files, three fixtures, three test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — a typed function with a Zod-validated input
      (`contracts/parser.md`). The upload route (TASK-0024) and any agent tool call the same
      function. No human-only path.
- [x] **II. Content contract** — not applicable: no codex entity is created. Library blocks
      are not codex entities.
- [x] **III. Data planes** — all new state is library-plane (in-memory `ParsedBook`); code
      sits in `apps/server/src/library/ddb/`, covered by the existing library boundary rule.
      No cross-plane access.
- [x] **IV. Event sourcing** — not applicable: no play state.
- [x] **V. Citations** — every block carries an anchor (book, path, span) whose round-trip
      is tested for every fixture. Retrieval evals are TASK-0029's; this feature changes no
      retrieval behavior.
- [x] **VI. System-agnostic** — stat-block fields are kept as labelled text; no 5e values
      are typed or interpreted (CR-004).
- [x] **VII. Structured first** — output is Zod-validated data; nothing is rendered or
      generated.
- [x] **VIII. Operator-owned content** — committed fixtures hold original or SRD 5.1
      (CC-BY-4.0, attributed) text only; real exports live in the gitignored
      `fixtures/private/`.
- [x] **IX. Self-hostable** — no new service or container; one pure-JS dependency.

**Stack conformance** — within the table. `parse5` is a library dependency, not a service,
language, or datastore, so no amendment is needed; it is still raised at the runbook's
new-dependency checkpoint.

**Post-design re-check (after Phase 1)**: unchanged — all nine hold.

## Project Structure

### Documentation (this feature)

```text
specs/012-ddb-parser/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/parser.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/server/src/library/ddb/
├── index.ts        # parseDdbExport + Zod input schema + exported types
├── selectors.ts    # the one table of D&D Beyond class names → block kinds / chrome
├── walk.ts         # parse5 tree walk → blocks + normalized text + anchors
└── extract.ts      # table and stat-block extraction

apps/server/test/library/
├── ddb.test.ts          # fixture suite: round-trip, order, wholeness, chrome, determinism
├── ddb.perf.test.ts     # ~300-page synthetic book under 10 s
└── ddb.private.test.ts  # real-export suite; visible skip when fixtures/private/ddb/ absent

apps/server/test/fixtures/ddb/
├── README.md        # provenance + SRD 5.1 CC-BY-4.0 attribution
├── basic-rules.html
├── equipment.html
└── bestiary.html

.gitignore           # + fixtures/private/
```

**Structure Decision**: the parser lives in the library plane of the existing server
workspace (research R1). No new workspace or package.

## Answers to the runbook's questions

- **(a) Location**: `apps/server/src/library/ddb/` (R1).
- **(b) Output shape**: `ParsedBook { book, text, blocks[] }`; each block's `Anchor { book,
  path, start, end }` is what TASK-0022 stores per chunk and what TASK-0024 sub-ranges when it
  chunks (R4, data-model.md).
- **(c) HTML parsing**: `parse5` — the one new dependency; checkpoint before dispatch (R2).
- **(d) Fixtures**: three synthetic pages with realistic chrome, original or SRD 5.1 text,
  attribution README (R5).
- **(e) Private suite**: `fixtures/private/` gitignored; `describe.skipIf` plus one warn line
  naming the folder (R6).

## Complexity Tracking

None. No constitution gate is a "no".
