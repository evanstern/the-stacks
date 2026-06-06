# Quickstart: Live DB-Backed Queue Claim/Status Handling

## What this feature is for

This feature documents the live queue boundary so future work stays aligned with the current DB-backed claim/status flow. It is not a broker redesign and it does not add retry, cancel, or admin dashboard behavior.

## Read order

1. `specs/001-live-db-backed-queue/spec.md`
2. `specs/001-live-db-backed-queue/research.md`
3. `specs/001-live-db-backed-queue/data-model.md`
4. `main/docs/wiki/Layer Boundaries.md`
5. `main/docs/wiki/Queue Architecture.md`

## How to validate the boundary

From the repo root, confirm the canonical spec path resolves the live queue feature:

```bash
bash .specify/scripts/bash/setup-plan.sh --json
```

You should see `specs/001-live-db-backed-queue` in the resolved paths.

## How to sanity-check the current implementation

From `main/`, inspect the current queue seams in the backend:

```bash
make test
```

If host pytest is unavailable, use the repo's Docker fallback path documented in `main/README.md` and focus on the existing upload, worker, and queue-status tests.

## What not to do

- Do not treat this as a broker queue project.
- Do not add retry or cancel behavior here.
- Do not move ETL, chat, or corpus ownership into the queue boundary.
- Do not create a `contracts/` directory unless a future feature introduces a real external interface that needs one.
