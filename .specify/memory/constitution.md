<!--
Sync Impact Report
- Version change: 1.0.0 -> 2.0.0
- Rationale: MAJOR — principles redefined around the v3 greenfield rebuild (docs/v3-grounding/01,
  decisions D1-D14 in docs/v3-grounding/08). v2-era mandates removed or redefined: per-version
  blue-green runtime machinery dropped (D4), Qdrant replaced by pgvector (D5), FastAPI-era
  verification anchors and the hard host-port clause superseded by generic contract-stability
  language, wiki governance moved from Principle V into Development Workflow.
- Modified principles:
  - I. Lawful Operator-Supplied Content Only (carried forward, wording tightened)
  - II. Contract-First ETL and Retrieval -> III. Citations Are Receipts
  - III. Evidence-Labeled Intelligence -> II. Hallucination Is Contained by Architecture
  - IV. Operator Control and Auditability -> split into IV. Slow Work Is Asynchronous and
    Destructive Work Is Guarded, and V. Operator Control and Observability
  - V. Durable Architecture Boundaries -> VI. Boring, Bounded Infrastructure
- Added sections: VII. Configuration Over Hardcoding (new principle); Fixed Technical
  Decisions (replaces Additional Constraints)
- Removed sections: Additional Constraints (v2-era runtime-version, Qdrant, and hard 5173
  clauses; contract stability retained generically in Fixed Technical Decisions)
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check gate is generated per plan; no
    static edits needed)
  - ✅ .specify/templates/spec-template.md (principle-agnostic; no edits needed)
  - ✅ .specify/templates/tasks-template.md (principle-agnostic; no edits needed)
  - ✅ README.md / AGENTS.md — updated by the v3 skeleton spec (007-v3-skeleton, T047):
    both now document the v3 stack under `v3/` alongside the still-running v2 reference;
    the owed wiki page (docs/wiki/V3-Walking-Skeleton.md) landed via T048
- Follow-up TODOs: none
-->

# The Stacks Constitution

## Core Principles

### I. Lawful Operator-Supplied Content Only

The Stacks MUST never ship, download, scrape, bundle, or imply access to proprietary
rulebooks, campaign data, D&D Beyond exports, or other restricted game material. All
corpus, archive, and reference material MUST be supplied by the operator and lawfully
possessed; the product is a bring-your-own-books research library. Repository fixtures
MUST use only synthetic, minimal, or explicitly permitted content. Engineering
convenience MUST NOT weaken licensing or provenance boundaries.

### II. Hallucination Is Contained by Architecture

Honesty MUST be enforced structurally, not requested from the model: retrieval decides
what the model may see, prompts confine it, and validators check citations after the
fact. The two chat modes carry distinct contracts (D7) that MUST NOT blur:

- **Quick Ask** is single-turn and strict: it always retrieves, answers only from
  evidence, and refuses honestly when evidence is missing.
- **Conversations** are multi-turn with memory; retrieval is a tool the model chooses
  to invoke (D8). The model MAY converse, summarize, and reason freely, but any claim
  presented as coming from the corpus MUST carry a citation validated against
  actually-retrieved chunks. The contract softens from "refuse to answer" to "never
  fake a citation" — the validation machinery stays.

Uncited output MUST be identifiable as reasoning, assumption, or general knowledge
rather than retrieved fact. Tool use and agentic features MUST NOT weaken provenance,
licensing, auditability, or operator control.

### III. Citations Are Receipts

Every citation MUST be a durable record linking answer → retrieval run → exact chunk,
and it MUST keep working when revisited in old conversations. Ingestion, chunking,
embedding, indexing, retrieval, and citation MUST be governed by explicit contracts
that preserve traceability from source material through chunks, jobs, and retrieval
runs to user-visible citations. Silent data loss, unverifiable transformations, and
hidden fallback behavior are not acceptable. New ingesters MUST plug in through the
ingestion plugin contract without modifying the pipeline core.

### IV. Slow Work Is Asynchronous and Destructive Work Is Guarded

Slow work MUST never happen while a user waits: uploads are accepted and recorded, and
processing is asynchronous behind a legible status contract. Retries MUST be safe by
construction — deterministic IDs, idempotent indexing, content-hash dedupe.

Destructive or hard-to-reverse operations MUST be dry-run-first, explicitly confirmed,
and structurally unable to touch what is live (e.g., corpus deletion refuses the
active corpus). Failures MUST be legible: append-only event trails for jobs, retrieval
runs, and corpus lifecycle; errors typed by cause and mapped to honest status codes;
user-facing messages scrubbed of secrets and internals while full diagnostics stay
operator-side.

### V. Operator Control and Observability

The operator MUST always be able to see inside: a Records-style observability surface
with URL-addressable state is part of the product, not tooling. Uploads, ingestion
jobs, retrieval runs, conversations, tool invocations, and corpus lifecycle events
MUST be inspectable through records, statuses, or event trails appropriate to the
action. The auth model is single-operator (D13); multi-user accounts, sharing, and
permissions are out of scope and MUST NOT be partially introduced. Conversation tool
use is bounded to the per-conversation scratch workspace and corpus retrieval/read
tools (D9); new tool surfaces require a spec.

### VI. Boring, Bounded Infrastructure

Boring infrastructure is a feature: the queue is a Postgres table with locked claims
and event trails (D12), vectors live in Postgres via pgvector (D5), config is env vars
with safe local defaults, and the whole system MUST start with one compose command.

Architectural boundaries are fixed (D2): the TypeScript core owns the API, ingestion
orchestration, chunking, retrieval, chat, and corpus lifecycle; the Python sidecar is
inference-only. The UI layer (React Router 7 SSR, D6) MUST consume retrieval and
evidence capabilities through explicit contracts — ingestion, chunking, embedding,
indexing, retrieval, and citation contracts MUST NOT depend on UI flows or
presentation assumptions. Corpus versioning keeps immutable content-hashed archives,
rebuildable/verifiable manifests, and dry-run/confirm/refuse-active guardrails without
per-version databases or blue-green activation (D4); sources and chunks carry a corpus
id so multi-corpus can return cheaply.

### VII. Configuration Over Hardcoding

Every model role — chat, quick-ask, embedding, judge, reranker — MUST be a named,
env-first configuration with no hardcoded model identifiers (D14). Providers
(Anthropic, OpenAI, OpenAI-compatible/self-hosted) MUST be selectable via
configuration and, per conversation, in the UI. The embedding-model identity MUST be
stamped on the index so mismatched query/index embeddings are structurally detectable.
Retrieval and model choices MUST be justified by the evaluation program (D11):
baseline first, one variable at a time, findings recorded as durable reports and ADRs.

## Fixed Technical Decisions

Decisions D1–D14 in `docs/v3-grounding/08-decisions-and-open-questions.md` are settled.
Specs MUST treat them as fixed; reopening one requires an ADR. In brief:

- D1 greenfield rebuild in this repo; v2 stays a runnable reference until parity, then
  is retired deliberately. v2's documented contracts stay intact until that retirement.
- D2 TypeScript core + Python inference-only ML sidecar. D3 Fastify for the API.
- D4 corpus versioning replaces per-version blue-green machinery.
- D5 pgvector replaces Qdrant. D12 the queue stays a Postgres table.
- D6 React Router 7 framework mode (SSR), Tailwind + shadcn/ui.
- D7 Quick Ask and Conversations are distinct contracts. D8 retrieval is a model-driven
  tool in Conversations. D9 file tools are a per-conversation scratch workspace.
- D10 Vercel AI SDK for the LLM layer; LangGraph is not carried forward.
- D11 four-track eval program. D13 single-operator auth. D14 named, env-first model
  roles.

Production secrets MUST stay out of the repository, and local, smoke, and production
configuration MUST remain distinct. Unsafe defaults or blurred environments MUST NOT
be introduced.

## Development Workflow

- For behavior changes where an automated test can reasonably express the desired
  outcome, development MUST follow TDD: write or update the failing test first,
  implement the smallest change that passes it, then refactor with tests passing.
- When TDD is not practical, the work MUST still include explicit verification
  evidence using the narrowest relevant command or QA surface.
- Development MUST preserve the bare-worktree operating model: `.bare/` is Git
  plumbing only, `main/` is the deploy-oriented app worktree, development happens in
  separate worktrees, and `.omo/` remains at the repository root beside worktrees.
- Durable architecture, contract, lifecycle, and cross-layer decisions MUST be
  recorded in `docs/wiki/` and linked from `docs/wiki/Home.md` once they settle.
  Architectural work MUST include a wiki-impact decision: either the relevant wiki
  page was updated and linked, or the work explicitly records why no durable wiki
  update was needed. Routine bug fixes and implementation-only changes do not require
  wiki pages.
- Any v3 design that violates a product principle from
  `docs/v3-grounding/01-vision-and-scope.md` requires an ADR.

## Governance

The Constitution supersedes conflicting local practices, templates, and ad hoc agent
habits.

Amendments MUST be made through `/speckit-constitution` and recorded with a semantic
version bump:

- MAJOR: backward-incompatible governance or principle removals/redefinitions.
- MINOR: new principle or materially expanded guidance.
- PATCH: clarifications, wording fixes, or non-semantic refinements.

Compliance review expectations:

- `/speckit-plan` and `/speckit-analyze` MUST reflect the constitution's requirements;
  the plan-template Constitution Check gate is derived from the current version.
- Durable changes MUST include the relevant wiki-impact decision in evidence.
- Claims of completion MUST be backed by fresh verification or explicit justification
  when a check cannot run.
- Exceptions MUST be documented in the relevant spec, plan, or OMO evidence.

**Version**: 2.0.0 | **Ratified**: 2026-06-05 | **Last Amended**: 2026-07-05
