---
id: TASK-0351
title: Keep failing model replies so replay tests use real outputs
status: To Do
assignee: []
created_date: '2026-11-15T05:37:00Z'
labels:
  - ws:tooling
  - playtest
milestone: m-10
dependencies: []
priority: medium
ordinal: 335000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-0347 (spec 116). The two hosted dm.react schema failures from session 8c7d506e could not be recovered. dm_model_calls stores no reply text, and the log lines that kept part of each reply were lost when the vm-104 app restarted (2026-11-15 04:51 UTC). So the TASK-0347 replay fixtures had to be reconstructed. Under the operator ruling 'Approved, but automate the tests', a replay test should replay the real model output. Store the reply text, or a bounded excerpt, for every call whose outcome is not ok (schema-mismatch, invalid-json, truncated). Keep it in the call ledger, where an app restart cannot wipe it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A non-ok model call stores its reply text, bounded and redacted of secrets, in the call ledger, with a test.
- [ ] #2 The debug calls route and the playtest export include it, so a replay fixture can be built from a hosted failure.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
