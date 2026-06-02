# OMO Plan: Upload Delete Data Cleanup

## TL;DR
> **Summary**: Add a safe, authenticated delete flow from the uploads page so a user can delete one upload or source and all derived data, without touching the wrong source when a duplicate is selected. The delete must remove the upload record, source, ingestion job, chunks, indexed_chunks, documents, sections, events, retrieval references, Qdrant vectors, and the archive filesystem directory, then return a clear confirmation and idempotent result.
> **Deliverables**:
> - Uploads page delete action with confirmation UX and visible scope of deletion.
> - Authenticated backend delete endpoint with scoped deletion only.
> - Data cleanup across upload/source/job/chunks/indexed_chunks/documents/sections/events/retrieval references.
> - Qdrant point deletion and archive directory cleanup.
> - Regression tests for API, integration, filesystem, and UI behavior.
> **Effort**: Medium-Large
> **Parallel**: YES, in waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Final Verification

## Context

### Request
- Create an OMO-style implementation plan for an upload delete feature on the uploads page.
- The feature should let an authenticated user delete an upload or source and all associated data.
- The plan must match the style of existing plans in `.omo/plans` and stay actionable, not vague.

### Manual Cleanup Evidence
- A duplicate ingestion job was cleaned manually for job `efd28922-35d2-4e50-8b9f-0c5f05575765`.
- The duplicate source was `8758fe0c`.
- The original source `381679b8` remained intact.
- Cleanup removed `465` chunks and vectors.
- The archive directory was removed as part of the cleanup.
- This plan should treat that manual result as the reference behavior and must not accidentally delete the original when the duplicate is selected.

### Repo Areas Likely In Scope
- `main/apps/api/app/routes_uploads.py`
- `main/apps/api/app/ingestion.py`
- `main/apps/api/app/qdrant_index.py`
- `main/apps/api/app/models.py`
- `main/apps/api/tests/test_uploads.py`
- `main/apps/web/app/routes/uploads.tsx` or the current uploads page route/component
- `main/apps/web/app/lib/api.ts`

### Guardrails
- Deletion must be authenticated and scoped to the selected upload or source only.
- If a duplicate is selected, the original source must remain untouched.
- The endpoint must be idempotent and return sane 404 behavior for already-deleted records.
- Cleanup must be transactionally safe where the database can be, and failure handling must be explicit where Qdrant or filesystem steps happen outside the DB transaction.
- No raw filesystem paths should be exposed in the API or UI.
- No path traversal, no unsafe delete-by-string path behavior, and no unscoped delete that can cross source boundaries.

## Work Objectives

### Core Objective
Ship a safe delete workflow for uploads and sources that removes all generated and referenced data, gives the user a clear confirmation step, and stays resilient if one cleanup step fails.

### Deliverables
- Uploads page delete button, confirmation modal, and post-delete feedback.
- Backend delete endpoint for authenticated users.
- Database cleanup for upload, source, ingestion job, chunks, indexed_chunks, documents, sections, events, and retrieval references.
- Qdrant vector point deletion for the deleted source's indexed chunks.
- Archive filesystem cleanup for the deleted source only.
- Tests covering delete authorization, duplicate safety, idempotency, 404s, Qdrant cleanup, archive cleanup, and UI confirmation flow.

## Definition of Done

- The uploads page shows a delete action for a user's own upload or source.
- The confirmation UX makes the scope of deletion explicit before the request runs.
- The API only deletes the requested, authorized upload or source.
- Deleting a duplicate source removes only that duplicate's data, not the original source `381679b8`.
- The delete flow removes all associated records and references, including Qdrant vectors and archive files.
- Repeating the delete after success returns a safe idempotent response, or a 404 where that is the chosen contract, without corrupting other data.
- Tests and build checks pass for backend, web, and browser QA.

## Must Have

- Authentication and authorization checks on the delete endpoint.
- Deletion scope tied to one upload or source identifier, not a broad query.
- Safe handling for duplicate uploads and duplicate sources.
- Full data cleanup for upload/source/job/chunks/indexed_chunks/documents/sections/events/retrieval references.
- Qdrant point deletion for the source's indexed chunks.
- Archive filesystem cleanup for the deleted source directory.
- Confirmation UX on the uploads page with a destructive action affordance.
- Tests for success, already-deleted, unauthorized, wrong-target, and partial-failure scenarios.

## Must NOT Have

- No deleting the original source when a duplicate is selected by mistake.
- No unauthenticated delete path.
- No path traversal or raw server path exposure.
- No broad cascade delete that depends on a user supplied path string.
- No silent partial deletion that claims success while leaving orphaned vectors or archive files behind.
- No direct app code changes in this plan file.

## Verification Strategy

> ZERO HUMAN INTERVENTION, all verification is agent-run.

- API tests for delete success, auth, 404/idempotency, and duplicate safety.
- Integration test for upload deletion end to end.
- Qdrant point-count and payload checks before and after deletion.
- Filesystem check that the archive directory is removed for the deleted source and preserved for the original.
- Web build verification.
- Playwright or manual browser QA for the uploads page confirmation flow.

### Verification Commands and Scenarios

```bash
cd /home/coda/projects/the-stacks/main && make test
cd /home/coda/projects/the-stacks/main/apps/web && npm run build
```

- Run targeted backend tests around upload deletion, source cleanup, and authorization.
- Run a web UI test or Playwright scenario for the destructive confirmation modal.
- Check Qdrant point counts before and after deleting the duplicate source.
- Check that the archive directory for the duplicate source is removed and the original source directory remains.

## Execution Strategy

### Parallel Execution Waves
> Target: 4 to 6 tasks per wave. Keep the API, cleanup, and UI work moving in parallel once dependencies are clear.

- Wave 1: inspect current upload/source deletion patterns and identify exact call sites.
- Wave 2: design the backend delete contract and data cleanup boundaries.
- Wave 3: implement backend cleanup, Qdrant deletion, and filesystem removal.
- Wave 4: implement uploads page confirmation UX and API wiring.
- Wave 5: add API, integration, filesystem, and UI regression tests.
- Wave 6: run full verification and harden any edge cases found.

### Dependency Matrix

- Task 1 blocks all implementation tasks.
- Task 2 is blocked by Task 1 and blocks Tasks 3 through 6.
- Task 3 depends on Task 2 and blocks Tasks 4 and 5.
- Task 4 depends on Task 2 and can run in parallel with Task 3 once the API contract is fixed.
- Task 5 depends on Tasks 3 and 4.
- Task 6 depends on Tasks 3, 4, and 5.

### Agent Dispatch Summary

- Wave 1 → `deep`, `unspecified-high`
- Wave 2 → `unspecified-high`, `deep`
- Wave 3 → `unspecified-high`, `deep`
- Wave 4 → `visual-engineering`
- Wave 5 → `unspecified-high`, `visual-engineering`
- Wave 6 → `unspecified-high`

## TODOs

> Implementation + Test = ONE task. Keep each task atomic and verifiable.

- [ ] 1. Map the current upload and source deletion flow so the delete contract is precise

  **What to do**: Inspect the current upload, source, ingestion, and Qdrant code paths in `main/apps/api` and the uploads page in `main/apps/web`. Identify the exact record types that must be removed, how authorization currently works, and whether there is already a delete path that can be extended instead of replaced.
  
  **Why**: The delete endpoint must be scoped correctly before any code is changed, especially because the manual cleanup proved the duplicate source is the real target and the original source must survive.

  **Must NOT do**: Do not change app code in this task. Do not infer cleanup behavior without checking the actual models and routes.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: cross-cutting backend and UI mapping.
  - Skills: [`boot-identity`] - Keep context grounded.
  - Omitted: [`playwright`] - not needed yet.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2,3,4,5,6] | Blocked By: []

  **References**:
  - `main/apps/api/app/routes_uploads.py`
  - `main/apps/api/app/ingestion.py`
  - `main/apps/api/app/qdrant_index.py`
  - `main/apps/api/tests/test_uploads.py`
  - uploads page route/component under `main/apps/web/app`

  **Acceptance Criteria**:
  - [ ] Exact delete entrypoint and related models are identified.
  - [ ] The cleanup scope is documented for upload, source, job, chunks, indexed_chunks, documents, sections, events, retrieval references, Qdrant, and archive storage.
  - [ ] The safety rule for duplicate vs original source is explicit.

  **QA Scenarios**:
  ```text
  Scenario: Delete contract inventory
    Tool: Read/Search
    Steps: Inspect routes, models, and upload page components.
    Expected: The plan has exact file targets and no missing cleanup category.
  
  Scenario: Duplicate safety mapping
    Tool: Read/Search
    Steps: Trace how source IDs and job IDs are linked for duplicate ingestions.
    Expected: The original source `381679b8` is clearly distinct from duplicate `8758fe0c`.
  ```

- [ ] 2. Define the backend delete endpoint contract and transaction boundaries

  **What to do**: Specify the authenticated delete endpoint shape, request parameters, response codes, and deletion order. The contract should support scoped deletion of one upload or source, return 404 or idempotent success for already-deleted targets, and define how the database transaction, Qdrant cleanup, and filesystem cleanup interact.

  **Why**: The deletion flow needs a stable contract before implementation so the frontend, tests, and cleanup logic stay aligned.

  **Must NOT do**: Do not broaden deletion beyond the selected record. Do not expose raw filesystem paths in the API response. Do not assume Qdrant or filesystem work can be rolled back by the database.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: backend contract and failure handling.
  - Skills: []
  - Omitted: [`playwright`] - API-first task.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [3,4,5,6] | Blocked By: [1]

  **References**:
  - `main/apps/api/app/routes_uploads.py`
  - `main/apps/api/app/models.py`
  - `main/apps/api/app/qdrant_index.py`
  - `main/apps/api/tests/test_uploads.py`

  **Acceptance Criteria**:
  - [ ] Endpoint shape and auth model are written down.
  - [ ] Delete is scoped to a single user-owned upload or source.
  - [ ] Idempotency and 404 behavior are defined.
  - [ ] Transaction boundary and post-DB cleanup handling are documented.

  **QA Scenarios**:
  ```text
  Scenario: Delete contract behavior
    Tool: Bash/Read
    Steps: Review current auth and route patterns, then document response codes for success, unauthorized, not found, and already deleted.
    Expected: Contract matches the rest of the app and does not leak paths.
  
  Scenario: Cleanup failure policy
    Tool: Read
    Steps: Define what happens if Qdrant cleanup fails after the DB transaction commits.
    Expected: Behavior is explicit, observable, and safe, with no fake success.
  ```

- [ ] 3. Implement backend data cleanup for upload, source, job, and relational records

  **What to do**: Add the backend deletion logic in the API layer so one delete request removes the upload/source and all associated relational data. The cleanup must include the ingestion job, chunks, indexed_chunks, documents, sections, events, and retrieval references tied to that source.

  **Why**: This is the core safety work. The duplicate cleanup example showed 465 chunks and vectors removed, so the implementation must be equally complete and must not leave orphaned references.

  **Must NOT do**: Do not delete the original source when the duplicate is the selected target. Do not hardcode IDs. Do not rely on filesystem cleanup alone.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: backend delete and relationship traversal.
  - Skills: []
  - Omitted: [`playwright`] - backend implementation.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [5,6] | Blocked By: [2]

  **References**:
  - `main/apps/api/app/routes_uploads.py`
  - `main/apps/api/app/ingestion.py`
  - `main/apps/api/app/models.py`
  - `main/apps/api/tests/test_uploads.py`

  **Acceptance Criteria**:
  - [ ] Upload, source, job, chunks, indexed_chunks, documents, sections, events, and retrieval references are deleted for the selected target.
  - [ ] The duplicate cleanup path leaves the original source intact.
  - [ ] Repeating the delete request behaves safely.

  **QA Scenarios**:
  ```text
  Scenario: Scoped duplicate deletion
    Tool: Pytest/Bash
    Steps: Delete duplicate source `8758fe0c` in a fixture or test database.
    Expected: The duplicate data disappears and original source `381679b8` remains.
  
  Scenario: Idempotent repeat delete
    Tool: Pytest
    Steps: Call the delete endpoint twice for the same target.
    Expected: Second call returns safe 404 or idempotent response without extra side effects.
  ```

- [ ] 4. Add Qdrant point deletion and archive filesystem cleanup for deleted sources

  **What to do**: Extend deletion so Qdrant vector points for the deleted source's indexed chunks are removed and the archive directory for that source is deleted safely. Use internal source identifiers and stored metadata only, never raw user paths.

  **Why**: The manual cleanup removed 465 chunks and vectors and deleted the archive dir. This step makes that behavior deterministic and testable.

  **Must NOT do**: Do not delete files outside the source's owned archive directory. Do not construct delete paths from user-supplied raw strings. Do not leave the system claiming success if vector deletion fails silently.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: Qdrant and filesystem safety.
  - Skills: []
  - Omitted: [`playwright`] - backend/data task.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [5,6] | Blocked By: [2]

  **References**:
  - `main/apps/api/app/qdrant_index.py`
  - any source/archive storage helper under `main/apps/api/app`
  - `main/apps/api/tests/test_uploads.py`

  **Acceptance Criteria**:
  - [ ] Qdrant points for the deleted source are removed.
  - [ ] Archive directory cleanup is constrained to the deleted source only.
  - [ ] No path traversal or raw filesystem path exposure exists.

  **QA Scenarios**:
  ```text
  Scenario: Qdrant cleanup
    Tool: Bash/Pytest
    Steps: Capture point count and payloads before delete, run delete, then recheck the collection.
    Expected: Points associated with the deleted source are removed while unrelated data remains.
  
  Scenario: Archive directory removal
    Tool: Bash
    Steps: Verify the deleted source archive dir is removed and the original source dir still exists.
    Expected: Only the selected source's archive tree disappears.
  ```

- [ ] 5. Build the uploads page confirmation UX and delete wiring

  **What to do**: Add the frontend delete action on the uploads page, wire it to the authenticated backend endpoint, and show a confirmation UX that makes the scope of deletion obvious. The UI should make it hard to confuse a duplicate with the original source, ideally by showing source/job identifiers and the number of related records that will be removed.

  **Why**: The frontend is the last chance to prevent accidental deletion of the wrong source, especially in duplicate cases.

  **Must NOT do**: Do not trigger delete without confirmation. Do not show raw filesystem paths. Do not hide which source is selected.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: confirmation UX and destructive flow clarity.
  - Skills: [`boot-identity`]
  - Omitted: [`git-master`] - no git operations needed.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: [6] | Blocked By: [2]

  **References**:
  - `main/apps/web/app/routes/uploads.tsx` or current uploads page route/component
  - `main/apps/web/app/lib/api.ts`
  - any uploads list/detail components in `main/apps/web/app/components`

  **Acceptance Criteria**:
  - [ ] Delete action exists on the uploads page.
  - [ ] Confirmation modal or equivalent includes the source/upload being deleted.
  - [ ] UI communicates that all derived data will be removed.
  - [ ] The delete state handles success, failure, and already-deleted cases.

  **QA Scenarios**:
  ```text
  Scenario: Confirmation UX
    Tool: Playwright
    Steps: Open uploads page, choose a source, click delete, inspect confirmation copy, cancel, then confirm.
    Expected: The modal clearly identifies the target and no delete happens until confirm.
  
  Scenario: Duplicate clarity
    Tool: Playwright
    Steps: Present both duplicate and original in the list, then inspect the delete target labels.
    Expected: The user can distinguish duplicate `8758fe0c` from original `381679b8`.
  ```

- [ ] 6. Add regression tests for the delete flow, duplicate safety, and failure handling

  **What to do**: Add or update tests for API authorization, delete success, 404/idempotency, duplicate selection safety, Qdrant cleanup, archive cleanup, and the uploads page confirmation flow. Include a test that reflects the manual cleanup outcome, with the duplicate removed and the original preserved.

  **Why**: This feature is destructive, so the tests are part of the safety system, not an afterthought.

  **Must NOT do**: Do not write tests that only check the happy path. Do not leave out the original-vs-duplicate regression.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: mixed API and integration test coverage.
  - Skills: [`playwright`] for browser QA, if available.
  - Omitted: [`git-master`] - no history work.

  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: [] | Blocked By: [3,4,5]

  **References**:
  - `main/apps/api/tests/test_uploads.py`
  - any new integration test file under `main/apps/api/tests`
  - web UI test or Playwright scenario for uploads page

  **Acceptance Criteria**:
  - [ ] Authorization, success, 404/idempotency, and duplicate safety are covered.
  - [ ] Tests verify that the original source survives duplicate deletion.
  - [ ] Qdrant and archive cleanup are asserted.
  - [ ] Browser QA proves the confirmation flow is understandable.

  **QA Scenarios**:
  ```text
  Scenario: API regression coverage
    Tool: Pytest
    Steps: Run the upload delete test module and any related integration tests.
    Expected: Delete behavior is covered for auth, duplicate safety, and repeat requests.
  
  Scenario: End-to-end delete verification
    Tool: Playwright/Bash
    Steps: Upload or load a fixture with a duplicate source, delete the duplicate, then inspect DB/Qdrant/filesystem state.
    Expected: Duplicate data is gone, original remains, and archive cleanup is complete.
  ```

- [ ] 7. Run final verification across backend, web build, Qdrant state, and browser QA

  **What to do**: Execute the full verification set for the new delete feature. Confirm backend tests, web build, Qdrant point counts and payloads, archive directory cleanup, and upload page browser QA all pass.

  **Why**: The task is destructive and cross-cutting, so it needs a full end-to-end confidence pass before it can be considered complete.

  **Must NOT do**: Do not claim success without running the actual checks. Do not skip the filesystem and Qdrant validation.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: final verification across systems.
  - Skills: [`verification-before-completion`, `playwright`]
  - Omitted: [`git-master`] - no git work required.

  **Parallelization**: Can Parallel: NO | Wave 6 | Blocks: [] | Blocked By: [3,4,5,6]

  **References**:
  - `cd /home/coda/projects/the-stacks/main && make test`
  - `cd /home/coda/projects/the-stacks/main/apps/web && npm run build`
  - Qdrant dashboard/API on local stack
  - uploads page in the web app

  **Acceptance Criteria**:
  - [ ] Backend tests pass.
  - [ ] Web build passes.
  - [ ] Qdrant deletion is confirmed by point-count or payload checks.
  - [ ] Archive directory cleanup is confirmed.
  - [ ] Browser QA shows the destructive confirmation flow works.

  **QA Scenarios**:
  ```text
  Scenario: Final backend and web verification
    Tool: Bash
    Steps: Run `make test` from `main/` and `npm run build` from `main/apps/web`.
    Expected: Both commands exit 0.
  
  Scenario: State verification after delete
    Tool: Bash/Playwright
    Steps: Verify the deleted source's Qdrant vectors are gone, the archive dir is removed, and the uploads page reflects the deletion.
    Expected: No leftover derived data remains for the deleted source.
  ```
