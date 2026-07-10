# Tasks: Library Operator Surface & Worktree Environment Protocol

**Input**: Design documents from `/specs/009-library-surface-env/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED — TDD is constitutional (Development Workflow): every behavior task
is preceded by its failing test task. Verify the test fails before implementing.

**Organization**: By user story, in spec priority order. One deliberate sequencing
note: this cycle's own worktree pivot (spec-cycle step 5) happens BEFORE implementation
and uses the manual port block from the protocol's derivation rule (009 → 4490/4491/
4492/5532, project `the-stacks-009-library-surface-env`) — US2 then builds the tool and
T015 closes the loop by verifying the tool agrees with the pivot-minted environment
(SC-004's live proof).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1 (nav + listing), US2 (worktree protocol), US3 (evidence at a glance)

## Path Conventions

Monorepo per plan.md: API in `apps/api/src/ingestion/`, web in `apps/web/app/`,
repo tooling in `scripts/`. All paths relative to the feature worktree root.

---

## Phase 1: Setup

**Purpose**: A clean baseline in the pivoted feature worktree — no new dependencies,
no scaffolding needed (008's infrastructure is this slice's foundation).

- [x] T001 Baseline the feature worktree: `pnpm install`, `pnpm verify` green, stack
      starts with the pivot-minted `.env` (`docker compose up -d --build --wait`),
      and `RUN_DB_INTEGRATION_TESTS=1 pnpm --filter @stacks/api test` passes against
      the worktree's own Postgres — proves the pivot environment before any change

---

## Phase 2: Foundational

**Purpose**: None — no schema changes (data-model.md), no new packages, no shared
scaffolding. 008's tables, auth hook, and error mapping are the foundation; user
stories start immediately after T001.

**Checkpoint**: T001 green ⇒ all three stories are unblocked (US1/US2 fully parallel —
disjoint files; US3 depends on US1's files).

---

## Phase 3: User Story 1 — Find the library and recover any upload from the UI (Priority: P1) 🎯 MVP

**Goal**: Visible navigation to a bounded, newest-first library listing of submissions
(standalone sources + batches), every row linking to its existing ticket detail page —
FR-001..003, FR-007, FR-008, FR-010.

**Independent Test** (spec US1): with one ingested source, one failed source, and one
batch present, go home → library via nav only, find all three, click through to each
detail page — no URL typing, no DB access (quickstart A1, A2, A4).

### Tests for User Story 1 (write first, watch them fail)

- [x] T002 [P] [US1] Failing DB-gated integration test for `GET /api/uploads` in
      apps/api/src/ingestion/list.test.ts — asserts: 401 without session; 200 envelope
      `{items,total,limit,offset}`; empty library → `items:[], total:0`; newest-first
      ordering (createdAt DESC, id DESC tiebreak); batch members (`batch_id IS NOT
      NULL`) excluded from rows; limit clamped to [1,200], offset ≥ 0; malformed
      paging → 400 typed refusal (contracts/api.md)
- [x] T003 [P] [US1] Failing web tests in apps/web/app/routes/library.test.tsx —
      asserts: nav header renders Home + Library links on protected pages; listing
      renders filename/kind/status/time per row; each row links to
      `/library/uploads/:kind/:id`; empty state points at `/library/upload`;
      prev/next paging controls reflect `total`/`limit`/`offset`

### Implementation for User Story 1

- [x] T004 [US1] Implement `GET /api/uploads` in apps/api/src/ingestion/list.ts —
      page query over standalone sources + batches (UNION shape per research R1/R2),
      envelope + clamping per contracts/api.md; register from
      apps/api/src/ingestion/routes.ts (T002 goes green)
- [x] T005 [US1] Add `listUploads(request, {limit, offset})` to
      apps/web/app/lib/api.server.ts — the sole legal API path (007 FR-019)
- [x] T006 [US1] Create listing page apps/web/app/routes/library.tsx (loader via
      listUploads, submission rows, honest empty state, prev/next) and add
      `route("library", "routes/library.tsx")` to apps/web/app/routes.ts (T003 partial
      green)
- [x] T007 [US1] Add shared nav header (Home / Library) to
      apps/web/app/routes/protected-layout.tsx (research R5) and cross-link the upload
      page ↔ listing (apps/web/app/routes/library.upload.tsx gains a "view library"
      link) (T003 fully green)
- [x] T008 [US1] **Story checkpoint**: `pnpm verify` +
      `RUN_DB_INTEGRATION_TESTS=1 pnpm --filter @stacks/api test` green; run
      quickstart A1/A2/A4 against the running stack; commit; GATE with US1's
      independent-test evidence

**Checkpoint**: US1 alone is a shippable MVP — the 008 discoverability gap is closed.

---

## Phase 4: User Story 2 — Run parallel worktree stacks without collisions (Priority: P2)

**Goal**: The environment protocol formalized and self-enforcing: deterministic
per-worktree identity/ports (10×NNN blocks), mint tool with refuse/collide/check
modes, lifecycle rules, contract succession — FR-011..017.

**Independent Test** (spec US2): mint environments for two sibling worktrees, run both
stacks concurrently with zero collisions, tear one down without touching the other
(quickstart B1–B5; SC-004 verified live against this cycle's own pivot).

### Tests for User Story 2 (write first, watch them fail)

- [x] T009 [P] [US2] Failing unit tests for the derivation library in
      scripts/worktree-env-lib.test.mjs — asserts: feature number parsed from
      worktree dirname (`009-library-surface-env` → 9; `main` → offset 0); port block
      `default + 10×NNN` for all four ports; `COMPOSE_PROJECT_NAME` =
      `the-stacks-<dirname>` (main → `the-stacks-v3`); `API_INTERNAL_URL` tracks
      derived `V3_API_PORT` while `EMBEDDING_ENDPOINT`/`DATABASE_URL` stay
      container-internal (contracts/environment.md §4); collision detection across a
      set of profiles; drift diff (missing keys, unknown keys, coupling violations)

### Implementation for User Story 2

- [x] T010 [US2] Implement scripts/worktree-env-lib.mjs — pure derivation: number
      parsing, port block, identity, port-coupled values, collision + drift checks
      (T009 goes green)
- [x] T011 [US2] Implement CLI scripts/mint-worktree-env.mjs — mint from
      `.env.example`, `--secrets-from` copy (never invent secrets), refuse existing
      `.env` without `--force`, sibling `../*/.env` collision scan with named refusal,
      `--check` drift mode (nonzero exit + report), printed profile table (the CLI
      visibility avenue, FR-018)
- [x] T012 [US2] Wire scripts/worktree-env-lib.test.mjs into `pnpm verify` (match the
      repo's verify pipeline pattern in package.json / turbo config so the derivation
      math is CI-guarded like check-boundaries)
- [x] T013 [P] [US2] Contract succession (FR-017): supersession banner atop
      specs/007-v3-skeleton/contracts/environment.md pointing to
      specs/009-library-surface-env/contracts/environment.md; update the
      `.env.example` header comment to point at the 009 contract
- [x] T014 [P] [US2] Update AGENTS.md ("Ports and env" + "Worktree safety" state the
      protocol: mint command, 10×NNN rule, lifecycle table pointer; re-scope the
      "Compose project name stays `the-stacks-v3`" line to main/ only) and README.md
      (mint step in local-run docs)
- [x] T015 [US2] **Story checkpoint — SC-004 live proof**: run
      `node scripts/mint-worktree-env.mjs --check` against this worktree's
      pivot-minted `.env` (tool and pivot agree); start `main/`'s stack alongside this
      worktree's stack, capture `docker ps` showing disjoint names/ports, both `/ready`
      green; `docker compose down --volumes` in a scratch worktree leaves the others
      untouched (quickstart B1–B5); commit; GATE with evidence

**Checkpoint**: US1 and US2 independently done — protocol is real and self-enforcing.

---

## Phase 5: User Story 3 — See ingestion evidence at a glance (Priority: P3)

**Goal**: The listing becomes an operator dashboard: plugin@version, generation,
current-generation section/chunk counts, failure stage, batch entry summaries —
FR-004..006.

**Independent Test** (spec US3): with mixed outcomes seeded (ingested / failed /
partial batch), the listing alone answers "what succeeded, what failed, how much is
indexed" without opening any detail page (quickstart A3; SC-003).

### Tests for User Story 3 (write first, watch them fail)

- [x] T016 [P] [US3] Extend apps/api/src/ingestion/list.test.ts with failing
      assertions: source rows carry `plugin` (null before detect), `generation`,
      `counts` computed over the CURRENT generation only (seed a superseded generation
      and assert it is not counted — the 008 R8 reader predicate), `lastError` when
      failed; batch rows carry `entrySummary {ingested,skipped,failed,total}` derived
      from entry_report + member statuses; still exactly 3 queries per page
      (research R3 — assert via query counting or explain in test comment)

### Implementation for User Story 3

- [x] T017 [US3] Extend apps/api/src/ingestion/list.ts with the two grouped
      current-generation aggregates (sections, chunks) merged in TS, and entrySummary
      computation from `entryReport` jsonb (T016 goes green)
- [x] T018 [US3] Extend apps/web/app/routes/library.tsx + library.test.tsx: evidence
      columns (plugin@version, generation, counts), visibly distinguished failed rows
      with failing stage, batch outcome summaries — failing web assertions first, then
      the rendering
- [x] T019 [US3] **Story checkpoint**: full verify + DB-gated suite green; quickstart
      A3 against seeded mixed outcomes; commit; GATE with US3's independent-test
      evidence

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Convergence evidence, constitutional closure (v2.2.0 visibility gate +
Principle VIII), durable-docs decision.

- [x] T020 Read-only + visibility verification for evidence: quickstart A5 grep (no
      new mutating verbs in apps/api/src/ingestion/), A6 contract curls, and the
      research R10 visibility-avenue table recorded per capability in
      specs/009-library-surface-env/evidence.md (constitution v2.2.0 gate)
- [x] T021 [P] Wiki-impact decision (plan ⚠): add the worktree/environment protocol as
      a durable operating-model page under docs/wiki/ (linked from docs/wiki/Home.md,
      `updated` frontmatter set) or record in evidence.md why AGENTS.md/README +
      contract suffice
- [x] T022 Full quickstart pass (A1–A6, B1–B5) against the running stack; assemble
      specs/009-library-surface-env/evidence.md (per-SC verification, wiki-impact
      decision, visibility avenues); commit
- [ ] T023 Principle VIII learning artifact via /spec-cycle-course:
      docs/courses/009-library-surface-env/ (briefs-first, feature-scoped, seeded with
      spec/plan/tasks/evidence), committed and linked from evidence.md — the cycle is
      incomplete without it

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: none — starts at the worktree pivot
- **Foundational (P2)**: empty by design; T001 green unblocks all stories
- **US1 (Phase 3)** and **US2 (Phase 4)**: fully independent of each other — disjoint
  file sets (apps/* vs scripts/+docs); can interleave or parallelize
- **US3 (Phase 5)**: extends US1's files (list.ts, library.tsx) — starts after T008
- **Polish (Phase 6)**: after all story checkpoints; T023 (course) is last and
  gate-blocking for the merge ritual

### Within Each Story

Failing tests (T002/T003, T009, T016) strictly precede their implementations; story
checkpoints (T008, T015, T019) each end with `pnpm verify` + commit + operator GATE.

### Parallel Opportunities

- T002 ∥ T003 (api test vs web test)
- T009 ∥ anything in US1 (disjoint trees) — a second lane can run all of US2 while
  US1 proceeds
- T013 ∥ T014 (different doc files), both ∥ T010–T012 after T009 exists
- T016 ∥ T018's test-writing half; T021 ∥ T020

## Implementation Strategy

MVP = Phase 3 (US1) alone: the discoverability gap closes and ships independently.
Then US2 (the protocol pays for itself immediately at SC-004's live proof), then US3
(dashboard columns), then Polish. Single-implementer plan: sequential by priority,
committing per task group, gating at each story checkpoint per the spec-cycle protocol.
