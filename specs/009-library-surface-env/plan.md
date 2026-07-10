# Implementation Plan: Library Operator Surface & Worktree Environment Protocol

**Branch**: `009-library-surface-env` | **Date**: 2026-07-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-library-surface-env/spec.md`

## Summary

Part A closes 008's visibility gaps read-only: one new `GET /api/uploads` list endpoint
(3 queries per page — page rows + two grouped current-generation aggregates), a
`/library` listing page, and a shared nav header in the protected layout so every
library page is reachable by navigation (the constitution v2.2.0 Principle V retrofit).
Zero new mutating endpoints — re-ingestion/corpus management stay pinned to the
corpus-lifecycle spec. Part B formalizes the worktree environment protocol the repo has
been running on informally: a superseding environment contract (deterministic
`10×NNN` port blocks, per-worktree compose identity, lifecycle rules) made
self-enforcing by `scripts/mint-worktree-env.mjs` (mint / refuse-overwrite /
sibling-collision scan / `--check` drift mode). This cycle's own worktree pivot is
Part B's live verification (SC-004).

## Technical Context

**Language/Version**: TypeScript 5.x on Node 22 (workspace-wide); no Python changes
(ML sidecar untouched)

**Primary Dependencies**: Fastify 5 (API), Drizzle ORM (reads only), React Router 7
SSR + Tailwind/shadcn (web), zero-dependency Node ESM for the mint tool (matches
`scripts/check-boundaries.mjs` precedent)

**Storage**: existing Postgres tables only (`sources`, `batches`, `document_sections`,
`chunks`) — **no migration**; counts computed per request over the current generation
(research R3)

**Testing**: vitest (API integration suite DB-gated via `RUN_DB_INTEGRATION_TESTS=1`;
web component/loader tests; mint-tool derivation unit tests); TDD per constitution

**Target Platform**: existing five-service compose stack; dev publishes on 127.0.0.1

**Project Type**: monorepo web app (apps/api + apps/web) + repo tooling (scripts/)

**Performance Goals**: listing page ≤ 3 queries per request regardless of page size;
no N+1 (research R3)

**Constraints**: read-only end to end (FR-009); browser never calls the API (007
FR-019 — loader goes through `lib/api.server.ts`); no new services, no new deps

**Scale/Scope**: single-operator corpus (hundreds of uploads); offset pagination,
default 50 / max 200 (research R4)

## Constitution Check

*Gate: constitution v2.2.0.*

| Principle | Verdict | Notes |
|---|---|---|
| I. Lawful content | ✅ | Fixtures reuse 008's synthetic set; nothing shipped/downloaded |
| II. Hallucination containment | ✅ n/a | No retrieval/chat surface touched |
| III. Citations are receipts | ✅ | Read-only over 008's traceable records; no transformation |
| IV. Async + guarded destructive | ✅ | Listing is a read; nothing slow, nothing destructive. Mint tool refuses overwrite + collision (guarded by construction) |
| V. Operator control & observability (incl. v2.2.0 visibility avenues) | ✅ | Part A: web UI reachable by nav — the 008 retrofit itself. Part B avenue: mint-tool CLI output + environment contract + README/AGENTS.md (recorded in research R10, per the new mandate) |
| VI. Boring, bounded infrastructure | ✅ | No new services/deps; compose topology unchanged; protocol makes the existing boring infra *more* deterministic |
| VII. Configuration over hardcoding | ✅ | No model roles touched; ports remain env-first — the tool derives env values, code reads env as before |
| VIII. The work must teach | ✅ | Teaching-register comments; visual course at cycle end via /spec-cycle-course |
| TDD posture | ✅ | Failing tests first: API list suite, web listing tests, mint derivation tests |
| Wiki impact | ⚠ decide at converge | Worktree protocol is a durable operating-model decision → likely a `docs/wiki/` page (or Walking-Skeleton update); record the decision in evidence |

**Post-design re-check**: no violations introduced by Phase 1 design; Complexity
Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/009-library-surface-env/
├── plan.md              # This file
├── research.md          # Phase 0 — R1..R10 decisions
├── data-model.md        # Phase 1 — read models + env profile shape (no schema)
├── quickstart.md        # Phase 1 — validation scenarios A1..A6, B1..B5
├── contracts/
│   ├── api.md           # GET /api/uploads
│   └── environment.md   # Environment & worktree protocol v2 (supersedes 007's)
└── tasks.md             # Phase 2 (/speckit-tasks — not created by plan)
```

### Source Code (repository root)

```text
apps/api/src/ingestion/
├── list.ts              # NEW — GET /api/uploads (page + aggregates, R1–R4)
├── list.test.ts         # NEW — DB-gated integration suite (TDD first)
└── routes.ts            # + registerListRoutes wiring

apps/web/app/
├── routes.ts            # + route("library", "routes/library.tsx")
├── routes/
│   ├── protected-layout.tsx   # + shared nav header (R5)
│   ├── library.tsx            # NEW — listing page (rows, empty state, paging)
│   └── library.test.tsx       # NEW — listing/nav component tests
└── lib/api.server.ts    # + listUploads(request, {limit, offset})

scripts/
├── mint-worktree-env.mjs        # NEW — mint / --check / --force CLI (R7, R8)
├── worktree-env-lib.mjs         # NEW — pure derivation (ports, identity, coupling)
└── worktree-env-lib.test.mjs    # NEW — derivation unit tests (TDD first)

# Part B documentation lands in:
.env.example                     # header pointer → 009 contract
specs/007-v3-skeleton/contracts/environment.md   # supersession banner
AGENTS.md / README.md            # protocol summary (mint cmd, derivation, lifecycle)
```

**Structure Decision**: Part A follows 008's exact seams — route module per concern
under `apps/api/src/ingestion/`, web page under `apps/web/app/routes/` with
`api.server.ts` as the sole API path (FR-019). Part B lives in `scripts/` beside
`check-boundaries.mjs` (repo-tooling precedent), with derivation logic split into an
importable module so TDD applies to the math, not just the CLI shell.

## Complexity Tracking

No constitution violations to justify — table intentionally empty.
