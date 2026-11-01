---
id: TASK-0186
title: >-
  Playtest-run skill: stand up, verify, checklist, watch turns, triage to the
  board
status: In Progress
assignee: []
created_date: '2026-11-01 21:09'
updated_date: '2026-11-01 21:21'
labels:
  - tooling
  - playtest
milestone: m-3
dependencies: []
priority: medium
ordinal: 173000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a repo-local skill (.claude/skills/playtest-run/) runs a human playtest end to end beside the operator: target set up and verified current, a derived checklist tracked in a file, every DM turn read and reported, and findings matched to existing cards or carded.

Why: alpha runs 1-3 (docs/playtests/2026-10-28-two-browser-alpha.md) were run by hand: preflight, checklist, Debug reads and carding were improvised each time. Operator request 2026-11-01.

Operator rulings 2026-11-01: hosted dev is read through the in-app browser pane (operator signs in once; the skill reads the /dm debug routes through that page, specs/037-debug-api/contracts/debug-api.md). Shape: one skill plus small scripts, run in the operator's session, no separate agent.

Design:
1. Target: a local worktree stack (pnpm env:up, migrate, optional DM_FAKE_SCRIPT) or hosted dev (vm-104).
2. Freshness: compare the intended commit with the deployed one (/health commit). List merged PRs and Done cards since the last run. Hosted actions (health, backup, deploy) are proposed as exact commands for the operator's go (vm-104 consent rule).
3. Checklist: derive items from cards merged since the last run, the card under test, and the last run's not-reached items. Keep stable ids across runs. Track each item's status in the run log (pending, pass, fail, blocked, not reached).
4. Watch: poll the debug events, jobs and calls routes with after-cursors. Per new turn report job kind and trigger, status, duration, model calls (outcome, retries, invalid-json), cost, and what the narration did. Reuse the auditor's deterministic checks (apps/server/src/playtest/auditor/checks.ts) where they fit. Keep a running cost total against the ceiling recorded on the card under test.
5. Triage: classify each finding with the log's classes. Search the board (backlog search, labels) for a covering card. Append evidence to a match; otherwise create a card with References to the log. Board commits go direct to main.
6. Wrap: run summary in the log, a note on the card under test, AC ticks only with evidence, and the log landed under docs/playtests/ by PR.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SKILL.md documents target setup for a local stack and for hosted dev, with every vm-104 command proposed for the operator's go
- [ ] #2 A freshness step reports intended versus deployed commit and the merged PRs and Done cards since the last run
- [ ] #3 A checklist is derived from the board and the previous run log and tracked in the run log with stable ids and statuses
- [ ] #4 A watch step reads the debug events, jobs and calls routes per turn, through the browser pane on hosted dev, and reports each turn
- [ ] #5 Each finding is matched against existing cards before a new card is created, and the run log records which
- [ ] #6 A run against a local stack in DM_FAKE_SCRIPT mode exercises every step and its log is committed as evidence
- [ ] #7 Rehearsal mode runs the full flow on a local stack with DM_FAKE_SCRIPT before a hosted run
- [ ] #8 Wrap runs the playtest auditor on the session and folds its verdict into the run summary
- [ ] #9 Not-reached checklist items roll forward to the next run under their stable ids
- [ ] #10 A spend tracker totals model-call cost per run against the card's ceiling and warns at 50% and 80%
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator, 2026-11-01: "Build it" — with the four suggestions added. Suggestions added to the design: (7) Rehearsal mode: a scripted-DM (DM_FAKE_SCRIPT) dry run on a local stack before every hosted run. (8) Reuse the auditor: run `pnpm playtest audit --session <id>` at wrap as a second opinion. (9) Stable checklist ids carried across runs; "not reached" items roll forward automatically. (10) Spend tracker: running cost from the calls ledger against the ceiling on the card under test, warn at 50% and 80%. No spec set: a direct operator request outside the M3 runbook; the card ACs drive the work.

Claimed 2026-11-01. Worktree .worktrees/task-0186, branch task-0186-playtest-run-skill, cut from origin/main 0479e5f3. No spec set (direct operator request, card ACs drive). Built by a sonnet-implementer using skill-creator.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
