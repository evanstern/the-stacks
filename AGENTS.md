# AGENTS.md

This repo’s working app lives in `main/`, not at the top level. Use the root for OMO coordination and `main/` for the actual app, compose stack, and web work.

The repo runs as a bare shared Git store plus per-worktree checkouts. `.bare/` is shared Git plumbing only, development happens in worktrees, and `main` is deploy-only.

## Workflow anchors

- Read `main/README.md` before changing anything that touches local run or verification behavior.
- Treat `.omo/plans/`, `.omo/notepads/`, and `.omo/evidence/` as part of the workflow; keep them intact and follow the active plan.
- Keep `.omo/` at the repo root beside the worktrees. Do not move it into `.bare/` or treat `.bare/` as a place for tracked project docs.
- Avoid editing generated output, backups, and recovery artifacts unless the task explicitly requires it.
- Keep the ETL wiki under `main/docs/wiki/` current, and add new durable notes there instead of scattering them through ad hoc docs.

## Where the app lives

- Main web app: `main/apps/web`
- Stack entrypoint and local runbook: `main/`
- If a task needs app code, work in `main/` subpaths, not the repository root.
- If you are inside `main/`, remember that you are in a worktree, not in the shared Git plumbing under `.bare/`.
- For ETL refactor context, start at `docs/wiki/Home.md` and follow the linked notes before making changes.

## Local verification

- Keep the Dockerized web app on host port `5173`; do not change that contract unless asked.
- Compose identity, ports, and teardown are per-worktree. Use the current worktree’s stack name and stop only that stack.
- Use `make test` from `main/` for backend/stack verification.
- Use `make smoke` from `main/` for end-to-end local smoke checks.
- Use `npm run build` from `main/apps/web` for web build verification.

## Editing rules

- Keep changes focused and aligned with the active OMO plan.
- Do not change application behavior, schemas, or workflow artifacts unless the task calls for it.
- Prefer concise, practical updates that help the next agent continue safely.
- If you need the operational model, start with `main/docs/worktree-operating-model.md`.
