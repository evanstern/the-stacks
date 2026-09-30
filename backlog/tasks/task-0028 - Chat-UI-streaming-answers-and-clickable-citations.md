---
id: TASK-0028
title: 'Chat UI: streaming answers and clickable citations'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-30 02:55'
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
- [ ] #1 The operator uploads a book and sees ingestion status
- [ ] #2 Answers stream into the chat as they generate
- [ ] #3 Clicking a citation opens the source passage with the quoted span highlighted
- [ ] #4 The M1 demo runs in two browsers from the per-worktree stack
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
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
