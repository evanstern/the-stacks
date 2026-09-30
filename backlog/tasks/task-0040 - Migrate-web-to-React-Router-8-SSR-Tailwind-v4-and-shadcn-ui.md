---
id: TASK-0040
title: 'Migrate web to React Router 8 SSR, Tailwind v4, and shadcn/ui'
status: In Progress
assignee: []
created_date: '2026-09-30 03:10'
updated_date: '2026-09-30 03:15'
labels:
  - ui
milestone: m-1
dependencies: []
references:
  - backlog/docs/doc-0003 - Frontend-stack-—-rulings.md
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the doc-0003 rulings (ratified 2026-09-29, decision-0008). They supersede architecture A1's Client row ("SPA, not SSR").
Port the existing routes (sign-in, home, play) off TASK-0016's TanStack SPA shell.

**Pre-empts TASK-0028.** Operator ruling 2026-09-29: this migration lands before TASK-0028 while the refactor is cheap.
- TASK-0028 pauses at its spec (specs/024-chat-ui) and rebases onto this task's merge.
- TASK-0028's decision record keeps its visual direction. Its Stack constraint now points to doc-0003.
- The operator relays this to the TASK-0028 session. Do not edit TASK-0028's card from this task.

Spec: specs/025-frontend-stack
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 apps/web runs React Router 8 in framework mode with SSR on by default
- [ ] #2 The play route renders client-only through clientLoader and HydrateFallback
- [ ] #3 Hono mounts the React Router request handler as the last middleware and reserved paths (/health /api /auth /ws /library) never reach it
- [ ] #4 Loaders reach server data through a load-context interface defined in packages/shared; the Biome boundary check stays green
- [ ] #5 Tailwind v4 and shadcn/ui are installed with no CDN or webfont; no Dialog or AlertDialog component is added
- [ ] #6 TanStack Router is removed; TanStack Query is removed or its remaining use is justified in the plan
- [ ] #7 The M0 two-browser echo demo still passes from the per-worktree stack and the container image
- [ ] #8 docs/design/architecture.md A1 Client row is updated to cite doc-0003
- [ ] #9 The wiki is re-grounded for static-serving, spa-shell, container-image, and server-entrypoint-and-app
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-09-30 by the TASK-0028 design-rounds session, running the sweep per docs/design/frontend-stack-sweep-runbook.md (draft, awaiting lane sign-off). Worktree .worktrees/task-0040, branch task-0040-frontend-stack. Spec 025.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
