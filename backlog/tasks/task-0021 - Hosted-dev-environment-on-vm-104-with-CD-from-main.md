---
id: TASK-0021
title: Hosted dev environment on vm-104 with CD from main
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 02:43'
labels:
  - infra
milestone: m-1
dependencies:
  - TASK-0020
documentation:
  - backlog/docs/doc-0002 - Runtime-environments-—-proposal.md
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement doc-0002 CD and Exposure sections (decision-0006, ratified 2026-09-28). The dev environment on vm-104 is the always-on main app and runs main HEAD after green CI. Tailnet-only exposure; the Cloudflare tunnel is out of scope. Blocked on the four operator prerequisites in doc-0002 (disk, service user, runner registration, tailscaled repair), which need sudo on vm-104.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 vm-104 runs the stacks-dev compose project with persistent data
- [ ] #2 A push to main that passes CI deploys to dev automatically, runs migrations, and waits for /health to report the new commit
- [ ] #3 A failed deploy leaves the previous version serving and fails the job visibly
- [ ] #4 A scheduled drift check fails when dev's commit differs from main HEAD
- [ ] #5 dev is reachable over HTTPS on the tailnet and from nowhere else
- [ ] #6 A runbook documents deploy, rollback, and restore on vm-104
- [ ] #7 The doc-0002 operator prerequisites are verified on vm-104: at least 40 GiB free, a stacks user in the docker group, a runner registered to evanstern/the-stacks, and working tailnet SSH
<!-- AC:END -->



## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
