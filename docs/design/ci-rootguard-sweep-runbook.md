# CI + root-guard (TASK-0018 → TASK-0017) — sweep runbook (2026-09-27)

**You (the session reading this) are the ORCHESTRATOR** for the tasks below. Run each
through the host project's full PDLC — spec → link → worktree → delegated implementation →
PR → merge → re-ground — parallelizing within lanes, merging serially, treating merge
conflicts as routine. **You do not implement.** Every task's code is dispatched to
`<tier>-implementer`; your hands touch specs, the board, worktree/PR plumbing, and this
log. Direction is decided; do not re-litigate it: `docs/design/architecture.md` (A3 three
data planes), `docs/design/milestones.md` (M0), and `.specify/memory/constitution.md`
v1.0.0 (III: "a forbidden cross-plane import is a CI failure") win. Plan-of-record is the
board; this file carries only ordering, doctrine, and the log.

**Status:** signed-off · operator sign-off on lanes: 2026-09-27
<!-- Only the OPERATOR flips draft → signed-off (the author never pre-fills it). An
     executing session must refuse a runbook whose status it cannot verify. -->

## Read first (in this order)

1. `docs/design/m0-skeleton-sweep-runbook.md` — the previous sweep. Its root-guard rules,
   Amendment A1 (spec cycle = `speckit-*` skill invocations) and Amendment A2 (neutral
   dispatch cwd + location check) are carried into this runbook as gate lines below.
2. `.specify/memory/constitution.md` v1.0.0 — every `plan.md` runs its Constitution Check.
3. `.claude/hooks/root-guard-hook.mjs` header comment — write jurisdiction rules.
4. `docs/wiki/CAPSULES.md`, then just-in-time: `monorepo-and-toolchain`, `test-suite`,
   `compose-stack` (TASK-0017); nothing in the wiki pins the hook (TASK-0018).
5. `backlog task list --plain`, then `backlog task view TASK-<n> --plain`.

## State when this runbook was written (2026-09-27)

- **Done already:** TASK-0010 → TASK-0016 (M0 sweep, closed 2026-09-23). `main` at
  `f08ce6d`. Baseline on `main`, measured this session: lint clean (65 files), typecheck
  green, build 3/3, test 30 passed / 42 skipped (no database). Wiki freshness:
  26/26 notes fresh.
- **In flight in other sessions:** none observed. `git worktree list` showed only the
  root checkout.
- **Paused — untouched:** none. Neither scoped task carries a `paused` label.
- **Queued (this runbook's scope, execution order):** TASK-0018, TASK-0017.
- **Tier config changed this session:** the operator moved the `opus` tier to
  `cc/claude-opus-5-5[1m]` (fallback `cc/claude-fable-5-1[1m]`). Regenerated;
  `tiers.mjs --check` exit 0. That change rides this runbook's PR. Neither scoped task
  uses the opus tier, so the restart-after-regenerate rule does not block this sweep's
  dispatches (the sonnet definition is unchanged).

## Execution lanes (dependency-ordered; parallelize within a lane)

**Lane 1 — both tasks, developed in parallel, merged serially: TASK-0018 first.**

- **TASK-0018 (sonnet · model `cc/claude-sonnet-5[1m]`, no fallback declared —
  the fix is specified by the card: NUL-delimited git output, audit two named sites,
  regression test both directions)** — root-guard non-ASCII false positive. Spec 008.
  Footprint: `.claude/hooks/root-guard-hook.mjs` + a new stdlib `node:test` file beside it.
- **TASK-0017 (sonnet · model `cc/claude-sonnet-5[1m]`, no fallback declared — the
  judgment calls are settled in this runbook's checkpoint section before dispatch)** —
  CI pipeline. Spec 009. Footprint: `.github/workflows/`, root `package.json`,
  `apps/server/tsconfig.json` (bring `test/` under typecheck), and the boundary check.

**Why one lane, and why 0018 merges first.** The footprints are disjoint, so parallel
development is safe. But 0017's CI must run the hook's regression test
(`node --test .claude/hooks/`), and that test only exists once 0018 merges. Merging 0018
first lets 0017 merge main in and wire the test into CI in the same PR. 0018 is also the
smaller slice — the smaller PR merges first.

Tiers come from `.claude/model-tiers.json`; `tiers.mjs --root . --check` exited 0 before
these lanes were written. Record on each card at dispatch, one line per dispatch:
`Dispatch: tier=<tier> pinned=<model-id> served=<model-id>`, `served=` a bare ID from
the transcript.

## Per-PR gates this project enforces (enumerated — implementers cannot miss these)

- **Merge-drift gate: ABSENT** (re-probed 2026-09-27; no `scripts/` directory). Raw git
  governs: `git fetch origin && git pull --ff-only` at root before each task; check
  `git ls-tree --name-only origin/main specs/` before claiming an NNN.
- **Root-guard hook (live, blocks tool calls):** root is read-only; rebases forbidden
  repo-wide; force-push forbidden; squash merge forbidden; no branch creation or
  `--amend` at root; board-only commits allowed at root. Stage `backlog/` paths in a
  SEPARATE Bash call from the commit.
- **Local check set, evidence pasted in the PR body:** `pnpm lint`, `pnpm typecheck`,
  `pnpm build`, `pnpm test`. For TASK-0017 the PR also links its own green CI run —
  that run is the first real CI evidence in this repo.
- **Hook test (TASK-0018 onward):** `node --test .claude/hooks/` passes. Biome excludes
  `.claude/`, so lint does not cover the hook; this test is its gate.
- **Wiki freshness after every history move:**
  `node <grounding-wiki>/gates/cli.mjs freshness . docs/wiki` must print `OK`.
  TASK-0017 touches pinned sources (`package.json`, `apps/server/tsconfig.json`), so its
  PR owes a `/grounding-wiki:wiki-update` pass. Notes `monorepo-and-toolchain` and
  `test-suite` are the expected NEEDS-REVIEW set — `test-suite` states `test/` is not
  typechecked, which TASK-0017 makes false.

## Per-task artifacts required before PR

**No PR opens for a task until each line below checks true for it.**

- [ ] **The spec set was produced by the Spec Kit skills** (Amendment A1 of the M0
      runbook, carried forward): `speckit-specify` → `spec.md`; `speckit-clarify` only on
      genuine ambiguity (say so in a note when skipped); `speckit-plan` → `plan.md` with
      the nine-checkbox Constitution Check; `speckit-tasks` → `tasks.md`. A hand-written
      file of the same name does not satisfy this line. A claim stub satisfies nothing.
- [ ] The card carries its Spec marker from the claim commit (`spec-bridge:link` against
      the stub); phase ACs are re-seeded from tasks.md before implementation dispatch.
- [ ] **Dispatch from a neutral cwd** (the repository root), and every dispatch prompt
      opens with `cd <worktree> && pwd && git branch --show-current`, naming the branch
      it must see and ordering a STOP on mismatch (Amendment A2, carried forward).
- [ ] **One implementer per tasks.md phase**, re-grounded from the spec dir and branch
      commits; every prompt carries the turn-hygiene block (batch independent reads, minimal
      narration).
- [ ] `Dispatch: tier=… pinned=… served=…` is on the card, `served=` a real bare ID.
- [ ] **TASK-0018 only — real-commit evidence (card DoD #3):** before merge, feed the
      branch's hook a real `git commit` hook payload with `cwd` = the root checkout while a
      real non-ASCII `backlog/` path is staged there; record exit 0. Repeat with a staged
      non-ASCII non-`backlog/` path; record exit 2. Unstage afterward. Paste both in the PR.
- [ ] **TASK-0017 only — the CI run is green on its own PR**, and the documented local
      command reproduces it (card AC #5).
- [ ] **TASK-0017 only — the three operator rulings are honored:** CI provisions a
      `pgvector/pgvector:pg17` service and the integration suites RUN (0 skipped in CI);
      the boundary check adds no dependency and ships a failing fixture proving it fires;
      `apps/server/test/` is under `pnpm typecheck`.
- **Escape lines (operator-signed only):** none.

## Concurrency & conflict doctrine

- **Hotspots:** root `package.json` and `pnpm-lock.yaml` (TASK-0017 only, if it adds a
  script or dependency — take main's side, re-run `pnpm install`, never hand-edit the
  lockfile). `.claude/hooks/` is touched by TASK-0018 and *read* by TASK-0017's workflow.
- **Every branch merges `origin/main` in — never rebases** (root-guard forbids rebase).
  PRs land by plain merge (`gh pr merge --merge`), never squash.
- **Honest re-pins only.** After any merge-in, classify each stale pin against
  `git diff <old-pin>..<merge-commit> -- <sources>` as RE-PIN-ONLY or NEEDS-REVIEW.
  Never bump a pin without reading the diff it covers.
- After every history move, re-run the full local check set AND the freshness probe.
- **Claim before work:** the branch's first commit carries the card → In Progress, the
  `specs/NNN-<slug>/` stub, and the `spec-bridge:link`. Push immediately; never
  force-push. A rejected push means a lost race: fetch, re-read, STOP if taken.
- **Spec numbers:** 008 → TASK-0018, 009 → TASK-0017 (origin/main holds 001–007 at
  authoring). An intent, not a reservation: re-check before each claim.
- Verify merge (`gh api repos/evanstern/the-stacks/pulls/<n> --jq .merged`) before
  deleting any branch or worktree.
- **Execution mode:** default (root board commits allowed by root-guard). If a push to
  `main` is rejected, fall back to the background-job mode: closures ride the next
  branch; the last closures land via a wrap-up PR.

## Operator checkpoints (do not proceed silently)

- **Lane sign-off on this runbook.** Signed 2026-09-27 by the operator.
- **TASK-0017: CI database.** RULED 2026-09-27 (operator): proposal accepted — a `pgvector/pgvector:pg17` service container
  (the image `docker-compose.yml` already uses), migrations applied, `TEST_DATABASE_URL`
  set — so the 42 integration tests run instead of loud-skipping. The alternative (skip
  in CI) leaves every auth, event-log, and gateway test unproven by the gate.
- **TASK-0017: boundary-check mechanism.** RULED 2026-09-27 (operator): proposal accepted — no new dependency. Use Biome's
  `noRestrictedImports` via `overrides` if it expresses the rules, else a stdlib Node
  script. Rules today: `apps/web` must not import `apps/server`; `packages/shared`
  imports no app. Plane rules (Library / Codex / Session) are declared now but only
  Session code exists, so the plane check ships with a failing fixture proving it fires.
  Adding a dependency such as dependency-cruiser is a Complexity Tracking entry and
  needs your yes.
- **TASK-0017: `test/` typechecking.** RULED 2026-09-27 (operator): proposal accepted — bring `apps/server/test/` under
  `tsc` (the wiki records this as a known gap assigned to TASK-0017). Fixing any type
  errors this exposes is in scope.
- Any escalation to the `opus` tier; any lane amendment; softening any gate above.

## Done means

- TASK-0018 and TASK-0017 each **Done on the board via its own merged PR**, status
  derived by `spec-bridge:sync`, never hand-set.
- Both cards still carry their Spec marker and a real `Dispatch:` line.
- `specs/008-*/` and `specs/009-*/` each contain real `spec.md` + `plan.md` + `tasks.md`.
- CI green on `main` after the final merge, running lint, typecheck, test (with the
  database), build, the boundary check, and `node --test .claude/hooks/`.
- Wiki freshness prints `OK` on `main`; `test-suite` and `monorepo-and-toolchain` notes
  re-verified, not mechanically re-pinned.
- `git worktree list` shows no stale sweep worktrees.
- This file's execution log complete and its status flipped to `done`.

## Execution log

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
