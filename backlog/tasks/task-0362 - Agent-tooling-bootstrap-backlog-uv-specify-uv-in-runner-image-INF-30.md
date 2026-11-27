---
id: TASK-0362
title: Agent tooling bootstrap (backlog/uv/specify) + uv in runner image (INF-30)
status: Done
assignee: []
created_date: '2026-11-27T07:47:35Z'
updated_date: '2026-11-27T07:47:43Z'
labels:
  - ws:ops
dependencies: []
ordinal: 345000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Idempotent no-root scripts/agent-bootstrap.sh installing backlog.md 1.57.4, uv 0.13.10, specify-cli (spec-kit v0.12.5); uv pin in deploy/runner/Dockerfile; docs/ops/agent-tooling.md. Docker access: rootless DinD chosen, enablement is a separate follow-up. Paperclip INF-30/INF-33.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged via PR #209 (squash), merge commit 0469f4c676a76edb1b81941c582c1b9d82fd9328. Delivers scripts/agent-bootstrap.sh, uv stage in deploy/runner/Dockerfile, docs/ops/agent-tooling.md. Rootless DinD enablement is a separate follow-up (CTO/Ops).
<!-- SECTION:FINAL_SUMMARY:END -->
