---
title: Layer Boundaries
status: active
owner: docs
created: 2026-06-04
updated: 2026-06-05
tags:
  - wiki
  - architecture
  - roadmap
---

# Layer Boundaries

This page records the current split across ETL, retrieval, corpus, chat, and queue. It keeps each note narrow and the ownership lines clear.

## Layer map

- [[ETL Architecture]] covers source intake, parsing, chunking, and the staged handoff into later work.
- [[RAG Retrieval Architecture]] covers retrieval requests, ranking, and answer-time lookup rules.
- [[Corpus Management Architecture]] covers corpus selection, import, reset, and lifecycle rules.
- [[Chat Sessions Architecture]] covers user chat sessions, session state, and how retrieval plugs into chat.
- [[Queue Architecture]] stays a stub for future queue design.

## Current module seams

- `main/apps/api/app/ingestion.py` owns the live ETL control flow and the job-claim path.
- `main/apps/api/app/etl/runner.py` holds the direct sequential ETL runner used today.
- `main/apps/api/app/etl/load_services.py` owns the staged load services.
- `main/apps/api/app/retrieval_service.py` owns retrieval scope resolution, lookup, ranking, and trace persistence.
- `main/apps/api/app/corpus_seed.py`, `main/apps/api/app/corpus_reset.py`, and `main/apps/api/app/version_lifecycle.py` own corpus lifecycle behavior.
- `main/apps/api/app/chat_rag.py` and `main/apps/api/app/routes_sessions.py` own chat session orchestration and the answer boundary.
- `main/apps/api/app/routes_uploads.py` and `main/apps/api/app/models.py` carry the upload and job record shapes that the rest of the layers read.
- These seams mirror the code that already exists today, rather than a future idealized split.

## Ownership and non-ownership

### ETL

- Owns source dispatch, parsing, chunking, and the current staged ETL flow.
- Does not own retrieval policy, corpus lifecycle, or chat session behavior.

### RAG retrieval

- Owns answer-time retrieval behavior, trace persistence, and the rules for what can be searched.
- Does not own corpus import, source ingestion, chat session state, or queue lifecycle.

### Corpus management

- Owns corpus scope, imports, resets, and the rules for what counts as part of a corpus.
- Does not own query-time ranking or chat orchestration.

### Chat sessions

- Owns session state, chat persistence, and the chat-facing flow that consumes retrieval results.
- Does not own corpus imports or ETL staging rules.

### Queue

- Remains a future concern.
- Does not carry implementation detail in the wiki yet beyond the current DB-backed claim/status flow.
- A fuller brokered queue design stays deferred until the work actually needs it.

## Promotion path for operator harnesses

This page also sets the promotion policy for the embedding evaluation harness. The default path stays script-first, then a CLI wrapper only if the same operator action becomes routine, and `app/evals` only if a shared contract proves stable across multiple callers.

### Stay script-first when

- The harness is still a one-off or lightly repeated operator workflow.
- It needs direct access to runtime services, fixtures, or isolated collections without becoming request-serving code.
- The logic is mostly orchestration, setup, cleanup, and report formatting around existing ETL, retrieval, or indexing boundaries.
- The same behavior has not yet needed to be called from more than one place.

### Add a CLI wrapper when

- The same workflow is being run repeatedly by operators and needs a stable command surface.
- The command can stay thin and delegate to existing runtime services instead of absorbing business logic.
- The CLI improves repeatability, argument handling, or exit codes, but does not move ETL, retrieval, corpus, or chat ownership into the wrapper.
- The wrapper still treats the underlying runtime boundaries as the source of truth.

### Consider `app/evals` only when

- Multiple callers need the same core evaluation contract and the shared logic is stable enough to justify reuse.
- The shared code is no longer just orchestration glue and has become a real library boundary that more than one script or test depends on.
- Moving the shared core into `app/evals` would reduce duplication without pulling benchmark orchestration into request handlers or chat code.
- The package can stay outside runtime request-serving flows and still respect ETL, retrieval, and chat ownership lines.

### Promotion guardrails

- Do not promote just because a script exists. Promote when the same behavior is shared, stable, and worth naming.
- Do not promote benchmark orchestration into request-serving code.
- Do not let the eval harness own retrieval policy, corpus lifecycle, or chat session behavior.
- Keep ETL, retrieval, corpus, and chat responsibilities in their current layers, and let the harness call across those seams instead of redefining them.

## Dependencies

- RAG retrieval depends on corpus scope and chat context, but it still only searches eligible data.
- Chat depends on retrieval and session state, but not on corpus reset mechanics.
- Corpus management depends on the ETL output shape, but it does not control the ETL flow.
- Queue work should stay separate until a real queue task is ready, and the current implementation should be described as claim/status handling, not a standalone queue system.
- Keep the wiki aligned to these concrete module seams so the next plan starts from reality instead of the roadmap draft.

## Roadmap follow-up

- The next implementation plan after ETL is `rag-retrieval-api-operations`.
- That plan should use this boundary map as the contract for retrieval, corpus, chat, and queue ownership.
- Queue remains a placeholder until a dedicated queue design plan is justified.
- The embedding evaluation harness should follow the promotion path above, staying script-first until a thin CLI wrapper is clearly useful, and only then considering `app/evals` if a stable multi-caller contract emerges.

## Related notes

- [[ETL Architecture]]
- [[ETL Plugin Contracts]]
- [[LangGraph ETL Decision]]
- [[RAG Retrieval Architecture]]
- [[Corpus Management Architecture]]
- [[Chat Sessions Architecture]]
- [[Queue Architecture]]
