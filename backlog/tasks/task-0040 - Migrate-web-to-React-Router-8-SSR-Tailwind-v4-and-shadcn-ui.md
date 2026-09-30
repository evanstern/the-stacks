---
id: TASK-0040
title: 'Migrate web to React Router 8 SSR, Tailwind v4, and shadcn/ui'
status: Done
assignee: []
created_date: '2026-09-30 03:10'
updated_date: '2026-09-30 08:01'
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
- [x] #1 apps/web runs React Router 8 in framework mode with SSR on by default
- [x] #2 The play route renders client-only through clientLoader and HydrateFallback
- [x] #3 Hono mounts the React Router request handler as the last middleware and reserved paths (/health /api /auth /ws /library) never reach it
- [x] #4 Loaders reach server data through a load-context interface defined in packages/shared; the Biome boundary check stays green
- [x] #5 Tailwind v4 and shadcn/ui are installed with no CDN or webfont; no Dialog or AlertDialog component is added
- [x] #6 TanStack Router is removed; TanStack Query is removed or its remaining use is justified in the plan
- [x] #7 The M0 two-browser echo demo still passes from the per-worktree stack and the container image
- [x] #8 docs/design/architecture.md A1 Client row is updated to cite doc-0003
- [x] #9 The wiki is re-grounded for static-serving, spa-shell, container-image, and server-entrypoint-and-app
- [x] #10 Spec phase: Setup and dependencies
- [x] #11 Spec phase: Server mount and load context (US3, US4)
- [x] #12 Spec phase: Route port (US1, US2)
- [x] #13 Spec phase: Styling foundation (US5)
- [x] #14 Spec phase: Hot-reload dev mode (US7)
- [x] #15 Spec phase: Verification, evidence, re-grounding
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

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 3 done (177778d): routes ported to React Router 8 framework mode, play client-only, TanStack removed, Dockerfile runtime stage updated; web SSR tests 3/3, server 411/0/5, boundaries green; env:up app stack healthy on :3040. Phase 4 (styling foundation) dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 4 done (3f90c7c): Tailwind v4 + shadcn Button/Input/Label/Card, cn() in ~/lib/utils; no dialog, no CDN (greps zero). The shadcn CLI added an unapproved npm package "cn"; removed from package.json and lockfile (verified). Phase-4 implementer left stash entry "phase4-wip-lintcheck" (48621e0, redundant) that it was blocked from dropping; left for the operator. Phase 5 (hot-reload dev) dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 5 done (a9a5d37): in-process Vite dev (STACKS_WEB_DEV=1, HMR on WEB_HMR_PORT); HMR proven in Brave with zero reloads; reserved paths and /ws stay on Hono in dev; no vite import in the prod dist. Phase 6 (verification, evidence, re-grounding, constitution PATCH) dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 6 done (7f44333 evidence + A1 + constitution 1.0.1; e572d7f wiki: 9 notes NEEDS-REVIEW rewritten, 10 RE-PIN-ONLY, spa-shell retired for react-router-app; 86ce7a4 teardown). Orchestrator re-verified: freshness OK (36 notes), spec-bridge ok, no-CDN and no-dialog greps zero, exactly button/card/input/label, env:prune no orphans. ci:check with DB exit 0 (411/416, 0 DB suites skipped); M0 demo 8/8 on stack and standalone image (evidence in specs/025-frontend-stack/ci-evidence.txt).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Setup and dependencies: 8/8 · Server mount and load context (US3, US4): 9/9 · Route port (US1, US2): 15/15 · Styling foundation (US5): 5/5 · Hot-reload dev mode (US7): 6/6 · Verification, evidence, re-grounding: 12/12). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
