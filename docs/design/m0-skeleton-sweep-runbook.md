# M0 Skeleton (TASK-0010 → TASK-0016) — sweep runbook (2026-09-22)

**You (the session reading this) are the ORCHESTRATOR** for the tasks below. Run each
through the host project's full PDLC — spec → link → worktree → delegated implementation →
PR → merge → re-ground — parallelizing within lanes, merging serially, treating merge
conflicts as routine. **You do not implement.** Every task's code is dispatched to
`<tier>-implementer`; your hands touch specs, the board, worktree/PR plumbing, and this
log. Direction is decided; do not re-litigate it: `docs/design/vision.md`,
`docs/design/architecture.md` (A1–A9), `docs/design/milestones.md` (M0), and
`.specify/memory/constitution.md` v1.0.0 win. Plan-of-record is the board; this file
carries only ordering, doctrine, and the log.

**Status:** signed-off · operator sign-off on lanes: 2026-09-22
**Amended 2026-09-22 (A1):** the per-task spec cycle now names the `speckit-*`
skills as invocations. See "Amendment A1" below. Re-signed by the operator.
**Amended 2026-09-22 (A2):** dispatch from a neutral cwd; every dispatch prompt opens
with a location check. See "Amendment A2" below.
**Amended 2026-09-22 (A3):** publish the database port on loopback so race-safety can be
tested against a real Postgres. See "Amendment A3" below. Operator-selected.
<!-- Only the OPERATOR flips draft → signed-off (the author never pre-fills it). An
     executing session must refuse a runbook whose status it cannot verify. -->

## Read first (in this order)

1. `docs/design/architecture.md` (A1 stack table, A2 topology, A4 event sourcing) and
   `docs/design/milestones.md` (M0 — the demo this sweep must produce).
2. `.specify/memory/constitution.md` v1.0.0 — every `plan.md` runs its Constitution
   Check gate. Principles I, III, IV, VIII, IX bind M0 directly.
3. `.claude/hooks/root-guard-hook.mjs` header comment — the repo's write jurisdiction
   rules, summarized under "Per-PR gates" below.
4. `backlog task list --plain` — live state; other sessions move it while you work.
5. The task you're about to execute (`backlog task view TASK-<n> --plain`).
6. `.specify/templates/spec-template.md` and `plan-template.md` — the shapes the
   `speckit-*` skills populate. Read them BEFORE authoring any spec, so you recognize
   what a correctly-produced artifact looks like. See Amendment A1.

## Current state (updated 2026-09-23 — read this before the snapshot below)

**Six of seven tasks are Done and merged.** Only **TASK-0016** (React SPA + the two-browser
demo) remains, and its AC#7 *is* the M0 milestone. See
[`lane-5-handoff.md`](./lane-5-handoff.md) for the executing contract.

`main` is at `3009838` with all gates green from a clean checkout: migration applies, 67/67
tests across 10 files, typecheck, lint, build. No worktrees, no stale branches.

Three amendments are in force: **A1** (the spec cycle must invoke the `speckit-*` skills),
**A2** (dispatch from a neutral cwd), **A3** (publish the database port on loopback).

The snapshot below is preserved as written on 2026-09-22 and describes a greenfield repo that
no longer exists. It is history, not current state.

## State when this runbook was written (2026-09-22)

- **Done already:** nothing in this scope. The repo is greenfield — `docs/`, `backlog/`,
  `.specify/`, `.claude/` only. **There is no source code, no `package.json`, no
  `specs/` directory.** TASK-0010 creates the first code in the repo.
- **In flight in other sessions (do not duplicate; expect their merges):** none observed
  at authoring time. `git worktree list` showed only the root checkout.
- **Paused — untouched:** none. No task in this scope carries a `paused` label.
- **Queued (this runbook's scope, execution order):** TASK-0010, TASK-0011, TASK-0013,
  TASK-0012, TASK-0014, TASK-0015, TASK-0016.
- **Out of scope but adjacent:** TASK-0017 (CI pipeline) and TASK-0018 (root-guard
  non-ASCII fix) are on the board and NOT in this sweep. TASK-0017 matters to lane
  planning — see the gate note about CI below.
- **No `docs/wiki/` exists.** The grounding corpus has not been built, so no note is
  pinned to any source file and no freshness gate can fire. Re-grounding for this sweep
  therefore degrades to: leave the wiki alone during the sweep, and run
  `/grounding-wiki:wiki-build` once after the last merge (see "Done means").

## Execution lanes (dependency-ordered; parallelize within a lane)

Rule of thumb: DEVELOP in parallel, MERGE serially. **This wave is unusually serial by
construction** — TASK-0010 creates the workspace every other task writes inside, and the
board's own dependency edges (0011←0010; 0012←0011; 0013←0010; 0014←0012,0013;
0015←0012,0013; 0016←0014,0015) leave exactly one honest parallel pair. Do not
manufacture parallelism the dependency graph does not support: two branches both
inventing `package.json` conflict on every file they touch.

**Lane 1 — TASK-0010 alone. Nothing else can start.**
- **TASK-0010 (sonnet · model `cc/claude-sonnet-5[1m]`, fallback n/a — non-escalation
  tier; the toolchain is fully specified by architecture A1's table, so the judgment
  calls are already made)** — pnpm + Turborepo workspace, TS strict, Node 22 pin, lint
  and format baseline, workspace packages for server/web/shared. **This is the whole
  repo's file footprint** — root `package.json`, `pnpm-workspace.yaml`, `turbo.json`,
  `tsconfig*.json`, `.nvmrc`, lint/format config, and the three package skeletons.
  Every later task writes inside what this creates. Merge it before cutting any other
  task's worktree.

**Lane 2 — after TASK-0010 merges. The one honest parallel pair:**
- **TASK-0011 (sonnet · `cc/claude-sonnet-5[1m]` — compose + Postgres 17/pgvector is
  configuration to a ratified spec, constitution IX; no unsettled design call)** —
  `docker-compose.yml`, `Dockerfile`, `.env.example`, named volume, healthcheck.
  Footprint is infra files at the repo root; it does not touch `apps/server/src`.
- **TASK-0013 (sonnet · `cc/claude-sonnet-5[1m]` — Hono server to architecture A1/A2
  with one Zod route; the pattern is prescribed)** — server entrypoint, health
  endpoint, one typed REST route, structured error shape, tests. Footprint is
  `apps/server/src/**`.
- **Why these two are genuinely parallel:** 0011 owns infra files, 0013 owns server
  source. They meet at exactly one seam — **the health endpoint's DB status and the
  compose healthcheck that calls it**. That seam is the conflict; see Concurrency
  doctrine for how it is resolved (0011 merges first, 0013 merges `main` in).
- **Contract-shaped work goes first within the lane:** TASK-0013's health-endpoint
  *contract* (its path and response shape) is what 0011's healthcheck consumes. The
  orchestrator fixes that contract in TASK-0013's `spec.md` BEFORE dispatching either
  task, and records it here as a gate line, so 0011 codes against a written contract
  rather than a guess. **Contract: `GET /health` → `200 {status:"ok"|"degraded",
  process:{...}, database:{reachable:boolean}}`.** If an implementer needs to change it,
  that is an operator checkpoint, not a unilateral edit.
- **Note on 0011's dependency edge:** the board declares 0011←0010 but NOT 0011←0013.
  0011's AC#5 ("the app container reaches the database and reports healthy") is
  satisfiable against the contract above; if the server does not yet exist when 0011 is
  implemented, the healthcheck targets the contract and 0013's merge makes it live.
  Sequence 0011 → 0013 within the lane so the second one reconciles.

**Lane 3 — after Lane 2 merges. Serial: the event log is the spine.**
- **TASK-0012 (sonnet · `cc/claude-sonnet-5[1m]` — Drizzle + the events table is
  written directly by architecture A4 and constitution IV; schema shape, ordering, and
  visibility field are all specified)** — Drizzle wiring, versioned migrations,
  `events` table keyed `(session_id, seq)` with actor/type/payload/visibility/ts, a
  payload schema-version field, race-safe append, tests for append + cursor read-back.
- **Ordering note:** the board puts 0012 before 0013 by ordinal, and declares
  0012←0011. This runbook runs **0013 before 0012** because 0013 depends only on 0010
  and pairs cleanly with 0011, while 0012's race-safe append is better built against a
  running server + compose stack. No dependency edge is violated: 0012's declared
  dependency (0011) is merged before 0012 starts. **This reordering is a deliberate
  runbook decision, recorded here rather than left implicit.**
- **Race-safety is the one real judgment call in this task.** AC#5 ("race-safe under
  concurrent writers to the same session") admits several implementations (advisory
  lock, serializable retry, an identity/sequence column with a unique constraint). The
  spec must NAME the chosen mechanism and justify it before dispatch, so the implementer
  is not choosing architecture. If the spec cannot settle it, that is an operator
  checkpoint — not an escalation the implementer makes mid-task.

**Lane 4 — after TASK-0012 merges. The one real parallel pair of the back half:**
- **TASK-0014 (sonnet · `cc/claude-sonnet-5[1m]` — Lucia-style self-rolled session
  auth; architecture A1 and constitution's auth row fix the approach. Password hashing
  and cookie flags are prescribed practice, not open design)** — user + session tables
  and migrations, modern password hash, sign-in/sign-out/validate over HTTP with secure
  cookies, operator provisioning path, player invite, WS authentication hook, tests.
- **TASK-0015 (sonnet · `cc/claude-sonnet-5[1m]` — WS gateway to architecture A4;
  authority, ordering, cursor replay, and visibility filtering are all specified)** —
  `ws` in the same process, server-side validation before append, fan-out in seq order,
  cursor replay with no gaps/duplicates, visibility filtering per viewer, reconnect
  handling, tests.
- **Why parallel:** 0014 owns auth tables + HTTP auth routes; 0015 owns the WS gateway
  and event fan-out. Both depend on 0012 and 0013, neither on the other.
- **Their seam, and it is a real one:** TASK-0014 AC#6 says WebSocket connections
  authenticate using the same session; TASK-0015 needs a per-viewer identity to filter
  `visibility` (its AC#5). **Contract-shaped work goes first: TASK-0014's
  session-validation function is the contract 0015 consumes.** Fix it in 0014's
  `spec.md` before dispatching either — **Contract: a
  `validateSession(token) → {userId, role} | null` seam callable from both the HTTP
  middleware and the WS upgrade handler.** 0014 merges first; 0015 merges `main` in and
  wires to the real function. Until then 0015 codes against that signature.

**Lane 5 — after Lane 4 merges. The demo. Not droppable.**
- **TASK-0016 (sonnet · `cc/claude-sonnet-5[1m]` — React 19 + Vite SPA with TanStack
  Router/Query per A1; the M0 demo's shape is written in milestones.md)** — SPA shell
  served by the app container, router + query wired, sign-in view persisting across
  reload, WS-subscribed view rendering events, send-a-message path, replay-on-reload,
  and the two-browser end-to-end demo from `docker compose up`.
- **This lane has no tail to drop.** TASK-0016 AC#7 IS the M0 milestone demo. A sweep
  that lands 0010–0015 and skips 0016 has not produced M0. If time pressure appears,
  the operator descopes — not the orchestrator.

Tiers and their model IDs come from **`.claude/model-tiers.json`** (the host's tier
config), not from memory — `tiers.mjs --root . --check` exited **0** on 2026-09-22 with
all three agents `unchanged` (config version 1, `defaultTier: sonnet`,
`escalationTier: opus`), so the IDs written above are the IDs that would run. **No tier
was regenerated while authoring**, so no session restart is owed before dispatch.

**Every task in this sweep runs at `defaultTier` (sonnet).** That is deliberate and
justified per task above: M0 is a walking skeleton whose every technology choice is
already ratified in architecture A1 and the constitution's Architecture Constraints
table. There is no design work left for an implementer to do — only implementation to a
written spec, which is exactly the sonnet tier's stated scope. **No task here is
pre-approved for the `opus` escalation tier**; reaching for it mid-sweep is an operator
checkpoint recorded before dispatch (see Operator checkpoints).

Record the model tier + explicit model ID + rubric justification on each board task at
dispatch, as the machine-findable line — one per dispatch:

```
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=<from transcript>
```

`served=` is filled from the transcript with a bare model ID; a placeholder does not
count, and **a task's PR is not merge-ready without this line.** The `opus` tier's
subscription fallback, if an escalation is ever approved, is `cc/claude-fable-5[1m]`
(record which model actually served). The `sonnet` and `haiku` tiers declare no fallback.

**Verify the served model from the FIRST dispatch's transcript before launching any
sibling dispatch.** This host requires the augmented model-ID form (`cc/...[1m]`); bare
API IDs are rejected here. Both pin mechanisms — the agent definition's frontmatter and
the dispatch call's `model` parameter — have been observed failing on some hosts, so
neither is proof. The transcript is.

## Per-PR gates this project enforces (enumerated — implementers cannot miss these)

- **Merge-drift gate: ABSENT.** `scripts/check-merge-drift.mjs` does not exist in this
  repo (probed 2026-09-22; there is no `scripts/` directory at all). Raw git commands
  govern: `git fetch origin && git pull --ff-only` at root before each task; manual
  check of `specs/` against `origin/main` before claiming an NNN. An adopting session
  should not re-derive this — re-probe only if `scripts/` has since appeared.
- **Root-guard hook (`.claude/hooks/root-guard-hook.mjs`, wired as a PreToolUse hook in
  `.claude/settings.json`). This is live machinery, not advice — it blocks tool calls:**
  - The **root checkout is read-only**. Write/Edit at root is blocked outside ignored
    paths. Author every change in a worktree.
  - **Rebases are forbidden repo-wide.** Freshen a branch by merging `main` INTO it.
    This is stricter than the generic PDLC doctrine (which rebases pin-free branches) —
    **in this repo, every branch merges main in, always.**
  - **Force-pushes are forbidden repo-wide.**
  - **Squash merges at root are forbidden.** Branches land by plain merge
    (`gh pr merge --merge`, or `git merge --no-ff` at root).
  - **Branch creation at root is forbidden** — cut a worktree instead.
  - **`git commit --amend` at root is denied outright.**
  - **One ratified exception:** commits scoped ENTIRELY to `backlog/` are allowed at
    root (board-sync). Non-`backlog/` staged paths block the commit. Note the pre-write
    side still blocks Write/Edit of `backlog/` at root — use the `backlog` CLI via Bash.
  - **Practical consequence, and it bites:** stage `backlog/` paths in a SEPARATE Bash
    call from the commit. The hook inspects staged state before the command runs, so a
    combined `git add X && git commit` reads the pre-add staged set.
- **No CI exists yet.** TASK-0017 (CI pipeline) is out of this sweep's scope, so there
  is no automated lint/typecheck/test/build gate on these PRs. **Each implementer runs
  the checks locally in the worktree and pastes the results into the PR body** — that
  output is the evidence standing in for CI. The constitution's "CI is the gate" clause
  is satisfied by TASK-0017 later; until then the evidence is manual and must be shown,
  not asserted.
- **Boundary check (constitution III):** the cross-plane import check is a CI job that
  does not exist yet. M0 creates only the Session plane, so there is nothing to violate
  — but do not add a Library or Codex import in this sweep.
- **Re-ground obligations:** no `docs/wiki/` exists, so no note is pinned and no
  freshness check can fail. Do NOT hand-write wiki notes during this sweep. The
  grounding corpus gets built once, after the final merge (see "Done means").

## Per-task artifacts required before PR

Per-TASK obligations — the per-PR gates above are project machinery; this section is
what every scoped task must have produced. **No PR opens for a task until each line
below checks true for it.**

- [ ] **The spec set was PRODUCED BY THE SPEC KIT SKILLS, not hand-authored.** Run, in
      order, as skill invocations — the skill name is the instruction, and a
      hand-written file of the same name does not satisfy this line:
      1. **`speckit-specify`** → `specs/NNN-<slug>/spec.md`. Populates
         `.specify/templates/spec-template.md`: prioritized user stories (P1/P2/P3),
         each INDEPENDENTLY TESTABLE, with Given/When/Then acceptance scenarios.
         Requirements prose organized under my own headings is NOT this template.
      2. **`speckit-clarify`** — only when the spec has genuine ambiguity. Skippable
         on a task whose direction architecture A1–A9 already settles; say so in the
         task's note rather than silently omitting it.
      3. **`speckit-plan`** → `plan.md`, populating
         `.specify/templates/plan-template.md`. Its **Constitution Check is a
         nine-checkbox gate** keyed to principles I–IX, each answered for this
         feature, and *"a 'no' MUST be justified in Complexity Tracking or the plan
         does not proceed."* Filling a differently-shaped table of my own invention
         does not clear this gate — the checkbox list is what a later reader and any
         downstream tooling expect to find.
      4. **`speckit-tasks`** → `tasks.md`, phased checkboxes the bridge derives
         status from.
      The `.specify/scripts/bash/` helpers (`create-new-feature.sh`, `setup-plan.sh`,
      `setup-tasks.sh`, `check-prerequisites.sh`) are what those skills call; they
      resolve a feature by `SPECIFY_FEATURE` or the spec-dir basename when no branch
      matches, so they work correctly inside a sweep worktree. A claim stub reserves
      the number; it satisfies nothing here.
- [ ] Optionally **`speckit-analyze`** after tasks.md, for cross-artifact consistency.
      Required only where `.spec-bridge.json` sets `strictDone` (it does not here).
- [ ] The card carries its Spec marker from the claim commit (`spec-bridge:link`
      against the stub), and phase ACs are seeded from tasks.md (link update mode)
      before implementation dispatch.
- [ ] **`Dispatch: tier=<t> pinned=<id> served=<id>` is on the card**, `served=` a bare
      model ID from the transcript. Required by the constitution's workflow section and
      by this runbook. No PR is merge-ready without it.
- [ ] **Local check evidence is in the PR body** (lint, typecheck, test, build output),
      standing in for the CI that TASK-0017 has not built yet.
- [ ] **The two named seam contracts are honored where they apply:** TASK-0011/0013
      share the `GET /health` contract; TASK-0014/0015 share the `validateSession`
      contract. Both are written into the contract-owning task's `spec.md` before
      either side dispatches.
- **Escape lines (operator-signed only):** none. Every task in this sweep produces a
  full spec set. There is no sanctioned substitute in this runbook.

## Concurrency & conflict doctrine

- **Hotspots (actual paths this wave fights over):**
  - `package.json` / `pnpm-workspace.yaml` / `turbo.json` / `tsconfig*.json` — created
    by 0010, then **every subsequent task adds dependencies to a `package.json`.** This
    is the single hottest surface in the sweep. Lane 2 and Lane 4's parallel pairs will
    both hit it.
  - `pnpm-lock.yaml` — conflicts on nearly any concurrent dependency addition, and does
    not merge sensibly by hand. **Resolution: take main's side, then re-run
    `pnpm install` in the worktree to regenerate.** Never hand-edit the lockfile.
  - `docker-compose.yml` / `Dockerfile` — 0011 creates them; 0016 must add the SPA
    build/serve step.
  - Drizzle migration files — 0012 creates the migration directory; 0014 adds user and
    session tables. **Migrations are ordered files: a later-numbered migration merging
    after another later-numbered one is a real conflict.** Whoever merges second
    renumbers their migration and re-tests against a fresh database.
  - `apps/server/src/index.ts` (or equivalent entrypoint) — 0013 creates it; 0015 and
    0014 both mount into it.
- **Paused tasks are not live lanes:** none in scope. If one appears (a `paused` label,
  set/cleared only via the backlog CLI, provenance in its append-notes), list it in the
  state snapshot and NEVER claim, rebase, or clean its branches/worktrees.
- **Reconcile by merging main IN — always, in this repo.** The generic PDLC doctrine
  rebases pin-free branches; **the root-guard hook forbids rebases repo-wide, so that
  branch of the doctrine is unavailable here.** Every branch freshens by
  `git merge origin/main`. PRs land by plain merge, never squash. Take main's side for
  anything you did not deliberately change.
- **Honest re-pins:** not applicable in this sweep — no `docs/wiki/` exists, so no pin
  can be staled or dishonestly bumped. The rule returns the moment the corpus is built.
- After every history move (a merge-in), **re-run the full local check set** — lint,
  typecheck, test, build — before opening or updating the PR. A sibling's merge changes
  shared config and the lockfile; a green check from before the merge proves nothing.
- Two hotspot-heavy PRs never merge within one re-ground cycle without a reconcile
  between them. Concretely: after 0011 merges, 0013 merges main in and re-checks before
  its own merge. Same for 0014 → 0015.
- Conflicting with a sibling session's open PR → the smaller PR merges first.
- **Claim before work:** the FIRST commit of any task claims it — board card →
  In Progress AND the spec number's directory (a stub claims the number) AND the
  `spec-bridge:link` against that stub — before any spec authoring or code. The claim
  rides the task branch, cut from `origin/main`. Push immediately
  (`git push -u origin <branch>`); never force-push a claim (the hook forbids it
  anyway).
- **Spec numbering:** `specs/` does not exist yet. This sweep creates it. Allocate
  **001 through 007 in execution order** — 001 TASK-0010, 002 TASK-0011, 003 TASK-0013,
  004 TASK-0012, 005 TASK-0014, 006 TASK-0015, 007 TASK-0016. **Check `origin/main` for
  a collision before claiming each one anyway** — another session may take a number
  while this sweep runs. Renumber on conflict; the mapping above is an intent, not a
  reservation.
- **A rejected push means you lost the race:** fetch, re-read the board and `specs/`.
  If another session now holds that task or number, STOP the lane and surface it to the
  operator. Unrelated rejection with the task + number still free → fetch, merge
  `origin/main` into the claim branch, re-push as a plain push.
- Verify a PR is merged (`gh api repos/evanstern/the-stacks/pulls/<n> --jq .merged`)
  before deleting its branch/worktree; never delete+recreate a closed PR's head.

## Operator checkpoints (do not proceed silently)

- **Lane sign-off on this runbook** — the lane order departs from board ordinal order
  (0013 runs before 0012, justified in Lane 3). That reordering needs the operator's
  explicit yes before execution starts.
- **The two seam contracts** (`GET /health`, `validateSession`). They are written into
  specs by the orchestrator. If an implementer needs either shape changed, that is a
  checkpoint, not an edit — a changed contract invalidates the sibling task already
  coded against it.
- **TASK-0012's race-safety mechanism**, if the spec cannot settle it from architecture
  A4 and constitution IV alone.
- **Any escalation to the `opus` tier.** No task here is pre-approved for it; an
  escalation is recorded on the card BEFORE dispatch, with the rubric justification.
- **Any lane dropped, reordered, or resplit mid-sweep** — that is a runbook amendment:
  amend this file, note why, tell the operator.
- **Softening any gate this runbook enumerates**, at plan, implement, or merge time —
  amendment plus an operator ping, never an implementer's decision note buried in a
  spec artifact.
- **Adding any dependency, service, or datastore not in the constitution's Architecture
  Constraints table** — it requires a Complexity Tracking entry in the plan, and an
  amendment if it contradicts the table.

## Done means

- TASK-0010 through TASK-0016 each **Done on the board via its own merged PR** — seven
  tasks, seven PRs, no task's work riding another's branch.
- Every scoped card **still carries its Spec marker** at sweep end (re-run the
  `spec-bridge` links check — other sessions move the board while branches sit).
- Every scoped task's `specs/NNN-*/` contains a real `spec.md` + `plan.md` +
  `tasks.md`. No escape lines are authorized in this runbook.
- Every scoped card carries its `Dispatch: tier=… pinned=… served=…` line with a real
  served model ID.
- **The M0 demo runs**: `docker compose up` from a clean clone, two browsers sign in as
  different users, a message sent from one appears in the other via the event log, and
  reloading replays prior events. This is TASK-0016 AC#7 and the milestone itself —
  verify it by actually running it, not by trusting the tests.
- Lint, typecheck, test, and build pass on `main` after the final merge (run locally;
  CI arrives with TASK-0017).
- `git worktree list` shows no stale sweep worktrees; every merged branch deleted after
  `gh api … --jq .merged` confirmed the merge.
- **Grounding built:** run `/grounding-wiki:wiki-build` after the final merge. This
  sweep creates the entire codebase, so the corpus is built fresh rather than updated.
  Until it exists there is no freshness gate to satisfy — after it exists, every later
  sweep owes it.
- This file's execution log complete and its status flipped to `done`.

## Amendment A1 — bind the spec cycle to the Spec Kit skills (2026-09-22)

**What went wrong.** This runbook's per-task loop said "Spec Kit cycle (specify →
clarify → plan → tasks)" as prose and required three files by name. It never said to
INVOKE the `speckit-*` skills. Spec 001 (TASK-0010, merged) was consequently
hand-authored with heredocs: right filenames, right directory, wrong process. It has no
prioritized user stories, no Given/When/Then acceptance scenarios, and a
Constitution Check table of my own shape rather than the plan template's
nine-checkbox gate.

**Why prose was not enough.** A named artifact is satisfiable by writing a file with
that name. Only a named *skill* is satisfiable solely by running it. Every other gate
in this runbook is written as a command or a checkable string; the spec cycle was the
one obligation expressed as narrative, and it is the one that drifted. That is the
lesson, not a coincidence.

**The fix.** The "Per-task artifacts required before PR" section above now names the
four skills as an ordered, numbered invocation list, states what each produces, and
says explicitly that a hand-written file of the same name does not satisfy the line.

**Scope of the correction.** Specs 002 and 003 were claimed (stubs only, no authoring)
when this was caught; they proceed under the amended loop. Spec 001 stays as merged —
its content is sound and TASK-0010 is Done — and is recorded here as a known
inconsistency rather than silently normalized. If uniformity is wanted later, that is a
board card of its own, not a quiet rewrite of merged history.

**Operator checkpoint:** this amendment was raised by the operator, not self-detected.

## Amendment A2 — dispatches inherit the orchestrator's cwd (2026-09-22)

**What went wrong.** Lane 2's two tasks were dispatched in parallel. The second dispatch
(spec 002, compose stack) was launched while the orchestrator's working directory was
`.worktrees/task-0013` — the *other* task's worktree. The subagent inherited that cwd and
woke up in the wrong checkout, holding instructions for a branch it was not on.

**It was caught by the implementer, not by the orchestrator.** The agent ran `pwd` and
`git branch --show-current`, found its environment contradicted its prompt, and refused
both available wrong answers: silently `cd`-ing into a worktree another process might own,
and writing root infrastructure files onto a branch named for a different task. It stopped
after two read-only tool calls with no files changed and no commits. That refusal is the
only reason this is a near-miss rather than a corrupted branch.

**The rule, for every dispatch in this sweep and any other:**

- [ ] **Dispatch from a neutral cwd** — the repository root, never a task worktree. A
      subagent inherits the orchestrator's working directory, so dispatching from inside
      worktree A hands worktree A to an agent told to work in worktree B.
- [ ] **Every dispatch prompt opens with a location check** the agent must perform before
      anything else: `cd <worktree> && pwd && git branch --show-current`, naming the exact
      branch it must see, and instructing it to STOP and report rather than guess if it
      sees anything else.

**Why this is a gate line and not advice.** Parallel lanes are the whole point of laning,
and every parallel lane multiplies this risk: with one worktree in play the orchestrator's
cwd is usually right by accident; with two or more it is a coin flip. The runbook's lane
plan therefore *creates* the condition this rule exists to handle.

**No corrective work was needed.** Both worktrees were verified clean and on their correct
branches afterward; the task was simply re-dispatched with the location check added.

## Amendment A3 — publish the database port on loopback (2026-09-22)

**What was found.** Spec 004 (TASK-0012) requires, in research D2, that race-safety be
proven against a **real** Postgres rather than a test double — the direct lesson of the
T016 finding. While specifying Lane 3 the orchestrator found that `docker-compose.yml`
publishes **no host port** for the `db` service: `5432/tcp` is exposed to the compose
network only. Verified both directions with the stack up: the host cannot open 5432, and
`docker compose exec db psql` connects fine from inside.

**Why it blocks.** The test suite runs on the host. With no published port, every
integration test would take its loud-skip path on every run, forever — so the evidence
for TASK-0012 AC#5 ("race-safe under concurrent writers") would be **structurally
unobtainable**, and the criterion could never be honestly ticked. A guarantee that cannot
be tested is a guarantee nobody should believe.

**This was a gap, not a ratified choice.** Spec 002 never decided against publishing the
port; it never addressed the question, because nothing before Lane 3 needed host access to
Postgres. Recorded here so a later reader does not mistake this for overturning a decision.

**The fix, operator-selected:** publish the port bound to loopback only —

```yaml
  db:
    ports:
      - "127.0.0.1:${DB_PORT:-5432}:5432"
```

Binding `127.0.0.1` rather than the default `0.0.0.0` is the whole point: the database
becomes reachable from the host that runs the tests, and remains unreachable from the LAN.
An unqualified `"5432:5432"` would expose a self-hoster's database to their entire network,
which constitution IX's self-hosting posture does not accept. `DB_PORT` is overridable for
anyone whose host already runs Postgres on 5432.

**Consequence for `DATABASE_URL`.** It stays `@db:5432` in `.env` — that is what the *app
container* uses, and it is correct there. Host-run tests need `@localhost:5432`, which is a
different connection string for a different caller. The two must not be conflated: `db`
resolves only inside the compose network, and `localhost` inside the app container means
the app container.

**Scope.** `docker-compose.yml` and `.env.example` belong to TASK-0011 (merged). This
amendment authorizes TASK-0012 to touch them, since the task that needs the port is the one
that discovered the gap and no separate deliverable would carry the change. Recorded rather
than done silently, per this runbook's rule that a merged task's surface is not edited on a
whim.

**Operator checkpoint:** the loopback-vs-network-vs-both choice was put to the operator and
decided before any file was edited.

## Execution log

Multi-phase dispatch stays visible in `notes` — one slot, never a second table: while a
task is in flight its row carries the phases dispatched/completed (e.g.
`phases: 1-2 done, 3 dispatched`), updated at each dispatch boundary, so a resuming
session can see where within the task the last one stopped; the closing note on merge
replaces or absorbs it. `tokens/cost` carries best-effort actuals from the
harness/transcript, so future runbook authoring budgets against real numbers.

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-09-22 | TASK-0010 | [#2](https://github.com/evanstern/the-stacks/pull/2) | `a1b1c9c` | ~694k subagent tokens, 3 dispatches | phases 1-4 done (e30f1c0, 4e1c175, 5a05ed4). tier=sonnet, served=claude-sonnet-5 from all 3 transcripts. Gates by orchestrator: install/typecheck/lint/build/test green; 21/21 boxes. Board Done via spec-bridge. |
| 2026-09-22 | TASK-0013 | [#5](https://github.com/evanstern/the-stacks/pull/5) | merged | ~766k subagent tokens, 3 dispatches | phases 1-5 done (d43c239, d13e7cd, 57eb648, aa8164f). tier=sonnet, served=claude-sonnet-5 from all 3 transcripts. 25/25 boxes, 9 tests. Bounded probe verified: hang test returns in 1011ms against a 1000ms timeout. Carries the APP_PORT reconciliation. Board Done via spec-bridge. |
| 2026-09-22 | TASK-0011 | [#6](https://github.com/evanstern/the-stacks/pull/6) | `3693233` | ~1.05M subagent tokens, 4 dispatches (one refused, see A2) | phases 1-6 done (942db84, 4592cbe, 39676d3, 632c56a, 380f3f6) + orchestrator fixes (55530bd, 49c8c6e). tier=sonnet, served=claude-sonnet-5 from all transcripts. 26/26 boxes, 10 tests. **T016 caught a crash in merged TASK-0013 code** — see the finding note below. Board Done via spec-bridge. |

| 2026-09-22 | TASK-0012 | [#8](https://github.com/evanstern/the-stacks/pull/8) | `cc830c4` | ~1.11M subagent tokens, 4 dispatches | phases 1-7 done. tier=sonnet, served=claude-sonnet-5 from all 4 transcripts. 36/36 boxes, 22 tests. **Race-safety measured by the orchestrator, not asserted**: lock-free append lost 21-23 of 50 concurrent writes per run; with `pg_advisory_xact_lock`, 50/50 stored gapless, 3 runs. Amendment A3 (db port) came out of this lane. Board Done via spec-bridge. |
| 2026-09-22 | TASK-0014 | [#9](https://github.com/evanstern/the-stacks/pull/9) | `ce16c74` | ~728k subagent tokens, 2 dispatches | phases 1-7 done. tier=sonnet, served=claude-sonnet-5 from both transcripts. 46/46 boxes, 40 tests. **Zero new dependencies** — stdlib `scrypt` over native argon2/bcrypt (constitution IX); N=2^15 throws synchronously without an explicit `maxmem`, measured. Orchestrator found and fixed: `db:migrate` broken from the host, and `create-operator` prompting before its existence check (hung non-interactive runs). Board Done via spec-bridge. |
| 2026-09-23 | TASK-0015 | [#10](https://github.com/evanstern/the-stacks/pull/10) | `0f9d07e` | ~753k subagent tokens, 2 dispatches | phases 1-7 done. tier=sonnet, served=claude-sonnet-5 from both transcripts. 40/40 boxes, 67 tests. **The implementer reported its own boundary test was only ~1-in-7 effective and diagnosed why** (a synchronous, un-interleavable window); the orchestrator turned that diagnosis into a deterministic guard — 5/5 failures against a broken ordering. Gateway verified live with real sockets. Board Done via spec-bridge. |

## Finding — the most useful implementer report of this sweep was an admission (2026-09-23)

**What happened.** TASK-0015's Phase 4-7 implementer was asked to prove its replay-boundary
test had teeth (revert the fix, watch the test fail). It ran the experiment and reported,
unprompted, that **its first test design never failed — 0 failures in 10 attempts** — then
strengthened the test and reported that even the improved version caught the defect only
about **1 run in 7**.

**Why that is worth recording.** The dispatch prompt had explicitly said: *if the test passes
against the broken version, say so — that is a finding, not a failure.* It did, and the
finding was more valuable than a clean pass would have been. It also diagnosed the cause:
the vulnerable window is a **synchronous, no-`await` gap**, so nothing in a single-threaded
Node process can interleave inside it and concurrent write pressure essentially never lands
a commit there. Raising concurrency did not help, which fits a fixed tiny window rather than
one proportional to load.

**What it unlocked.** That diagnosis is exactly what made a deterministic test possible: a
window unreachable by racing is trivially reachable by controlling the clock. The
orchestrator added `apps/server/test/ws.subscribe.test.ts`, which calls `subscribe()`
directly against a fake log and appends *during* the replay's own await — 2/2 pass against
the correct implementation, **2/2 fail across five runs** against replay-then-subscribe.

**The lesson, stated for the next runbook author:** keep writing dispatch prompts that name
the honest-negative outcome as an acceptable answer. An implementer that believes "the test
failed to catch it" is a reportable result will tell you; one that believes only a clean
proof is acceptable will produce a clean-looking proof.

## Finding — T016 caught a production crash in already-merged code (2026-09-22)

**The defect.** `apps/server/src/db.ts`'s `createDatabaseProbe` built a `pg.Pool` with no
`'error'` listener. `pg.Pool` is an EventEmitter; when Postgres terminates an idle
connection (`57P01`, which is what `docker compose stop db` produces) it emits `'error'`
on the pool. With no listener, Node's default is to throw — uncaught, and the process
exits 1 in under a second. A self-hoster restarting their database would have found the
app permanently down, needing a manual `up -d`.

**It was live on `main`** through TASK-0013's merge and several commits after.

**Why every earlier gate passed it.** The unit tests inject fake probes
(`{ reachable: async () => false }`) that never construct a real pool — correct design for
testing the *route*, but it means no test touched the connection path. `tsc` cannot see
runtime EventEmitter semantics. The `/health` endpoint and the container healthcheck were
both already correct; the process simply did not survive to answer. **Only booting the real
stack and stopping the real database could find it.**

**What this says about validation tasks.** T016 was written as a spec task with a stated
reason — "the one a passing-looking implementation silently fails". That framing is why it
was run as a real check instead of being waved through, and why the implementer stopped
rather than continuing to tick boxes around an unresolved failure. **Keep writing
validation tasks that name what they would catch.** A task that says "verify the stack
works" gets rubber-stamped; one that says "this is the check a broken implementation
passes" does not.

**Fixed** in `39676d3` (handler + comment warning against removing an apparent no-op) with
a regression test that builds a real `pg.Pool` against a raw TCP server speaking enough
Postgres wire protocol to authenticate, answer `SELECT 1`, and then emit a genuine `57P01`.
The orchestrator verified the test fails without the fix.

## Execution note — merge permission (2026-09-22)

**RESOLVED 2026-09-22** — the operator added `"permissions": {"allow": ["Bash(gh pr merge:*)"]}`
to `.claude/settings.json`. Merges have run unattended since. Kept for the record.

The sweep was blocked at its first merge. The auto-mode classifier refuses
`gh pr merge` on a PR this session authored (no human review), and separately
refuses to let this session edit `.claude/settings.json` to grant itself that
permission — correctly: an agent granting itself merge rights is the same
pattern regardless of who asked for it.

**Remedy, operator-applied:** add to `.claude/settings.json`

```json
"permissions": { "allow": ["Bash(gh pr merge:*)"] }
```

Until then: PR #1 (this runbook) and PR #2 (TASK-0010) stay open, and Lane 2
cannot start — both its tasks build inside the workspace PR #2 delivers.

A resuming session that finds the permission in place should merge #1 then #2,
verify each with `gh api repos/evanstern/the-stacks/pulls/<n> --jq .merged`,
ff-pull root, then proceed to Lane 2 per the lane plan above.
