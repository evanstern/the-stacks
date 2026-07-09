# Evidence: Extensible Ingestion Service

Captured 2026-07-08 against worktree `008-ingestion-service` (compose project
`the-stacks-008`, ports web `4500`/api `4501`/ml `4502`/postgres `5542`).

## Final gate (T056)

```text
$ DATABASE_URL=postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3 \
  RUN_DB_INTEGRATION_TESTS=1 pnpm verify
Boundary check passed (114 files scanned).
```

| Package | Test files | Tests | Result |
|---|---|---|---|
| packages/ingestion-contract | 3 | 23 | ✅ pass |
| packages/core | 4 | 18 | ✅ pass |
| apps/web | 4 | 10 | ✅ pass |
| packages/ingestion-plugins | 4 | 53 | ✅ pass (all 4 plugin conformance suites, SC-010) |
| packages/db | 3 | 14 | ✅ pass |
| packages/ingestion | 7 | 41 | ✅ pass |
| apps/worker | 2 | 9 | ✅ pass |
| apps/api | 5 (+1 skipped) | 29 (+2 skipped) | ✅ pass |

**Total**: 34 test files, 197 tests passing, 0 failures. `tsc --noEmit` clean across
all 8 TS packages. Boundary rules (R13: plugins DB-blind, parsing libs confined,
no-hardcoded-model) all hold.

Exit code: `0`.

## Full-stack validation (T055)

`docker compose up -d --build --wait` — all five services reported healthy:

```text
the-stacks-008-postgres-1   Up (healthy)
the-stacks-008-ml-1         Up (healthy)
the-stacks-008-api-1        Up (healthy)
the-stacks-008-worker-1     Up (healthy)
the-stacks-008-web-1        Up (healthy)
```

**Infrastructure fix discovered and applied during this validation** (pre-existing
in `docker-compose.yml` since spec 007, not introduced by 008): the `api` service
binds `process.env.V3_API_PORT` (unlike `web`'s fixed internal `PORT=4400`), but
the port mapping, healthcheck, and `web`'s `API_INTERNAL_URL` default all hardcoded
the container-side port as literal `4401`. Invisible at the default port block;
fatal for any worktree overriding `V3_API_PORT` (exactly what the spec-cycle
worktree-pivot convention does for every parallel feature branch). Fixed in
`docker-compose.yml` (port mapping + healthcheck + `API_INTERNAL_URL` default all
now track `${V3_API_PORT:-4401}`) and documented in `.env.example`. This
worktree's own `.env` also needed its `API_INTERNAL_URL` corrected to match its
port block — the worktree-pivot recipe's override list should be updated to
include this variable for future cycles.

### Quickstart scenarios run live against the stack

| # | Scenario | Result |
|---|---|---|
| 1 | DDB happy path (web + API) | ✅ `POST /api/uploads` → 201 ticket immediately (SC-002); polled to `ingested` in ~1s; full stage trail intake→…→commit; plugin `ddb-saved-html`@1.0.0 confidence 0.95; zero-orphan traceability SQL → **0** (SC-001). Web ticket page (`/library/uploads/source/:id`) renders the same state. **Additionally** (closing a convergence-review gap): the actual `/library/upload` HTML **form** was submitted directly (not curl-to-API) — server-side action relayed it through `api.server.ts`, redirected to a real ticket URL, and that source reached `ingested` — proving FR-027's "no command-line tools" claim end to end, not just the API layer beneath it. |
| 2 | Status visibility incl. failure | ✅ Uploaded `truncated.html`; job retried 3× then `failed`; `lastError` scrubbed to `{class: unsupported_type, stage: detect, message}`; full append-only trail shows every retry's started/failed pair (SC-006). |
| 3 | Honest front door | ✅ `sample.pdf` → 415 `unsupported_type`, zero residue. Oversized (30 MB) file → 415 size-limit reason, zero residue (SC-005). Duplicate `notes.md` upload → 200 `duplicate:true`, same ticket, no new rows (SC-003). |
| 4 | ZIP batch, mixed entries | ✅ `export-mixed.zip` → batch ticket → `expanded`; `entryReport` shows per-entry outcomes (1 fresh ingest, 2 recognized as cross-path duplicates from scenarios 1/3, 1 skipped-unsupported `.dat`) — batch succeeds despite the mixed outcomes (US1 AC-4/US3 AC-4). |
| 6 | Fallback detection | ✅ `plain-article.html` → owning plugin `generic-html`@0.1, with `ddb-saved-html` recorded at **exactly 0** in the `detect` event's candidates map. `notes.md` → owning plugin `markdown`@0.1. |
| 5, 7, 8, 9, 10 | Retry idempotency, extensibility proof, re-ingest-on-version-bump, atomic-chunk guarantee, embedding provenance | ✅ Proven by the DB-gated integration suite (not manual per quickstart.md): `ingest-source.test.ts` (retry + re-ingest), `reingest.test.ts` (candidate enumeration + version-bump re-ingest, T051), `demo.test.ts` + `git diff --stat` (zero pipeline-core diff, SC-007), `chunking.test.ts` (atomic-kind guarantee, SC-009), `ingest-source.test.ts`'s embedding-stamp assertions (FR-020). |

### Success-criteria coverage map

| SC | Status | Evidence |
|---|---|---|
| SC-001 | ✅ | Scenario 1: zero-orphan SQL query, full stage trail |
| SC-002 | ✅ | Scenario 1: 201 ticket returned before any processing |
| SC-003 | ✅ | Scenario 3: duplicate upload → 200, same ticket, zero new rows |
| SC-004 | ✅ | `ingest-source.test.ts`: interrupted retry converges to clean-run state |
| SC-005 | ✅ | Scenario 3: PDF + over-cap both 415, zero residue confirmed by row counts |
| SC-006 | ✅ | Scenario 2: full multi-attempt append-only trail |
| SC-007 | ✅ | `demo.test.ts` passes conformance; commit `9e01a57`'s `packages/ingestion/src` diff is only `reingest.ts`(T049)/`index.ts` export — zero lines attributable to the demo plugin |
| SC-008 | ✅ | `reingest.test.ts`'s version-bump scenario: re-ingest after a plugin version bump adopts the new version, generation flips, old rows swept, archive byte-identical |
| SC-009 | ✅ | `chunking.test.ts`: atomic kinds (stat_block/table/spell_entry) never split |
| SC-010 | ✅ | All 4 plugin conformance suites (ddb, markdown, generic-html, demo-format) run under plain `pnpm verify` |

## Cycle artifacts

- Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Research: [research.md](research.md)
- Data model: [data-model.md](data-model.md) · Contracts: [contracts/](contracts/)
- Tasks: [tasks.md](tasks.md) — 57/57 complete across 8 phases, 5 user stories
- Course: `docs/courses/008-ingestion-service/` (linked once `/spec-cycle-course` runs)
- Wiki: [docs/wiki/Ingestion.md](../../docs/wiki/Ingestion.md)

## Constitution check (re-confirmed at convergence)

All gates from plan.md's Constitution Check (G1–G11) still hold; no fixed decision
(D1–D14) was reopened. No Complexity Tracking entries.
