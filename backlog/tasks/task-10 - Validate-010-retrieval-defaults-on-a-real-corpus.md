---
id: TASK-10
title: Validate 010 retrieval defaults on a real corpus
status: To Do
assignee: []
created_date: '2026-07-12 02:04'
labels:
  - evals
dependencies: []
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 010 eval report (docs/eval-reports/010-retrieval-baseline.md) justifies RRF-default on the fixture gold set only. Standing follow-up: build a >=30-item gold set over the operator's real corpus (/evals/gold), re-run rrf-default vs weighted-a05, AND measure rerank on/off once RERANKER_MODEL_ID is configured (SC-006) — then update or supersede the report.
<!-- SECTION:DESCRIPTION:END -->
