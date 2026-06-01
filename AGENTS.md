# AGENTS.md

This repository’s working app lives in `main/`. Treat that as the project root for day-to-day work, even if the outer checkout contains backups or other support files.

## Where to work

- Main app code: `main/apps/web`
- Backend and compose stack: the `main/` Docker Compose setup
- OMO plans and workflow notes: `.omo/`
- Avoid touching generated output, backups, and recovery material unless the task explicitly needs it, including `restart-backups/` and similar artifacts.

## OMO workflow

- Read `.omo/plans/` and any relevant `.omo/notepads/` entries before making changes when they exist.
- Keep changes aligned with the active plan and avoid broad cleanup outside the requested scope.
- If a task depends on project conventions, check `main/README.md` first.

## Local run and verification

- The Dockerized web app must keep host port `5173` available. Do not change that contract unless the task explicitly says so.
- Start the stack with `docker compose up --build` from `main/`.
- Verify backend and stack changes with `make test` and `make smoke` from `main/`.
- Verify web changes with `npm run build` from `main/apps/web`.

## Editing guidance

- Keep edits focused on the requested files only.
- Do not change app behavior, schemas, or workflow files unless the task calls for it.
- Preserve existing generated artifacts and backups unless they are part of the fix.

## Final check

- Before closing out a task, confirm the edited file still matches the repo layout and the commands above are the ones future agents should use.
