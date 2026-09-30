---
id: TASK-0040
title: 'Migrate web to React Router 8 SSR, Tailwind v4, and shadcn/ui'
status: In Progress
assignee: []
created_date: '2026-09-30 03:10'
updated_date: '2026-09-30 04:14'
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
- [x] #10 Spec phase: Setup and dependencies
- [x] #11 Spec phase: Server mount and load context (US3, US4)
- [ ] #12 Spec phase: Route port (US1, US2)
- [ ] #13 Spec phase: Styling foundation (US5)
- [ ] #14 Spec phase: Hot-reload dev mode (US7)
- [ ] #15 Spec phase: Verification, evidence, re-grounding
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-09-30 by the TASK-0028 design-rounds session, running the sweep per docs/design/frontend-stack-sweep-runbook.md (draft, awaiting lane sign-off). Worktree .worktrees/task-0040, branch task-0040-frontend-stack. Spec 025.

Spec 025 authoring dispatched (spec, plan, research, quickstart, tasks; standing spec-authoring ruling 2026-09-29). Stops at the dependency checkpoint after plan.md.
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Spec 025 landed (3094e99): spec, plan, research, quickstart, tasks (48 tasks, 5 phases); phase ACs seeded. Plan checkpoint pending operator: dependency table (react-router 8.4.0, @react-router/node, isbot, radix-ui, cva, clsx, tailwind-merge; dev: @react-router/dev, tailwindcss, @tailwindcss/vite; TanStack Router+Query and @vitejs/plugin-react removed), hand-written Hono bridge (no adapter package), /library added to RESERVED_PREFIXES (code omits it today), unknown paths 404 instead of the 200 shell, no hot-reload dev server, constitution Stack row amendment.

Operator plan checkpoint 2026-09-30, approved all as recommended: (1) the dependency table as listed; (2) a hand-written Hono bridge, no adapter package; (3) /library added to RESERVED_PREFIXES; (4) unknown non-reserved paths return a React Router 404; (5) hot-reload dev (Vite middleware mode inside the Hono process) added to TASK-0040 scope; (6) constitution Stack row amended in this PR as a PATCH bump citing decision-0008.

Spec 025 amendment dispatched: record the checkpoint approvals, bring hot-reload dev and the constitution PATCH amendment into scope.
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Spec 025 amended (ba7d16c): Phase 5 hot-reload dev (US7, T049-T054), Phase 6 verification now includes T055 constitution PATCH 1.0.0 -> 1.0.1. vite added as an apps/server devDependency (already in the lockfile; follows from approved checkpoint 5). Phase ACs re-seeded.

Implementation phase 1 (Setup and dependencies) dispatched.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 1 done (cab046d): deps per the approved table, build config, TanStack removed from the lockfile. Phase 2 (server mount and load context) dispatched.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 2 done (2565447): hand-written bridge, /library reserved, StacksLoadContext in packages/shared, shared identity lookup; server tests 411/0/5 with DB. Phase 3 (route port) dispatched.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
