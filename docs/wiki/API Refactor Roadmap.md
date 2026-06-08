---
title: API Refactor Roadmap
status: active
owner: docs
created: 2026-06-07
updated: 2026-06-08
tags:
  - wiki
  - roadmap
  - api
  - architecture
---

# API Refactor Roadmap

This page turns the R1 to R7 follow-ups from the API architecture review into a durable roadmap. It is the place to split future work into one Spec Kit feature at a time without having to reopen the review history.

Source of truth:

- `specs/002-api-architecture-review/api-architecture-review.md` for the original review findings and recommendation set.
- `docs/wiki/API Boundary Architecture.md` for the current durable API contract.
- `docs/wiki/Layer Boundaries.md` for the cross-layer seam map that stays concise.

## Sequencing

R1 and R3 are already being handled by the current API boundary work as reference and guardrail follow-ups. The new API boundary page already covers route ownership, service seams, error mapping, response contracts, and the preflight and postflight wiki rule, so keep these entries visible without turning them into separate runtime tasks unless a later phase needs a narrower spec.

R2 and R4 remain later implementation follow-ups unless another feature has already completed them. R2 should wait for the API boundary note to stay stable. R5, R6, and R7 stay as guardrail or reference items, and R7 remains a guardrail, not a queue redesign.

## R1 - API boundary reference note or wiki link

- **Recommended feature title**: API boundary reference note or wiki link
- **Priority**: P1
- **Why it exists**: Future backend work needs one stable place to read the route and service contract, not a trail of review notes and scattered reminders.
- **Proposed scope**: Keep the durable API boundary page linked from the wiki spine and make sure it stays the primary reference for route ownership, dependency seams, public errors, response contracts, and test seams.
- **Out of scope**: Runtime changes, new endpoints, and any attempt to move the full layer map into the API page.
- **Primary files to inspect**: `docs/wiki/API Boundary Architecture.md`, `docs/wiki/Home.md`, `docs/wiki/Layer Boundaries.md`, `specs/002-api-architecture-review/api-architecture-review.md`, `specs/003-backend-api-boundary/spec.md`
- **Likely tests or verification**: Read the API boundary page from `Home.md`, confirm the route and service contract is readable end to end, and run a placeholder scan on changed wiki pages.
- **Wiki pages likely affected**: `docs/wiki/Home.md`, `docs/wiki/API Boundary Architecture.md`, maybe `docs/wiki/Layer Boundaries.md` if a short pointer needs to stay aligned.
- **Dependencies**: Depends on the current API boundary page existing and staying current.
- **Suggested Spec Kit prompt seed**: Create a docs-only reference feature that keeps the API boundary note as the durable route and service contract, links it from the wiki spine, and preserves the thin cross-layer map.

## R2 - Bounded upload orchestration implementation before upload and archive intake expansion

- **Recommended feature title**: Upload Intake Service Seam
- **Priority**: P1
- **Why it exists**: Upload intake still mixes HTTP validation with helper-heavy orchestration, so the next slice should separate route adaptation from upload orchestration instead of leaving the boundary implicit.
- **Proposed scope**: Create `specs/004-upload-intake-service-seam/` as the next bounded implementation spec. `routes_uploads.py` should stay focused on HTTP adaptation while a small service seam owns upload orchestration and archive intake expansion.
- **Durable note**: [[Upload Intake Boundary]] preserves the review so later spec work can start from a stable decision record.
- **Out of scope**: Broad ETL rewrites, new archive features, or changing public upload behavior just to simplify the module.
- **Primary files to inspect**: `apps/api/app/routes_uploads.py`, `apps/api/app/ingestion.py`, `apps/api/app/routes_archives.py`, `docs/wiki/ETL Architecture.md`, `docs/wiki/API Boundary Architecture.md`
- **Likely tests or verification**: Compare current upload route responsibilities to the ETL wiki, review existing upload tests for contract coverage, and add only targeted tests if the review uncovers a real seam boundary.
- **Wiki pages likely affected**: `docs/wiki/ETL Architecture.md`, `docs/wiki/API Boundary Architecture.md`, possibly `docs/wiki/Layer Boundaries.md` if ownership lines change.
- **Dependencies**: Best handled after the API boundary note is in place and stable.
- **Suggested Spec Kit prompt seed**: Create `specs/004-upload-intake-service-seam/` as a narrow upload-intake implementation feature that keeps `routes_uploads.py` on HTTP adaptation and moves orchestration behind a small service seam.

## R3 - Public API error-mapping convention

- **Recommended feature title**: Public API error mapping convention
- **Priority**: P1
- **Why it exists**: Public failures already follow safe patterns in several routes, but the rule is spread across modules instead of being documented once.
- **Proposed scope**: Document the shared convention for 400, 401, 404, 413, 415, and safe server-failure handling, with examples taken from the current route modules. This is a reference and guardrail item, not a runtime slice.
- **Out of scope**: Reworking the whole error handling stack or changing status codes just to match the note.
- **Primary files to inspect**: `docs/wiki/API Boundary Architecture.md`, `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_ingestion.py`, `apps/api/app/routes_records.py`, `apps/api/app/routes_archives.py`, `apps/api/app/auth.py`
- **Likely tests or verification**: Check route modules and contract tests for existing safe error shapes, then confirm the convention matches what the API actually returns.
- **Wiki pages likely affected**: `docs/wiki/API Boundary Architecture.md`, maybe `docs/wiki/Layer Boundaries.md` if the error contract needs a short cross-layer pointer.
- **Dependencies**: Depends on the API boundary page and the route examples already being stable.
- **Suggested Spec Kit prompt seed**: Create a docs-only reference feature that records the public error mapping convention for API routes and ties it to the current route examples.

## R4 - Chat facade cleanup or naming decision for `chat_rag.py` and `chat_session_service.py`

- **Recommended feature title**: Chat facade cleanup or naming decision
- **Priority**: P2
- **Why it exists**: The chat boundary is clear in behavior, but the compatibility facade and service names still invite confusion when someone is trying to find the real orchestration point.
- **Proposed scope**: Decide whether `chat_rag.py` should stay as a compatibility facade, be renamed, or be retired in a later cleanup while keeping the existing chat tests and answer boundary intact. This is an implementation follow-up, not a docs note.
- **Out of scope**: Changing retrieval behavior, rewriting chat state flow, or moving unrelated route logic into the chat service.
- **Primary files to inspect**: `apps/api/app/chat_rag.py`, `apps/api/app/chat_session_service.py`, `apps/api/app/routes_sessions.py`, `apps/api/tests/test_chat_rag.py`, `docs/wiki/Chat Sessions Architecture.md`, `docs/wiki/API Boundary Architecture.md`
- **Likely tests or verification**: Run the chat tests that exercise the answer boundary, confirm the facade still preserves the same public behavior, and check import paths for clarity.
- **Wiki pages likely affected**: `docs/wiki/Chat Sessions Architecture.md`, `docs/wiki/API Boundary Architecture.md`.
- **Dependencies**: Should wait until the API boundary note is stable and the error mapping convention is settled.
- **Suggested Spec Kit prompt seed**: Create a chat boundary cleanup feature that clarifies the facade and service naming without changing the public chat contract.

## R5 - Response-contract review checklist for new route changes

- **Recommended feature title**: Response-contract review checklist
- **Priority**: P2
- **Why it exists**: Route changes can leak internal objects or drift from the public contract if the response shape is not checked every time.
- **Proposed scope**: Add a lightweight checklist that route authors can apply before merging new or changed response models, especially for auth, sessions, uploads, records, and archives. Treat this as a guardrail for future work, not a runtime slice.
- **Out of scope**: Editing every route now, or adding a new response framework just for the checklist.
- **Primary files to inspect**: `docs/wiki/API Boundary Architecture.md`, `apps/api/app/schemas.py`, `apps/api/app/routes_auth.py`, `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_records.py`, `apps/api/app/routes_archives.py`, `apps/api/tests/test_contracts.py`
- **Likely tests or verification**: Use the current contract tests as the first verification anchor and confirm the checklist points to them.
- **Wiki pages likely affected**: `docs/wiki/API Boundary Architecture.md`.
- **Dependencies**: Depends on the API boundary note and the current schema and route patterns staying recognizable.
- **Suggested Spec Kit prompt seed**: Create a response-contract checklist for future route changes that keeps public schemas and route responses aligned.

## R6 - Records and archive ownership coverage when those surfaces expand

- **Recommended feature title**: Records and archive ownership coverage
- **Priority**: P2
- **Why it exists**: Records and archive routes are support surfaces, and if they grow, the ownership line needs to stay obvious so they do not become catch-all modules.
- **Proposed scope**: Add targeted ownership and contract coverage for records and archive routes if those surfaces expand or start accumulating new responsibilities. This is a guardrail and coverage item, not a product slice.
- **Out of scope**: Reworking records or archive delivery now, or turning support routes into a new product area.
- **Primary files to inspect**: `apps/api/app/routes_records.py`, `apps/api/app/routes_archives.py`, `apps/api/app/models.py`, `docs/wiki/Layer Boundaries.md`, `docs/wiki/API Boundary Architecture.md`
- **Likely tests or verification**: Add focused route tests if the surface grows, then confirm the route keeps public metadata shaping and ownership boundaries clear.
- **Wiki pages likely affected**: `docs/wiki/Layer Boundaries.md`, `docs/wiki/API Boundary Architecture.md`.
- **Dependencies**: Should follow the API boundary note and only become active if records or archive scope actually expands.
- **Suggested Spec Kit prompt seed**: Create a targeted ownership and test follow-up for records and archive routes if those support surfaces gain new behavior.

## R7 - Queue scope guardrail

- **Recommended feature title**: Queue scope guardrail
- **Priority**: P3
- **Why it exists**: The queue story should stay grounded in the current DB-backed claim and status flow, not drift into a brokered design just because the API review mentioned queue work.
- **Proposed scope**: Keep queue follow-up separate from API architecture planning and document the guardrail wherever the queue boundary is discussed. This entry is guardrail-only.
- **Out of scope**: Brokered queue design, retry and cancel workflows, and any attempt to reframe ingestion as a queue platform.
- **Primary files to inspect**: `docs/wiki/Queue Architecture.md`, `docs/wiki/Layer Boundaries.md`, `specs/001-live-db-backed-queue/plan.md`, `specs/002-api-architecture-review/api-architecture-review.md`
- **Likely tests or verification**: Compare the queue page and the queue plan to confirm the current claim and status boundary stays intact.
- **Wiki pages likely affected**: `docs/wiki/Queue Architecture.md`, maybe `docs/wiki/Layer Boundaries.md` if the pointer needs a small refresh.
- **Dependencies**: Lowest priority. It should stay separate from the API boundary phases unless a later queue-specific feature needs it.
- **Suggested Spec Kit prompt seed**: Create a queue scope guardrail note that keeps queue work tied to the current DB-backed claim/status flow and out of API boundary planning.

## How to use this roadmap later

- Start from the phase that matches the next real change.
- Turn only one phase into a Spec Kit feature at a time.
- Keep the phase narrow enough that the implementation can finish without reopening the whole API review.
- If a later phase changes the wiki spine, update the linked pages and refresh their `updated` frontmatter in the same pass.
