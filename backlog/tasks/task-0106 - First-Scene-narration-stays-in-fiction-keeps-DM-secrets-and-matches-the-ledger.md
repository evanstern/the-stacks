---
id: TASK-0106
title: >-
  First Scene: narration stays in fiction, keeps DM secrets and matches the
  ledger
status: To Do
assignee: []
created_date: '2026-10-26 17:50'
labels:
  - first-scene
  - dm
  - ai
milestone: m-2
dependencies: []
priority: high
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: with real models, DM narration and companion speech pass the runtime audit at a normal rate, stay in fiction, never reveal DM-only facts, and never contradict the ledger. When the factual fallback does ship, it is in-fiction prose that covers every state change in the turn.

Why: TASK-0048's paid scripted playtest run 5 (20261026T171359Z-greyhollow-ford-provider, docs/design/m2-demo/provider-playtest-stalled-5/) had no failed job but 13 audit fails:
- The in-runtime dm.audit rejected narration until the factual fallback shipped in 23 of about 39 narrated turns, from the first turn. 9 more passed only after regenerating.
- The fallback text (apps/server/src/dm/fallback.ts) says 'X acts, and nothing changes. One action needs a clearer description.' It is out of fiction and contradicts state changes it does not cover (F23: an encounter ended).
- 6 hidden-info-leak fails, mostly companion Odo stating the DM-only motive (the bell wards off the river-things). Suspect: the companion and narrate prompts receive DM-only seed facts.
- 5 ledger contradictions, including a wrong actor name (F76) and a melee jab narrated as a thrown dagger (F17).
The M2 demo criterion 'the narration never contradicts the ledger' would fail. Carded by operator ruling 2026-10-26: own spec and PR, merged before the live demo (TASK-0048 Phase 6). It fixes code from TASK-0046 (specs/031-dm-runtime).

Approach: diagnose from run 5's evidence first (the dm.audit issue mix per rejected attempt, and which prompt carries which DM-only fact), then fix prompts, context filtering and the fallback, whichever the evidence shows. The engine still owns every number. Verify with an operator-approved paid provider run. The scripted seat's repeated fallback move is fixed on the TASK-0048 branch, not here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Companion and narrate prompts receive no DM-only seed fact, proven by a test over the assembled prompts for the Greyhollow Ford seed
- [ ] #2 The factual fallback is in-fiction prose with no system commentary, and it states every ledger change in the turn (including encounter start and end and table-mode changes), with tests
- [ ] #3 The causes of run 5's dm.audit rejections are classified from evidence, and each selected cause has a fix with a test
- [ ] #4 A paid provider playtest under an operator-approved ceiling shows the factual fallback in at most 10% of narrated turns, with zero hidden-info-leak and zero ledger-contradiction fails in its audit
- [ ] #5 Existing dm tests and the scripted CI playtest stay green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
