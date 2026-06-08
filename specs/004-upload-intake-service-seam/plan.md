# Implementation Plan: Upload Intake Service Seam

**Feature Branch**: `[004-upload-intake-service-seam]`

**Plan Type**: Code-first feature package for the upload intake boundary.

## Summary

This feature introduces a small upload-intake service seam so `apps/api/app/routes_uploads.py` can stay a thin HTTP adapter. The route should keep request parsing, dependency wiring, response-model selection, public status codes, and safe error translation. The seam should own the upload orchestration branch that currently pressures the route, while the existing helper seams in `archive_storage.py`, `archive_repair.py`, and `ingestion.py` stay in place.

## Problem Statement

`routes_uploads.py` already does the right public-facing work, but it is carrying too much orchestration for future growth. Upload validation, single-versus-batch branching, archive-specific shaping, and downstream handoff are close enough to the HTTP edge that they still make sense together today, but the module is starting to look like a workflow coordinator rather than a pure boundary. This feature narrows that seam before the module grows further.

## Structure Decision

- Keep `routes_uploads.py` as the HTTP entrypoint for upload requests.
- Introduce a small upload-intake service or facade behind the route.
- Reuse `archive_storage.py` and `archive_repair.py` for archive-specific work.
- Keep `ingestion.py` as the downstream handoff seam.
- Leave `routes_archives.py` as a companion boundary for archive viewing and asset delivery, not as part of the intake orchestration.

## Scope

In scope:

- `POST /uploads` route delegation and response mapping.
- Public upload contract preservation.
- Archive-specific helper reuse.
- Route-test seam cleanup where the tests need a fake collaborator.
- Focused contract coverage in `test_uploads.py` and `test_contracts.py`.

Out of scope:

- Queue changes.
- Retrieval, chat, or corpus work.
- A broad ETL rewrite.
- New archive viewer behavior.
- Any public contract change not explicitly approved by the spec.

## Verification Strategy

- Use `apps/api/tests/test_uploads.py` for route-level upload behavior.
- Use `apps/api/tests/test_contracts.py` for response-shape and public-contract checks.
- Use focused route or service tests if the seam needs direct coverage.
- Keep FastAPI dependency overrides clean so the route stays testable without live collaborators.
- Finish with a placeholder scan on changed markdown and spec artifacts, plus a diff check limited to the intended docs and spec files during this planning pass.

## Implementation Notes

- Preserve existing public errors for invalid, duplicate, unsupported, oversized, and missing uploads.
- Avoid expanding `routes_archives.py` beyond its current archive viewer role.
- Do not fold archive repair or storage concerns into the route just because they are nearby.
- If a helper can stay where it is, keep it there and wire the seam around it instead of replacing it.

## Risks

- A new seam could accidentally change the public upload response shape if route mapping is moved too far from the HTTP layer.
- Archive-specific logic could be over-centralized if the helper seams are treated as disposable.
- Tests could become harder to read if the seam is introduced without a named provider or clear override path.

## Success Definition

This plan is successful when the later implementation can point to a small upload-intake seam, keep the route thin, preserve the upload contract, and prove the result with focused tests in `test_uploads.py` and `test_contracts.py`.
