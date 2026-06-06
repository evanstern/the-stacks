<!--
Sync Impact Report
- Version change: template placeholders -> 1.0.0
- Modified principles: Template Principle 1 → Lawful Operator-Supplied Content Only; Template Principle 2 → Contract-First ETL and Retrieval; Template Principle 3 → Evidence-Labeled Intelligence; Template Principle 4 → Operator Control and Auditability; Template Principle 5 → Durable Architecture Boundaries
- Added sections: Additional Constraints; Development Workflow
- Removed sections: none
- Templates requiring updates: ✅ reviewed and aligned (.specify/templates/plan-template.md, .specify/templates/spec-template.md, .specify/templates/tasks-template.md, .specify/templates/commands/*.md, main/README.md, main/AGENTS.md)
- Follow-up TODOs: none
-->

# The Stacks Constitution

## Core Principles

### I. Lawful Operator-Supplied Content Only

The Stacks MUST never ship, download, scrape, bundle, or imply access to proprietary
rulebooks, campaign data, DnDBeyond exports, or other restricted game material. All
campaign, corpus, archive, and reference material MUST be supplied by the operator and
lawfully possessed. Repository fixtures may only use synthetic, minimal, or explicitly
permitted content. Engineering convenience MUST NOT weaken licensing or provenance
boundaries.

### II. Contract-First ETL and Retrieval

Ingestion, parsing, chunking, embedding, indexing, retrieval, citation, and
runtime-version behavior MUST be governed by explicit contracts. Changes to ETL or
retrieval behavior MUST preserve traceability from source material to chunks, jobs,
records, retrieval runs, and user-visible citations. Silent data loss, unverifiable
transformations, and hidden fallback behavior are not acceptable.

### III. Evidence-Labeled Intelligence

Retrieval-backed answers MUST always include citations to operator-supplied source
material and MUST preserve traceability from answer to source, chunk, job, and
retrieval run where applicable. The system MUST clearly report when retrieved evidence
is absent, incomplete, conflicting, or low confidence.

Future agentic features MAY use general model knowledge, planning heuristics, and
reasoning capabilities when assisting the operator, but MUST label the basis of their
output. Any claim presented as coming from operator-supplied source material MUST be
citation-backed. Any uncited synthesis MUST be identifiable as reasoning, assumption,
recommendation, or general knowledge rather than retrieved fact. Agent autonomy MUST
NOT weaken provenance, licensing, auditability, or user control.

### IV. Operator Control and Auditability

The Stacks MUST keep the operator in control of content, runtime state, destructive
actions, and agentic behavior. Uploads, ingestion jobs, retrieval runs, corpus imports,
runtime-version activation, resets, repairs, and future agent actions MUST be
inspectable through records, statuses, lifecycle events, or evidence logs appropriate
to the action.

Destructive or hard-to-reverse operations MUST provide an explicit safety path
appropriate to their risk: confirmation, preview, dry-run, rollback, scoped operation,
or explicit operator approval. Dry-run or preview modes SHOULD be available for
high-risk lifecycle operations where they materially improve operator confidence, but
they are not mandatory for every runtime operation. Failures MUST be visible and
actionable without exposing unsafe internals such as secrets, host filesystem paths, or
raw tracebacks to public UI surfaces.

### V. Durable Architecture Boundaries

The Stacks MUST preserve clear boundaries between retrieval/evidence concerns,
operator-facing application concerns, runtime lifecycle concerns, and infrastructure
concerns. RR7 means the UI/UX-facing application layer, including the frontend and
related route/server API surfaces.

The RAG layer MUST remain frontend-agnostic: ingestion, chunking, embedding, indexing,
retrieval, citation, and evidence contracts MUST NOT depend on RR7 flows, visual
presentation, or session UX assumptions. RR7 MAY own UI/UX-facing behavior and
route/server API surfaces, but it MUST consume RAG capabilities through explicit
contracts rather than reaching across boundaries or embedding retrieval assumptions into
presentation logic.

Durable architecture, contract, lifecycle, ETL, retrieval, runtime-version,
operator-control, and cross-layer behavior decisions MUST be recorded in
`main/docs/wiki/` and linked from `main/docs/wiki/Home.md` once they settle. Routine bug
fixes, local refactors, and implementation-only changes do not require new wiki pages
unless they change a durable contract or operational expectation. Architectural work
MUST include a wiki-impact decision: either the relevant wiki page was updated and
linked, or the agent explicitly records why no durable wiki update was needed.

## Additional Constraints

- Local, smoke, and production configuration MUST remain distinct.
- Production secrets MUST stay out of the repository.
- Production storage, browser origins, secure cookies, host ports, runtime activation,
  resets, and teardown flows MUST preserve documented safety contracts.
- The local app port contract `5173` MUST NOT change without explicit approval.
- Unsafe defaults or blurred environments MUST NOT be introduced because they can
  corrupt data, weaken authentication, or make runtime state untrustworthy.
- Dry-run or preview modes are preferred safety options for high-risk operations, but
  they are not a universal prerequisite.

## Development Workflow

- For behavior changes where an automated test can reasonably express the desired
  outcome, development MUST follow TDD: write or update the failing test first,
  implement the smallest change that passes it, then refactor only with tests passing.
- When TDD is not practical, the work MUST still include explicit verification evidence
  using the narrowest relevant command or QA surface.
- Default verification anchors are `make test`, `make smoke`, `make smoke-public`,
  `make etl-live-smoke`, `make eval-embeddings`, and `npm run build` from the documented
  locations.
- Development MUST preserve the bare-worktree operating model. `.bare/` is Git plumbing
  only, `main/` is the deploy-oriented app worktree, development happens in separate
  worktrees, and `.omo/` remains at the repository root beside worktrees for plans,
  notes, and evidence.
- Changes MUST stay aligned with the active OMO plan when one exists.

## Governance

The Constitution supersedes conflicting local practices, templates, and ad hoc agent
habits.

Amendments MUST be made through `/speckit.constitution` and recorded with a semantic
version bump:

- MAJOR: backward-incompatible governance or principle removals/redefinitions.
- MINOR: new principle or materially expanded guidance.
- PATCH: clarifications, wording fixes, or non-semantic refinements.

Compliance review expectations:

- `/speckit.plan` and `/speckit.analyze` MUST reflect the constitution's requirements.
- Durable changes MUST include the relevant wiki-impact decision in evidence.
- Claims of completion MUST be backed by fresh verification or explicit justification
  when a check cannot run.
- Exceptions MUST be documented in the relevant spec, plan, or OMO evidence.

**Version**: 1.0.0 | **Ratified**: 2026-06-05 | **Last Amended**: 2026-06-05
