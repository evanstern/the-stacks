---
id: TASK-10
title: Validate 010 retrieval defaults on a real corpus
status: In Progress
assignee: []
created_date: '2026-07-12 02:04'
updated_date: '2026-07-12 03:09'
labels:
  - evals
dependencies: []
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 010 eval report (docs/eval-reports/010-retrieval-baseline.md) justifies RRF-default on the fixture gold set only. Standing follow-up: build a >=30-item gold set over the operator's real corpus (/evals/gold), re-run rrf-default vs weighted-a05, AND measure rerank on/off once RERANKER_MODEL_ID is configured (SC-006). FIRST QUESTION (observed live in the 010 walkthrough): is RETRIEVAL_MIN_SIMILARITY=0.3 too high for natural-question phrasing against real embeddings? 'how does a riposte work' missed under the floor + FTS AND semantics while 'riposte' hit — tune the floor with data, then update or supersede the report.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Real-corpus validation done (eval report 2026-07-12, run ids recorded). Corpus: real saved DDB 'Monsters (G)' (36 chunks) + Emberfall homebrew (1 chunk); 41-item gold set (31 tuning/10 heldout). Findings: (1) RRF == weighted-a05 on real data — RRF stays default. (2) FIRST QUESTION answered: floor 0.3 WAS too high — it dropped exactly the buried-topic riposte natural-questions (cosine ~0.21 < 0.3); floor 0.2 recovers them (tuning recall@5 0.94->1.0, MRR 0.87->0.90) while 0.0 regresses MRR. Default lowered 0.3->0.2 (config.ts/.env.example/api.md); fixture CI floor pinned at 0.3 explicitly (constructed geometry). Two engine bugs found+fixed while validating: ddb-saved-html detect missed real >64KiB-preamble saved pages; worker never called complete() so jobs re-ran forever. OPEN: SC-006 rerank on/off still unmeasured — needs a configured RERANKER_MODEL_ID/cross-encoder role.
<!-- SECTION:NOTES:END -->
