# AGENTS.md

The app checkout is this worktree. If you are one directory higher in the bare/worktree layout, enter `main/` before touching app code. `.bare/` is shared Git plumbing only; keep `.omo/` beside the worktrees, not inside `.bare/`.

## Start here

- Read `README.md` before changing local run, ports, production, corpus, or verification behavior.
- Read `specs/003-backend-api-boundary/plan.md` before backend API boundary work. That active slice is code-first: harden `POST /sessions/{session_id}/messages`, keep `apps/api/app/chat_session_service.py` as the workflow seam, preserve `ChatMessageEnvelope`, and use FastAPI dependency overrides in route tests.
- For architecture context, start at `docs/wiki/Home.md`; it links the current API boundary, layer, ETL, retrieval, corpus, chat, and queue notes. Update wiki `updated` frontmatter when changing those pages.
- Keep `.omo/plans/`, `.omo/notepads/`, and `.omo/evidence/` intact. Active plans and evidence live there even though app code lives in this worktree.

## Layout

- Backend API: `apps/api/app`; FastAPI app wiring is `apps/api/app/main.py` and routers live in `routes_*.py`.
- Backend tests: `apps/api/tests`; `conftest.py` puts `apps/api` on `sys.path`, so focused pytest paths work from the repo root.
- Web app: `apps/web/app`; Vite entry/config are `apps/web/src/main.tsx` and `apps/web/vite.config.ts`.
- Worker: `apps/worker/worker.py`; compose builds it with `apps/worker/Dockerfile`.
- Durable architecture docs: `docs/wiki/`; operational worktree rules: `docs/worktree-operating-model.md`.

## Commands

Run from this worktree root unless noted.

- Start current compose stack: `make up` or `docker compose up --build`; stop only this worktree's stack with `make down` or `docker compose down`.
- Backend suite: `make test` or focused `pytest apps/api/tests/test_sessions.py::test_name`. `make test` falls back to a no-deps API container if local pytest is missing.
- Local smoke script defaults to `API_URL=http://localhost:8000` and `WEB_URL=http://localhost:5173`. This checkout's `docker-compose.yml` currently publishes API on `8001` and web on `5174`, so use `API_URL=http://localhost:8001 WEB_URL=http://localhost:5174 make smoke` for this stack.
- Public/prod contract smoke: `make smoke-public`; defaults are local prod `http://localhost:8423` and public `https://thestacks.ikis.ai`.
- ETL live smoke: `make etl-live-smoke`; it starts only compose Postgres and Qdrant and uses deterministic local embeddings. Use an isolated `QDRANT_COLLECTION` when sharing a stack.
- Embedding eval: `make eval-embeddings`; override `EVAL_EMBEDDINGS_PROVIDER`, `EVAL_EMBEDDINGS_FORMAT`, `EVAL_EMBEDDINGS_TOP_K`, `EVAL_EMBEDDINGS_FIXTURE`, or `EVAL_EMBEDDINGS_ARGS` for comparisons.
- Web checks from `apps/web`: `npm run typecheck`, `npm run build`, and targeted UI verifiers such as `npm run verify:archive-upload-ui`. `npm run dev` and `npm run preview` use `--strictPort` on `5173`, so they fail instead of picking another port.
- Production retrieval health check requires the target API container running: `make corpus-doctor COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"`. If the container lacks the doctor subcommand, rebuild/recreate `api worker web` first.

## Ports and env

- Do not change the documented local `5173` web contract or production `8423` route contract casually. Current worktree compose maps host `5174 -> web:5173` and `8001 -> api:8000` to avoid clashing with the default stack.
- Compose uses `.env.example` plus `.env.webpage-5174` for local API/worker env. Production uses `.env.production` with `docker-compose.prod.yml`; keep production secrets and local dev env separate.
- Local compose service ports are host `5433 -> postgres:5432`, `6334 -> qdrant:6333`, `8001 -> api:8000`, and `5174 -> web:5173` in the current file. Use host `5433`/`6334` for local inspection even if README snippets mention default `5432`/`6333`.
- `scripts/route-preflight.sh` is read-only and refuses any production host port except `8423`.

## Project constraints

- The repository must not ship, download, scrape, or commit rulebooks, DnDBeyond exports, or other proprietary game data. Optional corpus archives are operator-supplied local files under `ARCHIVE_ROOT`.
- Corpus seed/reset commands operate on `default-corpus` by default and write the lock manifest under `../.omo/corpus/`; activation is separate from seed/reset.
- Runtime versions are identified by internal version IDs, not user labels. Reset/teardown paths are dry-run first and refuse active versions.
- Avoid editing generated output, backups, recovery artifacts, or workflow artifacts unless the task explicitly targets them.

## Backend patterns

- Keep routes thin. HTTP concerns stay in `routes_*.py`; workflow logic belongs in services such as `chat_session_service.py`, `retrieval_service.py`, ingestion, corpus, and lifecycle modules.
- Route tests should prefer `TestClient(app)` plus `app.dependency_overrides` for named FastAPI providers. Do not monkeypatch service internals when the route exposes a dependency seam.
- Preserve public-safe error shapes; tests in `test_contracts.py`, `test_chat_rag.py`, and `test_sessions.py` lock the session message boundary and missing-session/service-failure responses.
- New API/database behavior should be covered in `apps/api/tests` and, when schemas change, the Alembic history under `apps/api/alembic/versions`.

## OpenCode tooling

- Repo-local OpenCode config lives in `.opencode/opencode.jsonc`; `opencode debug config` should show `mcp.serena`, and `opencode mcp list` should show `serena connected` before relying on Serena tools.
- Serena is exposed to OpenCode as MCP; Serena may use LSP internally for semantic analysis. OpenCode LSP diagnostics are separate; this environment's LSP MCP points at `.opencode/lsp.json`, and Markdown diagnostics need their own server/config.
- Spec Kit command hooks under `.opencode/commands/` can run git scripts. `.opencode/commands/speckit.git.commit.md` stages and commits only when `.specify/extensions/git/git-config.yml` enables an auto-commit event; do not assume hooks are side-effect free.
- `.agents/skills/caveman*` are repo-local OpenCode skills; caveman mode is persistent until explicitly turned off, so say `stop caveman` or `normal mode` to revert.


## Worktree safety

- Compose identity, ports, volumes, and teardown are per worktree. Do not assume `docker compose down` in one checkout is safe for another checkout.
- Keep changes focused on the active plan or user request. If a task touches ETL architecture or settled refactor decisions, update `docs/wiki/` instead of scattering durable notes in ad hoc docs.
