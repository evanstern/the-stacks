---
title: Upload Intake Boundary
status: active
owner: docs
created: 2026-06-07
updated: 2026-06-07
tags:
  - wiki
  - architecture
  - api
  - etl
  - uploads
---

# Upload Intake Boundary

This page is the durable R2 note for the bounded upload orchestration review. It records the current split so later upload or archive intake work can start from a stable decision instead of reopening the original review.

## Why this exists

`routes_uploads.py` still does more than simple HTTP shaping. It validates uploads, creates jobs, expands batch uploads, stores archive uploads, and maps public failures. That is fine for now, but it is the boundary to review before any new upload or archive intake behavior is added.

The goal is not to rewrite ETL. The goal is to pin down what stays route-owned today, what already has a lower seam, and what should move only if a later spec needs it.

## What the route owns today

`routes_uploads.py` owns the HTTP side of intake:

- request parsing and public response codes
- filename, size, and media validation
- upload row and job row creation
- batch upload expansion
- archive upload handling and metadata shaping
- public-safe errors for invalid, duplicate, unsupported, oversized, or missing uploads

That mix is still coherent because it matches the current upload boundary. It just leaves the route as the place where orchestration pressure shows up first.

## What orchestration still lives in the route

The route also carries the work that starts to look like orchestration:

- stitching validation to persistence
- deciding whether an input is a single upload or a batch
- preparing archive-specific storage inputs
- coordinating the helper path before the worker ever sees a job

That is the part under review for R2. It is not a problem by itself. It is the part most likely to become messy if intake keeps growing.

## Seams that already exist

The code already has smaller seams, so the route is not the only place with structure.

- `archive_storage.py` handles archive storage concerns.
- `archive_repair.py` handles archive repair and related cleanup.
- `ingestion.py` owns the later ETL control flow after job creation.
- `ETL Architecture.md` already documents the upload-to-worker path.
- `API Boundary Architecture.md` already defines route ownership, dependency seams, public errors, response models, and route test seams.

Those seams matter because they show the decision is about placement, not about inventing a brand new architecture.

## Decision options

### Option 1: keep the route-led split

Keep `routes_uploads.py` as the intake orchestrator and continue tightening helper functions and tests around it.

- lowest change risk
- fine if upload growth stays modest
- leaves the module mixed and larger than a pure HTTP adapter

### Option 2: add a small upload intake service seam

Move the orchestration branch behind a small service and keep the route focused on HTTP adaptation and response mapping.

- cleaner ownership
- better fit if archive intake grows
- needs a careful seam so public errors and response shapes stay stable

The next implementation step for this option is `specs/004-upload-intake-service-seam/`.

### Option 3: split archive-specific orchestration first

Keep plain upload validation in the route, move archive-specific work behind a dedicated helper or service, and leave the rest alone.

- narrowest move
- useful if archive handling is the real pressure point
- does not fully solve the route-heavy upload module

## Recommendation

Favor Option 2 if the next spec needs more upload or archive intake behavior. It gives the cleanest long-term boundary without forcing a broad ETL rewrite.

If the next change is small, keep the current split and only harden the existing route with focused helpers or tests. Do not move code just to make the module look smaller.

## Non-goals

This review does not:

- change public upload behavior
- redesign ETL
- add new archive features
- move queue, retrieval, chat, or corpus concerns into upload intake
- reopen the whole API boundary note
- turn this into a broad refactor plan

## Verification anchors

If a later spec turns this note into code work, use these anchors:

- `docs/wiki/ETL Architecture.md` for the current upload intake and worker handoff
- `docs/wiki/API Boundary Architecture.md` for route ownership and public error rules
- `apps/api/tests/test_uploads.py` for upload contract coverage
- `apps/api/tests/test_contracts.py` for response-shape checks where needed
- `apps/api/app/routes_uploads.py` as the main boundary under review

For this durable note, verification is documentation-focused: confirm the placeholder scan passes on changed markdown and the wiki diff stays limited to the wiki pages.

## Follow-up path

If the next step becomes implementation, do not reopen this note as a general architecture discussion. Create a narrow spec for one of these paths:

1. `specs/004-upload-intake-service-seam/` for the upload intake service seam behind `routes_uploads.py`
2. archive-specific intake helper seam
3. route-only hardening for upload validation and batch behavior

Keep later specs small enough that they can finish without touching unrelated ETL or API boundary work.

## Related notes

- [[Home]]
- [[Layer Boundaries]]
- [[ETL Architecture]]
- [[API Boundary Architecture]]
- [[API Refactor Roadmap]]
