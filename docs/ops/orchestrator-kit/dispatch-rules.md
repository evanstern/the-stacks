# M3 sweep — rules for every dispatched agent

You were dispatched by the M3 sweep orchestrator. Follow these rules exactly.

## Location
- Your first command is the `cd <worktree> && pwd && git branch --show-current` line in your brief. On a branch mismatch, STOP and report.
- Run all commands from your worktree. Never `cd` to the repository root. Never touch another worktree.

## Git
- Stage with `git -C <literal worktree path> add <paths>` in one Bash call. Commit with `git -C <literal worktree path> commit -m "..."` in a SEPARATE Bash call. Use the literal path, never a `$variable` or `cd`. The root-guard hook blocks anything else.
- End every commit message with the attribution trailer your harness gives you.
- Push with `git -C <literal worktree path> push`. Never rebase, force-push or squash. Never `git stash`.
- Never `git add backlog/` wholesale.

## Board
- Never use the backlog MCP tools: they edit the root checkout's card copy. Use the `backlog` CLI inside your worktree, and only when your brief says to. The CLI auto-commits each edit.

## Spec Kit (spec authors)
- Use the skills: `speckit-specify` → `spec.md`; `speckit-clarify` only on genuine ambiguity (say so in spec.md when skipped); `speckit-plan` → `plan.md` with a Constitution Check against `.specify/memory/constitution.md` 2.0.0; `speckit-tasks` → `tasks.md` with real phases (one phase is one implementer dispatch; no catch-all phase).
- Point `.specify/feature.json` at your spec dir when a skill needs it, then restore it (`git -C <worktree> checkout origin/main -- .specify/feature.json`) before committing. Never commit it: every lane edits it and the PRs conflict.
- `spec.md` maps every card acceptance criterion. `plan.md` names every file it touches, every migration, and every new runtime dependency with the reason an installed package does not cover it.
- `tasks.md` ends with a wiki phase: the notes the runbook lists for your task (NEEDS-REVIEW), plus `CAPSULES.md`/`INDEX.md` upkeep, re-pinned honestly.

## Grounding
- Load `docs/wiki/INDEX.md` then `docs/wiki/CAPSULES.md`. Load notes just-in-time. Never bulk-load the corpus.
- The sweep runbook is on main: `docs/design/m3-table-sweep-runbook.md` (merge origin/main into your branch if it is missing). Amendment 1 supersedes the original Track C table. Its "Per-PR gates", "Per-task artifacts required before PR", "Task-specific merge conditions" and "Concurrency & conflict doctrine" sections bind you.

## Gates (implementers)
- A fresh worktree has no `node_modules`: run `pnpm install --frozen-lockfile` first.
- `pnpm ci:check` green. DB-touching work runs with `REQUIRE_DATABASE=1` on your worktree's own stack: `pnpm env:up` → migrate both databases by hand (fresh stacks come up unmigrated, TASK-0098) → restart the app → tests. Leave the stack up; the orchestrator runs `pnpm env:down`.
- DB scene/playtest integration tests can hit vitest's 5 s timeout under full-suite load (TASK-0154). Re-run once and report; do not fix.
- Run DB suites by exporting only `TEST_DATABASE_URL` from the worktree `.env`. Never `source` the whole `.env`: its JSON-valued AI config breaks `test/bench/retrieval.test.ts`.
- WebSocket gateway tests are known-flaky. If one fails and your change did not touch it, re-run it once and report the re-run. Do not fix it.
- Wiki freshness: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` prints `OK`.
- Spec-bridge: `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` exits 0.

## Product rules
- UI: no modals. Use slide-out panels or autocomplete dropdowns. Browser automation uses Brave.
- No "for now" without a card (decision-0020). Name any deferral as an open question; the orchestrator cards it.
- Never read, print or commit keys or passwords. No paid model/provider run: tests use the fake gateway.
- Do not change frozen contracts (`docs/wiki/ws-protocol.md` frame shapes, `specs/029-proposal-gate/contracts/`, `specs/030-play-route/contracts/proposal-seam.md`) unless your brief says the operator ruled.

## Turn hygiene
- Batch independent reads and checks as parallel tool calls in one message.
- Minimal narration between calls.
- Report back short: commit shas, what you produced, gate results, open questions.
