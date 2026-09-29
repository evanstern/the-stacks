---
id: TASK-0035
title: 'Gateway: accept sub-1024 embedding models by padding to the schema width'
status: To Do
assignee: []
created_date: '2026-09-29 21:44'
labels:
  - ai
  - bench
dependencies: []
priority: low
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-09-29 by TASK-0029's real benchmark run. The AI gateway rejects any embedding whose length is not 1024 (apps/server/src/ai/gateway.ts EMBED_DIM check), and Ollama ignores the OpenAI 'dimensions' request field, so a 768-dim model such as nomic-embed-text cannot be benchmarked or used. decision-0002 fixes the column at 1024; the benchmark already stores sub-1024 vectors by renormalising and zero-padding with a '<model>@<dim>' name. Decide whether the gateway should do the same for native sub-1024 models, or keep rejecting them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded: pad sub-1024 vectors in the gateway, or keep rejecting them
- [ ] #2 If padding: a 768-dim provider embeds through the gateway, rows store the true dim and a distinguishable model name, and retrieval filters by that name
- [ ] #3 The TASK-0029 local matrix runs nomic-embed-text end to end and its results are committed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
