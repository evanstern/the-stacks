# Quickstart: Library Operator Surface & Worktree Environment Protocol

**Feature**: 009-library-surface-env — runnable validation scenarios. Contracts:
[contracts/api.md](contracts/api.md), [contracts/environment.md](contracts/environment.md).

## Prerequisites

- `.env` present (mint it — that's scenario B1) with the two secrets set.
- Stack up: `docker compose up -d --build --wait` (five services healthy).
- Web app at `http://localhost:${V3_WEB_PORT}` (4400 in `main/`, derived elsewhere).

## Part A — library surface

### A1. Navigation (US1 / FR-001)

1. Log in; land on the home page.
2. **Expect**: a visible nav linking Home and Library on every protected page.
3. Follow Library → the listing; from the listing, reach the upload page (and back)
   without typing a URL.

### A2. Recover a lost ticket (US1 / FR-002, FR-003 / SC-001, SC-002)

1. Upload 2–3 files via `/library/upload` (fixtures:
   `packages/ingestion-plugins/fixtures/` — synthetic only, Principle I). Do NOT keep
   the ticket links.
2. Open the library listing.
3. **Expect**: each upload listed, newest first, with filename/kind/status/time;
   clicking a row lands on its ticket detail page (event trail visible). ≤ 3
   interactions from home; no DB access.

### A3. Evidence at a glance (US3 / FR-004..006 / SC-003)

Seed mixed outcomes: one good HTML file (→ `ingested`), one corrupt-but-sniffable file
(→ `failed`), one ZIP with a mix of supported/unsupported entries (→ partial batch).

**Expect from the listing alone**: plugin\@version + generation + section/chunk counts
on the ingested source; visibly distinguished failure with its stage on the failed
one; `ingested/skipped/failed` entry summary on the batch row.

### A4. Empty state & bounds (FR-007, FR-008)

- Fresh DB → listing shows an honest empty state pointing at the upload page.
- Upload > 50 submissions (script the intake endpoint) → page shows "X of Y" with
  working prev/next; response `items.length ≤ limit`.

### A5. Read-only guard (FR-009 / SC-007)

`grep -rn "app\.\(post\|put\|patch\|delete\)" apps/api/src/ingestion/` — the only
mutating route is 008's existing `POST /api/uploads`. The 009 diff adds `GET` only.

### A6. API contract check (contracts/api.md)

```bash
curl -s "http://localhost:${V3_API_PORT}/api/uploads?limit=2" -H "cookie: $SESSION"
# → 200 {items,total,limit,offset}; items[].kind ∈ {source,batch}; newest first
curl -s "http://localhost:${V3_API_PORT}/api/uploads?limit=nope" -H "cookie: $SESSION"
# → 400 typed refusal
curl -s "http://localhost:${V3_API_PORT}/api/uploads"   # no cookie
# → 401
```

## Part B — worktree environment protocol

### B1. Mint (US2 / FR-011, FR-013 / SC-005)

```bash
cd ../<feature-worktree>
node scripts/mint-worktree-env.mjs --secrets-from ../main/.env
```

**Expect**: `.env` created; printed profile table shows derived ports
(`default + 10×NNN`), `COMPOSE_PROJECT_NAME=the-stacks-<dirname>`,
`API_INTERNAL_URL` tracking the derived api port; secrets copied. Then
`docker compose up -d --build --wait` succeeds first try.

### B2. Refusal & collision detection (FR-013)

- Re-run the mint command → **refuses** (existing `.env`), tells you about `--force`.
- Hand-edit a sibling worktree's `.env` to share a port, re-mint with `--force`
  → **refuses**, naming the colliding worktree and port.

### B3. Two stacks, zero collisions (US2 / SC-004)

With `main/` and one feature worktree both minted and up:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'   # two disjoint name/port sets
```

Both `/ready` (api) endpoints answer on their own ports. This is verified live at this
cycle's own worktree pivot.

### B4. Teardown isolation (FR-015 / SC-006)

In the feature worktree: `docker compose down --volumes`. **Expect**: its
containers/networks/volumes gone (`docker volume ls | grep <project>` → empty);
`main/`'s stack still healthy.

### B5. Drift check (FR-016)

Remove any key from the worktree `.env`, run
`node scripts/mint-worktree-env.mjs --check` → nonzero exit naming the missing key;
restore, `--check` → clean.

## Test suites

- `pnpm verify` — boundaries + typecheck + unit tests (mint-tool derivation tests
  included).
- `RUN_DB_INTEGRATION_TESTS=1 pnpm --filter @stacks/api test` — list-endpoint
  integration suite (needs the compose Postgres).
- `pnpm --filter @stacks/web test` — listing page + nav tests.
