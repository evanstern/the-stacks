# M2 First Scene (TASK-0042 – TASK-0048) — sweep runbook (2026-10-25)

**You (the session reading this) are the ORCHESTRATOR** for the tasks below. Run each
through the host project's full PDLC — spec → link → worktree → delegated implementation →
PR → merge → re-ground — parallelizing within lanes, merging serially, treating merge
conflicts as routine. Direction is decided; do not re-litigate it: decision-0009 to
decision-0021, `backlog/docs/doc-0004` (the 2026-10-25 re-centre session record),
`docs/design/architecture.md` (A10–A14), `docs/design/milestones.md` (M2) and constitution
2.0.0 win. Dropping a card needs a decision record (decision-0020). Plan-of-record is the
board; this file carries only ordering, doctrine, and the log. This runbook is new; it
carries forward the M1 wave-2 runbook's gates and retrospective (cited per line below).

**Status:** executing · operator sign-off on lanes: 2026-10-25 ("Signed off: lanes as
written, TASK-0047 swept, standing opus sign-off for spec writing holds.")

## Read first (in this order)

1. `docs/design/milestones.md` (M2) and `docs/design/architecture.md` (A10–A14).
2. `backlog/decisions/decision-0015` to `decision-0021` and `backlog/docs/doc-0004*.md`.
   Read the files directly: `backlog doc view` opens a pager in a non-interactive shell.
3. `.specify/memory/constitution.md` (2.0.0) — IV, VI and VIII bind M2 most.
4. `docs/design/m1-wave2-sweep-runbook.md` — execution log only (cost and flake history).
5. `docs/wiki/CAPSULES.md` — then only the notes a task touches.
6. `backlog task list --plain` — live state; other sessions move it while you work.
7. The task you are about to execute (`backlog task view TASK-<n> --plain`).

## State when this runbook was written (2026-10-25)

- **Done already:** M0; M1 (closed); TASK-0041, the design re-centre (PR #41). `main` at
  `4fee63a`.
- **Verified at authoring:** root on `main`, clean, level with `origin/main`;
  `tiers.mjs --root . --check` → 0, all three definitions unchanged;
  `pnpm env:prune --check` → no orphans; wiki freshness (`gates/cli.mjs`, 0.68.0) →
  `OK: 37 note(s) fresh`; spec-bridge check → ok, 25 linked; `git worktree list` → root
  only; no open PRs; no In Progress cards; next free spec number `026`.
- **`.spec-bridge.json` absent:** the bridge does not enforce `requireDispatchRecord`.
  This runbook requires the `Dispatch:` line anyway (per-task artifacts below).
- **In flight in other sessions:** none known.
- **Paused — untouched:** none.
- **Queued (this runbook's scope):** TASK-0042, 0043 (lane 1); 0044 (lane 2); 0045, 0047
  (lane 3); 0046 (lane 4); 0048 (lane 5).

## Execution lanes (dependency-ordered; parallelize within a lane)

A task starts as soon as every task in its **Starts after** list has merged. Lanes group
tasks for sign-off and session boundaries; they are not barriers beyond those dependencies.

**Lane 1 — start immediately, in parallel:**
- **TASK-0042 (sonnet · `claude-sonnet-5-5` — A10 and the card fix the entry point,
  scope and refusal posture)** — pure 5e engine package. **Contract-shaped:** its command,
  event and refusal types are consumed by 0044, 0045 and 0046. The spec publishes them in
  `contracts/` before implementation. Starts after: — (TASK-0041 merged).
- **TASK-0043 (sonnet · `claude-sonnet-5-5` — decision-0012 and the card fix the
  baseline, record kinds and the size bound; the data source is a checkpoint below)** —
  SRD 5.2.1 data, loader, compact records, attribution surface. **Footprint rule:** the
  plan places the data and loader outside 0042's package directory, so the lane-1 PRs
  meet only in shared root files. Starts after: —.

**Lane 2:**
- **TASK-0044 (sonnet · `claude-sonnet-5-5` — decision-0016 and decision-0017 fix the
  vocabulary; the M0 log is unchanged)** — session event types and projections.
  **Contract-shaped:** its event schemas are the fixtures contract for 0047 and the input
  to 0045. Starts after: 0042.

**Lane 3 — in parallel:**
- **TASK-0045 (sonnet · `claude-sonnet-5-5` — decision-0015 and decision-0016 tabulate
  policies and commit authority)** — the proposal gate. Starts after: 0044.
- **TASK-0047 (sonnet · `claude-sonnet-5-5` — decision-0016 and the card fix the
  surfaces; `docs/design/chat-ui/` sets the visual language)** — the play route.
  Starts after: 0044. Builds on 0044's event fixtures. **Its PR stays draft until 0045
  merges**, then merges `origin/main` in and wires the live path. Routing it through
  `pdlc:design-rounds` instead is an operator checkpoint below.

**Lane 4:**
- **TASK-0046 (sonnet · `claude-sonnet-5-5` — A11, decision-0017 to decision-0019 and
  decision-0021 fix the nodes, their order and the doctrine source)** — the DM runtime.
  **Biggest slice; nothing else fights for its files** (0047 is web-only). Starts after:
  0045, 0043.

**Lane 5 — last; gates M2 close:**
- **TASK-0048 (sonnet · `claude-sonnet-5-5` for the harness and the auditor; the demo
  itself is run by the orchestrator with the operator)** — playtest harness, auditor agent,
  milestone demo. Starts after: 0046, 0047 (and every other scoped task merged).

**Spec authoring (all tasks) → `opus-implementer` · `claude-opus-5-5`, fallback
`claude-fable-5-1`.** Escalation tier. Carried forward from the M1 wave-2 runbook: operator
ruling 2026-09-28/29 is standing escalation sign-off for spec writing; the operator
confirmed it for this sweep at lane sign-off (2026-10-25). Never a session fork. No implementation dispatch uses
`opus`; any such need is a new checkpoint.

Tiers and model IDs come from `.claude/model-tiers.json`; `tiers.mjs --root . --check`
exited **0** on 2026-10-25. `haiku` (`claude-haiku-5-5`) may take a single mechanical
merge-reconcile step; record it as its own dispatch line.

## Execution mode

- **Interactive-root mode:** worktrees at `.worktrees/task-<n>`; `main` is not protected.
- **Board track:** `backlog/`-only commits go direct to `main` from root (the root-guard
  allows them). Stage `backlog/` paths in a separate Bash call from the commit.
- **Everything outside `backlog/` lands by PR.** Post-merge `tasks.md` ticks and this
  file's log rows ride the next claimed task's branch; the final ones ride a wrap-up PR.
- **This runbook lands by its own PR** (`sweep-m2-first-scene-runbook`), as M1 wave 2's
  did (#27).

## Per-PR gates this project enforces (enumerated — implementers cannot miss these)

- **Merge-drift gate: ABSENT** (probed 2026-10-25). Raw git governs:
  `git fetch origin && git pull --ff-only` at root before each task; check
  `git ls-tree --name-only origin/main specs/` before claiming an NNN (next free: `026`).
- **Root-guard hook:** root is read-only apart from `backlog/` commits; rebases,
  force-push, and squash merges are forbidden repo-wide. Every branch merges `origin/main`
  in and lands as a merge commit.
- **`pnpm ci:check`** green in the worktree; evidence in the PR body; CI green on the PR.
  A task adding a host-run script or a module a host script imports extends
  `check:host-scripts` in the same PR (wave-1 retrospective).
- **Boundary rules prove themselves:** a new package or plane rule in `biome.json` gets a
  violating fixture under `fixtures/boundary-violations/` in the same PR, so
  `pnpm check:boundaries` fails without the rule. TASK-0042 AC #10 is this gate for the
  engine (no database, network or LLM import).
- **Database suites RUN, not skip:** every DB-touching task (0044, 0045, 0046, 0048) runs
  its tests on its own stack with `REQUIRE_DATABASE=1`: `pnpm env:up` in the worktree →
  tests → `pnpm env:down` before `git worktree remove`.
- **After cleanup:** `pnpm env:prune --check` exits 0. A nonzero exit blocks the next task.
- **Wiki freshness after every history move:**
  `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
  prints `OK`. **Never** `gates/freshness.mjs` (a module; exits 0 whatever the state).
- **Spec-bridge:**
  `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
  exits 0 before the PR opens and after every sync.
- **Expected wiki reviews per task** (NEEDS-REVIEW candidates; new concepts get new notes;
  regenerate `CAPSULES.md` when any `description:` changes; update `INDEX.md`'s
  "state of the codebase" paragraph):
  - TASK-0042: `monorepo-and-toolchain`, `overview`; new note for the engine.
  - TASK-0043: `monorepo-and-toolchain`, `overview`, `react-router-app`; new note for SRD
    data.
  - TASK-0044: `event-log`, `ws-protocol`, `replay-live-boundary`, `overview`; new note for
    the session model.
  - TASK-0045: `event-log`, `server-entrypoint-and-app`, `websocket-gateway`,
    `error-contract`; new note for the gate.
  - TASK-0046: `ingestion` (jobs queue), `ai-gateway`, `configuration`, `rules-answerer`,
    `database-schema`, `migrations`; new note for the DM runtime.
  - TASK-0047: `chat-ui`, `react-router-app`, `client-session-hook`; new note for the play
    route.
  - TASK-0048: `test-suite`, `ci-pipeline`; new note for the M2 demo beside `m0-demo`.

## Per-task artifacts required before PR

**No PR opens for a task until each line below checks true for it.**

- [ ] **The spec set was produced by the Spec Kit skills**, authored by an
      `opus-implementer` dispatch: `speckit-specify` → `spec.md`; `speckit-clarify` only on
      genuine ambiguity (note the skip); `speckit-plan` → `plan.md` with the Constitution
      Check against 2.0.0; `speckit-tasks` → `tasks.md`. A claim stub satisfies nothing.
- [ ] The card carries its Spec marker from the claim commit (`spec-bridge:link` against
      the stub); phase ACs are re-seeded from `tasks.md` before implementation dispatch.
- [ ] **Dispatch from a neutral cwd** (repository root); every prompt opens with
      `cd <worktree> && pwd && git branch --show-current`, names the expected branch, and
      orders a STOP on mismatch.
- [ ] **Every dispatch prompt forbids the backlog MCP tools** (they edit root's card copy)
      and says: use the `backlog` CLI inside the worktree for any card change.
- [ ] **Every UI dispatch (0043's attribution surface, 0047) states: no modals —
      slide-out panels or autocomplete dropdowns only; browser automation uses Brave.**
- [ ] **One implementer per `tasks.md` phase**, re-grounded from the spec dir and branch
      commits; every prompt carries the turn-hygiene block.
- [ ] `Dispatch: tier=… pinned=… served=…` is on the card for every dispatch, spec
      authoring included; `served=` is a real bare ID read from the transcript. Verify the
      first dispatch's served model before launching siblings.
- [ ] **Any new runtime dependency is named in `plan.md` with the reason stdlib or an
      installed package does not cover it**, and is cleared at the checkpoint below first.
- [ ] **`tasks.md` ticks re-checked after every merge to `main`** (wave-1: ticks were lost
      in a reconcile merge).
- [ ] **No "for now" without a card** (decision-0020): any deferral in a spec or PR names
      an ordered board task created at the same time, or a revisit task with a trigger.
- [ ] **TASK-0042 only:** the package imports no database, network, LLM or clock module;
      every command and refusal code has a scripted-dice test.
- [ ] **TASK-0043 only:** `spec.md` names the data source and its license (AC #3); the
      attribution file carries the exact SRD 5.2.1 CC-BY-4.0 statement; nothing from
      `/Volumes/evan/dnd-sourcebooks` or `fixtures/private/` is committed (constitution
      VIII).
- [ ] **TASK-0046 only:** borrowed doctrine text carries the MIT notice naming tabletop-dm
      and its copyright holder (decision-0021), adapted from commit `fe2c29b`; the scene
      seed is original or SRD content only.
- [ ] **TASK-0048 only:** the harness's CI case uses the fake gateway adapter; the demo
      record lists every audit failure and its resolution.
- **Escape lines (operator-signed only):** none.

## Task-specific merge conditions

- **TASK-0045:** a test restarts the server and shows pending proposals intact (AC #9),
  run on the task's own stack.
- **TASK-0046:** one full turn runs end to end on the task's own stack against the fake
  gateway with scripted dice; record the turn's ledger and the audit result in the PR.
- **TASK-0047:** screenshots (Brave) of the route from fixtures and from a live log, in
  light and dark, attached to the PR.
- **TASK-0048:** the M2 demo (milestones.md) has run and its record is committed.

## Concurrency & conflict doctrine

- **Hotspots:**
  - Root `tsconfig.json` references, `pnpm-workspace.yaml`, `pnpm-lock.yaml` — 0042, 0043
    (new packages), any task adding a dependency.
  - `biome.json` and `fixtures/boundary-violations/` — 0042, 0043, 0045, 0046 (plane rules).
  - `apps/server/src/events/` — 0044 (event types, projections), 0045 (proposal events),
    0046 (turn events).
  - The jobs queue and worker (ingestion's claim/lease/fencing) — 0046 adds a turn job kind.
  - `apps/server/src/ai/` purposes and `apps/server/src/config.ts`, `.env.example` — 0046.
  - `apps/server/src/app.ts`, `index.ts`, `apps/server/src/ws/` — 0045, 0046.
  - `apps/server/drizzle/` incl. `meta/_journal.json` — any task whose plan adds a
    migration. **Never hand-merge the journal:** the later branch regenerates its migration
    after merging `origin/main` in.
  - `apps/web/app/routes.ts`, `apps/web/app/routes/play.tsx` — 0043 (about surface), 0047.
  - Root `package.json` scripts, `ci:check`, `.github/workflows/` — 0048.
  - `.claude/settings.json` — no task may change the root-guard entries.
- **Expect the operator to merge PRs as they turn green,** not in lane order. Budget one
  reconcile merge (`origin/main` into the branch) per PR that lands after a sibling.
- **Hold true dependents as draft PRs** until their dependency merges (0047 until 0045).
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

- **Lane sign-off (now):** the lanes above; the standing opus sign-off for spec writing;
  and TASK-0047 as a swept task (proposed) or a `pdlc:design-rounds` sister session (as
  TASK-0028 was in M1).
- **TASK-0043 data source.** Stop after `plan.md`. Name the source (own transcription of
  the SRD 5.2.1 PDF, or an existing dataset), its license, and how its 5.2.1 coverage was
  checked. Get a yes before dispatch.
- **New runtime dependencies.** Stop after `plan.md`, name the package and why, get a yes
  before dispatch. The engine is expected to need none.
- **Paid provider runs.** TASK-0046 and TASK-0048 test against the fake gateway. Stop
  before the first real-provider run with the provider, model list and an estimate. The
  operator supplies `AI_PROVIDERS` and keys; implementers never see or commit a key.
- **TASK-0048 demo.** The operator plays the human seat; the orchestrator runs the
  harness, records the auditor report, and records each audit failure and its resolution.
  A failed demo criterion becomes a card and blocks M2 close. Closing milestone `m-2` is
  the operator's call, after this sweep.
- **TASK-0055 (parked combat rules)** is decided from TASK-0048's evidence, after this
  sweep — not inside it.
- Tier escalations; lane amendments; softening any gate above (amend this file, note why,
  tell the operator).

## Done means

- TASK-0042 to TASK-0048 each **Done on the board via its own merged PR**, status derived
  by `spec-bridge:sync`, Spec marker still on each card.
- Each task's `specs/NNN-*/` holds `spec.md`, `plan.md`, and `tasks.md`.
- Every card carries its `Dispatch:` lines with real `served=` IDs.
- `pnpm ci:check` green on `main`; CI and the deploy job green on the last merge.
- Wiki freshness prints `OK` via `gates/cli.mjs`; spec-bridge check exits 0.
- `git worktree list` shows no sweep worktrees; `pnpm env:prune --check` exits 0.
- The M2 demo record is committed, with the auditor report attached and every audit
  failure resolved or carded.
- This file's log is complete and its status flipped to done.

## Execution log

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-10-25 | (runbook) | — | — | — | Authored as draft. Proposes 0047 starting after 0044 (fixtures) with a draft-hold on 0045. Awaiting lane sign-off. |
| 2026-10-25 | (runbook) | [#42](https://github.com/evanstern/the-stacks/pull/42) | — | — | Operator signed off in chat: lanes as written, TASK-0047 swept, standing opus sign-off for spec writing holds. Lane 1 starts. |
| 2026-10-25 | TASK-0042 | [#43](https://github.com/evanstern/the-stacks/pull/43) | `140948b` | ~0.9M: spec ~241k (opus ×1 + 2 amendments), impl ~663k (sonnet ×5), wiki ~108k (sonnet) | Orchestrator rulings from decision-0021 idea 1 (R8): the engine owns attack, save, resistance and crit arithmetic; adjudication supplies data inputs incl. `autoFail`. Grouping P1 \| P2 \| P3+P4 \| P5+P6 \| P7. 197 engine tests. A post-review commit (`2c9f99e`, die size ≤1000) landed after the wiki pin and staled `dnd5e-engine` on main; re-verified on the TASK-0043 branch. Closures (sync → Done) direct on main. |
| 2026-10-25 | TASK-0043 | [#45](https://github.com/evanstern/the-stacks/pull/45) | `f7384f5` | ~1.4M: spec ~225k (opus), impl ~0.9M (sonnet ×4; P2 data conversion ~363k was the costliest phase), wiki ~0.1M (sonnet) | Operator rulings: C1 Open5e srd-2024 (CC-BY-4.0, pinned e69ac13); C2 other kinds carded TASK-0092/0093/0094 (m-5); C3 downloads allowed. The converter also reads the SRD 5.2.1 PDF (dataset defects repaired and logged). 903 records, 0 PDF mismatches, 25/25 spot checks. Reconcile merge of #43: `tsconfig.json` references (both kept). Grouping P1 \| P2 \| P3+P4 \| P5. Out-of-scope follow-ups carded by operator ruling 2026-10-26: TASK-0097 (narrow-screen About/Settings), TASK-0098 (stacks come up unmigrated). Closures (sync → Done) direct on main. |
| 2026-10-25 | TASK-0044 | [#46](https://github.com/evanstern/the-stacks/pull/46) | `8a8bb81` | ~1.1M: spec ~257k (opus ×1 + amendment), impl ~578k (sonnet ×4), wiki ~0.1M (sonnet) | Spec 028. Orchestrator ruling: mechanics batch append is atomic in this task (decision-0020); failure-injection DB tests prove zero rows land. Live DM delivery recorded on TASK-0045. New pure package `packages/session-model` (5 fixtures = the contract for 0045/0047); Dockerfile now builds engine + session-model. Reconcile merge of #45/TASK-0095: `tsconfig.json`, `.specify/feature.json`. Test DB came up unmigrated (TASK-0098). Grouping P1+P2 \| P3 \| P4 \| P5+P6. Adversarial review (review-pr-46, operator-started) approved round 1, no findings. Closures direct on main. |
| 2026-10-26 | TASK-0045 | (PR pending) | — | ~1.6M: spec ~294k (opus), impl ~0.93M (sonnet ×5), wiki ~0.1M (sonnet) | Spec 029. Operator rulings: WS error frame gains optional `code`; DM view only for the logged human DM seat; default policy table as specified; uncatalogued send path carded TASK-0099 (m-3). Orchestrator ruling: the DM-seat subscribe race (secrecy leak) fixed in-task, not deferred. AC #1 import-graph write-boundary test. Session stopped once mid-lane (operator resume); no work lost. Grouping P1 \| P2+P3 \| P4 \| P5 \| P6(+race fix). |
| 2026-10-26 | TASK-0047 | [#47](https://github.com/evanstern/the-stacks/pull/47) (draft) | — | spec ~229k (opus), impl ~0.56M (sonnet ×4) so far | Spec 030. Defaults taken: fixture route ships operator-only; vitest web dev dep. Draft-held on TASK-0045. phases: 1–5 done; 6 (gated) next. |
