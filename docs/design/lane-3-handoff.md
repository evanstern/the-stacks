# M0 Lanes 3–5 (TASK-0012, 0014, 0015, 0016) — lane handoff (2026-09-22)

**You (the session reading this) are the ORCHESTRATOR for these lanes, not their
implementer.** Dispatch the implementation to `sonnet-implementer` and verify the served
model from the first dispatch's transcript before launching any sibling. Your own hands
touch specs, the board, worktree/PR plumbing, and grounding docs — never `apps/` or
`packages/` source.

**Not the `.handoff/` transport.** This is a session-portable lane contract — prose one
orchestrator writes for the next. Nothing to do with the gitignored `.handoff/` payload
transport between plugins.

**Lanes:** 3, 4, 5 · **Scope:** TASK-0012, TASK-0014, TASK-0015, TASK-0016 — all four
unstarted, unclaimed, no specs · **Runbook:**
`docs/design/m0-skeleton-sweep-runbook.md` (signed off, amended twice) · **Repo state
when written:** root on `main` at `1b49153`, clean, pushed; no worktrees; all gates green
(`pnpm typecheck && pnpm lint && pnpm test && pnpm build` — 10 tests across 3 files); no
CI exists yet (TASK-0017, out of scope).

This file plus the runbook plus the board are the whole contract. **No decision below
lives only in a chat log.**

## How to use this file

Everything here is **dispatch-prompt material, not a work order for you.** You assemble it
into per-phase implementer prompts, run the gates, hold the operator checkpoints, and
merge.

## Dispatch

**Dispatch every phase to `sonnet-implementer`** — model `cc/claude-sonnet-5[1m]`. The
`sonnet` tier declares no fallback; `opus` (`cc/claude-opus-5[1m]`, fallback
`cc/claude-fable-5[1m]`) is escalation-only. Justification: M0's technology choices are all
ratified in architecture A1 and the constitution's Architecture Constraints table, so these
tasks are implementation to a written spec, not design.

- **Escalation: none pre-approved.** Reaching for `opus` is an operator checkpoint recorded
  **before** dispatch. **TASK-0012's race-safe append is the one place this may be
  warranted** — see Operator checkpoints below.
- **Verify the served model from the first dispatch's transcript.** `tiers.mjs --check`
  exits 0 here (all three agents `unchanged`), but that proves the file says sonnet, not
  that sonnet ran. Lanes 1–2 verified it 8 times by grepping the transcript:
  `grep -o '"model":"[^"]*"' <output_file> | sort | uniq -c`. It served
  `claude-sonnet-5` every time on this host.
- **Record on the board task**, one line per dispatch, `served=` a bare ID from the
  transcript: `Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5`
- **Dispatch phase-scoped:** one fresh implementer per `tasks.md` phase. Grouping two
  tightly-coupled phases is defensible if you record why (Lanes 1–2 did this once, for a
  TypeScript references graph only provable once packages existed).
- **Dispatch from the repo root, never from inside a worktree** — see amendment A2. Every
  dispatch prompt opens with a location check naming the branch the agent must see.

## Read first, in this order

1. `docs/design/m0-skeleton-sweep-runbook.md` — the lane plan, **amendments A1 and A2**,
   and the T016 finding note. The per-task artifact gate is checkable lines, not prose.
2. `.specify/memory/constitution.md` v1.0.0 — ratified, so `plan.md`'s nine-checkbox
   Constitution Check is a real gate.
3. `docs/design/architecture.md` — **A4 governs TASK-0012 and TASK-0015 directly.**
4. `specs/001-monorepo-scaffold/`, `002-compose-stack/`, `003-hono-server/` — the three
   merged specs. **002 and 003 are the pattern to follow; 001 is not** (see Still owed).
5. `backlog task list --plain` — live state; other sessions move it.

## Where the work sits

- **Nothing is started.** No branches, no worktrees, no spec dirs for 0012/0014/0015/0016.
  Spec numbers 001–003 are taken; **004 onward are free, but check `origin/main` before
  claiming each** — another session may take one.
- **Claim state: all four unclaimed.** The first commit of each claims it: board card →
  In Progress, spec stub, AND the `spec-bridge:link` marker, in **one** commit.
- **One task, one PR** for each.

## Already proven — do not re-derive

- **The Spec Kit skills work inside a sweep worktree.** `setup-plan.sh` and
  `setup-tasks.sh` resolve a feature by spec-dir basename when no branch matches. Run them;
  do not hand-author. Amendment A1 is the gate line.
- **`backlog` has `auto_commit: true`.** Every CLI edit self-commits. A claim therefore
  needs `git reset --soft <base>` to fold the auto-commits and the spec stub into one
  atomic claim commit. This bites on every single claim.
- **The board CLI resolves to whichever checkout you run it from.** Run board commands
  inside the task worktree while a claim is in flight; root lags until merge. Root and
  branch disagreeing on a card's status is expected, not a bug.
- **Card-note merge conflicts are routine** when merging `main` into a task branch — both
  sides carry real history. Keep both, drop the `updated_date` side.
- **The health seam contract is settled and implemented**: `GET /health` returns **200 in
  every case**, with degradation in the body. `contracts/healthcheck.md` and
  `contracts/health.md` are the authority. Do not "fix" the 200.
- **`APP_PORT` is one number on both sides** — the app binds it, compose publishes it, the
  healthcheck probes it. There is no separate internal port variable.
- **The stack genuinely works end to end.** Verified by the orchestrator: healthy → db
  stopped → app stays Up reporting `degraded`/HTTP 200 → flips to `(unhealthy)` at ~54s →
  db restarted → healthy, no manual restart. Data survives `down`/`up` and an image
  rebuild. Postgres 17.10, `vector` 0.8.4 available (not enabled — that is TASK-0012).

## Still owed

- **Spec 001 is the odd one out.** It was hand-authored before amendment A1 and lacks
  prioritized user stories, Given/When/Then scenarios, the Constitution-Driven Requirements
  section, `research.md`, `contracts/`, `data-model.md`, and `quickstart.md`. Its tasks.md
  does not follow the `[ID] [P?] [Story]` format. **Left deliberately** — content is sound,
  TASK-0010 is Done, and rewriting merged history quietly is worse than a recorded
  inconsistency. Operator declined normalizing it mid-sweep. If uniformity is wanted, it is
  a board card, not a quiet rewrite.
- **`pnpm test` still reports "no tests yet" for `packages/shared` and `apps/web`** —
  placeholder no-ops from TASK-0010. Real tests arrive with the tasks that need them.
- **No `docs/wiki/` exists.** No pin, no freshness gate. Build it once with
  `/grounding-wiki:wiki-build` **after the final merge**, not during.

## Operator-authorized scope

- **In scope:** the four remaining M0 tasks, their specs, branches, and PRs. Merging is
  authorized — `Bash(gh pr merge:*)` is in `.claude/settings.json`, added by the operator
  after the classifier (correctly) refused to let a session grant itself merge rights.
- **NOT in scope:** TASK-0017 (CI) and TASK-0018 (root-guard fix) are on the board and
  outside this sweep. Do not start them.
- **Never-commit list:** a real `.env` (git-ignored; `.env.example` carries placeholders
  only). No rulebook content of any kind — constitution VIII is non-negotiable.
- **Decisions that are the operator's:** any lane reorder or drop (runbook amendment +
  ping); any `opus` escalation; any change to a settled seam contract.

## Gates and execution rules that already bit this sweep

- **Rebases and force-pushes are forbidden repo-wide** by the root-guard hook. Branches
  freshen by `git merge origin/main`. The root checkout is read-only except commits scoped
  entirely to `backlog/`.
- **Stage `backlog/` paths in a separate Bash call from the commit** — the hook inspects
  staged state before the command runs.
- **A subagent inherits the orchestrator's cwd.** Dispatching from inside worktree A hands
  worktree A to an agent told to work in worktree B. One dispatch woke up in the wrong
  checkout and correctly refused. Amendment A2 is the gate line.
- **Verify implementer claims; do not accept reports.** Lanes 1–2 found three defects this
  way, including one where an agent reported a warning as "pre-existing" that its own task
  had introduced. Re-run the gates yourself after every history move.
- **A regression test must be proven to fail without its fix.** Temporarily revert the fix,
  watch the test fail, restore. A test that passes either way is worse than none.
- **Gates before PR, in order:** `pnpm install && pnpm typecheck && pnpm lint && pnpm test
  && pnpm build`, run **in the worktree**, with the literal output pasted into the PR body.
  That output is the standing evidence for the CI that TASK-0017 has not built.
- **Re-run all gates after merging `main` in**, unconditionally.

## The lanes

**Lane 3 — TASK-0012 alone (the event log). Nothing else can start.**
Drizzle, versioned migrations, the `(session_id, seq)` events table with
actor/type/payload/visibility/ts and a payload schema version, race-safe append, tests for
append and cursor read-back. Architecture A4 and constitution IV govern. This is the spine
M4 rests on — the one task in the remaining set where a wrong shape is expensive later.

**Lane 4 — TASK-0014 ∥ TASK-0015, after 0012 merges.**
0014 owns auth tables and HTTP auth routes; 0015 owns the WS gateway and fan-out. Their
seam is **`validateSession(token) → {userId, role} | null`**, callable from both the HTTP
middleware and the WS upgrade handler — 0015 needs it to filter `visibility` per viewer.
**Fix that contract in 0014's `spec.md` before dispatching either side**, and write it as a
real file under `contracts/`, not a line in this handoff. Lanes 1–2 learned that the hard
way: the `APP_PORT` defect existed because a seam lived in prose instead of a contract.
0014 merges first; 0015 merges `main` in.

**Lane 5 — TASK-0016, the M0 demo. Not droppable.**
React 19 + Vite SPA, TanStack Router/Query, sign-in persisting across reload, WS-subscribed
view, send-a-message, replay-on-reload, and **the two-browser end-to-end demo from
`docker compose up`**. AC#7 *is* the M0 milestone. Note TASK-0016 must also add the SPA
build/serve step to the Dockerfile and compose file — repo-root files this lane owns.

## Done means

- All four tasks **Done on the board via their own merged PRs**, status derived by
  `spec-bridge:sync` — never hand-set on a linked card.
- Each carries its `Spec:` marker, a real `spec.md` + `plan.md` + `tasks.md`, and a
  `Dispatch:` line with a real served model ID.
- **The M0 demo actually runs**: `docker compose up` from a clean clone, two browsers
  signed in as different users, a message from one appearing in the other via the event
  log, and reload replaying prior events. **Verify by running it**, not by trusting tests —
  that is the lesson T016 paid for.
- All gates green on `main`; `git worktree list` shows nothing stale.
- `/grounding-wiki:wiki-build` run after the final merge.
- The runbook's execution log complete and its status flipped to `done`.

Anything short of that gets reported as **exactly what remains**, not rounded up.

## Known open, not blocking

- **Spec 001's format inconsistency** — recorded above, deliberate, operator-declined.
- **The merge-permission note in the runbook reads as a live blocker.** It is resolved and
  marked so; do not re-litigate it.
- **`healthcheck.js` env-var lint** was cleared by declaring `APP_PORT`/`DATABASE_URL` in
  `turbo.json`'s `globalEnv`. If a new task reads a new env var, expect the same warning —
  it is about Turborepo cache correctness, so declare the variable rather than suppress it.
