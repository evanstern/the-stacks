# AGENTS.md

The app checkout is this worktree. If you are one directory higher in the bare/worktree
layout, enter a worktree before touching app code. `.bare/` is shared Git plumbing only;
keep `.omo/` beside the worktrees, not inside `.bare/`.

## Start here

- Read `README.md` before changing local run, ports, production, or verification behavior.
- The constitution (`.specify/memory/constitution.md`, v2.1.0) governs all work: fixed
  decisions D1–D14, TDD posture, Principle VIII (learning artifacts are deliverables).
- For architecture context start at `docs/wiki/Walking-Skeleton.md`; the wiki spine is
  `docs/wiki/Home.md`. Update wiki `updated` frontmatter when changing those pages.
- Spec history lives in `specs/` (spec-kit). The delivered slice is `specs/007-v3-skeleton/`;
  ingestion, retrieval, and chat are the next specs.
- v2 was retired 2026-07-06 (`docs/adr/0001-retire-v2-before-parity.md`); its code lives in
  git history only. Do not resurrect v2 patterns from the wiki's historical pages without
  checking them against the v3 constitution.

## Layout

- API: `apps/api/src` — Fastify 5; composition root `app.ts`, process entry `main.ts`,
  routes in `auth/` and `skeleton-checks/`.
- Worker: `apps/worker/src` — poll loop `main.ts`, job handlers in `handlers/` keyed by
  job `kind`.
- Web: `apps/web/app` — React Router 7 SSR; the ONLY module allowed to reach the API is
  `app/lib/api.server.ts` (browser never calls the API — FR-019).
- ML sidecar: `apps/ml/src/ml` — FastAPI, inference-only, the only Python in the repo (D2).
- Shared packages: `packages/core` (domain types, typed errors, model roles),
  `packages/db` (Drizzle schema, migrations, queue + event helpers),
  `packages/ingestion-contract` (placeholder seam).
- Boundary enforcement: `scripts/check-boundaries.mjs`, wired into `pnpm verify`.

## Commands

Run from the worktree root unless noted.

- Start the stack: `docker compose up -d --build --wait` (five services; requires `.env`
  from `.env.example` with the two documented secrets).
- Full verification: `pnpm verify` (boundary check + `tsc --noEmit` + vitest across all
  TS packages). DB-gated integration suites need `RUN_DB_INTEGRATION_TESTS=1` and a
  reachable `DATABASE_URL` (the compose Postgres on `localhost:5442` works).
- ML sidecar suite: `cd apps/ml && source .venv/bin/activate && pytest && pyright --project .`
  (create the venv with `python3 -m venv .venv && pip install -e ".[dev]"` first).
- New migration: `pnpm --filter @stacks/db generate --name <slug>` (drizzle-kit; the API
  applies pending migrations at boot, before binding its port).
- Focused tests: `pnpm --filter @stacks/api test`, `pnpm --filter @stacks/web test`, etc.

## Ports and env

- Defaults: web `4400`, api `4401` (dev only), ml `4402` (dev only), postgres `5442`.
  All env-overridable (`V3_*` vars); all dev publishes bind `127.0.0.1`.
- Prod shape (`docker-compose.prod.yml` overlay) publishes ONLY the web port and sets
  `SESSION_COOKIE_SECURE=true`.
- `.env.example` is the environment contract (specs/007-v3-skeleton/contracts/environment.md).
  bcrypt hashes in `.env` need every `$` escaped as `$$` (compose interpolation).
- Compose project name stays `the-stacks-v3` — container/volume names depend on it.

## Project constraints

- The repository must not ship, download, scrape, or commit rulebooks, DnDBeyond exports,
  or other proprietary game data (constitution Principle I).
- No hardcoded model identifiers in product code — model roles resolve env-first
  (Principle VII / D14); `check-boundaries.mjs` enforces this.
- `apps/web` must never import `@stacks/db` or another app's source (FR-019) — enforced.
- `skeleton_check_events` is append-only BY CONSTRUCTION: `recordEvent` in
  `packages/db/src/events.ts` is the sole writer; never add an UPDATE/DELETE path.
- Slow work is accept-then-async off the Postgres `jobs` table (D12, Principle IV);
  handlers throw typed `DomainError`s — HTTP mapping happens only in `apps/api/src/app.ts`.

## Code style (Principle VIII)

- Code is written to teach: file headers place each module in the architecture with
  spec/contract pointers; why-comments explain doctrine, invariants, and real bugs.
  Match that register — this deliberately supersedes minimal-comment conventions.
- Every spec cycle ends with a visual learning artifact under `docs/courses/<feature>/`,
  linked from the feature's evidence.

## OpenCode tooling

- Repo-local OpenCode config lives in `.opencode/opencode.jsonc`; `opencode debug config`
  should show `mcp.serena`, and `opencode mcp list` should show `serena connected` before
  relying on Serena tools.
- Spec Kit command hooks under `.opencode/commands/` can run git scripts; do not assume
  hooks are side-effect free.

## Worktree safety

- Compose identity, ports, volumes, and teardown are per worktree. Do not assume
  `docker compose down` in one checkout is safe for another checkout.
- Keep changes focused on the active spec or user request. Durable architecture decisions
  go in `docs/wiki/` (with a wiki-impact decision), not ad hoc docs.
