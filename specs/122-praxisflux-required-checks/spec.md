# Feature Specification: praxisflux gates run as required GitHub checks

**Card**: TASK-0359 (Paperclip INF-9, parent INF-8). **Spec number**: 122 (allocated by the Project Manager, INF-10).
**Status**: Draft
**Decision**: decision-0031 (Dispatch evidence for non-Claude agents).

## Why

The pdlc gates run today only as Claude Code Stop and PreToolUse hooks. A harness that is not Claude Code (OpenCode, Hermes, Codex) never fires them. CI is the authoritative enforcement point, so the same gates must block a PR there before any agent changes harness.

## Requirements

- **FR-001**: A `gate-spec-bridge` job runs the spec-bridge bridge gate from the pinned `@praxisflux/gates` package. `.spec-bridge.json` sets `requireDispatchRecord: true`, so a claimed card without a `Dispatch: tier=<t> pinned=<id> served=<id>` line fails.
- **FR-002**: A `gate-wiki-freshness` job runs the grounding-wiki freshness gate with full git history.
- **FR-003**: A `gate-tiers` job runs `tiers.mjs --check` from the pinned praxisflux release against `.claude/model-tiers.json`. A tier key such as `kimi` added by PR is validated by the same check (decision-0031).
- **FR-004**: A `gate-scope` job runs `scripts/check-spec-scope.mjs`: it fails when a PR touches a path outside its linked spec's declared scope. `backlog/`, `docs/wiki/` and the spec's own directory are always allowed.
- **FR-005**: Scope is read from a `Scope-Paths:` line in `spec.md`, else from path-like backtick tokens in the `## Scope` section. Where scope cannot be derived the job warns and exits 0 (advisory). Those cases: the PR touches no spec dir; the PR touches more than one spec dir; the spec declares no scope paths.
- **FR-006**: The four jobs are marked required for PRs to `main` in branch protection, or a question card names the four check names for Evan.
- **FR-007**: Proof: one non-compliant PR is blocked by CI, one compliant PR passes; both are linked on the card; the non-compliant one is closed unmerged.
- **FR-008**: The gates start green on `main`: the stale `docs/wiki/hosted-dev.md` pin is re-pinned.

## Success criteria

- **SC-001**: a PR with a claimed card and no `Dispatch:` line fails `gate-spec-bridge`.
- **SC-002**: a PR touching `apps/web/**` under a spec that does not declare it fails `gate-scope`.
- **SC-003**: `pnpm ci:check` green, including the scope script's unit tests.

## Scope

Scope-Paths: .github/workflows/, .spec-bridge.json, scripts/check-spec-scope.mjs, scripts/check-spec-scope-lib.mjs, scripts/check-spec-scope-lib.test.mjs, package.json, docs/wiki/hosted-dev.md, AGENTS.md

- **In**: the four CI jobs, the scope script and its tests, `.spec-bridge.json`, the hosted-dev wiki re-pin.
- **Out**: changes to `@praxisflux/gates` itself; non-Claude tier entries (added later by PR); hosted-dev (vm-104) actions.

## Advisory vs blocking

All four jobs block, except `gate-scope` on the three non-derivable cases in FR-005, which warn.
