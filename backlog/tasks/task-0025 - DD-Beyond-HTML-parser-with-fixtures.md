---
id: TASK-0025
title: D&D Beyond HTML parser with fixtures
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 03:37'
labels:
  - library
milestone: m-1
dependencies: []
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First-class DDB export parser per A9 and decision-0003.

Spec: specs/012-ddb-parser
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Committed synthetic fixtures mirror DDB structure with original or SRD 5.1 text
- [ ] #2 Parser emits sections, tables, and stat blocks with anchors
- [ ] #3 A local-only real-export suite runs when fixtures/private exists and skips with a visible notice otherwise
- [x] #4 fixtures/private is gitignored
- [x] #5 Spec phase: Setup
- [x] #6 Spec phase: Foundational — types, selectors, fixtures
- [ ] #7 Spec phase: User Story 1 — anchored sections (Priority: P1) 🎯 MVP
- [ ] #8 Spec phase: User Story 2 — tables and stat blocks whole (Priority: P2)
- [ ] #9 Spec phase: User Story 3 — private real-export suite (Priority: P3)
- [ ] #10 Spec phase: Polish & cross-cutting
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec 012 authored (f7a2794): spec, plan, research, data-model, contracts/parser.md, quickstart, tasks (22 tasks, 6 phases). Clarify skipped — A9 and decision-0003 settle direction. OPERATOR CHECKPOINT: new runtime dependency parse5 ^8 (research R2) needs approval before Phase 1 dispatch.

Operator rulings 2026-09-28: parse5 APPROVED. Real exports available at /Volumes/evan/dnd-sourcebooks (NAS, operator machine only; never commit): players-handbook-zip/ (39 per-chapter zips), dmg-zip.zip (zip of 22 chapter zips), monster_manual.zip (one zip, 3219 files, includes __MACOSX/ junk), xanathars-guide-to-everything.zip, lost-mines-of-phandelver-zip/ (per-part zips + a combined zip of zips). Each chapter is a saved D&D Beyond page: one .html (~400 KB) plus png/js/css assets. Observed in PHB '23 - Combat': headings are h2/h3/h4 with class 'compendium-hr heading-anchor'; page title h1.page-title; inline links carry *-tooltip classes (rule/condition/spell/monster/item/action/skill-tooltip); site chrome uses quick-menu*, ddb-footer*, and hashed _xxx_ classes. Research R3 selectors are unverified until the private suite runs against these. Merge condition: private suite run against PHB, DMG, MM, and LMoP, results in the PR.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=cc/claude-sonnet-5[1m]

Phases 1-2 (T001-T009) implemented in .worktrees/task-0025: parse5 ^8 added, fixtures/private/ gitignored, index.ts stub + Zod schemas (ParseInput/Anchor/Block/ParsedBook per data-model.md), selectors.ts, and three synthetic fixtures (basic-rules.html, equipment.html, bestiary.html) plus README.md attribution. Before writing selectors/fixtures, surveyed real markup read-only (PHB Combat + Equipment zips, MM chapter G) in a /tmp scratch dir, deleted after; research.md R3 updated with observed/corrected selectors and their source export. biome.json excludes apps/server/test/fixtures/ddb from lint/format (raw export-shaped markup, not app code). pnpm ci:check green. Did not start Phase 3 (walk.ts/extract.ts/tests) per dispatch scope.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phases 1-2 (T001-T009) done in 5388ad3; orchestrator verified: transcript shows served=claude-sonnet-5 (the implementer's own line above wrote the pinned form; this line is the transcript value). parse5 ^8.0.1 added. R3 corrected from real exports: stat block is .stat-block-background/.Basic-Text-Frame (guess was wrong); tables are bare <table>; new in-content chrome select.nav-select and #comp-next-nav. biome.json excludes apps/server/test/fixtures/ddb (mirrors real empty aria-hidden anchors). Fixture README: original + SRD 5.1 text only, CC-BY-4.0 attribution. ~199k subagent tokens.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
