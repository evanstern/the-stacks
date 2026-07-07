# 02 — V2 Inventory: What Exists, What Carries Forward

v2 is a working system: React Router 7 SPA (Vite, nginx in prod) + FastAPI (Python) +
polling worker + Postgres + Qdrant + OpenAI, all on Docker Compose. This doc records what
it contains and the port/adapt/drop verdict for each piece, so specs don't rediscover it.

## Subsystem verdicts

| v2 subsystem | Where it lives (v2) | v3 verdict |
|---|---|---|
| Upload intake seam (batch/ZIP handling, public-safe per-file statuses, size caps) | `apps/api/app/upload_intake_service.py`, spec 004 | **Port the design** — recent, well-specified boundary; re-express in TS |
| Postgres job queue (`FOR UPDATE SKIP LOCKED`, status pipeline, event log) | `apps/api/app/ingestion.py`, spec 001 | **Port the pattern** — proven; stays a Postgres table, no broker |
| ETL plugin contract (`etl.contracts.v1`: Source/Extractor/Transformer protocols, registry, normalized document model, failure categories) | `apps/api/app/etl/` | **Adapt & promote** — becomes the primary pipeline in TS; kill the legacy-parser adapter (doc 05) |
| D&D Beyond saved-HTML import (detection, statblock/article parsing, sanitization, artifact archives) | `apps/api/app/ddb_import.py` (~760 lines) | **Port the knowledge** — the parsing rules and selectors are hard-won domain knowledge; reimplement as the flagship v3 ingester |
| Chunking (1200 chars / 160 overlap, seam-aware cuts, rich per-chunk metadata: sha256, offsets, section path, token estimate) | `apps/api/app/ingestion.py` | **Port as the baseline** — but chunking becomes an eval variable, not a constant (doc 06) |
| Embedding provider seam (OpenAI + HuggingFace/sentence-transformers, env-selected) | `apps/api/app/embeddings.py` | **Adapt** — API providers move to the TS core; local models move to the Python ML sidecar (D2) |
| Qdrant indexing (deterministic UUIDv5 point IDs, batched upserts, dim guards) | `apps/api/app/qdrant_index.py` | **Drop Qdrant, keep the invariants** — deterministic IDs and idempotent upserts carry to pgvector (D5) |
| Retrieval service (overfetch ~10×, min-score filter, dedupe, top-k, full `RetrievalTrace` audit with rejection tallies, weak-result reasons) | `apps/api/app/retrieval_service.py` | **Port the design** — the trace/audit model is a differentiator; extend for hybrid retrieval |
| Strict cited answering (JSON answer+citations contract, per-sentence markers, citation validation/repair, no-evidence short-circuit) | `apps/api/app/chat_session_rag.py`, `chat_citations.py`, `chat_session_service.py` | **Port** — this is the product's soul; becomes "Quick Ask" mode plus the validation layer for conversations |
| Chat sessions (persisted sessions/messages; LangGraph wired but graph is a single generate node; history never fed back) | `routes_sessions.py`, `chat_session_service.py` | **Replace** — v3 conversations are genuinely multi-turn; LangGraph is dropped in favor of the AI SDK tool loop (D10) |
| Runtime-version lifecycle (per-version DB + collection + storage namespaces, activation pointer, manifest lock/verify ritual, dry-run teardown with typed refusals) | `apps/api/app/version_lifecycle.py`, `corpus_*.py` | **Simplify** (D4) — keep immutable content-hashed archives, re-ingestable corpora, dry-run/confirm/refuse-active guardrails; drop per-version databases and blue-green activation |
| Corpus CLI (preflight / lock / seed / verify / reset / doctor) | `apps/api/app/cli/corpus_seed.py`, Makefile | **Adapt** — same verbs against the simplified corpus model |
| Records screen (Overview / Uploads / Jobs / Sources / Retrieval / Chunks, cross-linked, URL-addressable state) | `apps/web/app/routes/records*` | **Port the concept** — rebuild in RR7 SSR; extend with conversation/tool-use records |
| Archive viewer (sandboxed iframe citation deep-links, `sandbox=""`) | `routes_archives.py`, chat route | **Port** — the trust-nothing display posture is non-negotiable |
| Auth (single-operator, signed HTTP-only cookie sessions, 401 → login) | `apps/api` auth modules, `apps/web/app/lib/auth.ts` | **Port the model** — re-implement in the TS server; still single-operator |
| Embedding eval harness (gold fixtures, deterministic/openai/huggingface providers, stable JSON reports) | `scripts/eval_embeddings.py`, fixtures | **Adapt & grow** — seed corpus for the v3 eval program (doc 06) |
| Error doctrine (exceptions typed by cause, mapped at the boundary: 404/415/503/500; scrubbed user copy) | spec 005, `routes_sessions.py` | **Port the convention** — re-express as the TS server's error-mapping convention |
| Wiki + spec packages (docs/wiki architecture notes, specs 001–006) | `docs/`, `specs/` | **Keep in place** — historical grounding; v3 specs live alongside |

## What v2 does NOT have (confirmed by inspection)

- No conversational memory: prior turns are stored but never included in generation.
- No LLM provider abstraction for chat: OpenAI is hardcoded (embeddings are pluggable; chat is not).
- No tool use of any kind.
- No hybrid retrieval, no full-text search, no reranker — dense vectors only.
- No PDF parsing (deliberate).
- No SSR: the web app is a client-side SPA behind nginx.
- No streaming responses: answers arrive as one payload (the UI's progress theater is local).
- No worktree automation: the operating model is documented but manual.
- The term "vault" (from the course) maps to nothing; the real concepts are
  `ImmutableSourceArchive` (content-addressed storage) and per-version namespaces.

## Lessons encoded in v2 worth stating out loud

- **The plugin seam arrived late and had to bridge legacy code.** v3 starts with plugins as
  the only path so there is never a "legacy parser adapter" again.
- **Provider pluggability was retrofitted on one side only.** v3 treats "which model, from
  where" as a first-class configuration axis for every model role (chat, embedding, judge,
  reranker) from day one.
- **The audit trails paid off repeatedly** (the course's entire Module 6 is a tour of them).
  v3 extends the same discipline to conversations and tool calls: every tool invocation is
  a recorded, inspectable event.
- **Simplification has precedent:** the queue-as-table decision was called a "stub" and
  turned out to be enough. The versioning machinery went the other way — built big, used
  narrowly. D4 is the correction.
