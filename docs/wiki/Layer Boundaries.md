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

This page records the current roadmap split. It keeps the work separated by layer so each page can stay narrow and the next agent can pick up the right thread.

## Layer map

- [[ETL Architecture]] covers source intake, parsing, chunking, and the staged handoff into later work.
- [[RAG Retrieval Architecture]] covers retrieval requests, ranking, and answer-time lookup rules.
- [[Corpus Management Architecture]] covers corpus selection, import, reset, and lifecycle rules.
- [[Chat Sessions Architecture]] covers user chat sessions, session state, and how retrieval plugs into chat.
- [[Queue Architecture]] is reserved for future queue design and stays a stub for now.

## Ownership and non-ownership

### ETL

- Owns source dispatch, parsing, chunking, and the current staged ETL flow.
- Does not own retrieval policy, corpus lifecycle, or chat session behavior.

### RAG retrieval

- Owns answer-time retrieval behavior and the rules for what can be searched.
- Does not own corpus import, source ingestion, or queue lifecycle.

### Corpus management

- Owns corpus scope, imports, resets, and the rules for what counts as part of a corpus.
- Does not own query-time ranking or chat orchestration.

### Chat sessions

- Owns session state and the chat-facing flow that consumes retrieval results.
- Does not own corpus imports or ETL staging rules.

### Queue

- Remains a future concern.
- Does not carry implementation detail in the wiki yet.

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

- RAG retrieval depends on corpus scope. Indexed data is not automatically eligible for every retrieval call.
- Chat depends on retrieval and session state, but not on corpus reset mechanics.
- Corpus management depends on the ETL output shape, but it does not control the ETL flow.
- Queue work should stay separate until a real queue task is ready.

## Open questions

- Which retrieval filters are hard requirements versus optional hints.
- How much corpus scope metadata needs to travel with a chat session.
- Whether queue work lands before or after chat session refinements.

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
