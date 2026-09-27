# Implementation Plan: Root-guard accepts non-ASCII board paths

**Branch**: `task-0018-rootguard-nonascii` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-rootguard-nonascii/spec.md`

## Summary

The root-guard hook reads the staged set with `git diff --cached --name-only`. Git
C-quotes any path with non-ASCII bytes, so the `backlog/` prefix test fails and a legal
board-sync commit is refused. Fix: read the staged set with `-z` and split on NUL, which
yields every path verbatim under any git config. Audit the two sibling checks, pin all
three with a stdlib `node:test` file, then prove the fix on a real root commit.

## Technical Context

**Language/Version**: Node 22 (hook header states Node >= 18), ESM JavaScript

**Primary Dependencies**: none — stdlib `node:child_process`, `node:fs`, `node:path` only

**Storage**: N/A

**Testing**: `node:test` + `node:assert`, run by `node --test .claude/hooks/`

**Target Platform**: developer machines (macOS here) running Claude Code hooks

**Project Type**: CLI hook (PreToolUse), one file

**Performance Goals**: no measurable change — one git call, same as today

**Constraints**: zero npm dependencies; fail-open on internal error; fail-closed inside
the board-sync exception

**Scale/Scope**: one function edited (~3 lines), one new test file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — agents commit board changes through the backlog CLI via
      Bash, the same path a human uses; the fix removes a rename workaround.
- [x] **II. Content contract** — no codex entity. Not applicable.
- [x] **III. Data planes** — no application state; the change is dev tooling outside
      every plane.
- [x] **IV. Event sourcing** — no play state. Not applicable.
- [x] **V. Citations** — no library-derived claim; no retrieval change.
- [x] **VI. System-agnostic** — no game mechanics. Not applicable.
- [x] **VII. Structured first** — no generated artifact. Not applicable.
- [x] **VIII. Operator-owned content** — ships no rulebook content.
- [x] **IX. Self-hostable** — no container, service, or model access touched.

**Stack conformance** — the hook is JavaScript, not TypeScript. That is inherited, not
introduced: the hook is planted from the pdlc plugin as a zero-dependency Node script and
runs before any build step. This plan edits it in place and adds no new language.

**Post-design re-check (after Phase 1)**: unchanged — all nine pass.

## Project Structure

### Documentation (this feature)

```text
specs/008-rootguard-nonascii/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── board-sync-verdict.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (repository root)

```text
.claude/hooks/
├── root-guard-hook.mjs          # edit classifyBoardSyncCommit's staged-set read
├── shell-scan.mjs               # unchanged
└── root-guard-hook.test.mjs     # NEW — node:test regression suite
```

**Structure Decision**: the test sits beside the hook. `node --test .claude/hooks/`
discovers `*.test.mjs` there, and TASK-0017's CI will call that exact command.

## Complexity Tracking

No violations. Nothing to justify.

## Follow-up (out of scope)

The hook is planted from `praxisflux/pdlc` (same bug at the same line upstream,
verified 2026-09-27). Upstreaming is a separate change in that repository.
