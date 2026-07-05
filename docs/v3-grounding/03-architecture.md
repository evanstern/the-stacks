# 03 — V3 Architecture Direction

Decisions referenced as D-numbers are recorded in doc 08.

## Stack (decided)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **React Router 7, framework mode (SSR)** + Tailwind + shadcn/ui | Not a SPA (D6). Node server renders; streaming UI for chat |
| API server | **Fastify** (TypeScript) | Dealer's-choice pick (D3): TS-first, schema-driven validation that doubles as OpenAPI, plugin architecture mirrors how we want to structure the app, and none of NestJS's ceremony is needed at this size |
| Worker | TypeScript, same monorepo, shares domain packages with the API | Polling loop over the Postgres queue, as in v2 |
| ML sidecar | **Python (FastAPI or equivalent), internal-only** | Hosts local/HuggingFace models: embeddings via sentence-transformers, cross-encoder rerankers, anything GPU-ish. Small, stable, boring HTTP contract (D2) |
| Database | **PostgreSQL with pgvector** | One store for relational data, vectors, and full-text search (D5). Qdrant is retired |
| LLM layer | **Vercel AI SDK** | Provider abstraction, tool-call loop, streaming (D10). Providers: Anthropic, OpenAI, and any OpenAI-compatible endpoint (Ollama) |
| Repo layout | TypeScript monorepo (pnpm workspaces) with shared packages for domain types, DB schema, and the ingestion plugin contract | Exact layout is a spec-level decision |

## Service topology

Five compose services, mirroring v2's shape with the roles re-cast:

1. **web** — RR7 SSR server. Talks only to the API server.
2. **api** — Fastify. Owns auth, chat (both modes), retrieval, records, upload intake,
   corpus lifecycle. Calls model providers via the AI SDK; calls the ML sidecar for local
   embeddings/reranking.
3. **worker** — runs ingestion jobs from the Postgres queue. Same TS codebase as the API
   (shared packages), separate process — v2's arrangement, which worked.
4. **ml** — Python sidecar. Stateless inference over HTTP; no direct DB access. The only
   Python in the system, and only because local-model inference in Node is not yet mature.
5. **postgres** — with pgvector. The queue, the records, the vectors, the full-text index,
   the conversations.

External: model provider APIs (Anthropic/OpenAI) and/or a self-hosted Ollama endpoint,
which may run on the host or as an optional compose profile.

`docker compose up` brings up the full system (design constraint). Prod compose variant
follows v2's pattern: internal-only databases, one published web port, env-pinned models.

## Where the TS/Python line sits (D2)

TypeScript owns everything that is *orchestration, contract, or product logic*: the API,
the queue, the ingestion pipeline and its plugin contract, chunking, retrieval, chat,
citation validation, corpus lifecycle. Python owns only *model inference that has no
first-class TS equivalent*. The test for adding anything to the sidecar: "is this here
because of the Python ML ecosystem, or because it was easier to write here?" Only the
first is allowed.

This keeps constraint 3 (unify on TypeScript) honest while acknowledging that
sentence-transformers, cross-encoders, and future local-model work live in Python.

## Model configuration doctrine (constraint 6)

Every model role in the system — conversation model, quick-ask model, embedding model,
judge model, reranker — is addressed by a named configuration that specifies: provider
kind (anthropic / openai / openai-compatible / local-sidecar), endpoint, model id, API key
reference, and role-specific parameters (dimensions, temperature, etc.). Configurations
come from env by default; conversations can select among configured chat models in the UI.
No model identifier is ever hardcoded in product code. API keys live in env/secret stores,
never in the database or client.

## Data & durability doctrine

- Vectors carry deterministic IDs derived from chunk identity (v2 invariant, ported), so
  re-indexing is idempotent.
- Source archives remain immutable and content-addressed (sha256), the surviving half of
  v2's versioning subsystem (D4).
- Corpus mutation verbs (seed, reset, re-embed) are dry-run-first with explicit
  confirmation and refuse to run against a corpus in active use without acknowledgement.
- Embedding-model identity (provider, model, dimensions) is stamped on every index so a
  model change can never silently mix vector spaces; changing the embedding model is a
  deliberate re-embed operation, not a config flip.

## Error & observability doctrine (ported from v2, extended)

- Errors are typed by cause in domain code and translated to transport codes only at the
  API boundary (404 unknown thing / 415 unsupported type / 503 dependency down /
  500 our bug). User-visible copy is scrubbed; full diagnostics go to operator-side records.
- Append-only event trails for: ingestion jobs, retrieval runs (with rejection tallies and
  weak-result reasons), corpus lifecycle actions, **and — new in v3 — conversation turns and
  every tool invocation** (tool name, inputs summary, outcome, duration).
- The Records surface is rebuilt in the new frontend and extended with conversation and
  tool-use inspection. URL-addressable state is preserved.

## Streaming (new expectation)

v2 returned answers as a single payload. v3 conversations stream tokens and tool-use
progress to the UI (the AI SDK and RR7 SSR both support this natively). Quick Ask may
stay single-payload — its validation step is inherently post-hoc — a spec-level decision.
