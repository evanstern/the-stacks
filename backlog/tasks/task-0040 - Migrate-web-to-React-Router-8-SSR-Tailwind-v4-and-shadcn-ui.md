---
id: TASK-0040
title: 'Migrate web to React Router 8 SSR, Tailwind v4, and shadcn/ui'
status: To Do
assignee: []
created_date: '2026-09-30 03:10'
labels:
  - ui
milestone: m-1
dependencies: []
references:
  - backlog/docs/doc-0003 - Frontend-stack-—-rulings.md
priority: high
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the doc-0003 rulings (ratified 2026-09-29). They supersede architecture A1's Client row ("SPA, not SSR").
Port the existing routes (sign-in, home, play) off TASK-0016's TanStack SPA shell.
Sequencing: TASK-0028 (chat UI) is in flight on TanStack. Its decision record's Stack constraint now points here. Either land this first and rebase TASK-0028 onto it, or land TASK-0028 and port it here. The sweep runbook decides.
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
