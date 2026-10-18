---
id: TASK-0028
title: 'Chat UI: streaming answers and clickable citations'
status: Done
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-10-18 19:08'
labels:
  - ui
milestone: m-1
dependencies:
  - TASK-0027
  - TASK-0024
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The M1 demo surface. Not droppable.

Spec: specs/024-chat-ui
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The operator uploads a book and sees ingestion status
- [x] #2 Answers stream into the chat as they generate
- [x] #3 Clicking a citation opens the source passage with the quoted span highlighted
- [x] #4 The M1 demo runs in two browsers from the per-worktree stack
- [x] #5 Spec phase: Foundation — theme, cookies, load context, store, panel, shell
- [x] #6 Spec phase: US1 — Upload a book and watch it ingest (P1)
- [x] #7 Spec phase: US2 — Ask a question and watch the answer stream (P1)
- [x] #8 Spec phase: US3 — Open a citation's source passage (P1)
- [x] #9 Spec phase: US4 — Player views, the Table landing, and the two-browser run (P2)
- [x] #10 Spec phase: Verification, evidence, and re-grounding
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-09-29 (on merging PR #27, the M1 wave-2 runbook): TASK-0028 runs through pdlc:design-rounds in a sister session, not through the wave-2 sweep. The sweep orchestrator announces when 0027 and 0024 have merged and hands off a brief blurb.

Claimed 2026-09-29 for pdlc:design-rounds. Long-running worktree: .worktrees/task-0028, branch task-0028-chat-ui (cut from origin/main 8a79429). Spec number 024 claimed up front per the operator brief, overriding the skill's deferred-claim default; spec-bridge:link and the Spec Kit cycle still wait for the decision record.

Design-rounds binding constraints (Phase 2, checked every round):
- Constitution VIII: ask + ingestion are operator-only; book text appears only as citations to the operator. Players get 403. No widening without an amendment.
- V: every rules claim carries book, section, exact quote; operator clicks through to the passage. Refusal discards streamed deltas; error keeps text marked interrupted; done.dropped>0 may show a notice.
- I: every UI action is a plain fetch to a documented route (POST /library/ask via fetch+stream reader; POST /library/uploads multipart, XHR only for progress; poll GET /library/jobs every 1-2s).
- IX: self-hostable; no CDN fonts or assets. System font stacks or self-hosted files only.
- Stack: React 19 + Vite SPA + TanStack Router/Query; web has zero styling today, so no existing visual system constrains the choice. A UI library needs justification.
- Mock copy: SRD/original text only (fixture "Basic Rules"; question "How does grappling work?"), never real PHB text.

Round 1 mock build dispatched (three directions: A reference desk, B marginalia, C console; 14 shared states) to docs/design/chat-ui/round-1/.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Operator amendment 2026-09-29: rounds widened to chat + a Library area in one layout. ACs unchanged; this PR ships chat, upload with XHR progress, and job status/stage (job history if it falls out of AC #1). Book list, delete and re-import go to TASK-0038 (created on main, 0d48943; depends on TASK-0028), which needs GET /library/books and DELETE /library/books/:id. TASK-0031 dependencies unchanged. The in-flight round-1 dispatch was re-briefed: shell/navigation, upload in Library (A, C) vs reachable from chat (B), 0028/LIB ownership badges, first-run empty state, and book-level states (ingesting, failed, ready, search-only).

Round 1 landed (f3c5cb9): docs/design/chat-ui/round-1/index.html. Three directions, 18 shared states each (shell, first run, upload/progress/409, jobs, book list LIB, delete+re-import LIB, player 403 views, empty/validation/streaming/done chat, prose + stat-block citation, refusal, mid-stream error). Screenshots taken in Brave, light+dark, 1280+390.
- A Reference desk: conversation + pinned source pane; Library as a collapsible panel above chat; upload in Library only. Risk: two panes collapse to a bottom sheet on phones.
- B Marginalia: one column, Ask | Library tabs; citations unfold inline under the citing paragraph; attach control in chat also opens upload. Risk: long passages push the conversation apart.
- C Console: always-visible jobs strip + log-style chat; citations open in a <dialog> modal; upload in Library. Risk: reads as a tool, not a reading surface.
Asked of the operator: pick a direction (or a hybrid) for round 2, and rule on AC #4 (two operator browsers vs operator + a player seeing the 403 views).

Round 1 operator feedback 2026-09-29: A (reference desk) chosen as the base. Palette too dull; UX not scoped enough. References given (Dribbble; described, not copied into the repo): (1) RAG knowledge dashboard: left nav, library list and chat as a split pane, tabs replace the split on mobile; (2) single-purpose upload page: large dropzone, one file row with a progress bar, clean colours; (3) Untitled UI file management: left sidebar, dropzone above a files table, good mobile version; (4) dark AI chat dashboard: left sidebar, chat session list beside the conversation, strong dark-mode palette. Operator: chat sessions are a needed feature if not already specified; no board card covers them (searched). Proposed as a separate card; creation awaits operator confirmation. AC #4 operator intent: a player and the operator share a WebSocket session together; the operator flagged this as possibly out of scope. Ruling pending.

Round 2 mock build dispatched: one layout (A developed: left sidebar Ask|Library|Table, session list, conversation, source pane; Library page with dropzone, recent imports, books; mobile bottom tabs + Chat|Source toggle) in two palettes (a2-daylight, a2-nightshift), round-1 states carried over plus mobile, Table operator+player, and collapsed sidebar. Session list badged SES (proposed, not carded).
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Operator rulings 2026-09-29:
- Chat sessions: TASK-0039 created on main (2f4c472), milestone m-1, depends on TASK-0028. The session list ships there, not here (badge SES = TASK-0039).
- AC #4: proven by the operator and a player joining the same Table (M0 /play/:id WebSocket session) in two browsers on the worktree stack, while the operator uses Ask and Library alongside. Ask and Library stay operator-only (constitution VIII); the player sees the Table only. The proof must be visually inspectable: an operator-piloted run or a screen recording committed with the PR evidence.

Round 2 landed (44498fa): docs/design/chat-ui/round-2/index.html. Direction A developed as one layout in two palettes: a2-daylight (teal #0f6f63 light / #4fd1c0 dark) and a2-nightshift (violet #a48cf0 dark / #6d3fd1 light); all four combinations pass WCAG AA (6.0:1 or better). Shell: left sidebar Ask | Library | Table, collapsible to icons; Ask = session list (SES, TASK-0039) + conversation with a ready-books strip and "Add a book" link + pinned collapsible source pane; Library page = dropzone, upload card with progress, recent imports with stage stepper (0028), books table with Delete/Re-import (LIB, TASK-0038); Table = M0 play session, operator sidebar vs player sidebar (Table only) side by side for AC #4. Mobile: bottom tabs, Chat|Source segmented control, session sheet. 22 states; Brave screenshots light+dark at 1280+390.
Asked of the operator: palette pick, plus the six open questions in round-2/index.html (session titles, Add-a-book navigate vs overlay, sidebar collapse persistence, operator sidebar on Table, search-only book state lifecycle).

Round 2 operator rulings 2026-09-29:
1. Palette: Daylight (teal) in both light and dark. Nightshift rejected.
2. Session titles AI-generated from the first prompt; rename + delete added as ACs on TASK-0039 (688fa53 on main).
3. "Add a book" = adding a source to the session knowledge base: a slide-out panel or autocomplete dropdown for quick add and management of sources. Standing rule: NO MODALS (bad on mobile, painful UX); use slide-in/out panels or autocomplete dropdowns. Per-session source selection needs an ask contract change, so it ships in TASK-0039; TASK-0028 ships the panel as a library-wide view plus the upload entry.
4. Collapsed sidebar remembered per browser.
5. Sidebar shows what each role can see (operator: Ask, Library, Table; player: Table).
6. Book without embeddings stays keyword-searchable; "Embed now" is offered whenever a model is available, never forced (TASK-0038 note, c2de7fa on main).
Round 3 (narrow): the sources control in two mechanisms (slide-out panel vs autocomplete dropdown), the delete confirmation moved off <dialog>, and the search-only book with Embed now, all in Daylight.

Round 3 mock build dispatched: sources control as slide-out panel (P) vs autocomplete dropdown (D), inline delete confirm, Embed now, role sidebars; Daylight only; no modals.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Round 3 landed (c91a057, fix 1856a0d): docs/design/chat-ui/round-3/index.html. Daylight only; zero dialog/showModal hits.
- P Sources panel: "Sources · 2 of 4" button in the Ask header slides a panel from the right edge (over the source pane); checkbox per book with status pill, overflow with Open in Library / Embed now, inline "Add a book" dropzone at the bottom. Mobile: bottom sheet at ~85% height with drag handle.
- D Sources dropdown: removable book chips above the prompt plus "+ Add source" (or "@" in the prompt) opens an upward autocomplete; not-ready books listed disabled with a reason; last row "Upload a new book…" expands an inline upload row. Mobile: full-width list above the prompt.
Both: inline delete confirm row in the books table (no modal), Embed now → "Embedding · 120 of 214 chunks", role sidebars. Ownership: control + status + add-a-book = 0028; per-session checkboxes/chips = SES (TASK-0039); Embed now + Delete = LIB (TASK-0038). Known mock artifact: D state 2 dropdown top clips at the frame edge.
Asked of the operator: P or D (or hybrid, e.g. D chips for per-session selection + P panel for management).

Round 3 operator selection 2026-09-29: P (sources slide-out panel). Modifications: the Sources button gets an openable cue (leading icon, chevron, button styling, aria-expanded); the slide-out panel becomes a reusable component, the standard replacement for modals and dropdown menus. Decision record: docs/design/chat-ui/decision.md (179d4a5). Rounds closed; next: spec 024 authoring against the decision.

Spec 024 authoring dispatched to opus-implementer (spec authoring; operator brief names this tier, per the standing spec-authoring ruling 2026-09-29). Inputs: docs/design/chat-ui/decision.md, the card, contracts 018/017 unchanged, constitution, round-2/3 mocks, wiki notes.
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Operator hold 2026-09-29: a frontend refactor that changes the apps/web base comes first and takes precedence. No code for TASK-0028 until the operator says go. The spec 024 dispatch was narrowed in flight to spec.md only, kept free of frontend structure; plan.md, research.md, quickstart.md and tasks.md wait for the refactor to land. spec-bridge:link waits too. Resume: re-read the refactored apps/web and the wiki, then author plan and tasks against the new base.

spec.md landed (d06bf18, opus); plan/research/quickstart/tasks withheld for the TASK-0040 base. Spec additions beyond the decision record, pending operator confirmation: Settings = one theme control (System/Light/Dark, per browser); a Table landing page (Start a new table / Join by link or id); mobile breakpoint <=700px; jobs poll 1.5 s while any job is active. Open questions 1-4 resolved in spec.md (books grouped by lower(trim(book)) from GET /library/jobs; passages as plain text, tables monospace, no stat-block field grid; conversation in app-level memory; upload cancel creates no job). Drafted plan notes (SSE parser, XHR upload, panel a11y via inert, vitest devDep, Brave recording) kept in the dispatch report; re-derive them against the TASK-0040 base.

Operator rulings 2026-09-30: per-browser UI state (sidebar collapse, theme) persists in cookies the root loader reads; Ask posts directly to /library/ask (a React Router action cannot stream SSE). The four spec additions are confirmed: Settings theme control, Table landing (Start/Join), 700px breakpoint, 1.5 s jobs poll. TASK-0040 runbook signed off; the sweep is running.

Released from hold 2026-09-30: TASK-0040 merged (PR #39, 1446fd0) and synced Done; its closure (sync + runbook done) rides this branch. origin/main merged in (bca4b05). Next: author plan, research, quickstart and tasks for spec 024 against the React Router 8 / Tailwind v4 / shadcn base, then the dependency checkpoint.

Spec 024 plan/research/quickstart/tasks authoring dispatched against the TASK-0040 base (standing spec-authoring ruling). Stops at the dependency and design checkpoint.
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Spec 024 plan cycle landed (9bfad00): plan, research, quickstart, tasks (55 tasks, 6 phases); spec.md amended: the Library page URL is /books because /library is reserved. Phase ACs seeded. Plan checkpoint pending operator: (1) no new dependencies; (2) shadcn Sheet (Radix Dialog primitive, edge-anchored, overlay dim) accepted under no-modals, with the dialog gate rescoped to no dialog.tsx/alert-dialog.tsx, no <dialog/showModal/AlertDialog, "Dialog" only in sheet.tsx, enforced by a test; (3) Library at /books; (4) inline SVG icons, no lucide-react; (5) new load-context method StacksLoadContext.jobs(), operator-only; (6) UI cookies stacks-sidebar/stacks-theme written client-side, not HttpOnly; (7) the answering purpose is confirmed present in the root .env (checked without printing).

Operator plan checkpoint 2026-09-30: all 7 approved as recommended (no new deps; Sheet under no-modals with the rescoped dialog gate; Library at /books; inline SVG icons; StacksLoadContext.jobs(); client-written UI cookies; recording artifacts). Implementation phase 1 dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 1 done (e7b0de9): Daylight tokens + --input, UI cookies, StacksLoadContext.jobs(), app store, Sheet panel, inline icons, role-aware shell; web tests 23/23, server 413/0/5, ci:check exit 0; no dependency drift (verified); the shadcn CLI again added the "cn" package, reverted. Stack up on :3028. Phase 2 (US1 upload + status) dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 2 done (f27630e): /books Library page, XHR upload with progress/cancel, recent imports with the stage stepper, 1.5 s poll, Sources panel component (unmounted until phase 3). Real upload of combat.md in Brave reached Ready (31 chunks, bge-m3): AC #1. Web 38/38, server 413/0/5; no dependency drift. Ops note: host db:migrate/create-operator prefer TEST_DATABASE_URL over DATABASE_URL (see ci-evidence.txt). Phase 3 (US2 streaming) dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 3 done (ad677dc): SSE parser, turn reducer, ask/stop/retry in the store, Ask route with Sources mounted. Real stream in Brave: answer length grew 1 -> 19 -> 107; Stop kept the text marked Stopped; a real refusal rendered calmly with no streamed words; the stream kept writing while on /books (FR-028). AC #2 met. Web 56/56; no dependency drift. Incident: the phase-3 implementer lost the phase-2 operator password and tried to write a password hash straight into users; the permission classifier blocked it and it reprovisioned the stack instead (env:down/up, create-operator, re-ingest). Later dispatches keep the operator credential in a job-tmp file, never committed or printed. Phase 4 (US3 citations) dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 4 done (42ce132): citation buttons with accessible names, openCitation in the store, a source pane with book, breadcrumb and kind label, the quote in <mark>, scrolled into view; mobile Chat|Source control with Back. In Brave: <mark> text equals the citation quote exactly on 3 clean runs (1 run hit a transient upstream error before any citation); keyboard Enter opens the pane; 390px switch works. AC #3 met. Web 60/60; no dependency drift. Stack re-provisioned via the documented path; the operator secret is at job tmp operator-0028.secret (600, not committed). Phase 5 (US4 player views, Table landing, two-browser run) dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 5 done (5d4522c): Table landing (Start/Join), play without its own sign-out, player views verified server-side (no jobs() call). Two-browser run in Brave, 15/15 steps pass: operator starts a table, player joins by link, M0 echo both ways, operator uploads and asks with a citation alongside, player sees no book text, player /ask and /books show operator-only; player /library request count 0 (SC-008). Web 63/63, server 413/0/5; no dependency drift. Player created via the invite flow; secret in job tmp (600). Phase 6 (verification, recording, re-ground) dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 6 done (a82067c evidence + AC #4 recording; b3d871a wiki: 8 notes NEEDS-REVIEW re-verified, new chat-ui note, CAPSULES regenerated; 0d6b804 teardown). Orchestrator re-verified: freshness OK (37 notes), spec-bridge ok, no dependency drift, components/ui = button/card/input/label/sheet, zero <dialog/showModal/AlertDialog, recordings not blank (frames inspected: operator Ask streaming with Sources; player Table-only sidebar with both echo messages), player /library requests 0, no secret in the repo, env:prune no orphans. AC #4 met. ci:check with DB exit 0 (server 413/0/5, web 63/63). PR opening; spec-bridge sync to Done after merge.

Operator hold on PR #40 merge (2026-09-30): the operator wants a local manual-test pass and more design rounds before merging. Local stack up via pnpm env:up at http://localhost:3028 (commit 75932ad); app DB migrated, operator created via auth:create-operator, player via the invite flow, "Basic Rules" (SRD combat.md) ingested and embedded (31 chunks, bge-m3). Logins are in the gitignored .handoff/local-test-logins.txt (600). Next: the operator compiles feedback; design round 4 follows.

Design round 4 opened 2026-10-18. The operator began the manual review of the local stack (http://localhost:3028, commit 313f153).

Round 4 finding 1 (bug, not design): Ask answers frequently end "Interrupted — The model provider failed" after the cited text. Root cause confirmed: the local router (AI_PROVIDERS.claude, host :20128) ends every stream with finish_reason "stop" but never sends data: [DONE]. Probe: 5/5 streams, no [DONE]. apps/server/src/ai/adapters/openai-compatible.ts requires sawDone(), so every complete answer maps to kind "upstream" ("stream ended without a completion signal"). App logs show answering outcome=error after 29 and 45 output tokens, with usage chunks received. Proposed fix: accept a finish_reason of stop or length as the completion signal when [DONE] is absent; keep [DONE] sufficient; add a unit test for both stream endings. Pending operator ruling on scope and dispatch.

Round 4 finding 2 (minor): GET /favicon.ico reaches the React Router handler and logs a "No route matches" stack trace per page load. Proposed fix: ship a favicon or return 404 before the RR handler.

Operator ruling 2026-10-18: findings 1 ([DONE]) and 2 (favicon) are in scope for this PR; dispatch to sonnet, then rebuild the stack for continued review. Brief: .handoff/round4-fix-brief.md (gitignored).
Dispatch blocked twice (no worktree changes): this desktop-app session calls api.anthropic.com instead of the local router, but inherits the router-only cc/ model IDs. sonnet-implementer and model=sonnet both sent cc/claude-sonnet-5 and got model_not_found. Awaiting the operator: dispatch from a CLI session on the router, or record an escalation checkpoint for an inherited-model run.

Operator ruling 2026-10-18: Claude Code defaults back to built-in models. The 9router settings were removed from ~/.claude/settings.json (base URL, auth token, cc/ model defaults). model-tiers.json now pins bare IDs (haiku claude-haiku-5-5, sonnet claude-sonnet-5-5, opus claude-opus-5-5, fallback claude-fable-5-1); agents regenerated, --check green. Landed on main 4592e14 and merged into this branch (9765315). The round-4 fix dispatch runs from a new session, because settings and the agent registry load at session start. The app answering provider (AI_PROVIDERS) still uses 9router; that is unchanged.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

spec-bridge sync: Foundation — theme, cookies, load context, store, panel, shell: 21/21 · US1 — Upload a book and watch it ingest (P1): 8/8 · US2 — Ask a question and watch the answer stream (P1): 6/6 · US3 — Open a citation's source passage (P1): 4/4 · US4 — Player views, the Table landing, and the two-browser run (P2): 5/5 · Verification, evidence, and re-grounding: 11/11 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Foundation — theme, cookies, load context, store, panel, shell: 21/21 · US1 — Upload a book and watch it ingest (P1): 8/8 · US2 — Ask a question and watch the answer stream (P1): 6/6 · US3 — Open a citation's source passage (P1): 4/4 · US4 — Player views, the Table landing, and the two-browser run (P2): 5/5 · Verification, evidence, and re-grounding: 11/11). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
