---
id: TASK-0028
title: 'Chat UI: streaming answers and clickable citations'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-30 01:58'
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
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
