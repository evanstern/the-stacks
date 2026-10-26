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

**Lane 5 amendment (2026-10-26, operator ruling during the demo checkpoint):**
- **TASK-0102 (sonnet · `claude-sonnet-5-5`; spec by `opus-implementer`)** — the director's
  real-model output fails its schema (2 of 2 paid playtests stalled at turn 3–4) and failed jobs
  drop their schema issues. Own card, own PR, merged **before** TASK-0048's demo phase resumes.
  Starts after: — (TASK-0046 merged). Its paid capture run is an operator checkpoint (ceiling).
- TASK-0048's own harness defects found in the same runs (dice-lines false positive on
  scene-start narration; host CLI cannot use `host.docker.internal` provider URLs) are fixed on
  the TASK-0048 branch.

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
| 2026-10-26 | TASK-0045 | [#48](https://github.com/evanstern/the-stacks/pull/48) | `e91ff40` | ~1.6M: spec ~294k (opus), impl ~0.93M (sonnet ×5), wiki ~0.1M (sonnet) | Spec 029. Operator rulings: WS error frame gains optional `code`; DM view only for the logged human DM seat; default policy table as specified; uncatalogued send path carded TASK-0099 (m-3). Orchestrator ruling: the DM-seat subscribe race (secrecy leak) fixed in-task, not deferred. AC #1 import-graph write-boundary test. Session stopped once mid-lane (operator resume); no work lost. Grouping P1 \| P2+P3 \| P4 \| P5 \| P6(+race fix). Closures direct on main. |
| 2026-10-26 | TASK-0047 | [#47](https://github.com/evanstern/the-stacks/pull/47) | `bd15a9d` | ~1.0M: spec ~229k (opus), impl ~0.75M (sonnet ×5), wiki ~0.1M (sonnet) | Spec 030. Defaults taken: fixture route ships operator-only; vitest web dev dep. Draft-held on TASK-0045 until #48 merged, then Phase 6 merged main in and wired live proposals through the gate. Brave live checks all passed (DM-only delivery, approve/reject, refusal code, reload rebuild, reconnect). Follow-up carded TASK-0100 (suggest proposals still show Approve). Grouping P1+P2 \| P3 \| P4 \| P5 \| P6. Closures direct on main. |
| 2026-10-26 | TASK-0046 | (PR pending) | — | ~2.2M: spec ~348k (opus), impl ~1.6M (sonnet ×7 incl. reclaim fix), wiki ~0.15M (sonnet) | Spec 031. Spec defaults taken (combat-starting beat re-declares; audit flags in job record + dm journal; rulings as dm journal entries; seed in apps/server/seeds; one companion hold per beat). Migration 0004 extends the jobs table; spec author found an existing bug (ingestion job queries had no kind filter) — fixed. Orchestrator verified NOTICE.md carries tabletop-dm LICENSE@fe2c29b verbatim. Merge condition met: full turn on the worktree stack (fake gateway, scripted dice; 1d20=14 vs DC 13; audit passed), `evidence/full-turn.json`. Reclaim suite found a double tracker advance (fixed in Phase 6) and a duplicate narration on crash (orchestrator ruled fix in-task, 13101f0). Grouping one phase per dispatch. |

## Handoff — 2026-10-26 (orchestrator session ended at the operator's request, context > 70%)

Resume from this section plus the board. Read the runbook's doctrine sections above first. You
are the ORCHESTRATOR: dispatch implementation to `sonnet-implementer` (spec authoring to
`opus-implementer`), verify `served=` from each transcript, record a `Dispatch:` line per
dispatch, never implement inline. Nothing is running at handoff time.

### Board state

| Card | Status | Branch / worktree | Last commit | Next step |
|---|---|---|---|---|
| TASK-0042–0047 | Done (PRs #43, #45, #46, #48, #47, #49) | removed | — | none |
| TASK-0102 (new M2 card, spec 033) | In Progress | `task-0102-director-robustness` · `.worktrees/task-0102` | `7e75a67` (Phase 1 code `1ab1136`) | **Phase 2: orchestrator-run paid capture** (see Next action) |
| TASK-0048 (spec 032) | In Progress | `task-0048-playtest` · `.worktrees/task-0048` | `639a94c` (harness fixes `31f61f7`) | Phases 1–5 done; Phase 6 = the demo, resumes after TASK-0102 merges. Wiki already re-grounded (`954eec8`); an `m2-demo` wiki note is written after the demo. No PR opened yet. |
| TASK-0101 (hosted dev AI) | To Do, AC #4 ticked | main (board only) | — | Open: AC #2 move `stacks-ollama` into `deploy/dev` compose pinned to digest `sha256:dea72d1e…`; AC #3 record decision (realm 9router on **vm-103** over LAN HTTP, not CLIProxyAPI on vm-104:8317); AC #5 docs. Not M2 scope. |
| TASK-0092/0093/0094 (SRD kinds), 0097 (narrow-screen nav), 0098 (stacks come up unmigrated), 0099 (retire uncatalogued WS send), 0100 (suggest proposals show Approve) | To Do | — | — | Follow-ups carded this sweep; not M2 lanes. |

Merge order: TASK-0102 PR first, then resume TASK-0048 Phase 6 (TASK-0048 merges `origin/main`
in after #0102 lands), then TASK-0048's PR.

### Running stacks and hand-applied state

- **`stacks-task-0048`** (worktree `.worktrees/task-0048`): app `:3048`, db `:15048`, test-db
  `:25048`. App container built at `666167a` (stale vs the branch — irrelevant to the in-process
  playtest CLI, but **rebuild (`pnpm env:down` + `pnpm env:up`) before the operator plays in
  Brave**, after TASK-0102 is merged into the branch). Both DBs migrated by hand (TASK-0098).
- **`stacks-main`** (`.worktrees/env-main`): `:3000`/`:5432` at `6a74d72`, operator's long-running
  stack; launch config `main-stack` attaches to it. Do not `env:down main` (wipes its DB volume).
- **TASK-0098 workaround** (every fresh stack): migrate both DBs by hand. App URL =
  `postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$DB_PORT/$POSTGRES_DB`; test URL =
  `.env` `TEST_DATABASE_URL`. Read values with `grep '^KEY=' .env | cut -d= -f2-`; **never
  `source` the `.env`** (its JSON values lose their quotes). Run DB tests and `ci:check` with
  `TEST_DATABASE_URL=<value> REQUIRE_DATABASE=1`.
- **Local AI config (root `.env`, operator-owned; worktrees inherit on `env:up`)**: provider
  `claude` = 9router `host.docker.internal:20128` (key `NINEROUTER_API_KEY`), `ollama` =
  `host.docker.internal:11434` (`bge-m3`). Purposes: director, adjudicate, playtest.audit →
  `cc/claude-opus-5`; interpret, narrate, companion → `cc/claude-sonnet-5`; dm.audit, chronicle →
  `cc/claude-haiku-4-5-20251001`. maxTokens raised on the operator's go: director 1500,
  adjudicate 1500, interpret 1200, companion 800, chronicle 1000, narrate 500, dm.audit 300,
  playtest.audit 700 (root `.env` **and** `.worktrees/task-0048/.env`). AI_PRICES: opus 5/25,
  sonnet 2/10, haiku 1/5, `ollama/bge-m3` 0/0.
- **Host CLI vs `host.docker.internal`**: fixed on the TASK-0048 branch (`31f61f7`: CLI rewrites to
  `localhost` when `/.dockerenv` is absent; `PLAYTEST_HOST_NETWORK=0|1` overrides). On a tree
  without that fix, pass a per-process override (`AI_PROVIDERS` with `localhost` base URLs) and
  `env -u AI_PURPOSES -u AI_PRICES` so the CLI reads them from `.env`.
- **vm-104 (hosted dev)** — every change needs the operator's go on the exact command text:
  `stacks-ollama` container (ollama 0.40.11, network `stacks-dev_default`, volume
  `stacks-ollama`, `bge-m3` pulled, ~1.4 GiB RAM); `/home/stacks/dev/.env` has an appended AI
  block (claude → `http://9router.local.infinity-node.win/v1`, the realm 9router on **vm-103**;
  ollama → `http://stacks-ollama:11434/v1`; same purposes/prices) plus the operator-set
  `NINEROUTER_API_KEY`; dev redeployed (rerun of run 40339203227) and verified from inside
  `stacks-dev-app-1`: 9router lists 4 `cc/` models, embeddings are 1024-dim, no
  unconfigured-purposes warning.

### Spend: approvals and actuals (all at list prices; `cc/` routes are subscription-backed)

| Approval (operator's words on the card) | Used by | Spent |
|---|---|---|
| "Approved" — $20 scripted playtest, $6 demo-session audit | runs 1–2 | $0.00 + $0.67 |
| "Approved: spend ceiling $22 for the paid scripted playtest rerun" | runs 3–4 | $0.00 + $0.44 |
| "Approved: spend ceiling $22 for the TASK-0102 capture run and $22 for its verification run" | **unspent** | — |
| $6 demo-session audit | **unspent** | — |

Total spent so far: **$1.11**. A run refuses to start (exit 3) when its upper-bound estimate
exceeds the ceiling; with the raised caps the upper bound is $20.82.

### Paid playtest runs (TASK-0048 worktree, `docs/design/m2-demo/`)

| Run | Dir | Outcome | Cause / notes |
|---|---|---|---|
| 1 | `provider-playtest-failed-1/` | failed, $0, 1 call | host CLI could not resolve `host.docker.internal` (fixed, D4) |
| 2 | `provider-playtest-failed-2/` | failed at turn 4, $0.67, 32 calls | `stopped at director: invalid-output`; 1st attempt hit maxTokens 600 exactly (truncated JSON). Social beat played: Persuasion 1d20-1 → 19 = 18 vs DC 12 success |
| 3 | — | refused, $0 | upper bound $20.82 > $20 ceiling |
| 4 | `provider-playtest/` | failed at turn 3, $0.44, 20 calls | `stopped at director: invalid-output` again, **not** truncation: attempts 962 and 280 output tokens (cap 1500), both schema-invalid; issues were not persisted (now fixed by TASK-0102 Phase 1) |

Auditor findings to resolve in the demo record: D3 dice-lines false positive on scene-start
narration (fixed `31f61f7`); real continuity slip (run 2 #16 "no print" vs #10/#11 tracks);
"creak again" false positive (run 2); doctrine warns in run 4 (hero-is-theirs #10, fail-forward
#13–17, end-on-demand #17, one-sense #17); DM-runtime audit regenerated #16 (run 2) and shipped
the factual fallback (run 4 #17). Both director failures came on the first turn needing a real
director decision (tracker change / reed-camp encounter) — spec 033 research R3.

### Standing operator rulings from this session (not elsewhere in the runbook)

- TASK-0047 swept (not design-rounds); standing opus sign-off for spec writing holds.
- TASK-0043: Open5e srd-2024 source; other SRD kinds carded (0092–0094); downloads allowed.
- TASK-0045: DM view only for the logged human DM seat; WS error frame gains optional `code`;
  default policy table as specified; TASK-0099 for the legacy send path.
- Demo models as in the AI config above; if a 9router model errors on context, try the `[1m]`
  suffix first (e.g. `cc/claude-sonnet-5[1m]`) and add a matching AI_PRICES key.
- TASK-0102 is its own M2 card and PR, merged before the demo resumes (Lane 5 amendment above).
- WebSocket gateway tests are known-flaky (another session owns the fix): if CI or a local run
  fails only on a WS gateway test this work did not change, re-run it and log the re-run here;
  do not fix it.
- Preferred AI topology: local = Mac 9router + ollama `bge-m3`; hosted = realm 9router (vm-103) +
  `stacks-ollama` on vm-104 (TASK-0101).
- vm-104 commands: one exact command per go; the operator's go must quote/reference it.
- Never handle keys/passwords: the operator sets secrets; read keys only server-side, never print.

### Exact next action

Run **TASK-0102 Phase 2 — the paid capture** exactly as `specs/033-director-robustness/tasks.md`
Phase 2 and `quickstart.md` describe (composite worktree: `origin/task-0048-playtest` detached,
merge `origin/task-0102-director-robustness` in, never push; `pnpm playtest run --mode provider
--spend-ceiling-usd 22`; read `jobs.result.failure` by SQL; commit the fixture
`apps/server/test/dm/fixtures/director-capture-<runId>.json` and the evidence dir on the
TASK-0102 branch). Ceiling already approved ($22). Record the run and its spend on the card. If
the run shows no director failure, stop and ask the operator (FR-011). Then: orchestrator writes
`evidence/classification.md` → dispatch Phase 3 (sonnet) → Phase 4 paid verification ($22,
approved) → Phase 5 gate → wiki re-ground → PR → merge → resume TASK-0048 Phase 6 per
`docs/design/m2-demo.md` (rebuild the TASK-0048 stack first; the operator plays Tamsin in Brave;
audit with the $6 ceiling; fill the record).
