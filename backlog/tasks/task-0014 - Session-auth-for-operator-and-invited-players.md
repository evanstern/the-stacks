---
id: TASK-0014
title: Session auth for operator and invited players
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 18:26'
labels: []
milestone: m-0
dependencies:
  - TASK-0012
  - TASK-0013
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the self-rolled, Lucia-style session auth from architecture A1. Single-tenant and self-hosted: one operator account plus players the operator invites. No external identity provider. The M0 demo needs two distinct signed-in users, so this task must support at least two real accounts.

Spec: specs/005-session-auth
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 User and session tables exist with migrations
- [ ] #2 Passwords are stored with a modern password hash, never reversibly
- [ ] #3 Sign-in, sign-out, and session validation work over HTTP with secure cookies
- [ ] #4 An operator account can be provisioned on a fresh install by a documented path
- [ ] #5 The operator can invite a player who can then sign in
- [ ] #6 WebSocket connections can authenticate using the same session
- [ ] #7 Tests cover sign-in, rejection of bad credentials, and session expiry
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
