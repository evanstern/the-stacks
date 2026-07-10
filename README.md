# The Stacks

The Stacks is a TTRPG session harness: a local and deployable web app for running
sessions with authenticated chat, uploads, retrieval-backed answers, and records views
around material the operator supplies.

## What this project is

- A TTRPG session harness that helps operators run sessions with their own lawful
  campaign and reference material.
- A bring-your-own-books research library: retrieval-backed answers with real,
  durable citations.

## What this project is not

- It does not ship, download, scrape, or provide rulebooks.
- It does not include proprietary game data or bundled DnDBeyond exports.
- It does not replace ownership or licensing of source material.
- Users and operators must supply lawful content they have rights to use.

## Where the codebase is right now

This tree is the **v3 greenfield rebuild** (constitution v2.2.0, decisions D1–D14).
The delivered slice is the **walking skeleton** (`specs/007-v3-skeleton/`): a pnpm
monorepo, a five-service Docker Compose stack, single-operator auth, and an
end-to-end "skeleton check" that proves every architectural seam — UI → API →
Postgres job queue → worker → ML inference sidecar → pgvector write/read-back.
Ingestion, retrieval, and chat are the next specs, built on this foundation.

The previous app (**v2**) was retired on 2026-07-06 and removed from the working
tree; its code lives in git history (last full state: the parent of merge `cd9ed68` /
`docs/adr/0001-retire-v2-before-parity.md` records the decision). Its preserved
artifacts — the interactive course, historical wiki pages, the v2 inventory, and the
v2-era specs (001–006) — are staged under `.v2/` pending eventual deletion.

## Layout

```text
apps/
  api/      Fastify 5 — auth, health/ready, skeleton-check routes, error mapping
  worker/   TS queue consumer — SKIP LOCKED claims off the Postgres jobs table
  web/      React Router 7 SSR — the only published surface in prod
  ml/       Python 3.12 FastAPI sidecar — inference only, the only Python here
packages/
  core/     domain types, typed errors, env-first model-role config
  db/       Drizzle schema, migrations, queue + append-only event helpers
  ingestion-contract/  placeholder seam for the ingestion spec
scripts/    check-boundaries.mjs (architecture enforcement, runs in pnpm verify)
docs/       wiki, grounding docs, interactive courses
specs/      spec-kit feature specs (007 is the delivered slice; next specs build on it)
```

## Start the stack

In `main/`:

```bash
cp .env.example .env
# set the two required secrets — generation commands are documented in .env.example:
#   OPERATOR_PASSWORD_HASH   (bcrypt; escape every $ as $$ for compose)
#   SESSION_SECRET           (>= 32 random chars)
docker compose up -d --build --wait
```

In any other worktree, mint the derived environment instead of copying by hand —
ports and compose identity are per worktree (deterministic `default + 10×NNN` blocks;
protocol: `specs/009-library-surface-env/contracts/environment.md`):

```bash
node scripts/mint-worktree-env.mjs --secrets-from ../main/.env
docker compose up -d --build --wait
```

- Web (sign-in + skeleton-check UI): <http://localhost:4400>
- API: <http://localhost:4401> (`/health`, `/ready`) — dev-published only
- ML sidecar: <http://localhost:4402> (`/health`, `/ready`) — dev-published only
- Postgres + pgvector: `localhost:5442`

All ports are env-overridable (`V3_WEB_PORT` etc. — see `.env.example`); the URLs
above are `main/`'s block — feature worktrees land on their derived block (e.g. 009
→ 4490/4491/4492/5532). The prod
shape publishes only the web port:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --wait
```

## Verify

```bash
pnpm install
pnpm verify   # boundary check + typecheck + tests across every TS package
```

DB-gated integration suites (queue semantics, worker handler, migration lifecycle)
run when `RUN_DB_INTEGRATION_TESTS=1` and a Postgres is reachable at `DATABASE_URL`.
The Python sidecar has its own suite:

```bash
cd apps/ml && python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]" && pytest && pyright --project .
```

## Learn the codebase

Per constitution Principle VIII, every spec cycle ships learning artifacts:

- `docs/courses/007-v3-skeleton/index.html` — six-module interactive course on this
  codebase (open directly in a browser).
- Source files carry teaching-grade comments: file headers place each module in the
  architecture; why-comments explain doctrine and real bugs hit during validation.
- `docs/wiki/INDEX.md` — the architecture wiki spine (a code-grounded corpus; every
  note pins `verified_against` + `sources`); start at `docs/wiki/walking-skeleton.md`.

## Worktree operating model

This repo runs as a bare shared Git store plus worktrees: `.bare/` is plumbing,
`main/` is the deploy-oriented worktree, development happens in sibling worktrees,
and `.omo/` stays at the repository root beside them. Details:
`docs/worktree-operating-model.md`.
