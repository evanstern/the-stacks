# AGENTS.md

The app checkout is this worktree. If you are one directory higher in the bare/worktree
layout, enter a worktree before touching app code. `.bare/` is shared Git plumbing only;

## Start here

- Read `README.md` before changing local run, ports, production, or verification behavior.
- The constitution (`.specify/memory/constitution.md`, v2.3.0) governs all work: fixed
  decisions D1–D14, TDD posture, Principle VIII (learning artifacts are deliverables),
  and the process automation rules (board, pinned wiki, versioning, CI gates —
  adopted by `docs/adr/0002-process-architecture-adoption.md`).
- For architecture context start at `docs/wiki/walking-skeleton.md` and
  `docs/wiki/ingestion.md`; the wiki spine is `docs/wiki/INDEX.md`. The wiki is a
  code-grounded corpus: every note pins `verified_against` (a commit) + `sources`
  (the files that invalidate it). When a source changes, re-verify the note against
  the diff and re-pin (`/grounding-wiki:wiki-update`) — never bump a pin blind.
- Spec history lives in `specs/` (spec-kit). Delivered slices: `specs/007-v3-skeleton/`
  (foundation), `specs/008-ingestion-service/` (extensible ingestion pipeline), and
  `specs/009-library-surface-env/` (library operator surface + worktree environment
  protocol). Retrieval and chat are the next specs.
- v2 was retired 2026-07-06 (`docs/adr/0001-retire-v2-before-parity.md`); its code lives in
  git history only. Do not resurrect v2 patterns from the wiki's historical pages without
  checking them against the v3 constitution.

## Board and process

- The kanban is `backlog/` (Backlog.md), committed and shared across worktrees. Write
  tasks ONLY via the `backlog` CLI (`backlog task create/edit/view`, `backlog board view`)
  — never edit files under `backlog/` by hand.
- Every spec cycle gets exactly one linked board task: `/spec-bridge:link specs/NNN-…`
  after the spec exists, `/spec-bridge:sync` after working the spec (and at cycle close).
  The spec dir is the source of truth; a linked task's status must never exceed what the
  artifacts prove — the spec-bridge Stop gate blocks it, and `spec-bridge`'s `check` CLI
  runs in CI. Edit a spec's linked task only from that spec's worktree; sync on main
  after merges.
- strictDone (requiring a saved `analysis.md` per spec) is OFF; turning it on means
  saving `/speckit-analyze` output as `specs/<feature>/analysis.md` first (ADR 0002).

## Versioning and release

- One repo-level semver in the root `package.json`. Touching released surface (`apps/`,
  `packages/`, `scripts/`, compose files, root manifests — authoritative list in
  `scripts/check-version-bump.mjs`) requires bumping it in the same PR; docs/specs/
  backlog/process changes are exempt. Versions are never reused.
- Merging to `main` with a new version auto-tags `v<version>` and cuts a GitHub Release
  (`.github/workflows/release.yml`). Merge with MERGE COMMITS only — never squash: wiki
  pins and evidence reference SHAs that must stay reachable.

## CI gates and local mirrors

- CI (`.github/workflows/ci.yml`) is authoritative: `pnpm verify` (+ DB suites against
  pgvector), the ML suite, wiki freshness, spec-bridge check, course gate
  (`scripts/check-courses.mjs`), spec-artifact closure (`scripts/check-spec-artifacts.mjs`
  — a fully-checked tasks.md owes evidence.md + the feature course), ADR format
  (`scripts/check-adrs.mjs`), and the version bump (PRs). The praxis gates run through
  praxis's versioned consumer contract (`run-gates.mjs`) from a `PRAXIS_REF`-pinned
  checkout (the composite action can't resolve: public repo, private praxis); bumping
  the pin is a deliberate PR. Locally, always resolve a praxis checkout to its
  PHYSICAL path before spawning `run-gates.mjs` (its run-as-CLI guard silently
  no-ops through symlinks).
- Local mirrors: enable git hooks once per clone with `git config core.hooksPath
  .githooks` (pre-commit: fast gates; pre-push: bump + freshness); the Claude Stop hook
  (`.claude/settings.json` → `scripts/stop-gates.mjs`) blocks a turn ending with stale
  wiki pins or broken spec/ADR ledgers.

## Layout

- API: `apps/api/src` — Fastify 5; composition root `app.ts`, process entry `main.ts`,
  routes in `auth/`, `skeleton-checks/`, and `ingestion/` (upload intake + ticket
  status, contracts/api.md).
- Worker: `apps/worker/src` — poll loop `main.ts`, job handlers in `handlers/` keyed by
  job `kind`, including `ingest-source.ts` and `ingest-batch-expand.ts`.
- Web: `apps/web/app` — React Router 7 SSR; the ONLY module allowed to reach the API is
  `app/lib/api.server.ts` (browser never calls the API — FR-019). Routes include
  `library.upload.tsx` and `library.uploads.$ticket.tsx`.
- ML sidecar: `apps/ml/src/ml` — FastAPI, inference-only, the only Python in the repo (D2).
- Shared packages: `packages/core` (domain types, typed errors, model roles, ingestion
  ID derivation), `packages/db` (Drizzle schema, migrations, queue + event helpers,
  ingestion schema/events), `packages/ingestion-contract` (the versioned
  NormalizedDocument + plugin contract + conformance suite, FR-013/018),
  `packages/ingestion` (pipeline core: registry, chunking, embed client, indexing,
  stage driver, re-ingestion — DB/queue/model-facing), `packages/ingestion-plugins`
  (shipped ingesters — ddb-saved-html, markdown, generic-html — structurally DB-blind,
  FR-014).
- Boundary enforcement: `scripts/check-boundaries.mjs`, wired into `pnpm verify` —
  also enforces the ingestion-plugins package's parsing-lib confinement (research R13).

## Commands

Run from the worktree root unless noted.

- Start the stack: `docker compose up -d --build --wait` (five services; requires `.env`
  from `.env.example` with the two documented secrets).
- Full verification: `pnpm verify` (boundary check + `tsc --noEmit` + vitest across all
  TS packages). DB-gated integration suites need `RUN_DB_INTEGRATION_TESTS=1` and a
  reachable `DATABASE_URL` (the compose Postgres on `localhost:5442` works). Each suite
  derives its OWN database from that URL (`ensureSuiteDatabase` in `@stacks/db`, unique
  suite id per test file) — suites run in parallel and can never truncate each other's
  rows. A new DB-gated test file gets its own suite id; never point one at the base URL.
- ML sidecar suite: `cd apps/ml && source .venv/bin/activate && pytest && pyright --project .`
  (create the venv with `python3 -m venv .venv && pip install -e ".[dev]"` first).
- New migration: `pnpm --filter @stacks/db generate --name <slug>` (drizzle-kit; the API
  applies pending migrations at boot, before binding its port).
- Focused tests: `pnpm --filter @stacks/api test`, `pnpm --filter @stacks/web test`, etc.
- Regenerate ingestion ZIP fixtures: `node packages/ingestion-plugins/fixtures/build-zips.mjs`
  (deterministic STORE-method writer; commit the result if fixture inputs changed).

## Ports and env

- `main/` defaults: web `4400`, api `4401` (dev only), ml `4402` (dev only), postgres
  `5442`; all dev publishes bind `127.0.0.1`. Every other worktree derives its block
  deterministically: `default + 10×NNN` (feature number), compose project
  `the-stacks-<worktree-dirname>` — see the protocol in
  specs/009-library-surface-env/contracts/environment.md.
- Mint a worktree's `.env` with `node scripts/mint-worktree-env.mjs --secrets-from
  ../main/.env` (refuses overwrite + sibling port collisions); check drift after
  `.env.example` changes with `--check`. Never copy `.env.example` by hand outside `main/`.
- Prod shape (`docker-compose.prod.yml` overlay) publishes ONLY the web port and sets
  `SESSION_COOKIE_SECURE=true`.
- `.env.example` is the variable contract (specs/009-library-surface-env/contracts/
  environment.md, superseding 007's). bcrypt hashes in `.env` need every `$` escaped
  as `$$` (compose interpolation) — the mint tool copies them verbatim.
- `main/`'s compose project name stays `the-stacks-v3` — container/volume names depend
  on it; feature worktrees get their own project identity from the protocol.

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
  linked from the feature's evidence — machine-checked: `check-spec-artifacts.mjs`
  fails CI without it, and the course must pass `node scripts/check-courses.mjs`.

## OpenCode tooling

- Repo-local OpenCode config lives in `.opencode/opencode.jsonc`; `opencode debug config`
  should show `mcp.serena`, and `opencode mcp list` should show `serena connected` before
  relying on Serena tools.
- Spec Kit command hooks under `.opencode/commands/` can run git scripts; do not assume
  hooks are side-effect free.

## Worktree safety

- Compose identity, ports, volumes, and teardown are per worktree BY CONSTRUCTION
  (009 protocol): lifecycle commands act only on the project named in the current
  worktree's `.env`, so `docker compose down` cannot touch another checkout's stack.
  Full teardown at worktree retirement is `docker compose down --volumes` BEFORE
  `git worktree remove` — zero residue (lifecycle table:
  specs/009-library-surface-env/contracts/environment.md §5).
- Keep changes focused on the active spec or user request. Durable architecture decisions
  go in `docs/wiki/` (with a wiki-impact decision), not ad hoc docs.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/009-library-surface-env/plan.md
<!-- SPECKIT END -->
