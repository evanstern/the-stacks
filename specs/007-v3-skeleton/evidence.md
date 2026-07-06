# Evidence log: v3 Walking Skeleton

Date: 2026-07-05

All scenarios below were run live against a real Docker Compose stack (Docker
29.6.1, macOS/arm64) built from this feature's code, not simulated. Every
`pnpm verify` and `pytest` run cited was executed in this session.

## Scenario 1 — One-command startup and sign-in (SC-001)

```bash
cd v3 && cp .env.example .env   # OPERATOR_PASSWORD_HASH / SESSION_SECRET filled in
docker compose up -d --build --wait
```

- Result: all 5 services (`postgres`, `api`, `ml`, `worker`, `web`) reported
  `healthy`. First build (cold, real model download) completed and passed
  `--wait`; a second full rebuild after code changes completed in well under
  3 minutes.
- `curl localhost:4401/ready` → `{"status":"ready","checks":{"database":"ready","migrations":"applied"}}`
- `curl localhost:4402/ready` → `{"status":"ready","model":"sentence-transformers/all-MiniLM-L6-v2","dimensions":384}`
- Sign-in via `POST /login` (form-encoded, matching the real browser flow):
  correct password → 302 to `/` with a sealed `HttpOnly; SameSite=Lax` cookie;
  wrong password → 200 rendering "Sign-in failed." inline, no cookie set.
- `docker compose restart`: all 5 containers healthy again immediately; the
  pre-restart session cookie remained valid afterward (`docker compose
  restart` doesn't touch the named Postgres volume), confirming data-intact
  fast restart (acceptance 1.4).

## Scenario 2 — Skeleton check crosses every seam (SC-002, budget < 60 s)

Triggered via `POST /?index` (the real `<Form method="post">` action, form
action attribute confirmed baked into SSR HTML as `/?index` — React Router's
index-route disambiguation convention).

- Run completed `accepted → succeeded` in **~1 second** (createdAt
  `19:59:56.359Z`, completedAt `19:59:57.289Z`).
- All six events present in order with timings: `queued`, `claimed`,
  `inference` (31ms, `model` stamped), `vector_write` (1ms), `vector_readback`
  (1ms, `distance: 0`), `completed`.
- Vector block: `provider: "local-sidecar"`, `model:
  "sentence-transformers/all-MiniLM-L6-v2"`, `dimensions: 384` — matches the
  `.env` embedding-role config exactly (acceptance 2.3, FR-014).
- Web detail view (`GET /skeleton-checks/:id`) renders `Status: succeeded` and
  the same event trail server-side.

## Scenario 3 — Legible failure and recovery (SC-003, budget < 30 s)

```bash
docker compose stop ml
# trigger from the API
```

- Run failed in **<1 second**: `outcome: {"class":"dependency_down","seam":"inference", ...}`;
  event trail ends at `inference` with `ok:false`.
- `docker compose start ml`, waited for `/ready`, triggered a new run: succeeded
  with no manual cleanup, reusing the same deterministic vector id as prior
  runs.

## Scenario 4 — Idempotent re-runs (SC-007)

Three separate runs across this session (before/after two rebuilds, plus the
post-recovery run in Scenario 3) all resolved to the **identical** vector id
`8d6a972b7024290b3e535fe86d1559ca921c080131f59dadbb11e14d10c16603`, with
`vector_write` events showing `deduplicated: true` on every run after the
first. Also proven at the unit/integration level:
`packages/core/test/skeleton-check.test.ts` (`deriveVectorId` determinism) and
`apps/worker/test/skeleton-check.test.ts` ("re-running with identical input
reuses the same vector id and flags deduplicated") — both green against real
Postgres.

## Scenario 5 — Developer verification (SC-005, budget < 10 min)

```bash
cd v3 && pnpm install && pnpm verify
```

- Measured wall-clock: **10.4 s** (boundary check + `tsc --noEmit` + `vitest
  run` across `core`, `db`, `ingestion-contract`, `api`, `worker`, `web`) — all
  green, 0 failures.
- Migration-lifecycle drill (`apps/api/test/migrations.test.ts`, gated behind
  `RUN_DB_INTEGRATION_TESTS`): against an empty Postgres, migration `0001`
  applies and records exactly one row in `drizzle.__drizzle_migrations`; a
  dynamically-added trivial second migration (comment-only `ALTER`) applies
  incrementally on the next `runMigrations()` call, recording a second row —
  both assertions passed against a real Postgres+pgvector container.

## Scenario 6 — v2 coexistence (SC-004)

Started v2's full stack (`docker compose up -d --build --wait` at the repo
root, dummy `OPENAI_API_KEY`/generated `ADMIN_PASSWORD_HASH`/`SESSION_SECRET`)
simultaneously with the already-running v3 stack:

```text
rag-retrieval-api-operations-api-1        0.0.0.0:8001->8000/tcp
rag-retrieval-api-operations-postgres-1   127.0.0.1:5433->5432/tcp
rag-retrieval-api-operations-qdrant-1     127.0.0.1:6334->6333/tcp
rag-retrieval-api-operations-web-1        0.0.0.0:5174->5173/tcp
rag-retrieval-api-operations-worker-1     (no published port)
the-stacks-v3-api-1                       127.0.0.1:4401->4401/tcp
the-stacks-v3-ml-1                        127.0.0.1:4402->4402/tcp
the-stacks-v3-postgres-1                  127.0.0.1:5442->5432/tcp
the-stacks-v3-web-1                       127.0.0.1:4400->4400/tcp
the-stacks-v3-worker-1                    (no published port)
```

All 10 containers across both stacks reported `healthy` simultaneously. Zero
port collisions. Volumes fully disjoint: `rag-retrieval-api-operations-*` vs
`the-stacks-v3_*`.

`make smoke` (v2's documented smoke check) was attempted
(`API_URL=http://localhost:8001 WEB_URL=http://localhost:5174 make smoke`) but
failed immediately on `mktemp: unrecognized option --suffix=.md` — a
pre-existing v2 script portability gap against macOS's BSD `mktemp` (GNU
coreutils syntax), unrelated to v3 and not introduced by this feature. Not
fixed here (out of scope: v2 script hygiene, not v3 coexistence). The
infrastructural coexistence claim (disjoint ports/containers/volumes, both
stacks healthy) is fully verified above by direct inspection regardless.

v2's stack was torn down (`docker compose down -v`) after this check to leave
the environment as found; v3 was left running and healthy throughout.

## Scenario 7 — No secrets, no hardcoded models (SC-006)

```bash
grep -rn "sentence-transformers" v3/apps v3/packages --include='*.ts' --include='*.tsx' --include='*.py'
git -C v3 grep -iE 'sk-[a-zA-Z0-9]|password.*=.*[^example]' -- ':!*.example'
```

- Model-id hits: only in test fixtures (`packages/core/test/*.test.ts`,
  `apps/web/test/skeleton-checks.test.tsx`) and the vendored
  `apps/ml/.venv` (a gitignored virtualenv, absent on a fresh checkout before
  `pip install`). Zero hits in product code. `v3/scripts/check-boundaries.mjs`
  encodes this same rule (excluding test files) and is wired into `pnpm
  verify`, so this stays enforced going forward rather than being a one-time
  manual check.
- Secrets grep: only variable-name matches (`const password = ...`,
  `id="password"`) and test literals (`"correct-password"`); zero actual
  secret values (no `sk-`-prefixed strings, no real hashes/keys) anywhere in
  tracked source.

## Bugs found and fixed during live validation

1. **pg Pool crash on dependency-down.** `createDbClient` didn't attach a
   `pool.on('error', ...)` listener; node-postgres crashes the process on an
   unhandled idle-client error. Stopping the DB crashed the API instead of
   `/ready` surfacing 503. Fixed in `packages/db/src/client.ts`; regression
   test added (`packages/db/test/client.test.ts`).
2. **Dockerfiles missing `tsconfig.base.json`.** All three Node Dockerfiles
   copied `packages`/`apps` but not the root `tsconfig.base.json` that every
   package's `tsconfig.json` extends, breaking `apps/web`'s SSR build inside
   Docker (`TSConfckParseError`). Fixed by adding it to each `COPY` line.
3. **Docker Compose `.env` interpolation mangles bcrypt hashes.** Compose
   interpolates `.env` file values themselves (to support cross-references
   like `ML_EMBEDDING_MODEL=${EMBEDDING_MODEL_ID}`), so a bcrypt hash's
   literal `$2b$10$...` gets partially parsed as variable references,
   silently corrupting `OPERATOR_PASSWORD_HASH`. Documented the required
   `$$`-escaping directly in `.env.example`'s comment.
4. **Worker missing `EMBEDDING_PROVIDER` env var** in `docker-compose.yml` —
   `resolveModelRole('embedding')` threw a plain `Error` (not a `DomainError`)
   that the handler's inner try/catch (scoped to the `embed()` call only)
   didn't cover, leaving runs stuck at `status: "running"` forever while only
   the underlying job quietly retried. Fixed the missing env var and hardened
   `skeletonCheckHandler` with a top-level catch-all so *any* unexpected
   pre-inference error still fails the run.
5. **Test-only harness bug**: hand-rolled `createMemoryRouter` +
   `RouterProvider` never resolves its pending "initial hydration" state for
   a route whose only work is its own mount-time loader (no user-driven
   navigation to trigger a subsequent render) — the DOM stayed permanently
   empty despite the loader resolving correctly. Switched those specific
   tests to React Router's `createRoutesStub`, which is built for exactly
   this. Not a product bug; confined to `apps/web/test/*.test.tsx`.

## Convergence pass (Phase 7, T050-T051)

A `/speckit-converge` run re-tested the feature live rather than re-reading
docs, and found two real gaps, both now closed:

- **T050** (HIGH): actually ran `pnpm --filter @stacks/db generate` for a
  trivial schema change and it produced `0001_trivial_drill.sql`, colliding
  with the existing `0001_init.sql`. Traced to `drizzle-orm`'s
  `readMigrationFiles`: it applies migrations by `tag` and content hash in
  journal array order and never reads `idx` — `idx` is used only by
  `generate` to compute the next prefix (`lastEntry.idx + 1`). T010's earlier
  manual rename of drizzle-kit's native `0000_init.sql` to `0001_init.sql`
  (to match doc prose) left the journal's `idx: 0` mismatched with the `0001`
  tag, so every future `generate` would collide. Fixed by correcting the
  journal entry to `idx: 1` — no file rename, no doc changes needed, since
  the fix is purely to the tooling-facing counter, not the applied migration.
  Re-verified live: `generate` now produces `0002_...`; re-ran the T039
  migration-lifecycle test against a fresh Postgres+pgvector container —
  still green.
- **T051** (MEDIUM): added the two missing API-contract tests
  (`skeleton-checks.contract.test.ts`) pinning that a `succeeded` run's
  detail response includes `vector` and omits `outcome`, and a `failed`
  run's includes `outcome` and omits `vector` — closing the gap between
  `data-model.md`'s claimed test coverage and what was actually pinned.

`pnpm verify` after both fixes: still green, all 6 skeleton-checks contract
tests (4 original + 2 new) pass against live Postgres.
