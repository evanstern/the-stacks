# Evidence: Library Operator Surface & Worktree Environment Protocol

**Feature**: 009-library-surface-env | **Assembled**: 2026-07-10 | **Branch**: `009-library-surface-env`

Verification record for the converge gate. Every claim below was executed fresh
during this cycle against the 009 worktree stack (ports 4490/4491/4492/5532,
project `the-stacks-009-library-surface-env`) unless noted.

## Success criteria

| SC | Verdict | Evidence |
|---|---|---|
| SC-001 ≤3 interactions, no URL typing | ✅ | Nav header (protected layout) → `/library` → row link → ticket page; live-rendered rows verified via server HTML with session cookie (quickstart A1/A2) |
| SC-002 lost ticket recoverable <30s at 100+ | ✅ | Listing is newest-first with filename identity; verified live at 57 submissions with paging ("Showing 51 – 57 of 57", Newer/Older) |
| SC-003 corpus state from the listing alone | ✅ | Real worker output rendered: `ddb-saved-html@1.0.0 · gen 1 · sections · passages` (source), `4 entries: 2 ingested · 2 skipped · 0 failed` (batch); failure treatment covered by API+web tests (seeded lastError → `failed at chunk (internal_fault)`, `data-failed=true`) |
| SC-004 two stacks, zero collisions | ✅ | `main/` (the-stacks-v3, 4400 block) + 009 stack up concurrently: 10 containers, disjoint names/ports (`docker ps` capture), 4 public endpoints 200 |
| SC-005 one-step mint → first-try start | ✅ | 009 worktree: manual pivot per derivation rule, stack `--wait` healthy first try; `main/.env` minted BY the tool, stack healthy first try |
| SC-006 teardown leaves others untouched | ✅ | `docker compose down --volumes` on main → zero `the-stacks-v3_*` volumes remain; 009 `/ready` 200 and `/library` still serving during and after |
| SC-007 zero new mutating operations | ✅ | Quickstart A5 grep: only mutating route in `apps/api/src/ingestion/` is 008's `POST /api/uploads`; 009's diff adds one GET |

## Functional requirements — spot verification

- **FR-001..008 (surface)**: 10 API contract tests (`apps/api/test/ingestion-list.contract.test.ts`)
  + 7 web tests (`apps/web/test/library-list.test.tsx`), all TDD-first; live A1–A4, A6.
- **FR-009 (read-only)**: A5 grep above; re-ingestion/corpus mutation untouched (pinned
  to corpus-lifecycle spec, 2026-07-07).
- **FR-010 (seam)**: listing consumed only via `lib/api.server.ts` (`listUploads`);
  boundary check green (118 files).
- **FR-011..016 (protocol)**: 10 node-test derivation tests in `pnpm verify`; live
  B1–B5: mint (main, by tool), refusal on existing `.env`, collision refusal naming
  `../scratch-collision` port 4492, drift exit 2 naming `WORKER_POLL_MS`, clean recheck.
- **FR-017 (succession)**: supersession banner on 007 contract; `.env.example` header,
  AGENTS.md, README all point at `contracts/environment.md` (009).
- **FR-018 (visibility avenues)**: table below.

## Visibility avenues (constitution v2.2.0, Principle V)

| Capability | Avenue | Verified |
|---|---|---|
| Library listing + upload/ticket pages | Web UI, reachable via nav on every protected page | Live: nav present on `/`, `/library` renders; typed-URL-only reachability eliminated |
| `GET /api/uploads` | Consumed by the web UI; contract documented (contracts/api.md) | A6 curls: 200 envelope / 400 typed / 401 |
| Worktree env protocol | CLI output (mint profile table, `--check` report) + contracts/environment.md + AGENTS.md/README | B1–B5 transcripts this cycle |
| Docker lifecycle rules | Documentation (contract §5, AGENTS.md worktree safety, wiki) | B4 live teardown proof |

## Wiki-impact decision

The worktree environment protocol is a durable operating-model decision →
**wiki page added**: `docs/wiki/Worktree-Environments.md`, linked from
`docs/wiki/Home.md` (frontmatter `updated: 2026-07-10`). Part A (library surface)
is feature-level product surface, recorded in spec artifacts; no additional wiki
page needed beyond the Ingestion page's existing scope.

## Notable implementation decisions (beyond plan)

- **`invalid_input` (400)** joined `unauthorized` as an API-only error code:
  Fastify schema-validation failures previously fell through to the scrubbed 500;
  malformed paging now earns an honest 400 (`apps/api/src/errors.ts`, `app.ts`).
- **Constant queries per page is 5, not research R3's 3**: 1 page + 1 total +
  3 grouped aggregates (sections, chunks, batch member statuses — the last needed
  because the expand report can't know post-admission member outcomes). The
  requirement that holds is "constant regardless of page size."
- **drizzle `ANY(array)` hazard**: the sql template expands JS arrays into
  comma-joined params — valid in `IN (...)`, broken in `ANY(...)`. Aggregates use
  explicit IN lists (why-comment in `list.ts`).

## Test & verify summary

- `pnpm verify` (boundaries + node-test protocol suite + typecheck + vitest): green.
- DB-gated: `RUN_DB_INTEGRATION_TESTS=1 pnpm --filter @stacks/api test` → 39 passed.
- Web: 17 passed. Protocol: 10 passed (in verify).

## Learning artifact (Principle VIII)

Course: [docs/courses/009-library-surface-env/index.html](../../docs/courses/009-library-surface-env/index.html)
— six interactive modules (invisible library / submissions timeline / navigation shell /
honest 400 / ports by arithmetic / bug ledger), skilled-developer register, seeded from
this feature's spec artifacts + teaching-commented source via /spec-cycle-course →
/codebase-to-course (briefs-first; briefs committed alongside). Real data throughout:
the live ids, the 57-submission paging run, the collision/drift transcripts, and this
cycle's three real bugs.
