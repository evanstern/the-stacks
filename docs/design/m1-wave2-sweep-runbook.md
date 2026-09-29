# M1 wave 2 (TASK-0021, 0024, 0026–0032) — sweep runbook (2026-09-29)

**You (the session reading this) are the ORCHESTRATOR** for the tasks below. Run each
through the host project's full PDLC — spec → link → worktree → delegated implementation →
PR → merge → re-ground — parallelizing within lanes, merging serially, treating merge
conflicts as routine. Direction is decided; do not re-litigate it:
`backlog/docs/doc-0001` (M1 rulings, decisions 0002–0005 and 0007), `backlog/docs/doc-0002`
(runtime environments, decision-0006), `docs/design/architecture.md` (A7, A9), and
`docs/design/milestones.md` (M1) win. Plan-of-record is the board; this file carries only
ordering, doctrine, and the log. This runbook is new; it does not adopt the wave-1 runbook,
but it carries forward that runbook's gates and its retrospective (cited per line below).

**Status:** draft · operator sign-off on lanes: pending

## Read first (in this order)

1. `backlog/docs/doc-0001*.md` and `backlog/docs/doc-0002*.md` — the ratified rulings.
   (Read the files directly: `backlog doc view` opens a pager in a non-interactive shell.)
2. `docs/design/milestones.md` (M1) and `docs/design/architecture.md` (A7, A9).
3. `.specify/memory/constitution.md` — principles I–IX; III, V, and VIII bind M1.
4. `docs/design/m1-wave1-sweep-runbook.md` — execution log and retrospective only.
5. `docs/wiki/CAPSULES.md` — then only the notes a task touches.
6. `backlog task list --plain` — live state; other sessions move it while you work.
7. The task you are about to execute (`backlog task view TASK-<n> --plain`).

## State when this runbook was written (2026-09-29)

- **Done already:** M0 (TASK-0010 → 0018); TASK-0019; M1 wave 1 — TASK-0020, 0022, 0023,
  0025 (PRs #21–#25, closed by #26). `main` at `d7fa039`.
- **Verified at authoring:** `pnpm env:prune --check` → no orphans; `tiers.mjs --check` → 0;
  wiki freshness (`gates/cli.mjs`) → `OK: 31 note(s) fresh`; `spec-bridge check` → ok,
  13 linked; `git worktree list` → root only; no open PRs.
- **vm-104 (TASK-0021 AC #7, ticked):** runner `vm-104` registered, user `stacks` (docker
  group), 41 GiB free, tailnet SSH works as `evan` and `stacks` at
  `vm-104.tailb3c1b6.ts.net`. Tailscale runs in the Docker container `tailscale` (host
  network, host unit masked on purpose), **not** systemd — doc-0002's "repair tailscaled"
  text is superseded by the card notes.
- **Real exports** at `/Volumes/evan/dnd-sourcebooks` (operator-local, never committed):
  `players-handbook-zip/` and `lost-mines-of-phandelver-zip/` are directories of
  per-chapter zips (upload form: the zip of zips); `dmg-zip.zip` (119 MB),
  `monster_manual.zip` (128 MB compressed, 307.6 MB / 3,219 entries uncompressed, with
  `__MACOSX/` entries and `_files/` asset dirs), `xanathars-guide-to-everything.zip`
  (43 MB). The parser is proven on PHB/DMG/MM/LMoP; **XGtE is unproven**.
- **In flight in other sessions:** none known.
- **Paused — untouched:** none.
- **Queued (this runbook's scope):** TASK-0032, 0026, 0021, 0024 (lane 1); 0027, 0029, 0030
  (lane 2); 0028 (lane 3); 0031 (lane 4).

## Execution lanes (dependency-ordered; parallelize within a lane)

A task starts as soon as every task in its **Starts after** list has merged. Lanes group
tasks for sign-off and session boundaries; they are not barriers beyond those dependencies.

**Lane 1 — start immediately, in parallel:**
- **TASK-0032 (sonnet · `cc/claude-sonnet-5[1m]` — the card names the fix and the helper
  to share)** — shared unique-violation helper; invitation redeem returns `conflict`.
  Smallest slice; merges first. Touches `library/store.ts`, which 0024 also touches.
- **TASK-0026 (sonnet · `cc/claude-sonnet-5[1m]` — A9 and the card settle modes and
  anchors; the plan names the fusion method, RRF by default)** — hybrid retrieval.
  **Contract-shaped:** its retrieval interface is consumed by 0027 and 0029, so publish the
  function signature and result type in the spec's contract before implementation. The
  `tsv` generated column, GIN index, and HNSW index already exist (migration 0002); a new
  migration is a plan-time finding, not an assumption.
- **TASK-0021 (sonnet · `cc/claude-sonnet-5[1m]` — doc-0002 settles runner, project name,
  ports, deploy steps, drift check, and exposure)** — hosted `dev` on vm-104 with CD.
  Touches `.github/workflows/`, a new ops runbook, and vm-104; no app-code overlap.
- **TASK-0024 (sonnet · `cc/claude-sonnet-5[1m]` — decision-0005 settles the jobs table
  and worker; the card's AC #6/#7 settle the upload forms and size posture)** — ingestion
  pipeline. **Biggest slice; nothing else in lane 1 fights for its files** except the
  `store.ts` helper (0032 merges first). Its job-status contract is consumed by 0028 and
  0030, and its restart behaviour is stress-tested by 0030 AC #3: the plan must state how a
  job claimed by a dead process is recovered.

**Lane 2 — each starts when its own dependencies merge:**
- **TASK-0027 (sonnet · `cc/claude-sonnet-5[1m]` — decision-0004 fixes SSE; A9 fixes the
  citation anchor)** — rules answerer. Starts after: 0026.
- **TASK-0029 (sonnet · `cc/claude-sonnet-5[1m]` — doc-0001's benchmark ruling and the card
  settle metrics and tiering)** — retrieval benchmark. Starts after: 0026 **and 0024** (the
  card lists only 0026, but AC #2's chunking-strategy axis needs 0024's chunker — a hard
  dependency this runbook adds).
- **TASK-0030 (sonnet · `cc/claude-sonnet-5[1m]` — doc-0001 and decision-0005 settle what
  is measured and why)** — load and stress benchmark. Starts after: 0024 and 0021.

**Lane 3:**
- **TASK-0028 (sonnet · `cc/claude-sonnet-5[1m]` — the ACs are functional, on the existing
  SPA shell; see the checkpoint on design rounds)** — chat UI. Starts after: 0027 and 0024.

**Lane 4 — last; gates M1 close:**
- **TASK-0031 (sonnet · `cc/claude-sonnet-5[1m]` for the stand-up/teardown script and the
  checklist; the walkthrough itself is run by the orchestrator with the operator)** — M1
  human acceptance. Starts after: 0028, 0029, 0030 (and every other scoped task merged).

**Spec authoring (all tasks) → `opus-implementer` · `cc/claude-opus-5-5[1m]`, fallback
`cc/claude-fable-5-1[1m]`.** Escalation tier, **operator-signed: ruling 2026-09-28 is
standing escalation sign-off for spec writing** (carried forward from the wave-1
retrospective and memory). Never a session fork. No implementation dispatch uses `opus`;
any such need is a new checkpoint.

Tiers and model IDs come from `.claude/model-tiers.json`; `tiers.mjs --root . --check`
exited **0** on 2026-09-29. `haiku` (`cc/claude-haiku-4-5-20251001`) may take a single
mechanical merge-reconcile step, as in wave 1; record it as its own dispatch line.

## Execution mode

- **Interactive-root mode** (as wave 1): worktrees at `.worktrees/task-<n>`; `main` is not
  protected.
- **Board track:** `backlog/`-only commits go direct to `main` from root (the root-guard
  allows them). Stage `backlog/` paths in a separate Bash call from the commit.
- **Everything outside `backlog/` lands by PR.** Post-merge `tasks.md` ticks and this
  file's log rows ride the next claimed task's branch; the final ones ride a wrap-up PR.
- **This runbook lands by its own PR** (`sweep-m1-wave2-runbook`), as wave 1's did (#20).

## Per-PR gates this project enforces (enumerated — implementers cannot miss these)

- **Merge-drift gate: ABSENT** (re-probed 2026-09-29). Raw git governs:
  `git fetch origin && git pull --ff-only` at root before each task; check
  `git ls-tree --name-only origin/main specs/` before claiming an NNN (next free: `014`).
- **Root-guard hook:** root is read-only apart from `backlog/` commits; rebases, force-push,
  and squash merges are forbidden repo-wide. Every branch merges `origin/main` in.
- **`pnpm ci:check`** (lint, typecheck, build, test, boundaries, hooks, scripts,
  **`check:host-scripts`**) green in the worktree; evidence in the PR body; CI green on the
  PR. A task adding a host-run script or a module a host script imports **extends
  `check:host-scripts`** in the same PR (wave-1 retrospective: #21 merged with CI red).
- **Database suites RUN, not skip:** every DB-touching task (0032, 0024, 0026, 0027, 0029,
  0030, 0028) runs its tests on its own stack with `REQUIRE_DATABASE=1`:
  `pnpm env:up` in the worktree → tests → `pnpm env:down` before `git worktree remove`.
- **After cleanup:** `pnpm env:prune --check` exits 0. A nonzero exit blocks the next task.
- **Wiki freshness after every history move:**
  `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`
  prints `OK`. **Never** `gates/freshness.mjs` (a module; exits 0 whatever the state).
- **Spec-bridge:**
  `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`
  exits 0 before the PR opens and after every sync.
- **Expected wiki reviews per task** (NEEDS-REVIEW candidates; new concepts get new notes;
  regenerate `CAPSULES.md` when any `description:` changes):
  - TASK-0032: `invitations`, `library-schema`.
  - TASK-0026: `library-schema`, `configuration`; new note for retrieval.
  - TASK-0021: `ci-pipeline`, `runtime-stacks`, `health-check`, `compose-stack`; new note
    for hosted `dev` and CD.
  - TASK-0024: `library-schema`, `ddb-parser`, `configuration`, `server-entrypoint-and-app`,
    `database-schema`, `migrations`, `overview`; new note for ingestion.
  - TASK-0027: `ai-gateway`, `server-entrypoint-and-app`; new note for the rules answerer.
  - TASK-0029, TASK-0030: `test-suite`, `ci-pipeline`; new note(s) for benchmarks.
  - TASK-0028: `spa-shell`, `overview`; new note for the chat UI.
  - TASK-0031: `m0-demo` (or a new M1-acceptance note beside it).

## Per-task artifacts required before PR

**No PR opens for a task until each line below checks true for it.**

- [ ] **The spec set was produced by the Spec Kit skills**, authored by an
      `opus-implementer` dispatch (standing sign-off 2026-09-28): `speckit-specify` →
      `spec.md`; `speckit-clarify` only on genuine ambiguity (note the skip);
      `speckit-plan` → `plan.md` with the nine-checkbox Constitution Check; `speckit-tasks`
      → `tasks.md`. A claim stub satisfies nothing.
- [ ] The card carries its Spec marker from the claim commit (`spec-bridge:link` against
      the stub); phase ACs are re-seeded from `tasks.md` before implementation dispatch.
- [ ] **Dispatch from a neutral cwd** (repository root); every prompt opens with
      `cd <worktree> && pwd && git branch --show-current`, names the expected branch, and
      orders a STOP on mismatch.
- [ ] **Every dispatch prompt forbids the backlog MCP tools** (they edit root's card copy)
      and says: use the `backlog` CLI inside the worktree for any card change.
- [ ] **One implementer per `tasks.md` phase**, re-grounded from the spec dir and branch
      commits; every prompt carries the turn-hygiene block.
- [ ] `Dispatch: tier=… pinned=… served=…` is on the card for every dispatch, spec
      authoring included; `served=` is a real bare ID read from the transcript. Verify the
      first dispatch's served model before launching siblings.
- [ ] **Any new runtime dependency is named in `plan.md` with the reason stdlib or an
      installed package does not cover it**, and is cleared at the checkpoint below first.
- [ ] **`tasks.md` ticks re-checked after every merge to `main`** (wave-1: T011–T016 ticks
      were lost in a reconcile merge).
- [ ] **TASK-0024 only:** the merge condition below is recorded in the PR body.
- [ ] **TASK-0029 only:** the committed corpus is SRD 5.1 text with its CC-BY-4.0
      attribution; nothing from `/Volumes/evan/dnd-sourcebooks` or `fixtures/private/` is
      committed (constitution VIII).
- [ ] **TASK-0021 only:** the deploy workflow runs on the self-hosted runner **only** for
      pushes to `main` after CI succeeds (never on `pull_request`); the PR states it.
- **Escape lines (operator-signed only):** none.

## Task-specific merge conditions

- **TASK-0024:** upload each real export in its delivered form to the task's own stack:
  PHB and LMoP as a zip of their per-chapter zips; DMG, MM, and XGtE as single zips; plus
  one single-HTML page and one Markdown file. Record per book: HTTP result, job status,
  chunk count, and the app's peak RSS during the MM upload (proves streaming, AC #7).
  Record the configured ceiling (≥ 1 GB default) and where it is documented. XGtE is
  unproven for the parser: a failure there is recorded and carded, not a merge blocker,
  unless it crashes the worker.
- **TASK-0021:** one real deploy from a `main` push reaches `dev`, `/health` reports that
  commit, and a deliberately failed deploy (bad health) leaves the prior version serving.
  Record both run URLs.
- **TASK-0030:** the "against dev only" cases run once against `dev` and record results;
  cases that cannot run elsewhere skip with a visible reason (AC #4).

## Concurrency & conflict doctrine

- **Hotspots:**
  - `apps/server/src/library/store.ts` — 0032 (helper extraction), 0024 (writes chunks).
  - `apps/server/drizzle/` incl. `meta/_journal.json` — 0024 (jobs table); 0026, 0029, 0030
    only if their plan adds a migration. **Never hand-merge the journal:** the later branch
    regenerates its migration after merging `origin/main` in.
  - `apps/server/src/config.ts`, `.env.example` — 0024 (upload ceiling), 0026 (retrieval
    mode), 0027 (answerer purpose), 0021 (deploy env).
  - `apps/server/src/app.ts`, `index.ts` — 0024 (upload route, worker start), 0027
    (`/library/ask`).
  - Root `package.json` scripts and `ci:check` — 0029, 0030, 0031; `pnpm-lock.yaml` for any
    new dependency.
  - `.github/workflows/` — 0021 (deploy, drift), 0029 (per-commit recall case, if CI).
  - `docker-compose.yml` — 0021, 0031.
  - `.claude/settings.json` — no task may change the root-guard entries.
- **Expect the operator to merge PRs as they turn green,** not in lane order. Budget one
  reconcile merge (`origin/main` into the branch) per PR that lands after a sibling.
- **Hold true dependents as draft PRs** until their dependency merges (e.g. a 0029 branch
  opened before 0024 lands).
- Reconcile by what the branch carries; every branch merges `origin/main` in (root-guard
  forbids rebase) and lands as a merge commit.
- **Honest re-pins only — a merge-in never justifies a pin bump.** Classify every staled
  pin against `git diff <old-pin>..<merge-commit> -- <sources>` as RE-PIN-ONLY or
  NEEDS-REVIEW; amend prose before bumping a NEEDS-REVIEW pin.
- After every history move: re-run `ci:check`, the DB suites, the freshness probe, and the
  spec-bridge check — unconditionally.
- Conflicting with a sibling session's open PR → the smaller PR merges first.
- **Claim before work:** the FIRST commit of any task claims it — card → In Progress, the
  spec number's stub directory, and the Spec link — on the task branch cut from
  `origin/main`. Push immediately; never force-push a claim.
- **A rejected push means you lost the race:** fetch, re-read the board and `specs/`. If
  another session holds the task or number, STOP and surface it to the operator.
- Verify a PR merged (`gh api repos/evanstern/the-stacks/pulls/<n> --jq .merged`) before
  deleting its branch; `pnpm env:down` before `git worktree remove`; then
  `pnpm env:prune --check`.
- End the orchestrator session at each lane boundary; resume from this file and the board.
  A lane left half-done gets a lane handoff from the sweep's `templates/lane-handoff.md`.

## Operator checkpoints (do not proceed silently)

- **New runtime dependencies.** Likely: a zip reader for TASK-0024 (Node has no stdlib zip
  reader; `yauzl`-class or none if a shell `unzip` in the image is preferred). Stop after
  `plan.md`, name the package and why, get a yes before dispatch.
- **TASK-0024 upload transport.** Streaming a 310 MB body to disk rules out Hono's
  buffering `parseBody`. The plan picks raw-body upload or a streaming multipart parser;
  the latter is a dependency and falls under the line above.
- **TASK-0021, changes on vm-104 outside `/home/stacks`:** the `tailscale serve` config
  inside the shared `tailscale` container, and any secret placed on the runner. Name the
  exact command; get a yes before running it. The first real deploy to `dev` is announced
  before it runs.
- **Paid provider runs:** TASK-0029's full matrix and any real-provider run cost money.
  Stop before the first one with the provider, model list, and an estimate. The operator
  supplies `AI_PROVIDERS` / keys; implementers never see or commit a key.
- **TASK-0028 design rounds?** This runbook treats 0028 as functional work on the
  existing SPA shell (its ACs are behavioural). If the operator wants visual options
  first, 0028 leaves this sweep for `pdlc:design-rounds`; decide at sign-off.
- **TASK-0031 walkthrough.** The operator drives it; the orchestrator prompts one M1
  criterion at a time and records the verdict. A failed criterion becomes a card and
  blocks M1 close. Closing milestone `m-1` is the operator's call, after this sweep.
- Tier escalations; lane amendments; softening any gate above (amend this file, note why,
  tell the operator).

## Done means

- TASK-0021, 0024, 0026, 0027, 0028, 0029, 0030, 0031, 0032 each **Done on the board via
  its own merged PR**, status derived by `spec-bridge:sync`, Spec marker still on each card.
- Each task's `specs/NNN-*/` holds `spec.md`, `plan.md`, and `tasks.md`.
- Every card carries its `Dispatch:` lines with real `served=` IDs.
- `pnpm ci:check` green on `main`; CI and the deploy job green on the last merge; `dev`'s
  `/health` commit equals `main` HEAD.
- Wiki freshness prints `OK` via `gates/cli.mjs`; spec-bridge check exits 0.
- `git worktree list` shows no sweep worktrees; `pnpm env:prune --check` exits 0.
- TASK-0031's committed checklist shows every M1 criterion passed (or carded).
- This file's log is complete and its status flipped to done.

## Execution log

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-09-29 | (runbook) | — | — | — | Authored as draft. Adds 0024 as a hard dependency of 0029 (chunking axis). Awaiting lane sign-off. |
