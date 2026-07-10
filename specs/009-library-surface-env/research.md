# Research: Library Operator Surface & Worktree Environment Protocol

**Feature**: 009-library-surface-env | **Date**: 2026-07-09

Each decision below resolves a planning unknown left open (deliberately) by spec.md.

## R1 — Listing endpoint shape: one unified `GET /api/uploads`

**Decision**: A single list endpoint, `GET /api/uploads`, returning one newest-first
page of *submissions* — standalone sources and batches interleaved — each item carrying
a `kind` discriminator that mirrors the ticket vocabulary (`source` | `batch`) already
used by `GET /api/uploads/:kind/:id`.

**Rationale**: The operator's mental model is "what did I upload" — one timeline, not
two. The ticket page already discriminates on `kind`; the list reuses that vocabulary so
a row maps 1:1 onto the detail URL it links to (FR-003). REST-wise, `GET` on the same
collection the existing `POST /api/uploads` accepts into is the least surprising shape.

**Alternatives considered**: Separate `/api/sources` + `/api/batches` endpoints —
rejected: pushes the merge-and-sort into the web loader, duplicates pagination, and
invents nouns the API doesn't otherwise use.

## R2 — What counts as a listing row: submissions, not batch members

**Decision**: The listing shows what the operator submitted: sources with
`batch_id IS NULL` plus batches. Batch *member* sources do not get their own top-level
rows; they surface through the batch row's entry-outcome summary (FR-006) and through
the batch detail page, which already links each member.

**Rationale**: A 50-entry ZIP would otherwise bury the timeline under 50 rows the
operator never individually uploaded, and dedupe's "one record per stored upload" edge
case (spec) reads naturally at the submission level. Failed members stay legible: the
batch row's summary counts failures (US3 AC-3), one click opens the roster.

**Alternatives considered**: Flatten everything — rejected per above. A `?include=members`
flag — rejected as speculative; no user story needs it.

## R3 — Per-row counts without N+1: grouped aggregates over the current generation

**Decision**: Section and chunk counts for the page's sources come from two grouped
aggregate queries (`COUNT(*) ... WHERE source_id IN (page) AND generation =
source.current_generation GROUP BY source_id`), merged in TS. Batch entry summaries are
computed in TS from the already-loaded `entry_report` jsonb — no extra query.

**Rationale**: The ticket endpoint's per-source counts (status.ts) are correct but
1-row-scoped; naively reusing them per row is an N+1. Two aggregates per page keep the
listing O(3 queries) regardless of page size, and both filter on the current generation
— the same reader predicate the pipeline's generation-flip guarantees (008 R8): the
listing must never count a half-swapped generation.

**Alternatives considered**: Denormalized count columns on `sources` — rejected: a new
migration and a second writer for state that is cheaply derivable; the corpus is
single-operator scale (hundreds, not millions).

## R4 — Pagination: offset/limit with an honest total

**Decision**: `?limit` (default 50, max 200) + `?offset`, response carries
`{ items, total, limit, offset }`. The UI renders "showing X of Y" with prev/next —
FR-008's "explicitly capped with an indication that more exist".

**Rationale**: Single-operator scale makes offset pagination honest and sufficient;
`total` is one cheap `COUNT(*)`. Cursor/keyset pagination buys stability under
concurrent writers the product doesn't have (one operator), at real complexity cost.

**Alternatives considered**: Keyset (createdAt, id) cursors — deferred; if the
retrieval spec's surfaces need it, it lands there with its own justification.

## R5 — Navigation: a shared header in the protected layout

**Decision**: The nav lands in `protected-layout.tsx` — a small header (Home /
Library) rendered above `<Outlet />` — plus a `route("library", ...)` entry in
routes.ts. The listing links to the upload page and vice versa (US1 AC-5).

**Rationale**: Every authenticated route already nests under the protected layout
(routes.ts is explicit about this being the auth model), so it is the one place a nav
renders on every protected page without touching each route. This satisfies the
v2.2.0 Principle V mandate: reachable by navigation, not URL folklore.

**Alternatives considered**: Per-page links only — rejected: fixes the symptom (a
missing link) not the gap (no navigation model at all).

## R6 — Port derivation: offset = 10 × feature number

**Decision**: A worktree's port block derives from its feature number `NNN` (the
numeric prefix of the branch/worktree name): `PORT_OFFSET = 10 × NNN`, applied to every
default — web `4400+o`, api `4401+o`, ml `4402+o`, postgres `5442+o`. `main/` is
offset 0 (the documented defaults). Worktree 009 therefore gets 4490/4491/4492/5532.

**Rationale**: Feature numbers are already unique and monotonically assigned by
spec-kit, so uniqueness of derived blocks is inherited, not enforced. The ×10 stride
leaves room inside a block for future published services without re-numbering. The
arithmetic stays mentally checkable (the constitution's boring-infrastructure posture).
Range check: even NNN=999 keeps every port < 15500, well inside the unprivileged range.

**Alternatives considered**: Hash-of-branch-name derivation — rejected: collisions
possible and offsets unmemorable. Sequential "next free block" — rejected: not
deterministic from the worktree alone (depends on scan order and what's running).

**Known hazard (documented in the contract)**: a *manual* override can land inside a
future feature's derived block — the operator's historical web-on-4500 is exactly
feature 010's derived web port. The mint tool's collision scan (R7) plus the contract's
guidance ("prefer derived blocks; manual overrides go above 10000") make this visible.

## R7 — The mint tool: `scripts/mint-worktree-env.mjs`, zero-dependency Node

**Decision**: A repo script alongside `check-boundaries.mjs`: reads `.env.example` as
the template; derives `COMPOSE_PROJECT_NAME=the-stacks-<worktree-dirname>` (main keeps
`the-stacks-v3`), the four ports, and the port-coupled derived values
(`API_INTERNAL_URL=http://api:<derived api port>`); copies the two secrets from
`--secrets-from <path>` (typically `../main/.env`) or leaves them blank with a loud
warning; **refuses** to overwrite an existing `.env` (FR-013) without `--force`; scans
sibling worktrees' `.env` files and refuses on any port intersection; prints the
resulting profile as a table (Part B's CLI visibility avenue, FR-018). Pure derivation
logic lives in an importable module so the math is unit-testable (TDD applies to the
tool, not just the product).

**Rationale**: Node ESM with zero deps matches the existing repo-tooling precedent
(`scripts/check-boundaries.mjs` wired into `pnpm verify`). Deriving
`API_INTERNAL_URL` mechanically retires the compose file's documented footgun ("a
worktree that overrides V3_API_PORT and forgets this line gets ECONNREFUSED").
`EMBEDDING_ENDPOINT` stays `http://ml:4402` — the ml container's *internal* port is
fixed; only its host publish moves.

**Alternatives considered**: docker-compose `--env-file` layering — rejected: two env
files is a second source of truth and compose-only (the app also reads `.env` vars via
compose interpolation). A Makefile — rejected: repo has no make precedent.

## R8 — Drift handling: `--check` mode, documented not gated

**Decision**: `mint-worktree-env.mjs --check` diffs the worktree's `.env` keys against
`.env.example` (missing keys, unknown keys, port-coupling violations like
`API_INTERNAL_URL` not matching `V3_API_PORT`) and exits nonzero on drift. The
environment contract documents running it after pulling contract changes; it is NOT
added to `pnpm verify` in this slice.

**Rationale**: FR-016 asks for detection + reconciliation guidance. Gating `verify` on
a developer's local `.env` would make CI/agent runs (which may have no `.env`)
spuriously red — verification of tracked code shouldn't depend on untracked local state.

**Alternatives considered**: `pnpm verify` integration — rejected per above, revisitable.

## R9 — Contract succession: 009 contract supersedes, 007 gets a banner

**Decision**: `specs/009-library-surface-env/contracts/environment.md` is the new
single source of truth (full contract: variables + worktree protocol + lifecycle
rules). The 007 contract gains a one-line supersession banner pointing forward; the
`.env.example` header comment and AGENTS.md/README pointers move to 009 (FR-017).

**Rationale**: Editing history-in-place is worse than an explicit succession chain;
a banner keeps the old document honest without maintaining two contracts. AGENTS.md's
"Compose project name stays `the-stacks-v3`" line is re-scoped to main/ only — that
sentence predates per-worktree identity and would contradict the protocol.

## R10 — Visibility avenues (constitution v2.2.0 gate, FR-018)

| Capability | Avenue | Why |
|---|---|---|
| Library listing + nav | Web UI, reachable by navigation | Operator-facing; this IS the 008 retrofit |
| List endpoint | Web UI consumes it; contract documents it | Not independently operator-facing |
| Worktree env protocol | CLI output of mint tool + environment contract + README/AGENTS.md | Developer-facing; no web surface warranted |
| Docker lifecycle rules | Documentation (contract + AGENTS.md) | Process, not runtime capability |
