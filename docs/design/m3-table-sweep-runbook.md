# M3 The Table, multiplayer (milestone m-3) — sweep runbook (2026-10-26)

- **Status:** signed-off (operator, 2026-10-26, in chat): "Signed off: tracks and waves as written, escape lines E1-E4, standing opus sign-off C1 for spec authoring, TASK-0135 design and research analysis. Start wave 1."
- **Milestone:** m-3, "The Table (multiplayer)" (`docs/design/milestones.md`, M3 section).
  Target 2026-12-15. Demo-gated, not date-gated.
- **Orchestrator:** this session plans, dispatches and gates. It never implements.
  Implementation goes to `sonnet-implementer`; spec authoring to `opus-implementer`.
- **Predecessor:** `docs/design/m2-first-scene-sweep-runbook.md` (M2, closed 2026-10-27,
  PR #55). Its doctrine carries over unless this file says otherwise.

## Read first (in this order)

1. This file, top to bottom.
2. `docs/design/milestones.md`, M3 section.
3. `docs/wiki/INDEX.md`, then `docs/wiki/CAPSULES.md`. Load notes just-in-time.
4. Decisions decision-0014 (D6), decision-0015 (D7), decision-0016 (D8), decision-0017 (D9),
   decision-0020 (D12), decision-0022 (D14). Then each card's own references.
5. `docs/design/debug-view.md` before TASK-0116, TASK-0117 or TASK-0118.
6. `docs/design/m2-demo.md` before TASK-0053, TASK-0055 or TASK-0134.
7. `backlog task view TASK-<n> --plain` for the card in hand.

## State when this runbook was written (2026-10-26)

- `main` at `a4aab3c`. Root clean. Milestone m-2 archived. Last merged PR #55.
- Gates on `main`: wiki freshness `OK: 48 note(s) fresh`; spec-bridge `ok`; `pnpm env:prune
  --check` reports no orphans; `tiers.mjs --check` exit 0 (all three tiers `unchanged`).
- Next free spec number: **035** (`specs/034-narration-quality` is the highest on `origin/main`).
- In flight in other sessions: none. Linked sessions are all done or idle.
- Paused — untouched: none (no `paused` label on any m-3 card).
- m-3 holds 35 cards. TASK-0115 is Done (PR #53). The other 34 are To Do. Two were created
  in this session's Lane 0: TASK-0134 and TASK-0135.

## Lane 0 — rulings made before lanes (operator, 2026-10-26)

- [x] **R1 — TASK-0055: option A.** Operator's words: "1. A". Reject the Grit save, fight
      budgeting and the downed-target table by one decision record citing the M2 fight
      statistics. TASK-0122 is the single re-entry path for any combat-pacing rule (trigger
      note on TASK-0122). Recorded on TASK-0055.
- [x] **R2 — evidence defect carded.** The M2 report says "Reduced to zero: none", but the
      transcript shows `goblin-3 takes 7 (7→0 HP)`. Carded as TASK-0134 (m-3).
- [x] **R3 — debug view first.** Operator's words: "2. Agreed" (option A): the debug view
      runs first, in parallel with the multiplayer contract work.
- [x] **R4 — actor-state rule gate carded as TASK-0135 (HIGH).** The operator raised it with
      R1: "NPCs, PCs, anything with trackable stats should be tracked explicitly and the data
      should be passed around to the functions/gates which decide what happens. An HP=0
      should be seen by a gate and refuse illegal operations/narrations." Proposed hard rule,
      to be ruled on at checkpoint C3: "The LLM can add flavor or advance plot only in
      response to dice-rolls and those LLM-generated results must pass rule gates which take
      into account all trackable actors in the input." TASK-0135 is contract-shaped and
      frames the rules track, so it goes first in Track C.

## Execution lanes

**Develop in parallel, merge serially.** The sweep runs five tracks. Each track has at
most one task in implementation at a time. Tracks are split by file footprint, so tasks in
different tracks develop in parallel. Merges go one at a time across all tracks, smallest
first when two are green together.

Waves give the order across tracks. A wave ends when all its tasks are merged. The
orchestrator ends its session at each wave boundary and resumes from this file and the board.

### Track A — The Table (gate, WebSocket, play route)

| Order | Card | Deliverable | Tier (impl) | Notes |
|---|---|---|---|---|
| A1 | TASK-0051 | Presence: decision record, then frames and UI | sonnet | Checkpoint C2 after `spec.md`: the ws-protocol frame change is a one-way door. |
| A2 | TASK-0099 | Retire the uncatalogued send path | sonnet | Same `apps/server/src/ws/` footprint as A1. Merges after A1. |
| A3 | TASK-0049 | Group sign-off for party-scope actions | sonnet | Consumes A1's present-player set. |
| A4 | TASK-0100 | Suggest proposals offer no Approve control | sonnet | Frozen seam amendment (`specs/030-play-route/contracts/proposal-seam.md`). Shares the approvals panel with A3. |
| A5 | TASK-0050 | Turn-mode floor passing | sonnet | Gate commit authority again. Merges after A3. |
| A6 | TASK-0052 | Narrator chime-in rules for several humans | sonnet | DM talk trigger. Touches `apps/server/src/dm/`; reconcile with Track C before merge. |

### Track B — Debug view and table UX (debug API, web)

| Order | Card | Deliverable | Tier (impl) | Notes |
|---|---|---|---|---|
| B1 | TASK-0114 | Companion stall: a human reaction re-runs the companion | sonnet | HIGH. `dm/companion.ts`, `dm/worker.ts`. |
| B2 | TASK-0116 | Debug API and persisted model-call usage | sonnet | HIGH. Adds a migration. Develops beside B1. Merges after it. |
| B3 | TASK-0118 | Unseated operator with an AI DM seat views as a player | sonnet | Small. `apps/web/app/play/viewer.ts`. Develops beside B2. |
| B4 | TASK-0117 | `play/:sessionId/debug` page | sonnet | Depends on B2. Held as a draft PR until B2 merges. |
| B5 | TASK-0132 | Progress between Commit and narration | sonnet | Reads what B2 exposes. Merges after B4. |
| B6 | TASK-0133 | Dice lines render distinct from prose | haiku | Tail polish. Droppable. |
| B7 | TASK-0134 | Fight statistics count NPCs at 0 HP | haiku | Playtest harness only. Must merge before TASK-0053. |

### Track C — Rules and narration (DM nodes, engine, SRD)

TASK-0135 decides the contract. The rest of the track implements it. The decision record
from C1 may reassign rules between the cards below; that reassignment is a runbook
amendment (checkpoint C3).

| Order | Card | Deliverable | Tier (impl) | Notes |
|---|---|---|---|---|
| C1 | TASK-0135 | Design: actor-state rule gate over every model output | opus (design) | Escalation tier: checkpoint C3. Docs only. |
| C2 | TASK-0123 | SRD 5.2.1 Playing the Game text in `packages/srd` | sonnet | `packages/srd` only. Develops beside C1. |
| C3 | TASK-0110 | An encounter-ending action resolves as applied | sonnet | First actor-state fix after C1. |
| C4 | TASK-0112 | Downed hero: seat stops declaring; gate refuses | sonnet | The gate-refusal half is ruled by C1. |
| C5 | TASK-0104 | Modifiers and DCs derive from combatant stats | sonnet | Changes `StepSchema`. Heaviest card in the track. |
| C6 | TASK-0128 | Opposition as a derived DC; Help as advantage | sonnet | Depends on C5. |
| C7 | TASK-0105 | Spells resolve by SRD id through the engine | sonnet | Depends on C5. |
| C8 | TASK-0111 | Digits check quotes its match; fix the source | sonnet | Narration audit. Paid capture may be needed: checkpoint C6. |
| C9 | TASK-0113 | Narration player-agency residue | sonnet | Defines the NarrationFacts outcome-band slot. |
| C10 | TASK-0127 | Stakes before dice: outcome bands | sonnet | Depends on C9 and C5 (both touch interpret steps). |
| C11 | TASK-0130 | Doctrine pass against D14 | sonnet | Depends on C10 and C5. Measured on a captured run: checkpoint C6. |
| C12 | TASK-0109 | Chronicle keeps distinct combatants distinct | sonnet | `dm.chronicle` only. May run beside any C card after C1. |

### Track D — Research and decisions (docs only)

| Order | Card | Deliverable | Tier | Notes |
|---|---|---|---|---|
| D1 | TASK-0055 | Decision record rejecting the parked combat rules | sonnet | Ruled by R1. Escape line E1. |
| D2 | TASK-0119 | Research branch 2: NPCs, social, information | sonnet gather, opus analyze | Escape line E2. Its analysis decides TASK-0107. |
| D3 | TASK-0120 | Research branch 3: exploration, awareness, time | same | Depends on D2. |
| D4 | TASK-0121 | Research branch 4: the table contract | same | Depends on D3. Its findings may amend A6 (spotlight). |
| D5 | TASK-0122 | Research branch 5: running combat | same | Depends on D4 and on TASK-0053's fight statistics. Re-entry path from R1. |

Revisit cards:
- **TASK-0107** (Director reads NPC secrets) is in TASK-0119's scope. TASK-0119's decision
  record either adopts it (TASK-0107 becomes a Track C card) or drops it by decision record.
- **TASK-0108** (Director transcripts name user ids) keeps its trigger. Checkpoint C8 at the
  M3 demo: the trigger met makes it a Track C card; not met, the operator rules drop or move.

### Track E — Design round (operator in the loop)

| Order | Card | Deliverable | Notes |
|---|---|---|---|
| E1 | TASK-0129 | Design round: Ask the DM | Runs as a `pdlc:design-rounds` side session with the operator, not swept. Ends in a decision record amending decision-0016 and a spec. |
| E2 | TASK-0131 | Out-of-character channel | Implements E1's spec. Swept after E1's decision. Touches the play route: merges after the Track A card then in flight. |

### Waves

| Wave | Tasks in development | Exit |
|---|---|---|
| 1 | A1, B1, B2, B3, C1, C2, D1, D2; E1 proposed as a side session | B1, B2, B3, C2, D1 merged; A1 and C1 past their checkpoints |
| 2 | A1 → A2, B4, C3, C4, C12, D3 | A1, A2, B4, C1, C3, C4 merged |
| 3 | A3, A4, B5, B7, C5, D4 | A3, A4, B5, B7, C5 merged |
| 4 | A5, A6, B6, C6, C7, C8, C9, E2 | Track A, B and E merged; C6–C9 merged |
| 5 | C10, C11, then TASK-0053 | Demo recorded and signed |
| 6 | D5 (needs the demo's fight statistics), TASK-0108 ruling | Every m-3 card merged or dropped by decision record |

TASK-0053 (the three-human demo) runs in wave 5. It needs Track A, TASK-0114, TASK-0116,
TASK-0117 and TASK-0134 merged. It runs after C10 and C11, so the demo shows the final DM
rules. The demo's findings become cards per decision-0020.

## Amendment 1 — Track C after decision-0025 and decision-0026 (2026-10-26, operator-ruled)

Operator rulings in chat, 2026-10-26: decision-0025 cards "Add all, D17 order"; U6 "Fold into
TASK-0112"; demo gate "Demo after a subset"; TASK-0119 placement "K3 now, K1-K6 after demo".
This section supersedes the Track C table above and the waves' Track C entries.

**Track C, new order.** Strictly serial in the DM-node hotspots. TASK-0109 floats and merges
before TASK-0144. TASK-0107 floats.

| Order | Card | Deliverable | Demo subset |
|---|---|---|---|
| C1 | TASK-0135 | Design: decision-0025 (D17) | — (merges once TASK-0140's spec exists, AC #4) |
| C2 | TASK-0123 | SRD Playing the Game text | — |
| C3 | TASK-0140 | U1 actor snapshot | yes |
| C4 | TASK-0110 | Encounter-ending action resolves applied; resolve order (D17 §4) | yes |
| C5 | TASK-0112 | Downed hero: seat stops declaring; U6 able-actor gates | yes |
| C6 | TASK-0141 | U2 scene presence | yes |
| C7 | TASK-0142 | U8 seed NPC scene presence | yes |
| C8 | TASK-0104 | Modifiers and DCs from stats | — |
| C9 | TASK-0146 | U7 audit gets the snapshot | — |
| C10 | TASK-0143 | U3 output claim gate | yes |
| C11 | TASK-0144 | U4 companion say / chronicle claim gate | — |
| C12 | TASK-0128 | Opposition as derived DC; Help | — |
| C13 | TASK-0105 | Spells by SRD id | — |
| C14 | TASK-0145 | U5 Director legality | — |
| C15 | TASK-0111 | Digits check | — |
| C16 | TASK-0113 | Narration agency residue | — |
| C17 | TASK-0127 | Stakes before dice | — |
| C18 | TASK-0147 | U9 resolve batch gate | — |
| C19 | TASK-0130 | Doctrine pass against D14 and D17 | — |
| float | TASK-0109 | Chronicle combatant identity | — (before C11) |
| float | TASK-0107 | K3: DM-only seed view for DM-side nodes (decision-0026) | — |
| after C17 | K1, K2, K4, K5, K6 | decision-0026 cards, created at the demo boundary | — |

**Demo gate (supersedes wave 5).** TASK-0053 runs once these are merged: Track A, TASK-0114,
TASK-0116, TASK-0117, TASK-0134, and the Track C demo subset (C3, C4, C5, C6, C7, C10). The rest
of Track C merges after the demo, still in m-3. TASK-0130's captured run measures it.

## Model tiers (from `.claude/model-tiers.json`, checked 2026-10-26)

| Tier | Agent | Pinned model | Fallback | Used for |
|---|---|---|---|---|
| sonnet (default) | `sonnet-implementer` | `claude-sonnet-5-5` | — | All implementation; TASK-0055's decision record; research gathering. |
| haiku | `haiku-implementer` | `claude-haiku-5-5` | — | TASK-0133, TASK-0134 (single-surface, tests to a sibling standard). |
| opus (escalation) | `opus-implementer` | `claude-opus-5-5` | `claude-fable-5-1` | Spec authoring (all swept tasks); TASK-0135 design; research analysis (`analyze-vault`). Each use needs checkpoint C1's standing sign-off. |

- Verify the served model from the first dispatch's transcript before any sibling dispatch.
- Record one line per dispatch on the card:
  `Dispatch: tier=<tier> pinned=<model-id> served=<model-id>`. `served=` is a bare ID.
- After any edit to `.claude/model-tiers.json`, regenerate and restart the session before
  the next dispatch.

## Execution mode

- **Interactive-root mode.** Worktrees live at `.worktrees/task-<n>`. `main` is not protected.
- **Board track:** `backlog/`-only commits go direct to `main` from root. The backlog CLI
  auto-commits each edit. Push them promptly. If you stage `backlog/` by hand, do it in a
  separate Bash call from the commit.
- **Claim flips ride the claim commit on the task branch**, never root.
- **Everything outside `backlog/` lands by PR.** Post-merge `tasks.md` ticks and this file's
  log rows ride the next claimed task's branch. The final ones ride a wrap-up PR.
- **This runbook lands by its own PR** (branch `sweep-m3-runbook`).
- **Commit with `git -C <literal worktree path>`** in its own Bash call. The root-guard reads
  `$vars` and `cd` as root.

## Per-PR gates this project enforces (enumerated — implementers cannot miss these)

- **Merge-drift gate: ABSENT** (probed 2026-10-26: no `scripts/check-merge-drift.mjs`). Raw git
  governs. Run `git fetch origin && git pull --ff-only` at root before each task. Run
  `git ls-tree --name-only origin/main specs/` before claiming an NNN.
- **Root-guard hook:** root is read-only apart from `backlog/` commits. Rebase, force-push and
  squash merges are forbidden repo-wide. Every branch merges `origin/main` in. Every PR lands
  as a merge commit.
- **`pnpm ci:check`** green in the worktree, evidence in the PR body, CI green on the PR. A
  task adding a host-run script extends `check:host-scripts` in the same PR.
- **Boundary rules prove themselves:** a new plane rule in `biome.json` gets a violating
  fixture under `fixtures/boundary-violations/` in the same PR.
- **Database suites RUN, not skip:** every DB-touching task runs its tests on its own stack
  with `REQUIRE_DATABASE=1`. Sequence: `pnpm env:up` → migrate both databases by hand →
  restart the app → tests → `pnpm env:down` before `git worktree remove`. Fresh stacks come
  up unmigrated (TASK-0098).
- **After cleanup:** `pnpm env:prune --check` exits 0. A nonzero exit blocks the next task.
- **WebSocket gateway tests are known-flaky.** A failure only in a WS gateway test this task
  did not change gets a re-run, logged in the execution log. Do not fix it here.
- **Wiki freshness after every history move:**
  `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
  prints `OK`. Never `gates/freshness.mjs` (a module; exits 0 whatever the state).
- **Spec-bridge:**
  `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
  exits 0 before the PR opens and after every sync.
- **Tiers:** `node ~/.claude/plugins/cache/praxisflux/pdlc/0.68.0/scripts/tiers.mjs --root . --check`
  exits 0 at each wave start.
- **Frozen contracts:** a change to `docs/wiki/ws-protocol.md` frame shapes, to
  `specs/029-proposal-gate/contracts/`, or to `specs/030-play-route/contracts/proposal-seam.md`
  needs an operator ruling recorded on the card before implementation (TASK-0051, TASK-0100,
  and any card TASK-0135 points there).
- **Expected wiki reviews per task** (NEEDS-REVIEW candidates). New concepts get new notes.
  Regenerate `CAPSULES.md` when any `description:` changes. Update `INDEX.md`'s state paragraph.
  - TASK-0051: `ws-protocol`, `websocket-gateway`, `play-route`, `session-model`; new note `presence`.
  - TASK-0099: `websocket-gateway`, `ws-protocol`, `proposal-gate`.
  - TASK-0049, TASK-0050: `proposal-gate`, `play-route`, `session-model`.
  - TASK-0100: `play-route`, `proposal-gate`.
  - TASK-0052: `dm-runtime`, `dm-turn-jobs`.
  - TASK-0114: `dm-runtime`, `dm-turn-jobs`.
  - TASK-0116: `dm-turn-jobs`, `ai-gateway`, `database-schema`, `migrations`; new note `debug-view`.
  - TASK-0117, TASK-0118, TASK-0132, TASK-0133, TASK-0131: `play-route`; `debug-view` for 0117.
  - TASK-0104, TASK-0105, TASK-0110, TASK-0128: `dnd5e-engine`, `dm-failure-and-gates`, `dm-runtime`.
  - TASK-0112, TASK-0134: `playtest-harness`; `dm-failure-and-gates` if the gate refuses.
  - TASK-0111, TASK-0113, TASK-0127, TASK-0130: `dm-narration-quality`, `dm-runtime`.
  - TASK-0109: `dm-runtime`.
  - TASK-0123: `srd-data`.
  - TASK-0135: whichever notes its decision record names; no code.
  - TASK-0053: `m2-demo` as the model; new note `m3-demo`.

## Per-task artifacts required before PR

**No PR opens for a task until each line below checks true for it.**

- [ ] **The spec set was produced by the Spec Kit skills**, authored by an `opus-implementer`
      dispatch: `speckit-specify` → `spec.md`; `speckit-clarify` only on genuine ambiguity
      (note the skip); `speckit-plan` → `plan.md` with the Constitution Check against 2.0.0;
      `speckit-tasks` → `tasks.md`. A claim stub satisfies nothing.
- [ ] The card carries its Spec marker from the claim commit. Phase ACs are re-seeded from
      `tasks.md` before implementation dispatch.
- [ ] **Dispatch from a neutral cwd** (repository root). Every prompt opens with
      `cd <worktree> && pwd && git branch --show-current`, names the expected branch, and
      orders a STOP on mismatch.
- [ ] **Every dispatch prompt forbids the backlog MCP tools** (they edit root's card copy) and
      says: use the `backlog` CLI inside the worktree for any card change.
- [ ] **Every UI dispatch states: no modals — slide-out panels or autocomplete dropdowns only;
      browser automation uses Brave.**
- [ ] **One implementer per `tasks.md` phase**, re-grounded from the spec dir and branch
      commits. Every prompt carries the turn-hygiene block.
- [ ] `Dispatch: tier=… pinned=… served=…` is on the card for every dispatch, spec authoring
      included. `served=` is a real bare ID read from the transcript.
- [ ] **Any new runtime dependency is named in `plan.md`** with the reason an installed package
      does not cover it, and is cleared at checkpoint C5 first.
- [ ] **`tasks.md` ticks re-checked after every merge to `main`.**
- [ ] **No "for now" without a card** (decision-0020): any deferral names an ordered board task
      created at the same time, or a revisit task with a trigger.
- [ ] **Never handle keys or passwords.** The operator sets secrets. Implementers never read,
      print or commit a key.
- [ ] **Track C cards after TASK-0135 merges:** `spec.md` cites the TASK-0135 decision record
      and names which of its rules the card implements.
- [ ] **TASK-0051 only:** the decision record for the presence frames merges in the same PR as
      the implementation, after checkpoint C2.
- [ ] **TASK-0053 only:** the demo record lists every audit finding and its resolution, in
      `docs/design/m2-demo.md`'s shape.
- **Escape lines (operator-signed 2026-10-26 at C0):**
  - **E1 — TASK-0055:** a decision record (D15) stands in for `spec.md`/`plan.md`/`tasks.md`.
    The ruling is R1; the record cites `docs/design/m2-demo.md` Fight statistics.
  - **E2 — TASK-0119, TASK-0120, TASK-0121, TASK-0122:** the research-vault branch under
    `docs/research/`, its `analyze-vault` analysis note, and any decision record it produces
    stand in for the spec set, as TASK-0115 did (PR #53).
  - **E3 — TASK-0135:** the inventory (AC #1) and the decision record (AC #2, #3) stand in for
    the spec set. AC #4's spec lives in the first implementation card's own spec dir.
  - **E4 — TASK-0129:** the design-rounds artifacts and decision record stand in. Its spec is
    TASK-0131's spec set.

## Task-specific merge conditions

- **TASK-0051:** two browser sessions (Brave) on one table each see the other join and leave.
  Screenshots in the PR.
- **TASK-0049, TASK-0050:** a DB test with two human seats proves sign-off and floor passing
  through the gate on the task's own stack.
- **TASK-0114:** a test reproduces the M2 stall (a companion declares without committing; a
  human comments) and shows the companion re-runs.
- **TASK-0116:** each model call in a full fake-gateway turn persists its usage row.
- **TASK-0117:** screenshots (Brave) of the debug page during a live fake-gateway turn, light
  and dark.
- **TASK-0104, TASK-0105, TASK-0128:** a scripted-dice test shows the model's number ignored
  and the engine's used.
- **TASK-0053:** the M3 demo (milestones.md) has run twice, both runs audited, and its record
  is committed and signed.

## Concurrency & conflict doctrine

- **Hotspots:**
  - `apps/server/src/ws/` (`registry.ts`, the send classifier) — TASK-0051, TASK-0099.
  - The proposal gate (`apps/server/src/gate/`, policy table) — TASK-0049, TASK-0050,
    TASK-0100, TASK-0099.
  - `packages/session-model` (event catalog, projections) — TASK-0051, TASK-0049, TASK-0050.
  - `apps/server/src/dm/nodes/schemas.ts` (`StepSchema`) and interpret/adjudicate prompts —
    TASK-0104, TASK-0105, TASK-0127, TASK-0128, TASK-0135's implementation cards. Strictly
    serial in Track C.
  - `apps/server/src/dm/nodes/audit.ts`, `audit-words.ts`, `fallback.ts`, narrate prompts,
    NarrationFacts — TASK-0111, TASK-0113, TASK-0127, TASK-0130.
  - `apps/server/src/dm/worker.ts`, `companion.ts` — TASK-0114, TASK-0116, TASK-0052.
  - `apps/server/src/ai/` (usage sink) — TASK-0116.
  - `packages/dnd5e-engine` — TASK-0104, TASK-0105, TASK-0110, TASK-0112, TASK-0128, TASK-0127.
  - `apps/web/app/play/` and `apps/web/app/routes.ts` — TASK-0051, TASK-0049, TASK-0050,
    TASK-0100, TASK-0117, TASK-0118, TASK-0131, TASK-0132, TASK-0133.
  - `apps/server/drizzle/` incl. `meta/_journal.json` — TASK-0116 and any card whose plan adds
    a migration. **Never hand-merge the journal.** The later branch regenerates its migration
    after merging `origin/main` in.
  - `apps/server/src/playtest/` (harness, report folds) — TASK-0112, TASK-0134, TASK-0053.
  - `.claude/settings.json` — no task may change the root-guard entries.
- **Expect the operator to merge PRs as they turn green,** not in lane order. Budget one
  reconcile merge per PR that lands after a sibling.
- **Hold true dependents as draft PRs** until their dependency merges (TASK-0117 on TASK-0116;
  TASK-0128 and TASK-0105 on TASK-0104; TASK-0127 on TASK-0113).
- Every branch merges `origin/main` in and lands as a merge commit.
- **Honest re-pins only.** Classify every staled pin against
  `git diff <old-pin>..<merge-commit> -- <sources>` as RE-PIN-ONLY or NEEDS-REVIEW. Amend prose
  before bumping a NEEDS-REVIEW pin.
- After every history move: re-run `ci:check`, the DB suites, the freshness probe and the
  spec-bridge check, unconditionally.
- Conflicting with a sibling session's open PR: the smaller PR merges first.
- **Claim before work:** the FIRST commit of any task claims it — card → In Progress, the spec
  number's stub directory, and the Spec link — on the task branch cut from `origin/main`. Push
  immediately. Never force-push a claim.
- **A rejected push means you lost the race.** Fetch and re-read the board and `specs/`. If
  another session holds the task or number, STOP and tell the operator.
- Verify a PR merged (`gh api repos/evanstern/the-stacks/pulls/<n> --jq .merged`) before
  deleting its branch. Run `pnpm env:down` before `git worktree remove`. Then run
  `pnpm env:prune --check`.
- **Orchestrator context:** end the session at each wave boundary. Hand off at about 70% context
  by writing a "Handoff" section into this file. A half-done lane also gets a lane handoff from
  the sweep's `templates/lane-handoff.md`.

## Operator checkpoints (do not proceed silently)

- **C0 — lane sign-off (now):** the tracks and waves above, the tier table, and escape lines
  E1–E4.
- **C1 — standing opus sign-off for spec writing and design.** M2's standing sign-off covered
  spec authoring. This sweep asks it again for: spec authoring on every swept task, TASK-0135's
  design, and `analyze-vault` on research branches 2–5.
- **C2 — TASK-0051 frame change.** Stop after `spec.md`. Show the proposed presence frames and
  the decision record draft. Get a ruling before `plan.md`.
- **C3 — TASK-0135 rulings.** Stop after the inventory. Bring the operator the dice-only hard
  rule (R4) against decision-0022 point 3 ("a retry with no new risk succeeds without a roll")
  and against narration that no roll drives (scene framing, talk). Record the ruling in the
  operator's words. Any reassignment of rules across Track C cards amends this file.
- **C4 — TASK-0129 side session.** Proposed as a `pdlc:design-rounds` session in wave 1. The
  operator starts it.
- **C5 — new runtime dependencies.** Stop after `plan.md`. Name the package and why.
- **C6 — paid provider runs.** Get the operator's spending ceiling first, recorded on the card
  in the operator's words. Then state the provider, model list and an estimate before each run.
  Hidden reasoning counts against `maxTokens` on the `cc/` routes: size `maxTokens` for it.
  Expected paid runs: TASK-0111 capture (maybe), TASK-0130 captured run, TASK-0053 demo.
- **C7 — TASK-0053 demo.** Three humans play one scene twice: `auto` with the AI DM, then `ask`
  with a human DM. The operator recruits the humans and seats them. The orchestrator runs the
  harness, records both auditor reports, and records each audit finding and its resolution. A
  failed demo criterion becomes a card and blocks M3 close.
- **C8 — TASK-0108 trigger.** After the demo, rule: trigger met (a Track C card), drop by
  decision record, or move to a later milestone.
- **C9 — vm-104.** Any vm-104 command needs the operator's go on the exact command.
- Tier escalations; lane amendments; softening any gate above (amend this file, note why, tell
  the operator).
- **Closing milestone m-3 is the operator's call**, after this sweep.

## Done means

- Every m-3 card is Done on the board via its own merged PR, status derived by
  `spec-bridge:sync`, Spec marker still on each linked card — or explicitly dropped by a
  decision record (TASK-0107 and TASK-0108 may close this way).
- Each swept task's `specs/NNN-*/` holds `spec.md`, `plan.md` and `tasks.md`, or the task is
  named by a signed escape line.
- Every card carries its `Dispatch:` lines with real `served=` IDs.
- `pnpm ci:check` green on `main`; CI and the deploy job green on the last merge.
- Wiki freshness prints `OK` via `gates/cli.mjs`; spec-bridge check exits 0.
- `git worktree list` shows no sweep worktrees; `pnpm env:prune --check` exits 0.
- The M3 demo record is committed and signed by the operator, with both auditor reports attached
  and every finding resolved or carded.
- This file's log is complete and its status flipped to done. M3 close is put to the operator.

## Execution log

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-10-26 | (runbook) | — | — | — | Lane 0 rulings R1–R4 recorded (TASK-0055 option A; TASK-0134 and TASK-0135 carded; debug view first). Authored as draft. Awaiting lane sign-off (C0, C1, E1–E4). |
| 2026-10-26 | (runbook) | — | — | — | Operator signed off at C0: tracks and waves as written, E1–E4 signed, C1 standing opus sign-off (spec authoring, TASK-0135 design, research analysis). Wave 1 starts. |
| 2026-10-26 | (wave 1) | — | — | — | Claimed and pushed: TASK-0051 (spec 035), 0114 (036), 0116 (037), 0118 (038), 0123 (039), 0135, 0055, 0119 (escape lines). Served model verified from the first opus and sonnet transcripts before siblings. TASK-0129 design-round session proposed (C4), awaiting the operator. |
| 2026-10-26 | TASK-0055 | [#57](https://github.com/evanstern/the-stacks/pull/57) | — | ~81k (sonnet ×1) | decision-0023 (D15) rejects the parked rules (R1). Open for review. |
| 2026-10-26 | TASK-0118 | [#58](https://github.com/evanstern/the-stacks/pull/58) | `68e0513` | spec ~130k (opus), impl ~102k (sonnet ×1, P1+P2 grouped) | Spectator player view for an unseated operator. Done via sync on main (`801721b`). Local `ci:check` without a stack fails only on `adjudicate.integration` (pre-existing, carded TASK-0138). |
| 2026-10-26 | TASK-0051 | — | — | spec ~334k (opus ×2) | C2 ruled (operator): carriage D (frame + logged `presence.recorded` marker; Constitution IV), observers shown, timings stand, multi-process revisit TASK-0136. decision-0024 (D16) on the branch. phases: 1 dispatched. |
| 2026-10-26 | TASK-0135 | — | — | inventory ~220k (opus) | C3 ruled (operator): formulation 3 "ledger + opposition dice"; seed NPCs get minimal presence state in M3; position/range revisit TASK-0139. Decision record (reserved decision-0025) dispatched (opus). Track C reassignment follows it as an amendment. |
| 2026-10-26 | TASK-0114 | — | — | spec ~185k (opus) | Checkpoint W ruled (operator): W-A, add `action.withdraw` / `action.withdrawn` (amends the frozen 029 contract in Phase 3). phases: 1 dispatched. |
| 2026-10-26 | TASK-0116 | — | — | spec ~202k (opus), P1 ~113k (sonnet) | phases: 1 done (`d13f1e3`), 2 dispatched. |
| 2026-10-26 | TASK-0123 | — | — | spec ~156k (opus), P1 ~137k (sonnet) | OQ-3 ruled (operator): download the SRD PDF outside the repo. OQ-1 rest of the glossary → revisit TASK-0137. phases: 1 done (`9c0fc2c`), 2 dispatched. Deviation: plan/tasks hand-written to the Spec Kit templates. |
| 2026-10-26 | TASK-0119 | — | — | gather ~241k (sonnet) | Gather done (`bde79d2`); analysis dispatched (opus; decides TASK-0107; decision ids 0026+). |
| 2026-10-26 | (amendment) | — | — | — | New m-3 card TASK-0138 (adjudicate suite fails instead of skipping without a DB) joins Track B after B7, haiku tier. Revisit cards outside m-3 (no milestone, trigger-based): TASK-0136, TASK-0137, TASK-0139. Decision-id guard: ids are assigned per checkout, so a dispatch that creates a decision copies in the ids already taken on open branches first. |
| 2026-10-26 | TASK-0055 | [#57](https://github.com/evanstern/the-stacks/pull/57) | `ac336ac` | ~81k (sonnet ×1) | Merged. decision-0023 (D15) on main. TASK-0055 Done on main (`8eef04d`), escape line E1 (no spec set; not a linked card). Worktree and branch removed; `env:prune --check` clean. |
\n| 2026-10-26 | (amendment 1) | — | — | — | Track C re-ordered after decision-0025: TASK-0140 to TASK-0147 created on main; U6 folded into TASK-0112; demo after the subset. TASK-0119 rulings: K3 = TASK-0107 now; K1, K2, K4, K5, K6 after the demo; attitude per character; clue lint warns (fails only core); SRD Influence DC. |\n