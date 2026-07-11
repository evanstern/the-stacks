---
id: TASK-9
title: Retrieval & Evaluation Harness
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-11 04:55'
labels: []
dependencies: []
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Query-side hybrid retrieval over the ingested corpus (text + semantic signals fused, optional sidecar reranking) with append-only, URL-addressable retrieval-run receipts, operator-authored gold sets (tuning/held-out split), and the D11 evaluation harness: pinned recall@k/MRR/nDCG, deterministic per-PR CI slice, eval-justified configuration defaults. No chat in this cycle — Quick Ask/Conversations consume this engine later.

Spec: specs/010-retrieval-eval-harness
<!-- SECTION:DESCRIPTION:END -->
