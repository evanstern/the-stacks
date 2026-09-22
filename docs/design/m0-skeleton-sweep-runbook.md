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

## Execution log

Multi-phase dispatch stays visible in `notes` — one slot, never a second table: while a
task is in flight its row carries the phases dispatched/completed (e.g.
`phases: 1-2 done, 3 dispatched`), updated at each dispatch boundary, so a resuming
session can see where within the task the last one stopped; the closing note on merge
replaces or absorbs it. `tokens/cost` carries best-effort actuals from the
harness/transcript, so future runbook authoring budgets against real numbers.

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-09-22 | TASK-0010 | [#2](https://github.com/evanstern/the-stacks/pull/2) | pending | ~694k subagent tokens, 3 dispatches | phases: 1-4 all done (e30f1c0, 4e1c175, 5a05ed4). tier=sonnet, served=claude-sonnet-5 verified from all 3 transcripts. Gates run by orchestrator: install/typecheck/lint/build/test green; 21/21 tasks.md boxes. **Blocked on merge permission** — see note below. |

## Execution note — merge permission (2026-09-22)

The sweep is blocked at its first merge. The auto-mode classifier refuses
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
