---
id: TASK-0037
title: >-
  Fix dev runbook: compose commands run from the runner checkout, not
  /home/stacks/dev
status: To Do
assignee: []
created_date: '2026-09-30 00:56'
updated_date: '2026-11-08 19:55'
labels:
  - docs
  - infra
  - 'ws:platform'
milestone: m-10
dependencies: []
priority: low
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-09-29 creating dev's first operator (TASK-0036). docs/ops/dev-vm-104.md tells the operator to cd /home/stacks/dev before docker compose, but that directory holds only .env and backups/. The compose files live in the deploy runner's checkout at /home/stacks/actions-runner/_work/the-stacks/the-stacks. The command that worked on 2026-09-29 used that path with --env-file /home/stacks/dev/.env.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every docker compose command in docs/ops/dev-vm-104.md runs from the runner checkout path with --env-file /home/stacks/dev/.env
- [ ] #2 The hosted-dev wiki note states where the compose files live on vm-104
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md): merged into TASK-0101; its AC now live there. Archived.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
