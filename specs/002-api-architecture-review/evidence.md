# Evidence log: API architecture review

Date: 2026-06-06

## Setup and prerequisite checks

- `SPECIFY_FEATURE=002-api-architecture-review SPECIFY_FEATURE_DIRECTORY=specs/002-api-architecture-review bash .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`
  - Result: resolved `FEATURE_DIR` to `/home/coda/projects/the-stacks/main/specs/002-api-architecture-review`.
  - Available docs: `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `tasks.md`.
- Checklist directory check: `specs/002-api-architecture-review/checklists` is absent, so no checklist gate blocked implementation.

## Ignore-file verification

- `git rev-parse --git-dir` succeeded and returned `/home/coda/projects/the-stacks/.bare/worktrees/main1`.
- `.gitignore` already covers `.env*`, `.venv/`, `venv/`, `__pycache__/`, `*.pyc`, `.pytest_cache/`, `node_modules/`, `dist/`, `build/`, `*.log`, temporary files, and editor folders.
- `.dockerignore`, `apps/api/.dockerignore`, and `apps/web/.dockerignore` already cover Docker, Python, Node, env, cache, log, and editor patterns relevant to this repository.
- No `.prettierrc*`, ESLint config, Terraform files, or Helm charts were detected, so no additional ignore files were needed.
- No ignore files were changed.

## Evidence commands

### Wiki architecture evidence

Command:

```bash
rg -n "architecture|boundary|contract|decision|owns|does not own|roadmap" docs/wiki
```

Summary:

- `docs/wiki/Home.md` defines the current architecture spine and says the corpus contract page is current state.
- `docs/wiki/Layer Boundaries.md` names concrete ownership seams for ETL, retrieval, corpus, chat, and queue.
- `docs/wiki/ETL Architecture.md` assigns upload validation/job creation to `routes_uploads.py` and host ETL flow to `ingestion.py`.
- `docs/wiki/ETL Plugin Contracts.md` keeps plugin output limited to normalized documents and loader intents.
- `docs/wiki/LangGraph ETL Decision.md` keeps LangGraph out of ETL and inside chat/RAG answer generation.
- `docs/wiki/RAG Retrieval Architecture.md` assigns answer-time retrieval scope, lookup, ranking, trace persistence, and weak-result behavior to retrieval.
- `docs/wiki/Corpus Management Architecture.md` defines the current `default-corpus` contract and active pointer rules.
- `docs/wiki/Chat Sessions Architecture.md` identifies `routes_sessions.py` as the thin HTTP boundary and `chat_session_service.py` as chat-turn orchestration owner.
- `docs/wiki/Queue Architecture.md` records the queue as deferred and current behavior as DB-backed claim/status flow.

### API surface evidence

Command:

```bash
rg -n "APIRouter|include_router|response_model|Depends\(|HTTPException|^class |^def " apps/api/app
```

Summary:

- `apps/api/app/main.py` includes auth, archives, ingestion, records, sessions, and uploads routers and defines `health()`.
- Route modules use `APIRouter`, `Depends`, `HTTPException`, and `response_model` consistently for public API surfaces.
- `apps/api/app/schemas.py` defines Pydantic API contracts for auth, sessions, messages, citations, uploads, jobs, events, records, chunks, retrieval runs, and stats.
- `apps/api/app/models.py` defines persisted entities surfaced through API reads: sessions, messages, retrieval runs/hits, citations, uploads, batches, sources, chunks, runtime versions, active pointers, lifecycle events, and ingestion events.
- `apps/api/app/retrieval_service.py`, `apps/api/app/chat_session_service.py`, `apps/api/app/ingestion.py`, and runtime/corpus modules hold most non-HTTP orchestration.

Note: the raw output was large and was truncated by the harness. The command completed, and the review records the relevant module-level summary rather than copying every line.

### API test seam evidence

Command:

```bash
rg -n "dependency_overrides|get_db|response_model|RetrievalService|answer_session_message|HTTPException" apps/api/tests
```

Summary:

- `apps/api/tests/test_auth.py`, `test_sessions.py`, `test_contracts.py`, `test_uploads.py`, and `test_worker_jobs.py` override `get_db` and `get_settings` for route tests.
- `apps/api/tests/test_chat_rag.py` overrides retrieval, embedding, Qdrant, chat, graph, DB, and settings dependencies around the chat route and service seam.
- `apps/api/tests/test_retrieval_service.py` directly tests `RetrievalService` behavior.
- Contract and upload tests exercise response shapes, safe errors, dependency overrides, and metadata handling.

## Contract cross-check

`specs/002-api-architecture-review/contracts/review-report.md` requires these sections:

- Scope: present in `api-architecture-review.md`.
- Evidence Inventory: present.
- Wiki Direction Summary: present.
- API Surface Map: present.
- Service and Pattern Map: present.
- Findings: present with category, severity, evidence, affected, impact, and next step.
- Recommendations: present with priority, follow-up type, expected benefit, risk if deferred, verification anchor, and wiki-impact.
- Non-Goals and Deferred Work: present.
- Verification Evidence: present here and summarized in the report.

## Validation commands

These commands were run after writing the report and marking tasks complete:

```bash
rg -n "NEEDS CLARIFICATION|TBD|\[FEATURE|\[###" specs/002-api-architecture-review --glob '!quickstart.md' --glob '!tasks.md' --glob '!evidence.md'
```

Result: no unresolved placeholder matches.

```bash
rg -n "category:|severity:|evidence|affected|impact|follow-up type|wiki-impact" specs/002-api-architecture-review/api-architecture-review.md
```

Result: matched findings, recommendations, and verification sections.

```bash
python3 - <<'PY'
from pathlib import Path
p = Path('specs/002-api-architecture-review/tasks.md')
lines = p.read_text().splitlines()
tasks = [line for line in lines if line.startswith('- [X] T') or line.startswith('- [ ] T')]
open_tasks = [line for line in tasks if line.startswith('- [ ]')]
done_tasks = [line for line in tasks if line.startswith('- [X]')]
print(f'total={len(tasks)}')
print(f'completed={len(done_tasks)}')
print(f'incomplete={len(open_tasks)}')
raise SystemExit(0 if len(tasks) == 40 and len(done_tasks) == 40 and not open_tasks else 1)
PY
```

Result: 40 total tasks, 40 completed, 0 incomplete.

```bash
git diff --name-only -- specs/002-api-architecture-review
```

Result: changes are limited to `specs/002-api-architecture-review` review artifacts within that path.

## Artifact-only change summary

- Added `specs/002-api-architecture-review/api-architecture-review.md` as the final review report.
- Added `specs/002-api-architecture-review/evidence.md` as the evidence and validation log.
- Updated `specs/002-api-architecture-review/tasks.md` so all T001-T040 tasks are marked `[X]`.

No runtime API files, tests, migrations, frontend files, or worker files were modified for this implementation.
