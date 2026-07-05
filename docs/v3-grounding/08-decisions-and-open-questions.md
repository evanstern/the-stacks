# 08 — Decision Log & Open Questions

## Decisions (settled during grounding, 2026-07-05)

Specs should treat these as fixed unless explicitly reopening one (which requires an ADR).

| # | Decision | Rationale (short) |
|---|---|---|
| D1 | **Greenfield rebuild inside this repo**; v2 stays as runnable reference until parity, then is retired deliberately | Rewrite scope (language, SSR, providers) touches everything anyway; in-repo keeps specs/wiki/fixtures/history adjacent |
| D2 | **TypeScript core + Python ML sidecar.** TS owns API, ingestion orchestration, chunking, retrieval, chat, corpus lifecycle; Python is inference-only (local embeddings, rerankers) | Constraint 3 honored; Python retained only where the ML ecosystem genuinely requires it |
| D3 | **Fastify** for the API server (dealer's choice) | TS-first, schema-validation-as-OpenAPI, plugin model fits, no need for NestJS ceremony at this scale |
| D4 | **Simplify versioning to corpus versioning**: keep immutable content-hashed archives, rebuildable/verifiable corpus manifests, dry-run/confirm/refuse-active guardrails; drop per-version databases, collections, and blue-green activation | v2 built it big and used it narrowly; keep the guardrail patterns, shed the machinery. Keep a corpus id on sources/chunks so multi-corpus can return cheaply |
| D5 | **pgvector replaces Qdrant** | One fewer service, one backup story, unlocks hybrid (FTS + vector) retrieval for the eval program; single-operator scale makes ANN headroom moot |
| D6 | **React Router 7 framework mode (SSR)**, Tailwind + shadcn/ui | Stated constraint; v2's Tailwind/shadcn investment carries over conceptually |
| D7 | Two chat modes: **Quick Ask** (single-turn, strict, always-retrieve, refuses without evidence) and **Conversations** (multi-turn, memory, auto-saved, renamable) | Scope items 3 & 4 are different contracts; keeping them distinct preserves v2's strictness where it matters |
| D8 | In Conversations, **retrieval is a model-driven tool**, not an every-turn reflex; cited claims still validate against actually-retrieved chunks | Conversational turns shouldn't force searches; natural fit with the tool-use scope; citation integrity preserved |
| D9 | File tools = **per-conversation scratch workspace** (read/write/list; isolated, capped, downloadable, lifecycle-bound to the conversation) | Safest sandbox story that is still genuinely useful; foundation for future tools |
| D10 | **Vercel AI SDK** for the LLM layer (providers: Anthropic, OpenAI, OpenAI-compatible/Ollama); LangGraph is not carried forward | Provider abstraction + tool loop + streaming without hand-rolling protocol code; v2's LangGraph wiring was a single-node graph, nothing to preserve |
| D11 | Eval program covers **all four tracks**: embedding models, chunking strategies, hybrid retrieval + reranking, end-to-end RAG quality — baseline-first, one variable at a time, findings as durable reports + ADRs | User decision; doc 06 |
| D12 | Queue stays a **Postgres table** with locked claims and event trails; no broker | v2 proved it; boring is a feature |
| D13 | **Single-operator** auth model continues (signed HTTP-only cookie sessions) | No multi-user in scope |
| D14 | Every model role (chat, quick-ask, embedding, judge, reranker) is a **named, env-first configuration**; no hardcoded model identifiers; embedding-model identity stamped on the index | Constraint 6; v2's lesson about one-sided pluggability |

## Open questions — to be answered by individual specs

Grouped by the candidate spec that should own them.

### Spec: v3 skeleton (monorepo, compose, walking skeleton)
- Exact monorepo layout and package boundaries (shared domain types, DB schema package,
  plugin contract package); pnpm workspace conventions.
- ORM/query layer and migration tool for the TS core (e.g., Drizzle vs Prisma vs Kysely) —
  pick with pgvector support as a hard requirement.
- Directory/naming coexistence with v2 (new `apps/` names vs a `v3/` root), and the v2
  retirement checklist.
- ML sidecar contract: endpoints, batching semantics, model warm-up, health/readiness.

### Spec: ingestion service
- The normalized-document schema in full (section kinds, anchors, artifacts).
- Plugin packaging: in-tree only for v3, or a discovery mechanism from day one?
- Re-ingestion story when a plugin version changes (identify → re-run → re-index).
- What, if anything, of v2's ingested data migrates, vs. re-ingesting from archives
  (re-ingest is the default assumption — archives are the durable record).

### Spec: conversations & tools
- Streaming protocol shape end-to-end (AI SDK ↔ Fastify ↔ RR7 SSR).
- Memory compaction: trigger threshold, summary visibility UX.
- Citation UX in conversations: how cited-from-corpus vs model-reasoning content is
  visually distinguished; what happens on validation failure mid-stream.
- Tool-call degradation policy for providers with weak/no tool support.
- Workspace quotas, retention, and download UX.
- Whether Quick Ask streams or stays single-payload.

### Spec: retrieval & eval harness
- Gold-set construction protocol (who writes questions, labeling standard, held-out split).
- Hybrid fusion strategy candidates; reranker serving contract in the sidecar.
- Metric definitions pinned (recall@k, MRR/nDCG variants, judge rubrics).
- CI posture: which eval slices run per-PR (deterministic) vs on-demand (model-backed).

### Spec: corpus lifecycle
- Manifest schema for the simplified model; verify semantics without per-version DBs.
- Re-embed operation design (model change → staged re-index → cutover) — the one place
  a shadow-index idea may earn back a slice of the dropped blue-green machinery.
- What "refuse when in active use" means concretely for a single live corpus.

### Spec: worktree tooling
- Port-block derivation scheme and env override format.
- Doctor/list UX; orphan detection; acceptance tests for zero-residue teardown.

### Spec: records & observability
- Conversation/tool-use record schema and UI; retention.
- What of v2's Records information architecture carries verbatim vs gets redesigned.
