---
id: TASK-0034
title: 'env:up inherits shared keys from the root .env'
status: To Do
assignee: []
created_date: '2026-09-29 20:19'
labels:
  - infra
milestone: m-1
dependencies: []
priority: high
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator request 2026-09-29: keep one .env in the main checkout (secrets such as NINEROUTER_API_KEY, and shared AI_PROVIDERS/AI_PURPOSES) and reuse it in every worktree, instead of copying it by hand. A symlinked or copied .env cannot work: env:up rewrites each worktree's .env with that worktree's derived ports, and a copy goes stale. So when env:up builds a worktree .env it layers the root .env in for every key it does not derive itself. Derived keys (APP_PORT, DB_PORT, STACKS_ENV, TEST_DB_PORT, TEST_DATABASE_URL) stay per worktree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 env:up in a worktree writes every non-derived key found in the root checkout's .env into the worktree .env, and root's value wins over the worktree's existing value for those keys
- [ ] #2 Derived keys (APP_PORT, DB_PORT, STACKS_ENV, TEST_DB_PORT, TEST_DATABASE_URL) are never taken from the root .env
- [ ] #3 env:up run in the root checkout itself, and env:main, behave as before
- [ ] #4 A missing root .env is not an error; env:up behaves as today
- [ ] #5 No secret value is ever printed by env:up, status, or tests
- [ ] #6 The runtime-stacks wiki note and .env.example document where shared keys and secrets live
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
