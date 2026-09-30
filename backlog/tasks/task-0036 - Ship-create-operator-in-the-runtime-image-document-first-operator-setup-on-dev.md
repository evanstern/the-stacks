---
id: TASK-0036
title: >-
  Ship create-operator in the runtime image; document first-operator setup on
  dev
status: Done
assignee: []
created_date: '2026-09-29 22:58'
updated_date: '2026-09-30 01:02'
labels:
  - infra
  - auth
milestone: m-1
dependencies: []
priority: high
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-09-29 while preparing TASK-0030's dev load run (T026). The runtime image copies only apps/server/dist (tsconfig include: src), so scripts/create-operator.ts is absent in the container: 'Cannot find module /app/apps/server/scripts/create-operator.ts'. dev's Postgres is not published to the host, so the script cannot run from vm-104's shell either. dev therefore has no way to create its first operator account: its users table is empty. Operator ruling 2026-09-29: defer TASK-0030 T026 until this lands; the same account serves the M1 walkthrough (TASK-0031).

Spec: specs/023-create-operator-image
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The runtime image can create the first operator: e.g. a compiled entry point under dist, runnable with docker compose exec, keeping the existing interactive prompt and the refuse-if-exists rule
- [ ] #2 docs/ops/dev-vm-104.md gains a 'Create the first operator' section with the exact command; the password is typed at the prompt, never on the command line
- [ ] #3 The command is proven on a local stack; the real dev run is an operator step (vm-104 command consent)
- [ ] #4 TASK-0030 T026 (dev load run) runs after this merges, and its results file is committed
- [x] #5 Spec phase: US1 + US2 — compiled entry point (Priority: P1)
- [ ] #6 Spec phase: US3 — runbook and docs (Priority: P2)
- [ ] #7 Spec phase: Verification, local proof, re-grounding, cleanup
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
(spec authoring; standing escalation sign-off 2026-09-28; ~139k tokens). Design: git mv the script to src/cli/create-operator.ts (compiles into dist, which the image ships; no Dockerfile change); provisioning.ts gains hasOperator(db). check:host-scripts trimmed to config.ts + db.ts (the other imports existed only for this script) — flagged in the PR body, not a gate softening. Phase grouping: all three phases in one dispatch.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(all phases, one grouped dispatch: CLI moved to src/cli, compiled into dist; local proof create exit 0 / second run refuses exit 1 / dev-shaped command works; freshness OK 36). Orchestrator verified: no Dockerfile or .claude change; check:host-scripts drops only auth/password.ts and schema/auth.ts (imported only by the old uncompiled script).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (US1 + US2 — compiled entry point (Priority: P1): 6/6 · US3 — runbook and docs (Priority: P2): 2/2 · Verification, local proof, re-grounding, cleanup: 6/6). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
