# Tasks: Extensible Ingestion Service

**Input**: Design documents from `/specs/008-ingestion-service/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R13), data-model.md, contracts/ (4), quickstart.md

**Tests**: INCLUDED — the constitution's Development Workflow mandates TDD: within every
story, write the failing test first, implement the smallest change that passes, refactor
green. DB-gated suites run with `RUN_DB_INTEGRATION_TESTS=1` + compose Postgres
(`localhost:5442`), per skeleton convention.

**Organization**: Grouped by user story (US1–US5 from spec.md) so each story is an
independently testable increment. US1 is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 traceability label (story phases only)

## Path Conventions

pnpm monorepo per plan.md: `packages/{core,db,ingestion-contract,ingestion,ingestion-plugins}/src/`,
`apps/{api,worker}/src/`, `apps/web/app/`. Tests co-located `*.test.ts` (skeleton convention).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New packages exist, dependencies declared, boundaries enforced, env contract extended.

- [x] T001 Scaffold `@stacks/ingestion` package (package.json, tsconfig extending tsconfig.base.json, vitest config, empty src/index.ts) in packages/ingestion/, wired into pnpm-workspace.yaml and root verify script
- [x] T002 [P] Scaffold `@stacks/ingestion-plugins` package (same shape; depends ONLY on `@stacks/ingestion-contract` workspace dep) in packages/ingestion-plugins/
- [x] T003 [P] Add dependencies: `cheerio` + `sanitize-html` to packages/ingestion-plugins/package.json; `yauzl` to apps/worker/package.json (R6 worker-only exception); `@fastify/multipart` to apps/api/package.json
- [x] T004 [P] Extend scripts/check-boundaries.mjs with R13 rules — (a) ingestion-plugins imports only @stacks/ingestion-contract + its own parsing deps, (b) cheerio/sanitize-html appear nowhere outside packages/ingestion-plugins, yauzl nowhere outside apps/worker, (c) verify existing no-hardcoded-model rule covers new packages; prove by running `node scripts/check-boundaries.mjs`
- [x] T005 [P] Extend .env.example and docker-compose.yml (api + worker env passthrough) with `INGEST_MAX_UPLOAD_BYTES=26214400`, `INGEST_MAX_BATCH_ENTRIES=200`, `CHUNK_TARGET_CHARS=4000`, `CHUNK_OVERLAP_CHARS=400`, `CHUNK_MAX_CHARS=6000` per contracts/api.md, with teaching comments

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The contract everything plugs into, the identity scheme, and the schema — no story can start without these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 [P] Write failing invariant tests for NormalizedDocument v1 (invariants 1–7 from contracts/normalized-document.md: contiguous indexes, non-empty content, anchor resolution, char ranges, sanitization, serializability) in packages/ingestion-contract/src/document.test.ts
- [x] T007 Implement NormalizedDocument v1 types + `validateNormalizedDocument()` + `PluginError`/`PluginFailureCategory` + `IngestionPlugin`/`DetectInput`/`DetectResult`/`ChunkingHints` interfaces per contracts/plugin-contract.md; bump `INGESTION_CONTRACT_VERSION` to "1.0.0" (replaces placeholder) in packages/ingestion-contract/src/ (document.ts, plugin.ts, errors.ts, index.ts) — makes T006 pass
- [x] T008 Implement `describeConformance()` suite factory (assertions 1–6 from contracts/plugin-contract.md: identity/semver, detect purity + range, transform validity, determinism, PluginError on malformed, fixtures-dir guard) in packages/ingestion-contract/src/conformance/index.ts, self-tested with a minimal inline reference plugin in conformance/conformance.test.ts
- [x] T009 [P] Write failing tests then implement `deriveSectionId()`/`deriveChunkId()` per data-model.md identity summary (R9) in packages/core/src/ingestion-ids.ts + ingestion-ids.test.ts, exported from packages/core/src/index.ts
- [x] T010 [P] Drizzle schema for corpora, source_archives, batches, sources, document_sections, chunks (un-dimensioned vector customType reused from skeleton-vectors.ts, generated tsvector + GIN, embedding-stamp CHECK), ingestion_events (CHECKs on stage/event/scope) per data-model.md in packages/db/src/schema/ingestion.ts, exported from packages/db/src/index.ts
- [x] T011 Generate migration `pnpm --filter @stacks/db generate --name ingestion` and add seed of the `default` corpus row; verify API boot applies it against compose Postgres
- [x] T012 Write failing DB-gated tests then implement `recordIngestionEvent()` sole-writer (mirrors events.ts construction: insert-only, append-only-by-construction doc comment) in packages/db/src/ingestion-events.ts + ingestion-events.test.ts

**Checkpoint**: Contract v1.0.0 published in-repo, schema migrated, IDs deterministic — story phases may begin (in parallel where staffing allows).

---

## Phase 3: User Story 1 — Upload a D&D Beyond export and get a searchable corpus (Priority: P1) 🎯 MVP

**Goal**: DDB fixture → immediate claim ticket → async detect/extract/transform/chunk/embed/index → traceable, provenance-stamped chunks under generation 1. ZIP batches fan out per entry.

**Independent Test**: quickstart Scenario 1 (via API + SQL; web form lands in T030) — acceptance < 2 s, unattended completion, 100% chunks anchor-traceable.

### Tests for User Story 1 (write first, watch them fail)

- [x] T013 [P] [US1] Recover v2 `ddb_import.py` from git history (`git log --all --diff-filter=A -- '*ddb_import*'`; `git show <sha>:<path>`) and distill the port: detection heuristics, selector→section-kind table, sanitization allowlist, artifact model into specs/008-ingestion-service/ddb-rules.md (R3 — reviewable rules, no code copied)
- [x] T014 [P] [US1] Author synthetic DDB-shaped fixtures (stat-block page, spell page, table-heavy page; no proprietary text — Principle I / FR-024) in packages/ingestion-plugins/fixtures/ddb/, plus fixtures/zips/export-mixed.zip build script (2 DDB pages + 1 markdown + 1 .dat) in packages/ingestion-plugins/fixtures/build-zips.mjs
- [x] T015 [P] [US1] Failing plugin tests: `describeConformance` run + kind-classification asserts (stat_block/table/spell_entry recognized; anchors stamped `data-stacks-anchor`) in packages/ingestion-plugins/src/ddb/ddb.test.ts
- [x] T016 [P] [US1] Failing chunking unit tests: atomic kinds never split (SC-009), char budgets + overlap, `keepTogether`/`preferBreakBefore` hints, oversized flag path (R4) in packages/ingestion/src/chunking.test.ts
- [x] T017 [P] [US1] Failing registry tests: accepts-filter, highest-confidence wins, deterministic tie-break by registry order, all-zero → unsupported_type, decision recording shape (FR-011) in packages/ingestion/src/registry.test.ts
- [x] T018 [P] [US1] Failing embed-client tests against a mocked sidecar: ≤ EMBED_MAX_BATCH batching, model identity assert, dimensions check before write, 503/timeout → dependency_down + 404/415/500 → internal_fault (007 ml-sidecar contract) in packages/ingestion/src/embed.test.ts

### Implementation for User Story 1

- [x] T019 [US1] Implement `ddb-saved-html` plugin (detect via heuristics from ddb-rules.md; transform via cheerio table-driven rules; sanitize-html artifacts with anchor stamping) in packages/ingestion-plugins/src/ddb/index.ts — T015 green
- [x] T020 [P] [US1] Implement structure-aware chunker with env-tunable params snapshot (R4, FR-019) in packages/ingestion/src/chunking.ts — T016 green
- [x] T021 [P] [US1] Implement plugin registry + detection dispatch (static ordered list, FR-011/012) in packages/ingestion/src/registry.ts — T017 green
- [x] T022 [P] [US1] Implement batched embed client resolving the `embedding` model role at construction (D14/FR-020) in packages/ingestion/src/embed.ts — T018 green
- [x] T023 [US1] Implement idempotent chunk indexing: ON CONFLICT DO NOTHING inserts, embedding UPDATE-where-NULL (skip-existing on retry), provenance + embedding stamps, section persistence (R9/R10) in packages/ingestion/src/index-chunks.ts with DB-gated tests in index-chunks.test.ts
- [x] T024 [US1] Implement `ingestSource()` stage driver: detect→extract→transform→chunk→embed→index→commit, per-stage events per contracts/events.md, PluginError→DomainError mapping at the seam, empty-document honest outcome, generation flip + sweep in commit (R8) in packages/ingestion/src/ingest-source.ts, with DB-gated happy-path test in ingest-source.test.ts
- [x] T025 [US1] DB-gated retry-idempotency test (quickstart Scenario 5 / SC-004): complete once, snapshot chunk ids; interrupt a re-run after chunk stage, let retry finish; assert identical final state in packages/ingestion/src/ingest-source.retry.test.ts
- [x] T026 [US1] Worker handler `ingest_source` (thin delegation to ingestSource(), DomainError → job fail contract) in apps/worker/src/handlers/ingest-source.ts, registered in apps/worker/src/main.ts
- [x] T027 [US1] Worker handler `ingest_batch_expand`: yauzl streaming, per-entry source+archive+job rows in one transaction, nested-ZIP refusal, entry caps, entry_report + batch status transitions (R6) in apps/worker/src/handlers/ingest-batch-expand.ts with fixture-ZIP DB-gated test
- [x] T028 [US1] API intake `POST /v1/uploads`: @fastify/multipart, media-type sniff, sha256-while-stream, single transaction (archive→source→batch→enqueue), 201/200-duplicate ticket bodies per contracts/api.md, wired in apps/api/src/app.ts, in apps/api/src/ingestion/routes.ts with inject() contract tests in routes.test.ts
- [x] T029 [US1] DB-gated end-to-end pipeline test: intake fixture → run worker handlers inline → assert sections/chunks under current_generation, plugin+version+confidence recorded, anchors resolve (SC-001 zero-orphan query from quickstart) in packages/ingestion/src/pipeline.e2e.test.ts
- [x] T030 [US1] Web upload form (multipart POST through app/lib/api.server.ts only — 007 FR-019; redirect to ticket URL) in apps/web/app/routes/library.upload.tsx + route registration in apps/web/app/routes.ts, with component test

**Checkpoint**: MVP — a DDB fixture ingests end-to-end, unattended, idempotently. Demoable via form + curl.

---

## Phase 4: User Story 2 — See what happened to every upload (Priority: P2)

**Goal**: Claim ticket resolves to status + full append-only stage trail; failures legible, scrubbed, cause-typed.

**Independent Test**: quickstart Scenario 2 — one success and one malformed-HTML failure both fully inspectable; trail unchanged on re-read.

### Tests for User Story 2

- [x] T031 [P] [US2] Failing contract tests for `GET /v1/uploads/:kind/:id`: source payload shape (status, plugin, generation, counts, lastError, ordered events), batch payload (entryReport + per-source summaries), 404 unknown_thing in apps/api/src/ingestion/status.test.ts
- [x] T032 [P] [US2] Author malformed fixture (declares HTML, truncated garbage) in packages/ingestion-plugins/fixtures/rejects/truncated.html

### Implementation for User Story 2

- [x] T033 [US2] Implement ticket status endpoint per contracts/api.md in apps/api/src/ingestion/status.ts (registered in routes.ts) — T031 green
- [x] T034 [US2] Scrubbed failure propagation: driver writes sources.last_error `{class, stage, message}` on terminal failure, failed events carry stage-specific detail keys per contracts/events.md; DB-gated retry-then-fail test with T032's fixture in packages/ingestion/src/ingest-source.failure.test.ts
- [x] T035 [US2] Web ticket status page (loader on status endpoint, event-trail table, auto-revalidate while non-terminal — R12) in apps/web/app/routes/library.uploads.$ticket.tsx + route registration
- [x] T036 [US2] Append-only re-inspection test: after terminal state, trail re-reads byte-identical incl. all retry attempts (US2 AC-3, SC-006) added to packages/ingestion/src/ingest-source.failure.test.ts

**Checkpoint**: US1 + US2 — the full human journey (upload → watch → indexed/failed-with-reason) works in the browser (SC-001 web path now complete).

---

## Phase 5: User Story 3 — Honest front door: rejection, limits, duplicates (Priority: P3)

**Goal**: Unsupported/oversized refused at the door with zero residue; duplicates recognized by fingerprint; mixed ZIPs report per-entry outcomes.

**Independent Test**: quickstart Scenario 3 (two 415s + duplicate 200) and Scenario 4 (mixed ZIP).

### Tests for User Story 3

- [x] T037 [P] [US3] Author reject fixtures: synthetic sample.pdf (magic bytes only), renamed-binary fake.html in packages/ingestion-plugins/fixtures/rejects/
- [x] T038 [P] [US3] Failing intake hardening tests: PDF → 415 no-residue (rows counted before/after — SC-005), declared-vs-actual mismatch → 415, over-cap stream abort → 415, in apps/api/test/ingestion-intake.contract.test.ts (colocated with T028's intake contract tests, not a separate file — matches this repo's `*.contract.test.ts` convention)

### Implementation for User Story 3

- [x] T039 [US3] Implement magic-byte sniffing (html/markdown/text/zip signatures; mismatch policy per R7) and in-stream size-cap enforcement in packages/ingestion/src/sniff.ts (shared by both intake doors — API + worker expand — rather than API-only; used by routes.ts and ingest-batch-expand.ts) — T038 green. Built during T026-T027 admission-seam work; hardening tests added T038 confirm it.
- [x] T040 [US3] Dedupe path: unique (corpus_id, fingerprint) conflict → 200 `duplicate: true` with existing ticket, intake event notes duplicate (FR-003, SC-003), implemented in packages/ingestion/src/admit.ts (shared admission path, T026), tests in apps/api/test/ingestion-intake.contract.test.ts
- [x] T041 [US3] Mixed/empty ZIP handling proof: per-entry skipped events + entry_report reasons (already covered, T027/T029) plus zero-ingestible → batch status `empty` honest outcome (US3 AC-4, R6) — DB-gated tests in apps/worker/test/ingest-pipeline.test.ts, new export-empty.zip fixture

**Checkpoint**: Front door honest and residue-free under every refusal path.

---

## Phase 6: User Story 4 — Generic material through fallback ingesters (Priority: P4)

**Goal**: Markdown/plain-text and generic-HTML fallbacks catch what DDB doesn't claim; detection decisions recorded.

**Independent Test**: quickstart Scenario 6 — non-DDB HTML → generic-html; notes.md → markdown; candidates map visible in detect event.

### Tests for User Story 4

- [x] T042 [P] [US4] Author fixtures: notes.md (nested headings — already existed from T014/build-zips.mjs), plain.txt, blank.md (malformed case) in packages/ingestion-plugins/fixtures/markdown/; plain-article.html (non-DDB, already existed) in fixtures/html/
- [x] T043 [P] [US4] Failing conformance + heading-path tests for markdown plugin in packages/ingestion-plugins/src/markdown/markdown.test.ts
- [x] T044 [P] [US4] Failing conformance + fallback-confidence tests for generic-html plugin (must NOT claim DDB fixtures above 0.1 floor) in packages/ingestion-plugins/src/html/html.test.ts

### Implementation for User Story 4

- [x] T045 [P] [US4] Implement `markdown` plugin (heading trail → path via ATX heading walk, text/markdown + text/plain accepts, 0.1 fallback floor) in packages/ingestion-plugins/src/markdown/index.ts — T043 green
- [x] T046 [P] [US4] Implement `generic-html` plugin (cheerio heading/section walk, sanitized artifact, 0.1 floor) in packages/ingestion-plugins/src/html/index.ts — T044 green
- [x] T047 [US4] Registered fallbacks after ddb in packages/ingestion/src/shipped.ts (registry.ts itself is generic dispatch machinery, unchanged — the shipped LIST lives in shipped.ts); dispatch test: plain-article.html → generic-html wins, candidates map includes ddb-saved-html: 0 (US4 AC-2/3) in packages/ingestion/src/registry.dispatch.test.ts. Also updated apps/worker/test/ingest-pipeline.test.ts's e2e assertion — notes.md now ingests via markdown instead of the stale "no owner yet" expectation.

**Checkpoint**: All shipped FR-028 ingesters live behind one detection front.

---

## Phase 7: User Story 5 — Add a new ingester without touching the pipeline core (Priority: P5)

**Goal**: The extensibility promise proven (demo plugin, zero core diff) and the re-ingestion domain operations scaffolded for the lifecycle spec (pinned decision in contracts/api.md).

**Independent Test**: quickstart Scenarios 7–8 — demo plugin passes conformance with no packages/ingestion/src changes; plugin-version bump enumerates + re-ingests without duplicates.

### Tests for User Story 5

- [x] T048 [P] [US5] Failing DB-gated tests for `sourcesByPluginVersion()` (exact candidate enumeration, FR-016) and `reingestSource()` (generation N+1 job, flip, old-generation sweep, archive byte-identical — SC-008) in packages/ingestion/src/reingest.test.ts

### Implementation for User Story 5

- [x] T049 [US5] Implement `sourcesByPluginVersion()` + `reingestSource()` domain operations (no HTTP verb — decision pinned 2026-07-07 in contracts/api.md) in packages/ingestion/src/reingest.ts — T048 green
- [x] T050 [P] [US5] Author test-only `demo-format` plugin + synthetic fixture + conformance run in packages/ingestion-plugins/src/demo/index.ts + demo.test.ts; verified zero diff under packages/ingestion/src's PRODUCTION code (only reingest.ts's own export changed index.ts; demo-format appears nowhere in shipped.ts) — SC-007 reviewability confirmed via `git diff --stat`
- [x] T051 [US5] Confirmed every plugin's conformance suite already runs under `pnpm verify` (packages/ingestion-plugins' `vitest run` picks up all `*.test.ts` with no extra wiring — SC-010 holds structurally); added the plugin-version-bump re-ingest scenario to packages/ingestion/src/reingest.test.ts (no pipeline.e2e.test.ts file exists in this repo — the e2e suite lives at apps/worker/test/ingest-pipeline.test.ts per T029's actual location; reingest.test.ts is the natural home for this scenario). Added a `./demo` package.json subpath export on @stacks/ingestion-plugins so the test-only plugin is reachable across the package boundary without violating tsc's rootDir.

**Checkpoint**: All five stories independently green.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T052 [P] Teaching-comment pass — spot-checked across packages/ingestion*, apps/api/src/ingestion, apps/worker/src/handlers/ingest-*, apps/web/app/routes/library.*: every file already carries a Principle VIII header (file-in-architecture + spec/contract pointers + why-comments); no gaps found, no changes needed
- [x] T053 [P] Wrote docs/wiki/Ingestion.md (pipeline map, plugin seam, detection dispatch, generation-flip doctrine, storage) and linked from docs/wiki/Home.md (updated `updated` frontmatter + roadmap-continuation note) — the constitution's wiki-impact decision for this cycle
- [x] T054 [P] Updated AGENTS.md Layout (two new packages + ingestion routes/handlers) and Commands (fixture-regeneration command) sections
- [x] T055 Full-stack validation: `docker compose up -d --build --wait` (all 5 services healthy after fixing a pre-existing api-port mismatch in docker-compose.yml — see evidence.md), executed quickstart.md Scenarios 1-4/6 live (curl + web), 5/7/8/9/10 via the DB-gated suite; outcomes + SC coverage map recorded in specs/008-ingestion-service/evidence.md
- [x] T056 Final gate: `pnpm verify` + DB-gated suites + boundary rules all green (197 tests, 0 failures, exit 0); command output captured in evidence.md
- [x] T057 `/speckit-converge` reported converged (0 findings); ran `/spec-cycle-course` — six-module interactive course built briefs-first under docs/courses/008-ingestion-service/, verified rendering live in-browser (all modules, group-chat + flow animations, quizzes, no console errors, no duplicate-id bugs after fix), linked from evidence.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately; T002–T005 parallel after T001 (workspace file contention)
- **Foundational (Phase 2)**: needs Setup. T006→T007→T008 sequence; T009, T010 parallel with it; T011 after T010; T012 after T011. BLOCKS all stories
- **US1 (Phase 3)**: needs Phase 2. Internal: T013–T018 all parallel; T019 needs T013–T015; T020–T022 need their tests; T023–T025 sequential (same driver seam); T026–T027 need T024; T028 can start after T011 (schema) in parallel with the pipeline work; T029 needs T019–T028; T030 needs T028
- **US2 (Phase 4)**: needs US1's T024 (driver/events) + T028 (tickets). T031/T032 parallel first
- **US3 (Phase 5)**: needs US1's T028 (intake) + T027 (expand). T037/T038 parallel first
- **US4 (Phase 6)**: needs Phase 2 + T021 (registry); independent of US2/US3
- **US5 (Phase 7)**: needs US1's T024/T023 (generations, indexing); T050 independent of T048/T049
- **Polish (Phase 8)**: needs all desired stories; T052–T054 parallel; T055→T056→T057 sequential

### Story completion order

US1 → US2 → US3 → US4 → US5 (priority order). US4 may run in parallel with US2/US3 if staffed; US5 last (it *proves* the seam the others built).

## Parallel Example: User Story 1

```bash
# After Phase 2, launch the test-first wave together:
Task: "T013 recover ddb rules → specs/008-ingestion-service/ddb-rules.md"
Task: "T014 synthetic DDB fixtures → packages/ingestion-plugins/fixtures/ddb/"
Task: "T015 failing ddb plugin tests → packages/ingestion-plugins/src/ddb/ddb.test.ts"
Task: "T016 failing chunking tests → packages/ingestion/src/chunking.test.ts"
Task: "T017 failing registry tests → packages/ingestion/src/registry.test.ts"
Task: "T018 failing embed tests → packages/ingestion/src/embed.test.ts"
# Then the parallel implementation wave: T020, T021, T022 (different files)
```

## Implementation Strategy

**MVP first**: Phases 1–3 only, then STOP and validate US1 via quickstart Scenario 1 +
the retry test (SC-004). That alone is a demoable product increment: material in,
searchable traceable corpus out.

**Incremental delivery**: each story phase ends at a checkpoint that is independently
demonstrable; commit per task or logical group (skeleton habit), keeping `pnpm verify`
green at every checkpoint. The web journey completes at US2; front-door hardening (US3)
and fallbacks (US4) widen coverage; US5 cashes the extensibility promise and scaffolds
the lifecycle spec's re-ingest verbs.

**Total**: 57 tasks — Setup 5, Foundational 7, US1 18, US2 6, US3 5, US4 6, US5 4, Polish 6.
