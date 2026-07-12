---
id: TASK-11
title: Measure rerank on/off on the real corpus (SC-006)
status: To Do
assignee: []
created_date: '2026-07-12 03:14'
labels:
  - evals
dependencies: []
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-10 left this open: RERANKER_PROVIDER/RERANKER_MODEL_ID are empty (role disabled), so rerank on-vs-off was never measured on the real corpus. Configure a cross-encoder reranker role served by the ml sidecar, then re-run the 010 gold set with RETRIEVAL_RERANK=off vs on (RETRIEVAL_RERANK_DEPTH sweep) and record the latency-vs-quality tradeoff in the eval report. Gold set + real corpus already exist in the 010 worktree DB.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reranker role configured and /ready reports it live
- [ ] #2 rerank off vs on measured on the >=30-item real gold set, per-slice
- [ ] #3 eval report updated with the rerank tradeoff and a ship/no-ship call
<!-- AC:END -->
