# Research: Live DB-Backed Queue Claim/Status Handling

## Scope check

This feature documents the current queue boundary only. It does not propose a brokered queue, a new retry model, cancel semantics, or ownership changes in ETL, chat, or corpus layers.

## Findings

### 1. The live queue boundary already exists in code

- `main/apps/api/app/ingestion.py` is the current claim path. It selects queued jobs with row locking and advances them through status changes.
- `main/apps/worker/worker.py` polls `process_next_job(db)` in a loop, which makes the live behavior a worker-driven DB claim flow rather than a broker subscription model.
- `main/apps/api/app/routes_uploads.py` creates the batch and job rows that the rest of the app reads.
- `main/apps/api/app/routes_ingestion.py` exposes job status and event history for the operator-facing read path.

### 2. The wiki already frames queue as current-state DB-backed handling

- `main/docs/wiki/Layer Boundaries.md` says queue remains a future concern and only names the current DB-backed claim/status flow.
- `main/docs/wiki/Queue Architecture.md` says the live queue behavior is a database-backed claim/status flow and that there is no standalone brokered queue design today.

### 3. The boundary is carried by ordinary persisted rows

- `main/apps/api/app/models.py` holds the queue-related row shapes, including `UploadBatch`, `IngestionJob`, and `IngestionEvent`.
- Batch status is derived from child job status, so the operator-visible view comes from persisted state, not from a separate queue subsystem.

## Plan impact

- The canonical artifact set belongs in `specs/001-live-db-backed-queue/` because the branch and the setup-plan helper both resolve there.
- No `contracts/` directory is needed. This feature documents an existing boundary rather than introducing a new external contract surface.
- The durable architecture decision remains in the wiki. This planning pass only captures the current state in a clean, canonical spec bundle.

## Open caveat

- If a future task turns this into a brokered queue, that work needs its own spec and wiki update. That is out of scope here.
