# M1 wave 1 (TASK-0020, 0022, 0023, 0025) — sweep runbook (2026-09-28)

**You (the session reading this) are the ORCHESTRATOR** for the tasks below. Run each
through the host project's full PDLC — spec → link → worktree → delegated implementation →
PR → merge → re-ground — parallelizing within lanes, merging serially, treating merge
conflicts as routine. Direction is decided; do not re-litigate it:
`backlog/docs/doc-0001` (M1 decision rulings), `backlog/docs/doc-0002` (runtime
environment rulings), `docs/design/architecture.md` (A7, A9), and
`docs/design/milestones.md` (M1) win. Plan-of-record is the board; this file carries only
ordering, doctrine, and the log.

**Status:** signed-off · operator sign-off on lanes: 2026-09-28

## Read first (in this order)

1. `backlog doc view doc-0001` and `backlog doc view doc-0002` — the ratified rulings.
2. `docs/design/milestones.md` (M1) and `docs/design/architecture.md` (A3, A7, A9).
3. `.specify/memory/constitution.md` — principles I–IX; III, V, and VIII bind M1 directly.
4. `docs/wiki/CAPSULES.md` — then only the notes a task touches.
5. `backlog task list --plain` — live state; other sessions move it while you work.
6. The task you're about to execute (`backlog task view TASK-<n> --plain`).

## State when this runbook was written (2026-09-28)

- **Done already:** M0 (TASK-0010 → TASK-0018, milestone `m-0` archived); TASK-0019
  (milestone re-baseline, PR #19). vm-104 prerequisites for TASK-0021 verified (AC #7).
- **In flight in other sessions:** none known.
- **Paused — untouched:** none.
- **Queued (this runbook's scope):** TASK-0020, TASK-0023, TASK-0025, then TASK-0022.
- **Out of scope (later waves):** TASK-0021 (needs 0020), 0024, 0026–0031.

## Execution lanes (dependency-ordered; parallelize within a lane)

**Lane 1 — start immediately, in parallel:**
- **TASK-0020 (sonnet · model `cc/claude-sonnet-5[1m]`, no fallback — doc-0002 settles
  names, ports, verbs, and gates; work to a written spec)** — per-worktree compose stacks,
  `scripts/env.mjs`, orphan gates, `pnpm env:main`. **Unblocks isolated databases for every
  later lane,** so it merges first in this lane.
- **TASK-0023 (sonnet · `cc/claude-sonnet-5[1m]` — A7 and decision-0002 settle the
  interface; tests use a fake provider)** — AI gateway first slice. Needs no database.
- **TASK-0025 (sonnet · `cc/claude-sonnet-5[1m]` — decision-0003 settles fixtures; pure
  parsing)** — D&D Beyond parser with committed synthetic fixtures. Needs no database.

**Lane 2 — after TASK-0020 merges:**
- **TASK-0022 (sonnet · `cc/claude-sonnet-5[1m]` — decision-0002 fixes dim 1024 and the
  model/dim columns)** — library schema. It is the only wave-1 task that migrates a
  database, so it waits for 0020 and runs against its own `stacks-task-0022` stack instead
  of the shared default one.

No tail lane: every task here is a dependency of wave 2.

Tiers and model IDs come from `.claude/model-tiers.json`; `tiers.mjs --root . --check`
exited **0** on 2026-09-28. No task needs the `opus` escalation tier.

## Per-PR gates this project enforces (enumerated — implementers cannot miss these)

- **Merge-drift gate: ABSENT** (re-probed 2026-09-28; `scripts/` holds only
  `check-boundaries.mjs`). Raw git governs: `git fetch origin && git pull --ff-only` at root
  before each task; check `git ls-tree --name-only origin/main specs/` before claiming an NNN.
- **Root-guard hook (live, blocks tool calls):** root is read-only; rebases, force-push, and
  squash merges are forbidden repo-wide; board-only commits are allowed at root. Stage
  `backlog/` paths in a SEPARATE Bash call from the commit.
- **Local check set, evidence in the PR body:** `pnpm ci:check` (lint, typecheck, build,
  test, boundaries, hooks). CI must be green on the PR.
- **Integration tests must RUN, not skip:** a PR whose database suites skip has proven
  nothing. Before TASK-0020 merges, tasks use the default compose stack; after it merges,
  each task uses its own stack from `pnpm env:up`.
- **Wiki freshness after every history move:**
  `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`
  must print `OK`. **Do not call `gates/freshness.mjs` directly** — it is a module, prints
  nothing, and exits 0 whatever the corpus state (found 2026-09-28; it hid a stale
  `overview` pin after PR #19).
- **Expected wiki reviews per task** (NEEDS-REVIEW candidates; new concepts get new notes):
  - TASK-0020: `compose-stack`, `health-check`, `configuration`, `container-image`.
  - TASK-0022: `database-schema`, `migrations`, `overview` (library plane no longer empty).
  - TASK-0023: `configuration`; new note for the gateway.
  - TASK-0025: new note for the parser.
- **Stop hook note:** each Stop-hook gate that ships blocks a session end. TASK-0020's
  orphan warning must warn, not block.

## Per-task artifacts required before PR

**No PR opens for a task until each line below checks true for it.**

- [ ] **The spec set was produced by the Spec Kit skills** (M0 Amendment A1, carried
      forward): `speckit-specify` → `spec.md`; `speckit-clarify` only on genuine ambiguity
      (note the skip); `speckit-plan` → `plan.md` with the nine-checkbox Constitution Check;
      `speckit-tasks` → `tasks.md`. A hand-written file of the same name does not satisfy
      this line. A claim stub satisfies nothing.
- [ ] The card carries its Spec marker from the claim commit (`spec-bridge:link` against the
      stub); phase ACs are re-seeded from tasks.md before implementation dispatch.
- [ ] **Dispatch from a neutral cwd** (the repository root); every dispatch prompt opens with
      `cd <worktree> && pwd && git branch --show-current`, names the expected branch, and
      orders a STOP on mismatch (M0 Amendment A2, carried forward).
- [ ] **One implementer per tasks.md phase**, re-grounded from the spec dir and branch
      commits; every prompt carries the turn-hygiene block.
- [ ] `Dispatch: tier=… pinned=… served=…` is on the card, `served=` a real bare ID.
- [ ] **Any new runtime dependency is named in plan.md with the reason stdlib or an
      installed package does not cover it,** and is raised at the operator checkpoint below
      before implementation dispatch.
- [ ] **TASK-0025 only:** `fixtures/private/` is gitignored, and no committed fixture holds
      non-SRD proprietary text (constitution VIII).
- **Escape lines (operator-signed only):** none.

## Concurrency & conflict doctrine

- **Hotspots:** `pnpm-lock.yaml` and `apps/server/package.json` (0023, 0025 if either adds a
  dependency); `apps/server/src/config.ts` and `.env.example` (0020, 0023);
  root `package.json` scripts (0020); `docker-compose.yml`, `.claude/settings.json`
  (0020 only); `apps/server/drizzle/` (0022 only); `.gitignore` (0020, 0025).
- **Lane 1 merge order:** TASK-0020 first; then 0025 and 0023, smaller first. The second of
  those two merges `origin/main` in before its PR merges.
- Reconcile by what the branch carries: a **pin-carrying branch** (it carries wiki re-pins)
  **merges `origin/main` in** and lands as a merge commit; a pin-free branch may rebase in
  its worktree only where the root-guard allows it (it forbids rebases repo-wide, so in
  practice every branch merges `origin/main` in). Take main's side for anything you did not
  deliberately change.
- **Honest re-pins only — a merge-in never justifies a pin bump.** Classify every staled pin
  against `git diff <old-pin>..<merge-commit> -- <sources>` as RE-PIN-ONLY or NEEDS-REVIEW;
  amend prose before bumping a NEEDS-REVIEW pin.
- After every history move: re-run gates AND the freshness probe, unconditionally.
- Conflicting with a sibling session's open PR → the smaller PR merges first.
- **Claim before work:** the FIRST commit of any task claims it — board card → In Progress,
  the spec number's stub directory, and the Spec link — on the task branch cut from
  `origin/main`. Push immediately; never force-push a claim.
- **A rejected push means you lost the race:** fetch, re-read the board and `specs/`. If
  another session holds the task or number, STOP and surface it to the operator.
- Verify a PR is merged (`gh api … --jq .merged`) before deleting its branch or worktree.
  After TASK-0020 merges, run `pnpm env:down` for a task's stack before removing its worktree.

## Operator checkpoints (do not proceed silently)

- **New runtime dependencies** (likely: the Anthropic SDK in 0023, an HTML parser in 0025):
  stop after `plan.md`, name the package and why, get a yes before dispatch.
- **TASK-0020 AC #6** asks the sweep's precondition and cleanup steps to run
  `env prune --check`. The sweep procedure lives in the praxisflux plugin, not this repo.
  Proposal to confirm at plan time: land it as the Stop hook plus a gate line in this
  project's runbooks and `CLAUDE.md`, and file the plugin change upstream separately.
- **TASK-0020 edits `.claude/settings.json`**, which hosts the root-guard hook. The PR must
  state that the root-guard entries are unchanged.
- **TASK-0025 real-export suite:** the operator supplies a real D&D Beyond export under
  `fixtures/private/` to run it once before merge; the PR records the result or the skip.
- Tier escalations; lane amendments (amend this file, note why, tell the operator).

## Done means

- TASK-0020, 0022, 0023, 0025 each **Done on the board via its own merged PR**, status
  derived by `spec-bridge:sync`, Spec marker still on each card.
- Each task's `specs/NNN-*/` holds `spec.md`, `plan.md`, and `tasks.md`.
- `pnpm ci:check` green on `main`; CI green on the last merge.
- Wiki freshness prints `OK` via `gates/cli.mjs`.
- `git worktree list` shows no sweep worktrees; `pnpm env:status` shows no orphan stacks.
- This file's log is complete and its status flipped to done.

## Execution log

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-09-28 | (runbook) | — | — | — | Authored. Carries the `overview` wiki re-pin: PR #19 changed only milestone dates in `docs/design/milestones.md`; the note states no dates → RE-PIN-ONLY. |
