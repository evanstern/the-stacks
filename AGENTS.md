# AGENTS.md

This repo’s working app lives in `main/`, not at the top level. Use the root for OMO coordination and `main/` for the actual app, compose stack, and web work.

## Workflow anchors

- Read `main/README.md` before changing anything that touches local run or verification behavior.
- Treat `.omo/plans/`, `.omo/notepads/`, and `.omo/evidence/` as part of the workflow; keep them intact and follow the active plan.
- Avoid editing generated output, backups, and recovery artifacts unless the task explicitly requires it.

## Where the app lives

- Main web app: `main/apps/web`
- Stack entrypoint and local runbook: `main/`
- If a task needs app code, work in `main/` subpaths, not the repository root.

## Local verification

- Keep the Dockerized web app on host port `5173`; do not change that contract unless asked.
- Use `make test` from `main/` for backend/stack verification.
- Use `make smoke` from `main/` for end-to-end local smoke checks.
- Use `npm run build` from `main/apps/web` for web build verification.

## Editing rules

- Keep changes focused and aligned with the active OMO plan.
- Do not change application behavior, schemas, or workflow artifacts unless the task calls for it.
- Prefer concise, practical updates that help the next agent continue safely.
