# API architecture review

Date: 2026-06-06

Scope: `apps/api/app`, `apps/api/tests`, and API-relevant wiki decisions under `docs/wiki`.

This review is read-only. It does not change routes, schemas, migrations, frontend code, worker behavior, or runtime API behavior. Any recommendation that needs code should become a separate bounded Spec Kit feature or OMO plan.

## Evidence inventory

Wiki pages read:

- `docs/wiki/Home.md`
- `docs/wiki/Layer Boundaries.md`
- `docs/wiki/ETL Architecture.md`
- `docs/wiki/ETL Plugin Contracts.md`
- `docs/wiki/LangGraph ETL Decision.md`
- `docs/wiki/RAG Retrieval Architecture.md`
- `docs/wiki/Corpus Management Architecture.md`
- `docs/wiki/Chat Sessions Architecture.md`
- `docs/wiki/Queue Architecture.md`

API modules inspected:

- `apps/api/app/main.py`
- `apps/api/app/routes_auth.py`
- `apps/api/app/routes_sessions.py`
- `apps/api/app/routes_uploads.py`
- `apps/api/app/routes_ingestion.py`
- `apps/api/app/routes_records.py`
- `apps/api/app/routes_archives.py`
- `apps/api/app/schemas.py`
- `apps/api/app/models.py`
- `apps/api/app/auth.py`
- `apps/api/app/chat_session_service.py`
- `apps/api/app/chat_rag.py`
- `apps/api/app/chat_citations.py`
- `apps/api/app/retrieval_service.py`
- `apps/api/app/ingestion.py`
- `apps/api/app/corpus_seed.py`
- `apps/api/app/corpus_reset.py`
- `apps/api/app/corpus_manifest.py`
- `apps/api/app/version_lifecycle.py`
- `apps/api/app/embeddings.py`
- `apps/api/app/qdrant_index.py`
- `apps/api/app/etl/contracts.py`
- `apps/api/app/etl/runner.py`
- `apps/api/app/etl/load_services.py`
- `apps/api/app/etl/bundled.py`
- `apps/api/app/etl/ingestion_compat.py`

Test evidence inspected:

- `apps/api/tests/test_auth.py`
- `apps/api/tests/test_sessions.py`
- `apps/api/tests/test_contracts.py`
- `apps/api/tests/test_uploads.py`
- `apps/api/tests/test_worker_jobs.py`
- `apps/api/tests/test_chat_rag.py`
- `apps/api/tests/test_retrieval_service.py`
- `apps/api/tests/test_citations.py`
- `apps/api/tests/test_no_evidence.py`
- `apps/api/tests/test_qdrant_indexing.py`
- `apps/api/tests/test_version_lifecycle.py`
- `apps/api/tests/test_corpus_seed_reset.py`

## Wiki direction summary

`docs/wiki/Home.md` points readers to the current architecture spine: layer boundaries first, then ETL, retrieval, corpus, chat, and queue notes. It also says the retrieval/API operations plan is complete and the corpus contract should be treated as current state.

`docs/wiki/Layer Boundaries.md` is the strongest contract for this review. It names concrete module seams: `ingestion.py` owns live ETL control flow and job claiming, `etl/runner.py` owns host orchestration, `etl/load_services.py` owns staged load services, `retrieval_service.py` owns retrieval scope/lookup/ranking/trace persistence, `version_lifecycle.py` owns runtime namespace lifecycle, and the chat session modules own the answer boundary. It also says the queue page should stay aligned to the DB-backed claim/status reality rather than a brokered queue design.

The ETL pages keep upload intake separate from ETL execution. `routes_uploads.py` owns upload validation and job creation; plugins stop at normalized documents and loader intents; chunking, embedding, and Qdrant indexing stay host-owned. The LangGraph ETL decision explicitly keeps LangGraph out of ETL for now.

The retrieval page says `RetrievalService` owns answer-time retrieval, including active runtime scope resolution, query embedding, Qdrant lookup, score filtering, deduplication, trace metadata, hit persistence, citation metadata, and weak-result reporting. It does not own chat state or UI presentation.

The corpus page says the current contract is `default-corpus` only. Runtime versions provide storage and execution namespaces, while the active pointer selects the live version. The page is explicit that there is no generalized multi-corpus selector in the current release.

The chat sessions page says `routes_sessions.py` is a thin HTTP boundary and `chat_session_service.py` owns chat-turn orchestration. The compatibility facade in `chat_rag.py` remains part of the answer-generation edge.

The queue page is deliberately modest. The current system is a DB-backed claim/status flow, not a standalone queue subsystem.

## API surface map

`apps/api/app/main.py` is the composition root. It configures CORS, includes routers for auth, archives, ingestion, records, sessions, and uploads, and exposes `GET /health`.

| Area | Module | HTTP surface | Notes |
| --- | --- | --- | --- |
| Auth | `apps/api/app/routes_auth.py` | `/auth/login`, `/auth/logout`, `/auth/me` | Uses `get_db`, `get_settings`, and `current_admin_session`; returns `AuthStatus`. |
| Sessions/chat | `apps/api/app/routes_sessions.py` | `/sessions`, `/sessions/latest`, `/sessions/{id}`, `/sessions/{id}/messages` | Thin HTTP boundary over chat service dependencies, retrieval service dependency, and safe error mapping. |
| Uploads | `apps/api/app/routes_uploads.py` | `/uploads`, `/uploads/batches/{id}` | Validates file types, batch limits, nested zip bundles, archive storage, upload/job creation, and safe child errors. |
| Ingestion jobs | `apps/api/app/routes_ingestion.py` | `/jobs/{id}`, `/jobs/{id}/events`, legacy `/ingestion/jobs/*` aliases | Read-only job and event surface. It also sanitizes public job metadata. |
| Records | `apps/api/app/routes_records.py` | `/records/*` | Operator-facing records and observability for uploads, jobs, sources, chunks, retrieval runs, and stats. |
| Archives | `apps/api/app/routes_archives.py` | `/records/sources/{source_id}/archive/...` | Archive viewer/assets API. It checks archived source metadata and maps validation failures to 400/404 responses. |

The route layer consistently uses FastAPI dependencies for shared infrastructure: `current_admin_session`, `get_db`, `get_settings`, and route-specific factories for embeddings, Qdrant, chat, graph, and retrieval. Response models are declared through `response_model` on the major HTTP surfaces, and schemas live in `apps/api/app/schemas.py`.

## Service and pattern map

The API mostly follows a thin-router pattern. Route modules own HTTP mechanics: request parsing, dependency assembly, status codes, public error shapes, and response model conversion. Domain work is pushed into service or host modules.

Important service seams:

- `chat_session_service.py` owns chat-turn persistence, retrieval-run lifecycle, retrieval calls, graph invocation, citation validation/repair handoff, assistant message persistence, and envelope reads.
- `chat_rag.py` is still the compatibility facade and LangGraph boundary. That matches the wiki, but it is a transitional shape worth keeping visible.
- `retrieval_service.py` owns retrieval scope, lookup, ranking, filtering, trace metadata, hit persistence, and citation metadata shaping.
- `ingestion.py` owns live ETL control flow, job claim/status transitions, host chunking, embedding/indexing, and safe failure metadata.
- `etl/runner.py`, `etl/contracts.py`, `etl/load_services.py`, and `etl/bundled.py` define the host/plugin split for parsing and staged loading.
- `version_lifecycle.py`, `corpus_seed.py`, `corpus_reset.py`, and `corpus_manifest.py` own corpus/runtime lifecycle outside the request/response surface.

FastAPI-native practices are generally used well. `APIRouter` groups each API area, dependencies express shared concerns, response models define public shapes, and tests use `app.dependency_overrides` heavily. The main weak spot is consistency: some route modules are very thin (`routes_sessions.py` delegates complex behavior), while `routes_uploads.py` carries substantial upload/archive helper logic inside the route module. That may be intentional because upload validation is an HTTP-edge responsibility, but the boundary deserves a follow-up decision.

## Findings

| ID | category: | severity: | Finding | evidence | affected | impact | Suggested next step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | alignment | high | The API layer is mostly thin at the HTTP boundary and delegates durable behavior to service modules. | `docs/wiki/Layer Boundaries.md`, `docs/wiki/Chat Sessions Architecture.md`, `apps/api/app/main.py`, `apps/api/app/routes_sessions.py`, `apps/api/app/chat_session_service.py`, `apps/api/app/retrieval_service.py` | Session/chat/retrieval API seams | Maintainers can reason about HTTP behavior separately from retrieval and chat orchestration. | Preserve this split in future route work. |
| F2 | alignment | high | Retrieval is scope-aware and tied to the active runtime context, matching the corpus/retrieval wiki contract. | `docs/wiki/RAG Retrieval Architecture.md`, `docs/wiki/Corpus Management Architecture.md`, `apps/api/app/retrieval_service.py`, `apps/api/tests/test_retrieval_service.py`, `apps/api/tests/test_chat_rag.py` | Retrieval service, chat answer path, runtime version pointer | Reduces stale or cross-corpus answer risk under the current default-corpus contract. | Keep future multi-corpus work behind a separate selector contract. |
| F3 | alignment | medium | Public API contracts are explicit through Pydantic schemas and route `response_model` declarations. | `apps/api/app/routes_auth.py`, `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_ingestion.py`, `apps/api/app/schemas.py`, `apps/api/tests/test_contracts.py` | Auth, sessions, uploads, jobs, records | Limits accidental exposure of internal model fields. | Continue adding contract tests when response shapes change. |
| F4 | risk | medium | Upload intake has many route-local helpers and storage/job creation logic in `routes_uploads.py`. | `apps/api/app/routes_uploads.py`, `docs/wiki/ETL Architecture.md`, `apps/api/tests/test_uploads.py` | Upload route, archive storage handoff, ingestion job creation | The module is doing both HTTP-edge validation and some orchestration, which makes future changes harder to classify. | Decide whether upload orchestration deserves a small service seam before adding more upload behavior. |
| F5 | inconsistency | medium | Error mapping is safe in important places, but the policy is distributed across route modules and services rather than documented as an API convention. | `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_ingestion.py`, `apps/api/app/ingestion.py`, `apps/api/tests/test_uploads.py` | Session message errors, upload/archive validation, ingestion failure metadata | New endpoints may copy local patterns without knowing the intended public error envelope. | Add an API error-mapping convention note or contract section before broad route growth. |
| F6 | risk | medium | `chat_rag.py` remains a compatibility facade while `chat_session_service.py` owns the real orchestration. The wiki documents this, but the split can confuse future reviewers. | `docs/wiki/Chat Sessions Architecture.md`, `apps/api/app/chat_rag.py`, `apps/api/app/chat_session_service.py`, `apps/api/tests/test_chat_rag.py` | Chat answer boundary | Follow-up work could accidentally add new orchestration to the facade. | Keep facade responsibilities explicit or plan a later rename/deprecation pass. |
| F7 | alignment | medium | Test seams are strong: API tests use dependency overrides for DB, settings, retrieval, embeddings, Qdrant, chat, and graph collaborators. | `apps/api/tests/test_auth.py`, `apps/api/tests/test_sessions.py`, `apps/api/tests/test_contracts.py`, `apps/api/tests/test_chat_rag.py`, `apps/api/tests/test_worker_jobs.py`, `apps/api/tests/test_uploads.py` | Route tests and service tests | Route and service behavior can be tested without real external services in most paths. | Keep new external collaborators behind dependencies. |
| F8 | improvement | low | There is no single API architecture wiki page. The current direction is reconstructed from layer-specific pages plus code. | `docs/wiki/Home.md`, `docs/wiki/Layer Boundaries.md`, this review | Wiki navigation and future planning | Future API reviews require reassembling the same context. | Link this review or a distilled API boundary note from the wiki if the direction settles. |
| F9 | risk | low | Records and archive routes are support surfaces, but their architectural ownership is less explicit than chat/retrieval/corpus. | `apps/api/app/routes_records.py`, `apps/api/app/routes_archives.py`, `docs/wiki/Layer Boundaries.md` | Operator records, archive viewer/API | These routes may accumulate mixed observability, repair, and viewer responsibilities. | Add ownership notes if records/archive behavior expands. |
| F10 | alignment | low | The queue story is correctly bounded as DB-backed claim/status behavior rather than a brokered queue architecture. | `docs/wiki/Queue Architecture.md`, `docs/wiki/Layer Boundaries.md`, `apps/api/app/ingestion.py`, `specs/001-live-db-backed-queue/plan.md` | Ingestion jobs and queue documentation | Avoids overbuilding around queue abstractions that do not exist yet. | Keep queue follow-up in `001-live-db-backed-queue` or a separate feature. |

## Recommendations

| ID | priority | follow-up type: | Recommendation | expected benefit | risk if deferred | verification anchor | wiki-impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | P1 | documentation | Add or link an API boundary note that summarizes route ownership, service seams, error mapping, and test seams. | Gives future planners one API entry point instead of reconstructing from every layer page. | Review cost stays high and new route work may miss existing conventions. | Confirm the note cites this review and `docs/wiki/Layer Boundaries.md`. | Update `docs/wiki/Home.md` if the note becomes durable. |
| R2 | P1 | future feature | Create a bounded upload orchestration review before adding more upload/archive intake behavior. | Clarifies what belongs in `routes_uploads.py` versus a service seam. | Route-local helper sprawl continues. | Compare `routes_uploads.py` responsibilities to `docs/wiki/ETL Architecture.md`. | Likely update ETL or API boundary docs if ownership changes. |
| R3 | P1 | documentation | Document public API error-mapping conventions for 400/401/404/413/415/500-safe failures. | Makes safe error behavior easier to apply consistently. | New endpoints may leak internal details or invent inconsistent envelopes. | Check route modules and upload/chat tests for matching examples. | Add to API boundary note or relevant wiki pages. |
| R4 | P2 | refactor | Plan a later chat facade cleanup or naming decision for `chat_rag.py` and `chat_session_service.py`. | Reduces confusion around the answer boundary. | New logic may land in the compatibility facade. | Check imports and tests around `answer_session_message`. | Update `Chat Sessions Architecture.md` if responsibilities change. |
| R5 | P2 | contract/schema | Add a response-contract review checklist for new route changes. | Keeps internal ORM and metadata fields from leaking into API responses. | Schema drift may appear slowly across records, uploads, and archive routes. | Use `apps/api/tests/test_contracts.py` as the first verification anchor. | No wiki update needed unless public contracts change. |
| R6 | P2 | test coverage | Add targeted tests when records/archive ownership expands. | Keeps support surfaces from silently mixing concerns. | Records/archive routes may become hard to refactor safely. | Add focused tests under `apps/api/tests/test_uploads.py` or a future records/archive test file. | Update wiki only if route ownership changes. |
| R7 | P3 | documentation | Keep the queue scope separate from API architecture planning. | Prevents queue roadmap assumptions from bleeding into ingestion status endpoints. | Future tasks may overstate queue behavior. | Compare against `docs/wiki/Queue Architecture.md` and `specs/001-live-db-backed-queue/plan.md`. | No update needed unless queue design changes. |

## Recommendation backlog by type

Documentation:

- R1: API boundary note or wiki link.
- R3: Public API error-mapping convention.
- R7: Queue scope guardrail.

Refactor:

- R4: Chat facade cleanup or naming decision.

Contract/schema:

- R5: Response-contract review checklist.

Test coverage:

- R6: Records/archive ownership coverage if those surfaces expand.

Future feature:

- R2: Upload orchestration review.

## Non-goals and deferred work

This review does not recommend immediate runtime API changes. It also does not add a migration, new endpoint, frontend behavior, worker behavior, or queue abstraction.

Deferred work:

- Multi-corpus runtime selection. The current contract is `default-corpus` only.
- Brokered queue design. Current behavior is DB-backed claim/status.
- Frontend changes that consume these APIs.
- Upload orchestration refactoring until a bounded follow-up plan exists.
- Chat facade cleanup until a separate task can preserve existing tests.

## Wiki-impact decision

No durable wiki page was updated in this implementation because this pass produced a Spec Kit review artifact, not a settled architecture change. If the recommendations are accepted, R1 should create or link a durable API boundary note from `docs/wiki/Home.md`.

## Verification evidence

Validation evidence is recorded in `specs/002-api-architecture-review/evidence.md`. The final checks confirmed that checklist tasks are complete, required report sections exist, findings and recommendations contain the required fields, placeholder scans are clean, and changes remain artifact-only under `specs/002-api-architecture-review` plus the earlier Spec Kit metadata/context updates.
