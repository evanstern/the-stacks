---
id: TASK-0175
title: The Table landing lists the tables you play at
status: Done
assignee: []
created_date: '2026-10-29 01:52'
updated_date: '2026-11-02 23:14'
labels:
  - web
  - server
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-10-28-two-browser-alpha.md
priority: medium
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: /play lists the tables the signed-in account has a seat at (as a player or the DM), newest activity first, each with its scene title and a link. The operator also sees the tables they started. Start fresh and Join by link stay.

Why: two-browser alpha playtest 2026-10-28, item 8. After a system reboot the operator could not find the table again. /play (apps/web/app/routes/table.tsx) offers only 'start a fresh table' (a random id) and 'join by pasting a link or id'. Nothing lists past tables, so the only way back was browser history.

Spec: specs/069-table-landing-list
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A read route returns the sessions the signed-in account has a seat at or started, with scene title and last activity, and an integration test covers a player and the operator
- [x] #2 /play lists those tables newest activity first, each linking to play/:sessionId, in light and dark mode
- [x] #3 A player never sees a table they have no seat at, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook A (docs/design/m3-runbook-a-run3-fixes.md). Worktree .worktrees/task-0175, branch task-0175-table-landing-list, cut from origin/main 7e252840. Spec number 069 claimed with a stub. Lane A5.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Operator ruling 2026-11-02 (in chat, answering 'How should the remaining lanes get write access to .worktrees/?'): "Allow edits via Bash". The harness edit guard blocks Write/Edit outside the session worktree; dispatched agents edit worktree files through Bash (heredocs, sed, scripts) instead.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 069 authoring, C1)

Operator ruling 2026-11-02 (in chat, on spec 069 OQ-1 'which tables does the operator see'): "Every table (Recommended)". Spec 069 as written; no startedBy field.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 069 phase 1, 2a9a2d1b)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 069 phase 2, 0c8feec8)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 069 phases 3-4, 00ea3f40 58519171)

Hosted evidence, runbook A playtest run 1 (2026-11-02, session 9296c653): the operator left the table and returned through /play 'Your tables'; it worked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
/play lists the account's tables (newest activity first, scene title, relation) from the new GET /api/tables. The operator sees every table, and a player only sees tables with their seat. Brave evidence for the operator and a player at 1280/390, light and dark. Merged in PR #105.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
