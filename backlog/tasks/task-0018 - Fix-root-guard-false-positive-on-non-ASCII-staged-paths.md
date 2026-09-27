---
id: TASK-0018
title: Fix root-guard false positive on non-ASCII staged paths
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-27 15:06'
labels:
  - bug
  - tooling
dependencies: []
references:
  - .claude/hooks/root-guard-hook.mjs
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The root-guard hook wrongly blocks legitimate board-sync commits when any staged path under backlog/ contains a non-ASCII character.

At .claude/hooks/root-guard-hook.mjs:422 the staged set is read with 'git diff --cached --name-only' and split on newlines. Git's core.quotepath defaults to true, so a path containing non-ASCII bytes comes back C-quoted and wrapped in double quotes, for example "backlog/milestones/m-0 - m0-\342\200\224-skeleton.md". The check at line 427 then tests startsWith('backlog/'), which fails on the leading quote, and the commit is denied with reason 'staged-outside' naming a path that is in fact under backlog/.

Observed on 2026-09-22 while seeding this board: a milestone titled with an em-dash produced exactly this denial. Renaming the milestone to ASCII worked around it, but any task, decision, or milestone whose title carries an em-dash, an accented letter, or any other non-ASCII character will trip the guard again. Backlog titles are free text, so this is reachable by ordinary use.

The explicit-pathspec branch and the pre-write path check deserve the same review, since they compare raw git output the same way.

Spec: specs/008-rootguard-nonascii
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A board-sync commit whose staged paths under backlog/ contain non-ASCII characters is allowed at the root checkout
- [ ] #2 The staged set is read unambiguously, for example with -z and NUL splitting, or with core.quotepath disabled
- [ ] #3 A commit staging a genuinely non-backlog path is still blocked, including when that path contains non-ASCII characters
- [ ] #4 The explicit-pathspec branch and the pre-write path check are audited for the same quoting assumption and fixed if affected
- [ ] #5 A regression test covers a non-ASCII backlog path in both the allowed and the blocked direction
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
- [ ] #3 The revised hook is exercised against a real commit at the root checkout, not only unit tests, before it lands
<!-- DOD:END -->
