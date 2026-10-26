---
id: TASK-0043
title: 'First Scene: SRD 5.2.1 baseline data with attribution'
status: Done
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 02:52'
labels:
  - first-scene
  - srd
  - data
milestone: m-2
dependencies:
  - TASK-0041
references:
  - 'https://www.dndbeyond.com/srd'
priority: high
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the engine works on day one with no imported book. The repo ships structured SRD 5.2.1 records (monsters, spells, classes, equipment, conditions), a loader, and compact lookup records of about 100 tokens each.

Why: decision-0012 sets the SRD as the mechanics baseline. Imports layer over it later (M5). Compact records keep prompts small: the model never loads a whole data file (decision-0021 idea 7).

License: SRD 5.2.1 is CC-BY-4.0. Its legal page requires one exact attribution statement and asks for no other attribution to Wizards. Verified against the SRD 5.2.1 PDF on 2026-10-25. The spec names the data source (transcription or an existing CC-BY dataset) and that source's own license.

Runs in parallel with the engine card. It depends on nothing else.

Spec: specs/027-srd-data
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The repo ships SRD 5.2.1 monsters, spells, classes, equipment and conditions as Zod-validated records.
- [x] #2 An attribution file carries the exact SRD 5.2.1 CC-BY-4.0 statement, and the app shows it on an about or legal surface.
- [x] #3 The spec records the data source and its license.
- [x] #4 A loader returns typed records by id and by name.
- [x] #5 Each record has a compact lookup form of about 100 tokens, and a test enforces the size bound.
- [x] #6 A test fails when the attribution file is missing or a record lacks a source reference.
- [x] #7 The data contains no content from outside SRD 5.2.1.
- [x] #8 Spec phase: Package scaffold, schemas, attribution, estimator (one dispatch)
- [x] #9 Spec phase: Provenance index and converted data — US4 then US1 (one dispatch)
- [x] #10 Spec phase: Loader and compact forms — US1 and US3 (one dispatch)
- [x] #11 Spec phase: About page — US2 (one dispatch)
- [x] #12 Spec phase: Close-out (one dispatch)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-25 by the M2 First Scene sweep (docs/design/m2-first-scene-sweep-runbook.md, lane 1). Worktree .worktrees/task-0043, branch task-0043-srd-data, cut from origin/main 4fee63a. Spec number 027-srd-data claimed with a stub.

Spec authoring (speckit specify/plan/tasks) by opus-implementer: commit 8b63240, ~225k tokens. Clarify skipped (recorded in spec.md).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Plan checkpoints awaiting the operator: C1 data source (Open5e open5e-api srd-2024, CC-BY-4.0, recommended), C2 out-of-scope record kinds, C3 Phase 2 downloads the PDF and dataset to a scratch dir outside the repo.

Operator rulings 2026-10-25 at plan checkpoints: C1 data source = Open5e open5e-api srd-2024 (CC-BY-4.0), pinned to one commit, verified against the SRD 5.2.1 PDF. C2 = the other kinds stay out of this task and were carded: TASK-0092 (magic items), TASK-0093 (species, backgrounds, feats), TASK-0094 (rules glossary entries), milestone m-5. C3 = Phase 2 may download the PDF and clone open5e-api into a scratch dir outside the repo.

Phase 1 by sonnet-implementer: 14c3207. ci:check green, 23 srd tests, docker build ok. Deviations accepted by the orchestrator: @types/node as a test-only devDependency (already in the lockfile; not a runtime dependency); a Dockerfile build step for srd; a data/.gitkeep file.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 2 by sonnet-implementer: 204a9d7. Open5e pinned at e69ac13 (staging). 903 records: 331 monsters, 339 spells, 12 classes, 206 equipment, 15 conditions. Each count equals the PDF index count. PDF verification shows 0 mismatches; 86 srd tests pass.
The converter also reads the SRD 5.2.1 PDF itself, for spell headers, stat-block headers and equipment. This is because the dataset's casting times and equipment text are wrong. Each dataset defect it repairs is recorded under provenance/source.json repairs. The orchestrator accepts this: the PDF is the CC-BY source of record.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phases 3 and 4 by sonnet-implementer: d534143 and a88ee53. 140 srd tests and 64 web tests pass. Compact forms stay at or under 120 estimated tokens; the medians are 48–105. The /about route and footer link have Brave screenshots in the scratchpad. No SRD data reaches the client bundle.
Recorded deviation: like Settings, the About link sits in the sidebar footer, which is hidden on narrow screens.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 5 by sonnet-implementer: 2276265. Every tasks.md box is ticked. 25/25 PDF spot-checks pass, and the license guards come back clean. The Phase 5 note says quickstart step 5's screenshot was not taken; that step was already done in Phase 4 (T038), whose Brave screenshots are in the scratchpad.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Wiki re-ground by sonnet-implementer: ebec1b0. New note srd-data. Seven notes were amended: dnd5e-engine (for 2c9f99e), ci-pipeline, monorepo-and-toolchain, test-suite, container-image, react-router-app and chat-ui. ddb-parser and runtime-stacks were re-pinned only. Freshness OK, 39 notes.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Merged in PR #45 on 2026-10-25. Card ACs #1–#7 are proven by specs/027-srd-data/ci-evidence.txt.

spec-bridge sync: Package scaffold, schemas, attribution, estimator (one dispatch): 15/15 · Provenance index and converted data — US4 then US1 (one dispatch): 10/10 · Loader and compact forms — US1 and US3 (one dispatch): 6/6 · About page — US2 (one dispatch): 8/8 · Close-out (one dispatch): 6/6 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Package scaffold, schemas, attribution, estimator (one dispatch): 15/15 · Provenance index and converted data — US4 then US1 (one dispatch): 10/10 · Loader and compact forms — US1 and US3 (one dispatch): 6/6 · About page — US2 (one dispatch): 8/8 · Close-out (one dispatch): 6/6). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
