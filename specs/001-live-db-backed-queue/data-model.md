# Data Model: Live DB-Backed Queue Claim/Status Handling

## Overview

The current queue boundary is represented by ordinary database rows. The operator-visible queue state comes from batch rows, job rows, and job events, with worker claim state reflected through status transitions.

## Entities

### UploadBatch

- **Purpose**: Groups one or more uploads into a single operator-visible batch.
- **Key fields**: `id`, `status`, timestamps, and the batch-level deep link data used by the upload flow.
- **Relationships**: Has many `Upload` rows and many `IngestionJob` rows.
- **Notes**: Batch status is derived from child job state, so it is a summary view of the live DB-backed flow.

### Upload

- **Purpose**: Represents a submitted file or source artifact within a batch or a single upload.
- **Key fields**: Upload identity, source metadata, batch linkage, and per-item position when part of a batch.
- **Relationships**: Belongs to one `UploadBatch` when submitted in a batch and maps to one `IngestionJob`.

### IngestionJob

- **Purpose**: Represents the per-item unit of work that moves through the live queue boundary.
- **Key fields**: `id`, `status`, error fields, batch linkage, and the upload reference.
- **Relationships**: Belongs to one `UploadBatch`, belongs to one `Upload`, and emits one or more `IngestionEvent` rows.
- **Status role**: Status is the source of truth for whether the job is queued, processing, awaiting embedding, completed, or failed.

### IngestionEvent

- **Purpose**: Records event history for a job so operator tooling can inspect the lifecycle.
- **Key fields**: Event type, timestamps, job linkage, and batch linkage where applicable.
- **Relationships**: Belongs to one `IngestionJob` and is read by the job detail path.

### Queue claim state

- **Purpose**: The ephemeral claim state used by worker polling while a job is selected for processing.
- **Representation**: Not a separate broker record. It is reflected through row locking and status updates on the persisted job row.
- **Notes**: The live code uses database row locking for the claim, so claim state remains part of the DB-backed workflow rather than a detached queue service.

## Status flow

1. A batch is created with queued child jobs.
2. A worker claims the next eligible job with row locking.
3. The job status advances through processing and any follow-on states used by the existing ingestion path.
4. Batch status is derived from child job statuses for operator visibility.
5. Job events preserve the lifecycle trail for later inspection.

## Boundary rules

- ETL, chat, and corpus ownership stay in their current layers.
- Retry and cancel semantics are not part of this data model.
- Admin dashboards are not modeled here because they are out of scope.
- The plan does not introduce a new queue storage table or broker schema.
