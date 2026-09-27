---
description: "Task list for spec 008 — root-guard accepts non-ASCII board paths"
---

# Tasks: Root-guard accepts non-ASCII board paths

**Input**: Design documents from `/specs/008-rootguard-nonascii/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — spec FR-005 and FR-006 demand regression tests.

## Format: `[ID] [P?] [Story] Description`

Paths are repository-relative. Hook: `.claude/hooks/root-guard-hook.mjs`.
Test file: `.claude/hooks/root-guard-hook.test.mjs`. Run tests with `node --test .claude/hooks/`.

## Phase 1: Test harness (foundational)

**Purpose**: a temp-repo fixture every story's tests reuse. Blocks all stories.

- [x] T001 Create `.claude/hooks/root-guard-hook.test.mjs` using only `node:test`, `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`. Add a `makeRepo()` helper: `mkdtempSync` under `os.tmpdir()`, `git init -q`, set local `user.name`/`user.email`, make one initial commit, and return its `realpathSync` path. Register cleanup with `t.after` (or `after`) removing the directory.
- [x] T002 In the same file add `stage(repo, relPath, content)`: create parent dirs, write the file, `git add -- relPath` via `execFileSync` (argument array, never a shell string). Import `classifyBoardSyncCommit` and `boardPathspecOk` from `./root-guard-hook.mjs`.
- [x] T003 Add a baseline test: an ASCII `backlog/tasks/a.md` staged ⇒ `classifyBoardSyncCommit(['-m','x'], repo, repo)` deep-equals `{ ok: true }`; an ASCII `docs/a.md` staged ⇒ `ok:false`, `reason:'staged-outside'`, `token:'docs/a.md'`. Run `node --test .claude/hooks/` — must pass on the unmodified hook.

**Checkpoint**: harness works against the current hook; ASCII behavior pinned.

## Phase 2: User Story 1 — non-ASCII board commits allowed (Priority: P1) 🎯 MVP

**Goal**: a staged non-ASCII `backlog/` path is allowed.

**Independent Test**: T004 fails before T005 and passes after.

- [x] T004 [US1] Add failing tests in `.claude/hooks/root-guard-hook.test.mjs`: (a) only `backlog/milestones/m-0 - m0-—-skeleton.md` staged ⇒ `{ ok: true }`; (b) that file plus ASCII `backlog/tasks/a.md` staged ⇒ `{ ok: true }`. Run and confirm (a) and (b) FAIL with `staged-outside` — record the failure output in the commit message.
- [x] T005 [US1] In `.claude/hooks/root-guard-hook.mjs` `classifyBoardSyncCommit`, change the staged read to `['-C', effDir, 'diff', '--cached', '--name-only', '-z']` and split on `'\0'`, filtering out empty strings only (do NOT trim — a path may legitimately contain spaces). Keep every other line of the function unchanged. Run tests — T003 and T004 pass.

**Checkpoint**: MVP — the reported defect is fixed.

## Phase 3: User Story 2 — non-board paths stay blocked (Priority: P1)

**Goal**: the fix opens no hole; refusals name paths readably.

**Independent Test**: all T006 cases pass.

- [ ] T006 [US2] Add tests in `.claude/hooks/root-guard-hook.test.mjs`: (a) `docs/café.md` + a `backlog/` file staged ⇒ `ok:false`, `reason:'staged-outside'`, `token:'docs/café.md'` exactly; (b) `backlog—x/a.md` staged ⇒ refused with that token; (c) a file named `backlog/a\nb.md` (literal newline in the name) staged ⇒ `{ ok: true }`, and `docs/a\nb.md` ⇒ refused with the full name as token; (d) a path containing `"` under `backlog/` ⇒ `{ ok: true }`; (e) nothing staged ⇒ `reason:'nothing-staged'`; (f) a repo where `git config core.quotepath false` is set locally still gives (a)'s result. Run — all pass with T005 in place; if any fail, fix `classifyBoardSyncCommit` only.

**Checkpoint**: blocked direction proven, including edge cases.

## Phase 4: User Story 3 — sibling checks audited (Priority: P2)

**Goal**: prove research R2 and R3 with tests; change code only if a test fails.

**Independent Test**: T007 and T008 pass against the hook.

- [ ] T007 [P] [US3] Add explicit-pathspec tests in `.claude/hooks/root-guard-hook.test.mjs`: `classifyBoardSyncCommit(['-m','x','--','backlog/tâche.md'], repo, repo)` ⇒ `{ ok: true }`; with `docs/tâche.md` ⇒ `reason:'pathspec-outside'`, `token:'docs/tâche.md'`; `boardPathspecOk(<absolute path to repo/backlog/tâche.md after creating it>, repo)` ⇒ `true`.
- [ ] T008 [P] [US3] Add pre-write end-to-end tests in `.claude/hooks/root-guard-hook.test.mjs`: spawn `node .claude/hooks/root-guard-hook.mjs pre-write` with `CLAUDE_PROJECT_DIR=<repo>` and stdin `{"tool_input":{"file_path":"<repo>/docs/tâche.md"},"cwd":"<repo>"}` after creating that file ⇒ exit 2; same with the file under `<repo>/.worktrees/x/tâche.md` ⇒ exit 0. Use `spawnSync` with `input:` for stdin.
- [ ] T009 [US3] If T007 or T008 failed, fix the affected check in `.claude/hooks/root-guard-hook.mjs` and re-run; if both passed, change no hook code. Either way, append one line to `specs/008-rootguard-nonascii/research.md` under R2/R3: "Confirmed by tests T007/T008 on <date>".

**Checkpoint**: all three checks covered for non-ASCII.

## Phase 5: Polish & proof

- [ ] T010 Run `node --test .claude/hooks/`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` from the worktree. All green. Paste outputs into the PR body.
- [ ] T011 Run `specs/008-rootguard-nonascii/quickstart.md` section 2 (real root index, branch hook vs main hook, four exit codes). Clean up the root checkout afterward. Paste the exit codes into the PR body.
- [ ] T012 After merge: run quickstart.md section 3 (rename the milestone back to `M0 — Skeleton` and commit at root). Record the commit hash on TASK-0018.

## Dependencies & Execution Order

- Phase 1 blocks everything.
- Phase 2 (US1) before Phase 3 (US2): US2's non-ASCII cases need the fix in T005.
- Phase 4 (US3) depends only on Phase 1; T007 and T008 run in parallel.
- Phase 5 after all stories; T012 only after the PR merges.

## Parallel Opportunities

- T007 ∥ T008 (independent test groups; both append to the test file — write them as separate `describe` blocks to avoid overlapping edits).

## Implementation Strategy

- MVP = Phases 1–2: the defect is fixed and proven.
- Phases 3–4 harden and audit; Phase 5 proves it outside the test suite.
- Dispatch: Phases 1–4 are one implementer dispatch group (small, one file pair). The
  orchestrator runs Phase 5.
