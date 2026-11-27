# Spec: No-shell-push guard (rule 13)

**Card**: INF-39 (parent INF-37). Spec number 125 is provisional — PM to confirm.

## Requirements
- FR-001: A Claude Code PreToolUse Bash hook blocks `git push` (any form), `gh <noun> <write-verb>` (pr create/merge/edit/comment, issue, release, workflow run…) and `gh api` with a non-GET method or field flags, exiting 2 with a message naming the connector tools.
- FR-002: Quoted text (commit messages, echo, heredocs) is not a violation; `bash -c`, `env`, `sudo`, `xargs` wrappers are inspected.
- FR-003: A harness-agnostic `.githooks/pre-push` exits non-zero with the same guidance; `pnpm env:up` sets `core.hooksPath=.githooks`.
- FR-004: Audit: `scripts/deploy-*.mjs`, `scripts/env*.mjs`, `scripts/agent-bootstrap.sh` contain no `git push`/`gh` writes (verified by grep; none found). GitHub Actions workflows are out of scope.

## Acceptance
- `node --test .claude/hooks/no-shell-push-hook.test.mjs` passes, including blocked `git push` exiting 2.
