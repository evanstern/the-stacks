---
id: TASK-0103
title: 'Reset-password CLI for any account, shipped in the runtime image'
status: To Do
assignee: []
created_date: '2026-10-26 15:29'
labels:
  - auth
  - ops
  - cli
dependencies: []
priority: medium
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An operator who forgets a password has no supported way back in. Passwords are stored only as scrypt hashes, and create-operator refuses to overwrite an existing account. On 2026-10-26 the hosted dev operator password was reset with a hand-built one-off script run through docker exec over ssh. That script echoed the new password to the terminal. Ship a supported CLI beside create-operator so a reset is one documented command. Reference: apps/server/src/cli/create-operator.ts, apps/server/src/auth/password.ts, docs/ops/dev-vm-104.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 dist/cli/reset-password.js ships in the runtime image and runs through docker exec, like create-operator
- [ ] #2 The CLI prompts for the new password with no terminal echo and asks for it twice
- [ ] #3 The CLI never accepts the password as a command-line argument
- [ ] #4 The CLI resets any account named by RESET_USERNAME, defaulting to operator
- [ ] #5 A successful reset deletes every auth session of that user in the same transaction
- [ ] #6 An unknown username or a mismatched confirmation changes nothing and exits nonzero
- [ ] #7 Tests cover success, unknown user, mismatch and session invalidation
- [ ] #8 docs/ops/dev-vm-104.md documents the exact reset command for hosted dev
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
