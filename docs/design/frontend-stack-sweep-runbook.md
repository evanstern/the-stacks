# Frontend stack migration (TASK-0040) — sweep runbook (2026-09-30)

**You (the session reading this) are the ORCHESTRATOR** for the task below. Run it
through the project's full PDLC: spec → link → worktree → delegated implementation → PR →
merge → re-ground. Direction is decided; do not re-litigate it. These win:
`backlog/docs/doc-0003` (frontend stack rulings, decision-0008),
`docs/design/architecture.md` (A1, whose Client row this task supersedes), and the card.
The board is the plan of record. This file carries only ordering, doctrine and the log.
It carries forward the gates and retrospective of `docs/design/m1-wave2-sweep-runbook.md`.

**Status:** executing · operator sign-off on lanes: 2026-09-30 (operator, in the TASK-0028 session)

## Read first (in this order)

1. `backlog/docs/doc-0003*.md` — the ratified rulings. Read the file directly:
   `backlog doc view` opens a pager in a non-interactive shell.
2. `docs/design/architecture.md` (A1, A5) and `.specify/memory/constitution.md` (I, III,
   IX; the Stack section).
3. `docs/design/chat-ui/decision.md` and `specs/024-chat-ui/spec.md` on branch
   `task-0028-chat-ui`: the consumer this migration unblocks. Read them for context
   only. Build none of them here.
4. `docs/wiki/CAPSULES.md`, then only these notes: `spa-shell`, `static-serving`,
   `container-image`, `server-entrypoint-and-app`, `client-identity`,
   `client-session-hook`, `m0-demo`.
5. `backlog task list --plain`, then `backlog task view TASK-0040 --plain`.

## State when this runbook was written (2026-09-30)

- **Done already:** M0; M1 wave 2 except TASK-0028 and TASK-0031. `main` at `de88074`.
- **Verified at authoring:**
  - `pnpm env:prune --check` → no orphans.
  - `tiers.mjs --check` → exit 0, all three definitions unchanged.
  - Root is clean on `main`.
  - Merge-drift gate absent.
  - Highest spec on `origin/main` is `023`. `024` is held by TASK-0028 on its branch.
- **In flight in other sessions:** none. TASK-0028's design-rounds session runs this
  sweep.
- **On hold — untouched:** TASK-0028.
  - Its branch is `task-0028-chat-ui` and its worktree is `.worktrees/task-0028`.
  - It is held by operator ruling until this task merges. The hold is recorded in its
    card notes, not as a `paused` label.
  - Never claim, rebase or clean its branch or worktree from this sweep.
- **Queued:** TASK-0040.

## Execution lanes

**Lane 1 (only lane):**

- **TASK-0040. Implementation: sonnet · `cc/claude-sonnet-5[1m]`.** The rulings settle
  every stack choice; the plan settles the mechanics.
  - Spec authoring: opus · `cc/claude-opus-5-5[1m]`, under the standing spec-authoring
    ruling of 2026-09-29.
  - Fallback for opus: `cc/claude-fable-5-1[1m]`.
  - Spec number: `025`.
  - Scope: port the existing sign-in, home and play routes. Add no chat UI.

**After merge:** TASK-0028 resumes in the same session. Its branch merges `origin/main`
in, its plan and tasks are authored against the new base, and implementation dispatches
then. That is TASK-0028's design-rounds work, not this sweep's.

Tiers and model IDs come from `.claude/model-tiers.json`. Record
`Dispatch: tier=… pinned=… served=…` on the card for every dispatch. Read `served=` from
the transcript.

## Per-PR gates this project enforces

- **Merge-drift gate: ABSENT.** Raw git governs:
  - Run `git fetch origin && git pull --ff-only` at root first.
  - Check `git ls-tree --name-only origin/main specs/` before claiming.
- **Root-guard hook:** root is read-only apart from `backlog/` commits.
  - Rebase, force-push and squash merge are forbidden repo-wide.
  - The branch merges `origin/main` in.
  - The PR lands as a merge commit.
- **`REQUIRE_DATABASE=1 pnpm ci:check`** green in the worktree.
  - Export `TEST_DATABASE_URL` from the worktree `.env` first. Never print `.env`.
  - Put the evidence in the PR body. CI must be green on the PR.
  - This PR changes the web build and the server entry. Re-check `check:host-scripts`,
    and extend it in the same PR if needed.
- **Boundary check stays green** (card AC #4). `apps/web` never imports `apps/server`.
  The load-context interface lives in `packages/shared`.
- **Two demo runs** (card AC #7): run the M0 two-browser echo demo against the
  per-worktree stack and against the built container image. Record both in the PR body.
- **No CDN, no webfont** (constitution IX; card AC #5).
  - Search `apps/web` and the built output for `fonts.googleapis`, `cdn.`, `unpkg` and
    `jsdelivr`.
  - Expect zero hits.
- **No modals** (card AC #5; standing operator UI rule).
  - Never add the shadcn `Dialog` or `AlertDialog` component.
  - No file under `apps/web` defines a dialog component.
- **Browser automation uses Brave**, not Chrome:
  `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser`.
- **Wiki freshness after every history move:**
  `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`
  prints `OK`.
- **Spec-bridge:**
  `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`
  exits 0 before the PR opens and after every sync.
- **Expected wiki reviews** (card AC #9):
  - Re-ground `static-serving`, `spa-shell`, `container-image` and
    `server-entrypoint-and-app`.
  - Review `client-identity`, `client-session-hook`, `m0-demo`, `monorepo-and-toolchain`
    and `overview`.
  - `spa-shell` likely becomes a note on the React Router app. Rename or retire it through
    the wiki-update loop, never by hand.
  - Regenerate `CAPSULES.md` when any `description:` changes.
- **Same-PR companion:** amend `docs/design/architecture.md` A1 Client row to cite
  doc-0003 (card AC #8).

## Per-task artifacts required before PR

**No PR opens until each line below checks true.**

- [ ] **An `opus-implementer` dispatch produced the spec set through Spec Kit:** `spec.md`,
      `plan.md` with the Constitution Check, `research.md` and `tasks.md`. The claim stub
      satisfies nothing.
- [ ] The card carries its Spec marker from the claim commit. Phase ACs are re-seeded
      from `tasks.md` before implementation dispatch.
- [ ] **Dispatch from a neutral cwd.** Every prompt opens with
      `cd <worktree> && pwd && git branch --show-current`, names the expected branch, and
      orders a STOP on mismatch.
- [ ] **Every dispatch prompt forbids the backlog MCP tools.** Card changes use the
      `backlog` CLI inside the worktree.
- [ ] **One implementer per `tasks.md` phase.** Each prompt carries the turn-hygiene block.
- [ ] A `Dispatch:` line with a real `served=` ID is on the card for every dispatch.
      Verify the first dispatch's served model before launching siblings.
- [ ] **`plan.md` names every new dependency with its reason.** The checkpoint below
      clears them. Expected:
      - `react-router`, `@react-router/dev`, and `@react-router/node` (or the Hono
        adapter the plan picks);
      - `tailwindcss` and `@tailwindcss/vite`;
      - shadcn's local-source dependencies: `radix-ui` primitives,
        `class-variance-authority`, `clsx`, `tailwind-merge`, and an icon set.
- [ ] **TanStack Query:** removed, or `plan.md` justifies its remaining use (card AC #6).
- [ ] **`tasks.md` ticks are re-checked after every merge to `main`.**
- **Escape lines (operator-signed only):** none.

## Concurrency & conflict doctrine

- **Hotspots:**
  - `apps/web/**`: rewritten wholesale by this task. TASK-0028 builds on the result and
    starts only after merge, so there is no parallel conflict.
  - `apps/server/src/static.ts`, `app.ts` and `index.ts`: the request-handler mount.
  - `packages/shared`: the new load-context interface.
  - `Dockerfile`: the web build output location changes.
  - Root `package.json`, `pnpm-lock.yaml`, `biome.json` and the boundary rules.
- The TASK-0028 branch touches only `docs/design/chat-ui/`, `specs/024-chat-ui/` and its
  card. It does not conflict with this task.
- Reconcile by merging `origin/main` in (root-guard forbids rebase).
- Re-pin honestly. Classify every staled pin as RE-PIN-ONLY or NEEDS-REVIEW against
  `git diff <old-pin>..<merge-commit> -- <sources>`.
- After every history move, re-run `ci:check`, the DB suites, the freshness probe and the
  spec-bridge check.
- **Claim before work.** The first commit on the branch holds:
  - the card set to In Progress;
  - the `specs/025-frontend-stack` stub;
  - the Spec link;
  - this runbook.

  Push immediately. Never force-push.
- Verify the merge with `gh api repos/evanstern/the-stacks/pulls/<n> --jq .merged` before
  deleting the branch.
- Run `pnpm env:down` before `git worktree remove`, then `pnpm env:prune --check`.

## Operator checkpoints (do not proceed silently)

- **Lane sign-off on this runbook.** Stop before the spec dispatch.
- **Dependencies.** Stop after `plan.md` is committed. List every new package and its
  reason. Get a yes before implementation dispatch.
- **Hono adapter choice.** doc-0003 ruling 4 mounts `createRequestHandler` inside Hono.
  The plan names how: a community adapter or a hand-written bridge. A new package falls
  under the dependency checkpoint above.
- **Reserved paths.** Changing which paths are reserved (`/health`, `/api`, `/auth`,
  `/ws`, `/library`) is a contract change. Stop and ask.
- **Other stops.** Tier escalations, lane amendments, and softening any gate above: amend
  this file, note why, tell the operator.

## Done means

- TASK-0040 is **Done on the board via its own merged PR**, with status derived by
  `spec-bridge:sync`. The Spec marker is still on the card.
- `specs/025-frontend-stack/` holds `spec.md`, `plan.md` and `tasks.md`.
- The card carries a `Dispatch:` line for every dispatch.
- `pnpm ci:check` is green on `main`. CI and the deploy job are green on the merge.
- Wiki freshness prints `OK`, and the spec-bridge check exits 0.
- No TASK-0040 worktree remains, and `pnpm env:prune --check` exits 0.
- TASK-0028 is released from hold: the operator is told, and it resumes on the new base.
- This file's log is complete and its status is set to done.

## Execution log

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-09-30 | (runbook) | — | — | — | Authored as draft from the TASK-0028 session, in the TASK-0040 claim commit. Awaiting lane sign-off. |
| 2026-09-30 | (runbook) | — | — | — | Signed off by the operator. Spec 025 dispatched to opus. |
| 2026-09-30 | TASK-0040 | — | — | — | In flight. Spec 025 (3094e99) + amendment (ba7d16c, checkpoints approved). phases: 1 done (cab046d), 2 done (2565447), 3 done (177778d), 4 done (3f90c7c), 5 done (a9a5d37), 6 done (7f44333, e572d7f, 86ce7a4). All gates green. PR #39 open, CI green (run 36671760825); awaiting operator merge. |
