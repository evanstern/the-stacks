<!--
Sync Impact Report
- Version change: 2.1.0 -> 2.2.0
- Rationale: MINOR — materially expanded guidance in Principle V (Operator Control and
  Observability): every delivered capability MUST have a visibility avenue. Operator-
  facing capabilities surface in the web UI (Records-style, URL-addressable, reachable
  by navigation — not URL folklore); capabilities without a warranted web surface
  (developer tooling, protocols, background machinery) surface through CLI output, log
  files, or documented inspection paths. Specs/plans record which avenue each capability
  satisfies and why; a capability with no visibility avenue is incomplete, the same way
  a cycle without its Principle VIII learning artifact is incomplete. Requested by the
  operator 2026-07-09 after 008-ingestion-service shipped web pages unreachable by
  navigation and capabilities with no UI avenue at all; 009-library-surface-env (FR-018)
  is the first spec gated on this.
- Modified principles: V. Operator Control and Observability (expanded with the
  visibility-avenue mandate; not renamed). I-IV and VI-VIII carried forward unchanged.
- Added sections: Development Workflow gains the visibility-avenue recording step.
- Removed sections: none.
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check gate is generated per plan
    from the current version; plans authored after 2.2.0 must gate on the visibility
    avenue)
  - ✅ .specify/templates/spec-template.md (principle-agnostic; no edits needed)
  - ✅ .specify/templates/tasks-template.md (principle-agnostic; task lists generated
    after 2.2.0 must carry the visibility-avenue verification where a capability lacks a
    web surface)
- Follow-up TODOs:
  - TODO(007-RETROFIT): 007-v3-skeleton predates the 2.1.0 amendment — it owes a
    teaching-comment pass over v3/ and its feature course/lesson under Principle VIII.
  - TODO(008-VISIBILITY-RETROFIT): 008-ingestion-service predates this amendment — its
    unreachable pages and avenue-less capabilities are being retrofitted by
    009-library-surface-env; re-ingestion's avenue lands with the corpus-lifecycle spec.
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

Every delivered capability MUST have a visibility avenue — being able to see inside is
a property of each feature, not only of the system:

- Operator-facing capabilities MUST be visible in the web UI: Records-style,
  URL-addressable, and reachable through the product's navigation. A page reachable
  only by typing its URL does not satisfy this.
- Where a web surface is not warranted or not yet feasible — developer-facing tooling,
  protocols, background machinery — the capability MUST instead be visible through
  other output: CLI output, log files, or a documented inspection path.
- Each feature's spec or plan MUST record which visibility avenue every delivered
  capability satisfies and why that avenue is the right one.
- A capability with no visibility avenue at all is incomplete, the same way a spec
  cycle without its Principle VIII learning artifact is incomplete.

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

### VIII. The Work Must Teach

The operator approves specs and reads results; assume they have not read the code and
will not. Code is produced quickly against approved specs, so every spec cycle MUST
produce learning artifacts alongside the working system — the work is not done when it
runs, it is done when the operator can understand it without reading it.

- Code MUST be written to teach: comments narrate intent, architecture seams, domain
  doctrine, and the why behind non-obvious choices, at a density sufficient for a
  skilled but time-poor developer — or course-generation tooling such as
  `/codebase-to-course` — to follow the design without reading every line. Comments
  address the system's future reader, not the diff's reviewer; this deliberately
  supersedes minimal-comment style conventions for this repository.
- Every spec cycle (specify → converge) MUST end with a feature-scoped visual learning
  artifact: an interactive HTML course, an HTML/SVG slide-show lesson, or richer media
  where tooling allows. It teaches what was built, why, and how it works — diagrams,
  animated flows, and side-by-side code-with-plain-English. Prose-only summaries do
  not satisfy this requirement.
- Learning artifacts SHOULD be scoped to the feature (its diff, its file list from
  tasks.md) and pre-loaded with the feature's spec artifacts (spec, plan, tasks,
  evidence) rather than re-analyzing the whole repository — cheaper to generate and
  more focused to consume.
- Reporting to the operator MUST be visual-first wherever the content allows:
  informative but visual beats exhaustive but textual. The artifact targets a skilled
  developer who thinks visually, not a beginner needing CS fundamentals.

## Fixed Technical Decisions

Decisions D1–D14 in `docs/grounding/08-decisions-and-open-questions.md` are settled.
Specs MUST treat them as fixed; reopening one requires an ADR. In brief:

- D1 greenfield rebuild in this repo; v2 stays a runnable reference until parity, then
  is retired deliberately. v2's documented contracts stay intact until that retirement.
  (Superseded by ADR 0001, 2026-07-06: v2 was retired before parity and removed from the
  working tree, so the "until parity" clause no longer holds; v2 now lives in git history.)
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
  `docs/grounding/01-vision-and-scope.md` requires an ADR.
- Every feature MUST declare its visibility avenue (Principle V): specs/plans record,
  per delivered capability, whether it surfaces in the web UI or — where a web surface
  is not warranted — through CLI output, logs, or a documented inspection path, and
  converge/evidence MUST verify the declared avenue actually exists.
- Every spec cycle MUST close with the Principle VIII learning artifact: after
  `/speckit-converge` reports converged, generate the feature's course or lesson —
  scoped to the feature's files and seeded with its spec artifacts — commit it to the
  repository (e.g. `docs/courses/<feature>/`), and link it from the feature's
  evidence. The canonical mechanism is the `/spec-cycle-course` skill, which pins the
  skilled-developer register and the briefs-first workflow; use it rather than
  hand-rolling the artifact. A spec cycle without its learning artifact is incomplete.

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

**Version**: 2.2.0 | **Ratified**: 2026-06-05 | **Last Amended**: 2026-07-09
