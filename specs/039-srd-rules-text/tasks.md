---
description: "Task list for SRD 5.2.1 Playing the Game rules text (TASK-0123)"
---

# Tasks: SRD 5.2.1 Playing the Game rules text

**Input**: `specs/039-srd-rules-text/` — spec.md, plan.md.

**Tests**: required. Every card AC is proven by a named test.

**Dispatch unit**: one phase is one implementer dispatch (sonnet). Run phases in order: 1, 2, 3.

**Gate for every phase** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/srd test && pnpm check:boundaries`.
Phase 2 and Phase 3 also run `pnpm ci:check`, because `SrdKind` widens into `apps/server`.

**Rules for every phase**: add no runtime dependency. Add no migration. Edit nothing outside
`packages/srd/`, `specs/039-srd-rules-text/` and the wiki files named in Phase 3. Never edit the
attribution statement or `SRD_ATTRIBUTION`. Never commit the SRD PDF or any file from
`/Volumes/evan/dnd-sourcebooks` or `fixtures/private/`. Keep the five existing data files
byte-identical.

**Commits**: one or more per phase, each message led by `TASK-0123:`.

## Format: `[ID] [P?] [Story] Description`

## AC coverage map

| Card AC | Proven by |
|---|---|
| #1 Playing the Game sections as validated records with heading-path ids | T003, T008, T010, T013, T014 |
| #2 The CC-BY-4.0 attribution covers the new records | T006, T007, T012 |
| #3 A test proves the DC table and each d20-test section load | T015 |

## Phase 1: Rule kind in the package (schema, loader, compact)

**Goal**: the package accepts, validates, looks up and compacts `rule` records. Tests use
hand-written fixture records in a temp data directory, so this phase needs no PDF.

- [x] T001 [US1] Add `packages/srd/src/schema/rule.ts` with `RuleId`, `RuleBlock` and `Rule`, per plan.md "Data model". Use `.strict()` objects.
- [x] T002 [US1] Add `"rule"` to `SrdKind` in `packages/srd/src/schema/common.ts`. Export and register `Rule` in `packages/srd/src/schema/index.ts`.
- [x] T003 [P] [US1] Add schema tests in `packages/srd/test/schema.test.ts`: a valid record passes; a bad id, an empty path, a table row of wrong length and an unknown key each fail.
- [x] T004 [US2] Add `ruleUnits` and the `rule` case to `toCompact` in `packages/srd/src/compact.ts`, per plan.md D8.
- [x] T005 [P] [US2] Add compact tests in `packages/srd/test/compact.test.ts`: a DC-table fixture renders all six rows unbroken under the ceiling; a long fixture truncates by whole units with `+N more`; the footer is `SRD 5.2.1 p.<page>`.
- [x] T006 [US1] Add one sentence to `packages/srd/ATTRIBUTION.md` naming the six record kinds, per plan.md D9. Do not change the statement or the change notice.
- [x] T007 [P] [US1] Add a test in `packages/srd/test/attribution.test.ts` that every `SrdKind` value is named in `ATTRIBUTION.md`. Keep every existing assertion.
- [x] T008 [US1] Add a loader test with `createLoader` over a temp `rule.json`: `getById` by heading-path id, `getByName` by the full ` › ` name, a miss returns `undefined`, and two records sharing a bare `title` load without a duplicate-name error.
- [x] T009 [US1] Ship an empty `packages/srd/data/rule.json` (`[]`) so the default loader and the server build stay green until Phase 2 fills it.

**Checkpoint**: package gate green. `apps/server` typechecks with the widened `SrdKind`.

## Phase 2: Generated rule data and coverage proof

**Goal**: `data/rule.json` holds the whole chapter plus the four glossary actions, proven
against the PDF. Needs the SRD PDF on disk (spec OQ-3) and an Open5e checkout at
`e69ac13b49dae6a9d84abf38fc674fe1db5b392b`. Store both outside the repository. Stop and report
if either is unavailable, or if `pdftohtml` is missing.

- [x] T010 [US3] Extend `packages/srd/scripts/extract-index.mjs` with a `rule` pass, per plan.md D6. Write `kinds.rule` entries `{ id, path, page }` to `provenance/srd-5.2.1-index.json`. Prove the other kinds' entries are unchanged with `git diff`.
- [x] T011 [US1] Add `packages/srd/scripts/lib/rules.mjs` and `packages/srd/scripts/convert-rules.mjs`, per plan.md D1–D5. Use dataset text where it matches the PDF and PDF text otherwise. Write `data/rule.json`.
- [x] T012 [US1] Update `packages/srd/provenance/source.json`: `usedFor.rule`, `ruleFromPdf` (ids taken from the PDF), each repair, `absentTopics` (card-named topics the PDF does not print, e.g. contests if absent), and `ruleHeadingCheck` (date and result of the hand check in T016).
- [x] T013 [US3] Extend `packages/srd/scripts/verify-against-pdf.mjs` to check each rule record's text and numbers over pages `source.page..pageEnd`. Re-run it. Resolve every rule mismatch to zero. Confirm the existing records still report `ok`.
- [x] T014 [US3] Extend `packages/srd/test/provenance.test.ts`: rule pages fall in the chapter and glossary ranges; index `kinds.rule` and `data/rule.json` match one to one on id and page; no rule entry in `verification.json` has a `missing` item.
- [x] T015 [US1] Add `packages/srd/test/rule.test.ts`: the DC table record holds exactly the six SRD rows; every child of `playing-the-game.d20-tests` loads; every id in spec.md "Downstream lookups" exists; id equals slugged path; parent and children agree; every record's compact form is at or under 120 tokens.
- [x] T016 [US3] Hand-check at least 10 rule records and the heading list against the PDF. Record the check in `source.json` (T012) and in the phase commit message.
- [x] T017 [US1] Correct the spec.md "Downstream lookups" table if any expected id differs from the generated index. Add a loader-test sample row for `rule` in `packages/srd/test/loader.test.ts`. Update `test/__snapshots__/` for rule compact forms.
- [x] T018 Prove SC-006: `git diff --stat origin/main -- packages/srd/data/monster.json packages/srd/data/spell.json packages/srd/data/class.json packages/srd/data/equipment.json packages/srd/data/condition.json` prints nothing.

**Checkpoint**: `pnpm ci:check` green. The card's three ACs are provable from tests.

## Phase 3: Wiki re-ground

**Goal**: the grounding corpus describes the `rule` kind and is re-pinned honestly.

- [x] T019 Update `docs/wiki/srd-data.md` (NEEDS-REVIEW per the runbook): six kinds, the `rule` schema and id form, mixed sourcing, the heading index as coverage oracle, the new counts, and the `SrdKind` widening into the adjudicate citation schema. Add the new source files to `sources:`.
- [x] T020 Regenerate `docs/wiki/CAPSULES.md` because the `srd-data` description changes. Update the state paragraph in `docs/wiki/INDEX.md`.
- [x] T021 Re-pin `verified_against` only on notes re-verified against this branch's code. Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` until it prints `OK`.
- [x] T022 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` and `pnpm ci:check`. Both pass.

**Checkpoint**: freshness `OK`, spec-bridge exit 0, `pnpm ci:check` green.

## Dependencies

- Phase 2 depends on Phase 1 (the schema validates generated data).
- Phase 3 depends on Phase 2 (counts and sources are final).
- Within Phase 1, T003, T005 and T007 run beside their implementation tasks.
