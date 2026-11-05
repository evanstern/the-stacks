---
id: TASK-0251
title: >-
  Hosted dev deploys fail at the pre-deploy backup, so dev serves a
  pre-runbook-B2 commit
status: Done
assignee: []
created_date: '2026-11-05 10:13'
updated_date: '2026-11-05 14:58'
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
- [x] #1 The cause of the pre-deploy backup failure is identified and recorded
- [x] #2 A Deploy dev run on main succeeds and dev's health reports the current main commit
- [x] #3 The backup step reports pg_dump's stderr or exit code when it fails, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause (orchestrator, 2026-11-05, from code, no vm-104 command): scripts/deploy-dev.mjs backup() runs pg_dump through spawnSync with no maxBuffer, so stdout is capped at Node's 1 MiB default. Once the dev dump passed 1 MiB (playtest rows, dm_model_calls), spawnSync returns status null with error ENOBUFS and empty stderr — exactly the 'backup failed:' line with nothing after it. Reproduced locally: spawnSync of 2 MB output → status null, ENOBUFS, stderr ''. Fix: stream pg_dump to the backup file (stdout as a file descriptor), and report result.error and the exit status on failure. Not yet confirmed on vm-104 by dump size; a successful deploy after the fix confirms it.

Claimed 2026-11-05 by M3 runbook B2 (follow-up blocking checkpoint C7). Worktree .worktrees/task-0251, branch task-0251-deploy-backup, cut from origin/main b5362482. No spec dir: card ACs drive (a one-function ops fix; operator go 'Yes, diagnose it').

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=claude-haiku-5-5 (implementation, 401024ac; edits via Bash under the 'Allow edits via Bash' ruling after the app's path hook blocked Edit/Write)

Fix: backup() streams pg_dump to the file through an fd (no stdout buffer); on error or nonzero status it removes the partial file and throws backupFailureMessage (stderr, else error code, else exit status, else signal). Five node:test cases. Orchestrator check: the same spawnSync fd pattern wrote 5 MB at status 0, mode 600 (the old buffered call fails at 1 MiB with ENOBUFS). AC #2 confirms on the first Deploy dev run after merge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #142 (087ecb7f). Cause: spawnSync buffered pg_dump under Node's 1 MiB maxBuffer; dumps over 1 MiB failed ENOBUFS with empty stderr. backup() now streams to the file via an fd and names the failure (backupFailureMessage). Confirmed: Deploy dev on 087ecb7f succeeded (2026-11-05T14:56Z) and /health reports status ok, commit 087ecb7f. No vm-104 command was run.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
