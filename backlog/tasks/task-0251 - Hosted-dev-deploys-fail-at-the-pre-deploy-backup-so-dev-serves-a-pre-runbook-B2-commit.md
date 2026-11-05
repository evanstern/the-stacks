---
id: TASK-0251
title: >-
  Hosted dev deploys fail at the pre-deploy backup, so dev serves a
  pre-runbook-B2 commit
status: To Do
assignee: []
created_date: '2026-11-05 10:13'
labels:
  - ops
  - hosted-dev
milestone: m-3
dependencies: []
references:
  - docs/ops/dev-vm-104.md
priority: high
ordinal: 235000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: deploy-dev on push to main succeeds again, so hosted dev serves current main and the runbook B2 playtest can run there.

Why: since 2026-11-05 ~04:14Z every 'Deploy dev' run fails (first failure bd297a05; last success 1dd035f5 at 03:43Z). The log shows the db container recreated and healthy, then 'backup failed:' with an empty stderr from scripts/deploy-dev.mjs backup() (docker compose exec -T db pg_dump -Fc). Dev keeps serving 1dd035f5, which has none of runbook B2 (#133-#140). Drift dev fails alongside. Diagnosis needs vm-104 commands (runbook checkpoint C9: the operator's go on each exact command). Candidates: pg_dump racing the just-recreated db, the backups dir or disk, or the dev env file creds.

Related: TASK-0021 (hosted dev), TASK-0250 (the scenario that needs it), docs/ops/dev-vm-104.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The cause of the pre-deploy backup failure is identified and recorded
- [ ] #2 A Deploy dev run on main succeeds and dev's health reports the current main commit
- [ ] #3 The backup step reports pg_dump's stderr or exit code when it fails, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
