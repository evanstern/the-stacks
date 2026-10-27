# Tasks: Debug view card B — the `play/:sessionId/debug` page

**Input**: `specs/041-debug-page/` — spec.md, plan.md, research.md, data-model.md, quickstart.md.
Consumed contract: `specs/037-debug-api/contracts/debug-api.md` (TASK-0116, PR #62).

**Tests**: requested. The card's ACs need test proof, and the runbook's merge condition needs
Brave screenshots of a live fake-gateway turn, light and dark.

**Dispatch**: one `sonnet-implementer` dispatch per phase, re-grounded from this directory and the
branch's commits. Every dispatch prompt states: no modals (slide-out panels or autocomplete
dropdowns only); browser automation uses Brave; no backlog MCP tools (use the `backlog` CLI inside
the worktree). Do not touch `apps/server/`. Do not touch frozen contracts.

**TASK-0116 dependency**: Phases 1–5 build against the contract with an injected `fetch` and
need no server change. **Phase 6 starts only after TASK-0116 merges**: merge `origin/main` into
this branch first (a merge commit, never a rebase). The PR stays a draft until then.

**Format**: `- [ ] T### [P?] [US?] Description with file path`. `[P]` = different files, no open
dependency. Paths are relative to the repository root.

---

## Phase 1: Data layer — types, readers, client, snapshot, poller — DISPATCH (sonnet)

**Goal**: the page can fetch, hold and poll the debug API, all as pure tested modules.

**Independent test**: `pnpm --filter @the-stacks/web test` runs the Phase 1 suites green with a
fake `fetch`, fake timers and a fake visibility source.

### Tests first

- [x] T001 [P] Write `apps/web/test/debug/read-result.test.mjs`: a finished turn, a failed turn (failure + excerpts), a held turn, a running turn (checkpoint only), a queued job (`null`), a companion result, a chronicle result; a call without usage fields reads `usage: null`; a submission without `seqs` reads `seqs: undefined`; `narration` without `seqs` reads `undefined`; `null`, `42`, `{}` and `{ checkpoint: "x" }` never throw.
- [x] T002 [P] Write `apps/web/test/debug/client.test.mjs`: each method builds the contract URL (`/dm/sessions/<id>/events?after=&limit=`, `/jobs?limit=50[&before=]`, `/calls?after=&limit=`, `/seed`, `POST /turn`) with `credentials: "same-origin"`; 401 and 403 map to `{ kind: "auth" }`; 500 to `http`; a thrown fetch to `network`; seed 404 → `{ kind: "none" }`, 409 → `{ kind: "failed" }`.
- [x] T003 [P] Write `apps/web/test/debug/snapshot.test.mjs`: `mergeEvents` keeps ascending seq and drops duplicates, sets `lastEventAt` only when a new seq arrives; `mergeJobs` replaces by id; `mergeOlderJobs` adds without replacing newer copies; `mergeCalls` keeps ascending id and replaces `totals`; reducers never mutate input.
- [x] T004 [P] Write `apps/web/test/debug/activity.test.mjs`: active with a queued job, with a running job, with `lastEventAt` 29 s ago, with a retry 29 s ago; idle at 31 s with only terminal jobs; `nextDelayMs` returns 2000 and 10000.
- [x] T005 [P] Write `apps/web/test/debug/poller.test.mjs`: ticks never overlap (a 5 s tick delays the next); the delay follows `delayMs()` after each tick; `kick()` ticks at once and cancels the pending wait; hidden → no tick scheduled; visible → immediate tick; a tick that reports an auth error stops the poller.

### Implementation

- [x] T006 [P] Create `apps/web/app/debug/api-types.ts` (type-only mirrors per data-model.md "Wire mirrors").
- [x] T007 [P] Implement `apps/web/app/debug/read-result.ts` (`readTurnResult`, `readCompanionResult`, `readChronicleResult`, `readTrigger`) per data-model.md and research R5.
- [x] T008 [P] Implement `apps/web/app/debug/client.ts` (`createDebugClient(sessionId, fetchImpl)`; first-load helpers `loadAllEvents(after)` and `loadAllCalls(after)` that loop while `hasMore` at `limit=1000`) per research R3.
- [x] T009 [P] Implement `apps/web/app/debug/snapshot.ts` (`emptySnapshot`, `mergeEvents`, `mergeJobs`, `mergeOlderJobs`, `mergeCalls`, `setSeed`, `setNotice`).
- [x] T010 Implement `apps/web/app/debug/activity.ts` (`isActive`, `nextDelayMs`) and `apps/web/app/debug/poller.ts` (`createPoller`) per research R2. No React import in either.

**Checkpoint**: web tests green. Commit `TASK-0117: Phase 1 — debug data layer`.

---

## Phase 2: Derivations — waiting summary, job view, links, filters, scrub — DISPATCH (sonnet)

**Goal**: every value the page shows is a pure tested function of the snapshot.

**Independent test**: the Phase 2 suites pass over hand-built snapshots plus a
`@the-stacks/session-model/fixtures` event log.

### Tests first

- [x] T011 [P] Write `apps/web/test/debug/waiting.test.mjs`: active jobs with heartbeat age from `now`; declared and discussed actions listed, committed ones not; free and turn mode with the active actor's label; pending proposals with policy; a held turn paired with the companion job whose `input.beatJobId` names it; `latestFailure` set when a failed turn finished after the newest narration and unset when a narration came later; `stuck` true at 15 s with a committed action newer than the newest narration and no turn or companion job active, false at 14 s, false with a running turn; `showRetry` = failure or stuck.
- [x] T012 [P] Write `apps/web/test/debug/job-view.test.mjs`: one case per badge (queued, running, failed, shipped, fallback, held, empty; companion and chronicle shipped); duration running vs finished; totals from ledger rows by `jobId`, unpriced counted apart, aborted rows included; seven turn sections in node order with `ran` false for nodes not run; calls grouped by purpose to section; `wroteSeqs` unions submissions, narration, plays and chronicle seqs; `linkUnknown` for a non-refused `seqs: []`, a shipped narration without `seqs`, and `attempts > 1`; a refused submission with `[]` is not unknown. `apps/web/test/debug/seq-index.test.mjs`: seq → job; a seq in no job → `null`; a seq claimed twice → the newer job.
- [x] T013 [P] Write `apps/web/test/debug/event-filter.test.mjs`: empty filter passes all; AND across types/actors/visibilities, OR within one; `distinctValues` sorted and unique; `windowRows(rows, 500)` returns the last 500.
- [x] T014 [P] Write `apps/web/test/debug/scrub.test.mjs`: for every fixture and several seqs, `through(events, seq)` deep-equals `project(events.filter(e => e.seq <= seq), { role: "dm" })` (excluding `pendingBatches`, as view-model tests do); `live` after appends equals a full `project`; a 2,000-event synthetic log pins at any seq in under 100 ms.
- [x] T015 [P] Write `apps/web/test/debug/labels.test.mjs`: node names; `ageText` (`4 s`, `2 m 05 s`); `costText(null)` → `unpriced`, `costText(0.0123)` → `$0.0123`.

### Implementation

- [x] T016 [P] Implement `apps/web/app/debug/waiting.ts` (`toWaitingSummary`) per research R9; actor names via `apps/web/app/play/labels.ts` `actorLabel` with an empty viewer actor.
- [x] T017 [P] Implement `apps/web/app/debug/job-view.ts` (`toJobView`) and `apps/web/app/debug/seq-index.ts` (`buildSeqIndex`) per research R8 and plan decision 4.
- [x] T018 [P] Implement `apps/web/app/debug/event-filter.ts` and `apps/web/app/debug/labels.ts`.
- [x] T019 [P] Implement `apps/web/app/debug/scrub.ts` (`createFolder`) per research R7, over `applyEvent` and `emptyProjections` from `@the-stacks/session-model`.

**Checkpoint**: web tests green. Commit `TASK-0117: Phase 2 — debug derivations`.

---

## Phase 3: Route, hook, strip, retry and the Debug link (US6, US1; AC #1, #2, #3, #9) — DISPATCH (sonnet)

**Goal**: an operator opens the page from `/play`, sees the live strip, and can retry. Anyone else
gets `OperatorOnly`.

**Independent test**: markup tests render the route for a player (OperatorOnly, no fetch) and
the strip for each waiting state; the table header shows the Debug link only with `debugHref`.

### Tests first

- [x] T020 [P] [US6] Write `apps/web/test/debug/route-gate.test.tsx`: the route component with a non-operator root user renders the OperatorOnly message and the injected `fetch` records zero calls; with an operator it renders the strip region.
- [x] T021 [P] [US6] Extend `apps/web/test/play/table-view.test.tsx`: with `debugHref="/play/<id>/debug"` the header has a link with that href, `target="_blank"` and `rel="noopener"`; without it, no Debug link.
- [x] T022 [P] [US1] Write `apps/web/test/debug/waiting-strip.test.tsx`: "nothing queued" when empty; a running job row with kind, stage, attempts and age; uncommitted actions, mode, proposals, holds and the latest failure render; the retry control renders only when `showRetry`; a disabled state while in flight; the returned job id and a refusal render inline.

### Implementation

- [x] T023 [US6] Add `route("play/:sessionId/debug", "routes/play-debug.tsx")` to `apps/web/app/routes.ts` after `play/:sessionId`; create `apps/web/app/routes/play-debug.tsx` (client-only; `clientLoader`, `HydrateFallback`; non-operator → `OperatorOnly` "The debug view is available to the operator only.") per research R1.
- [x] T024 [US6] Add optional `debugHref` to `TableView` in `apps/web/app/play/table-view.tsx` and render the Debug link in `apps/web/app/play/components/table-header.tsx`; pass `debugHref` from `apps/web/app/routes/play.tsx` when `user.role === "operator"`. Keep the edit minimal (hotspot).
- [x] T025 [US1] Implement `apps/web/app/debug/use-debug-session.ts`: builds the client, runs the first load (events and calls by cursor, newest jobs, seed), starts the poller with `visibilitychange`, refetches the seed when `scene.sceneId` changes, keeps a 1 s clock for ages, exposes `retry()` (POST, then `kick()`, records `lastRetryAt`), `loadOlderJobs()`, the snapshot, the live DM projection and the notice. Stops polling on an auth error.
- [x] T026 [US1] Implement `apps/web/app/debug/components/debug-view.tsx` (sticky strip over the three-column grid per plan decision 7, empty column placeholders) and `apps/web/app/debug/components/waiting-strip.tsx` with the retry control.

**Checkpoint**: web tests and `pnpm --filter @the-stacks/web typecheck` green. Commit `TASK-0117: Phase 3 — route, strip, retry, Debug link`.

---

## Phase 4: Job timeline, event log and cross-links (US2, US3; AC #4, #5, #6) — DISPATCH (sonnet)

**Goal**: the left and center columns, linked both ways.

**Independent test**: markup tests render a finished, a failed and a held turn card expanded, a
companion card, the log with filters, and the highlight states for a selected job and event.

### Tests first

- [x] T027 [P] [US2] Write `apps/web/test/debug/job-card.test.tsx`: collapsed card shows kind, trigger, status, duration, attempts, call count, tokens, cost and badge; expanded turn shows the seven sections in order with "not run" placeholders; resolve rows show refusal codes and seq links; audit attempts list blocking and advisory issues separately with word count and prose hash; the fallback flag; the failure section with excerpts; a call without usage reads "usage not recorded"; a companion card shows plays and submissions; "link unknown" shows when `linkUnknown`.
- [x] T028 [P] [US3] Write `apps/web/test/debug/event-log.test.tsx`: each row shows seq, time, actor name, type, visibility and a collapsed payload; the type combobox has `role="combobox"`, `aria-expanded`, `aria-controls` and a `role="listbox"` of matching options; chosen filters narrow the rows; rows in the selected job's `wroteSeqs` carry the highlight marker; "show 500 older" appears past 500 rows.
- [x] T029 [P] [US3] Write `apps/web/test/debug/cross-link.test.tsx`: rendering `DebugView` with a selected seq highlights the job that wrote it; a seq no job wrote highlights no card.

### Implementation

- [x] T030 [P] [US2] Implement `apps/web/app/debug/components/job-card.tsx` and `apps/web/app/debug/components/job-timeline.tsx` (oldest at top, follow-bottom unless scrolled up, "load older jobs", scroll the selected card into view).
- [x] T031 [P] [US3] Implement `apps/web/app/debug/components/type-filter.tsx` (ARIA combobox autocomplete dropdown per research R6; no portal, no overlay) and `apps/web/app/debug/components/event-log.tsx` (filters, rows, payload expander with `JSON.stringify(v, null, 2)`, window per research R4).
- [x] T032 [US3] Wire selection in `apps/web/app/debug/components/debug-view.tsx`: selecting a job highlights its rows; clicking a row selects it, pins the state column (Phase 5 renders the pin) and highlights its job via `buildSeqIndex`.

**Checkpoint**: web tests and typecheck green. Commit `TASK-0117: Phase 4 — timeline, log, cross-links`.

---

## Phase 5: State column, seq pin and panels (US4, US5; AC #7, #8) — DISPATCH (sonnet)

**Goal**: the right column, the scrub, and the four slide-out panels; structural gates prove no
modal and no storage.

**Independent test**: markup tests render the state column live and pinned, and each panel body;
the structural test and the existing no-dialog test pass.

### Tests first

- [ ] T033 [P] [US4] Write `apps/web/test/debug/state-column.test.tsx`: live shows party, combatants, trackers, mode, encounter, DM seat, policy overrides and pending proposals; pinned shows "pinned at seq N" and the state through N; "back to live" renders only while pinned.
- [ ] T034 [P] [US5] Write `apps/web/test/debug/panels.test.tsx`: Seed marks each `dmOnlyPaths` field "DM only", says "no scene" for `none` and the load failure for `failed`; Ledger renders `toLedgerItems` rows through the pinned seq; Journal marks `dm`-visibility entries; Cost shows totals, by purpose, by model and unpriced count.
- [ ] T035 [P] Write `apps/web/test/debug/surfaces.test.mjs`: no `localStorage`, `sessionStorage` or `fixed inset-0` under `apps/web/app/debug`; the only fetch paths under `apps/web/app/debug` are the four debug reads and `POST .../turn`; only `components/panel.tsx` imports `components/ui/sheet`.

### Implementation

- [ ] T036 [US4] Implement `apps/web/app/debug/components/state-column.tsx` over `createFolder` (live or `through(pinnedSeq)`), with the pin badge, "back to live" and the panel triggers in its header.
- [ ] T037 [P] [US5] Implement `apps/web/app/debug/components/seed-panel.tsx`, `ledger-panel.tsx` (reuse `apps/web/app/play/ledger-format.ts` and `apps/web/app/play/components/ledger-list.tsx`), `journal-panel.tsx` and `cost-panel.tsx`, each inside `apps/web/app/components/panel.tsx` `Panel`.
- [ ] T038 [US5] Mount the panels in `apps/web/app/debug/components/debug-view.tsx`; one panel open at a time; Escape closes.

**Checkpoint**: `pnpm ci:check` green; `apps/web/test/no-dialog.test.mjs` unchanged and green. Commit `TASK-0117: Phase 5 — state, pin, panels`.

---

## Phase 6: Live check in Brave (AC #10; runbook merge condition) — DISPATCH (sonnet)

**Precondition**: TASK-0116 is merged to `main`, and `origin/main` is merged into this branch.
Re-run `pnpm ci:check` after the merge. Reconcile any contract drift against
`specs/037-debug-api/contracts/debug-api.md` as merged, and note it in `live-check.md`.

**Goal**: screenshots of the page during a live fake-gateway turn, light and dark.

- [ ] T039 Bring up the worktree stack per quickstart.md steps 1–2 (`pnpm env:up`, migrate both databases by hand, restart the app with `dm.*` routed to a `fake` provider in the app process's environment only). Read and print no key.
- [ ] T040 Write `specs/041-debug-page/evidence/shoot-debug.mjs` modelled on `specs/030-play-route/evidence/shoot.mjs` (playwright-core from outside the repo, Brave by `executablePath`, untracked creds file): sign in operator and player, start a table and scene, commit an action, capture the debug page while the turn job runs and after it ends, plus one expanded turn card, one pinned state column and each panel, with `stacks-theme` set to `light` and `dark`, at 1280 px and 390 px. Capture the player at the debug URL (OperatorOnly).
- [ ] T041 Run it; save PNGs under `specs/041-debug-page/evidence/shots/`; write `specs/041-debug-page/evidence/live-check.md` (date, commit, stack, fake-provider config shape without values, the turn's outcome, the shot list, and the quickstart steps 4–9 results).

**Checkpoint**: commit `TASK-0117: Phase 6 — Brave live check`. The PR body embeds or links the shots.

---

## Phase 7: Wiki re-ground and full gate — DISPATCH (sonnet)

**Goal**: the wiki describes the page and every pin is honest.

Classify each staled pin against `git diff <old-pin>..HEAD -- <sources>` as RE-PIN-ONLY or
NEEDS-REVIEW. Amend prose before bumping a NEEDS-REVIEW pin.

- [ ] T042 [P] NEEDS-REVIEW `docs/wiki/play-route.md`: the Debug link in the header for operators (`debugHref`), the new route beside `play/:sessionId`; add `apps/web/app/routes/play-debug.tsx` to sources only if the note describes it, else link `[[debug-view]]`.
- [ ] T043 [P] NEEDS-REVIEW `docs/wiki/debug-view.md` (created by TASK-0116): add the page — the strip, the three columns, the poll cadence, the scrub, the panels, the retry rule, and the "link unknown" reading; add `apps/web/app/debug/*` and `apps/web/app/routes/play-debug.tsx` to sources; state what TASK-0132 can reuse (`waiting.ts`'s commit-without-narration fold, the stage labels).
- [ ] T044 Update `docs/wiki/INDEX.md` (state paragraph: the debug page exists) and regenerate `docs/wiki/CAPSULES.md` for every changed `description:`.
- [ ] T045 Run `pnpm ci:check`, `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` (prints `OK`) and `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` (exits 0). Record the output in `specs/041-debug-page/ci-evidence.txt`.

**Checkpoint**: commit `TASK-0117: Phase 7 — wiki re-ground`.

---

## Dependencies & Execution Order

- Phase 1 has no dependency.
- Phase 2 depends on Phase 1 (`api-types`, `read-result`, `snapshot`).
- Phase 3 depends on Phases 1–2.
- Phase 4 depends on Phase 3 (`debug-view.tsx`, the hook).
- Phase 5 depends on Phase 4 (selection wiring) and Phase 2 (`scrub`).
- Phase 6 depends on Phase 5 **and on TASK-0116 merged into this branch**.
- Phase 7 depends on Phase 6 (and on `docs/wiki/debug-view.md` existing on `main`).
- Within a phase, `[P]` tasks touch different files and may run in either order.

## Parallel examples

- Phase 1: T001–T005 together; then T006–T009 together; then T010.
- Phase 2: T011–T015 together; then T016–T019 together.
- Phase 4: T027–T029 together; T030 and T031 together; then T032.

## Implementation strategy

MVP is Phases 1–3: the operator reaches the page and the strip answers "why waiting?" with a
retry. Phase 4 adds the cross-linked columns, Phase 5 the state and panels. Phase 6 meets the
merge condition and needs TASK-0116 merged. The PR opens as a draft after Phase 5 and leaves
draft only after Phases 6 and 7.

## Notes

- Hotspots: `apps/web/app/play/` and `apps/web/app/routes.ts` are shared with TASK-0051,
  TASK-0049, TASK-0050, TASK-0100, TASK-0118, TASK-0131, TASK-0132, TASK-0133. Keep edits to the
  three lines and one prop named in T023–T024. Merge `origin/main` in before the PR.
- No server file, migration, env var or new runtime dependency.
