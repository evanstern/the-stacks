# Implementation Plan: Debug view card B — the `play/:sessionId/debug` page

**Branch**: `task-0117-debug-page` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/041-debug-page/spec.md`. Binding design:
`docs/design/debug-view.md`. Consumed contract: `specs/037-debug-api/contracts/debug-api.md` on
branch `task-0116-debug-api` (PR #62, not merged at authoring time).

## Summary

Add an operator-only, client-only route `play/:sessionId/debug` to `apps/web`. It polls
TASK-0116's four debug reads (events, jobs, calls, seed) on one adaptive tick (2 s active, 10 s
idle). It renders a pinned "why waiting?" strip over three linked columns: job timeline, event
log, state. The state column folds the held log with `project(events, { role: "dm" })` through a
pinned seq or the head. Seed, Ledger, Journal and Cost open as `Panel` slide-outs. One retry
control posts to the existing `POST /dm/sessions/:sessionId/turn`. `/play/:sessionId` gains a
Debug link for operators.

The work is web-only. All logic that decides what to show lives in pure modules under
`apps/web/app/debug/`, tested with `node:test`. Components are thin and get markup tests under
vitest, as `apps/web/app/play/` does.

## Technical Context

**Language/Version**: TypeScript 5 (erasable syntax in pure modules, as `app/play/`), React 19.

**Primary Dependencies**: React Router 8 (framework mode, client-only route), Tailwind v4
tokens (Daylight), `components/panel.tsx` `Panel`, `@the-stacks/session-model` (`project`,
`StoredEvent`, projection types). All already installed.

**New runtime dependencies**: **none.** The autocomplete dropdown is a small ARIA combobox built
in this card (research R6). No virtual-list library: the log renders a 500-row window (R4). No
data-fetching library: one hand-written poller (R2). No JSON viewer: `JSON.stringify(v, null, 2)`
in a `<pre>`.

**Storage**: none. No migration. Browser memory only; no `localStorage` or `sessionStorage`.

**Testing**: `node --test` for pure `.ts` modules via `.test.mjs` (sibling standard
`apps/web/test/play/*.test.mjs`); vitest `renderToStaticMarkup` for `.tsx` (sibling standard
`apps/web/test/play/*.test.tsx`). Live check in Brave with playwright-core loaded from outside
the repo, as `specs/030-play-route/evidence/shoot.mjs` does.

**Target Platform**: desktop browsers at 1280 px and wider for the three-column layout; stacks
below 1024 px.

**Project Type**: web app (`apps/web`), client-only route.

**Performance Goals**: fold of a 2,000-event log through any seq in under 100 ms (SC-004);
a new event visible within 3 s while active (SC-001).

**Constraints**: no modals; operator only; read only plus retry; no server change.

**Scale/Scope**: one session; logs up to a few thousand events; jobs up to a few hundred.

## Constitution Check (against `.specify/memory/constitution.md` 2.0.0)

*Run before Phase 0 and again after Phase 1 design. Both runs pass.*

- [x] **I. Agent-operable** — every datum comes from the operator debug API
      (`GET /dm/sessions/:id/{events,jobs,calls,seed}`); the one action is the existing
      `POST /dm/sessions/:id/turn`. An agent with an operator session drives the same routes.
      The page adds no capability an agent cannot reach.
- [x] **II. Content contract** — no codex entity. N/A, and no new content type.
- [x] **III. Data planes** — the page reads session-plane data (events, DM jobs) through the
      `/dm` HTTP seam and the seed through the same seam. It holds no state of its own beyond
      browser memory. No cross-plane import: `apps/web` imports only `@the-stacks/session-model`
      and its own modules, never `apps/server`.
- [x] **IV. Event sourcing** — the page appends nothing. Its state column is a projection of the
      log through `project`. DM-visibility rows reach only the operator (D1); spoilers are
      accepted by ruling (D2).
- [x] **V. Citations** — no library-derived claim. N/A.
- [x] **VI. 5e engine boundary** — the page computes no mechanics. It displays engine output
      already in the log and in job results.
- [x] **VII. Structured first** — no generated asset. N/A.
- [x] **VIII. Operator-owned content** — the page shows only API output. The API carries no
      prompt, completion or retrieved text beyond the bounded failure excerpts already stored.
      NON-NEGOTIABLE: holds.
- [x] **IX. Self-hostable** — no new container, service or env var. Ships in the existing web
      bundle.

**Stack conformance**: React 19, React Router 8 (client-only route), Tailwind v4, shadcn `Sheet`
through `Panel`. No departure.

**Post-design re-check**: the data model and module seams below keep every gate above. No
Complexity Tracking entry.

## Phase 0: Research

See [research.md](research.md). Decisions R1–R10 settle: client-only route and gate (R1), the
poller and its back-off (R2), first load by cursor (R3), log windowing (R4), tolerant result
readers (R5), the autocomplete dropdown (R6), fold memoization for the scrub (R7), the seq↔job
index and "link unknown" (R8), the retry visibility rule (R9), and the live fake-gateway check
(R10).

## Phase 1: Design

- [data-model.md](data-model.md) — the client-side shapes and the pure module signatures.
- [quickstart.md](quickstart.md) — how to run the page and the live check.
- **Contracts**: none new. The page consumes `specs/037-debug-api/contracts/debug-api.md` and
  `specs/031-dm-runtime/contracts/dm-api.md` (`POST .../turn`) unchanged. The pure module
  signatures are internal and live in data-model.md.

## Project Structure

### Documentation (this feature)

```text
specs/041-debug-page/
├── spec.md
├── plan.md               # this file
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── checklists/requirements.md
└── evidence/             # Phase 6: live-check.md, shoot-debug.mjs, shots/
```

### Source code — every file this card touches

New pure modules (`apps/web/app/debug/`):

| File | Purpose |
|---|---|
| `apps/web/app/debug/api-types.ts` | The debug API response types, mirrored from debug-api.md (web cannot import `apps/server`). Type-only. |
| `apps/web/app/debug/read-result.ts` | Tolerant readers over `DebugJob.input`/`result` (`unknown`): `readTurnResult`, `readCompanionResult`, `readChronicleResult`, `readTrigger`. Never throw; absent fields read as "not recorded". |
| `apps/web/app/debug/client.ts` | `createDebugClient(fetchImpl)`: `events(after,limit)`, `jobs(before?)`, `calls(after)`, `seed()`, `retry()`. Maps 401/403 to an `auth` error, other failures to `network`/`http`. |
| `apps/web/app/debug/snapshot.ts` | `DebugSnapshot` and pure reducers: `mergeEvents`, `mergeJobs` (replace by id), `mergeOlderJobs`, `mergeCalls`, `setSeed`. |
| `apps/web/app/debug/poller.ts` | `createPoller({ tick, clock, timers, visibility })`: one in flight, 2 s / 10 s cadence from `isActive`, immediate poll on `kick()` and on visible. No React. |
| `apps/web/app/debug/activity.ts` | `isActive(snapshot, now, lastRetryAt)` and `nextDelayMs`. |
| `apps/web/app/debug/waiting.ts` | `toWaitingSummary(snapshot, projections, now)`: strip rows, `latestFailure`, `stuck`, `showRetry`. |
| `apps/web/app/debug/job-view.ts` | `toJobView(job, ledgerRows, now)`: badge, duration, totals, sections in node order, calls per section, `wroteSeqs`, `linkUnknown`. |
| `apps/web/app/debug/seq-index.ts` | `buildSeqIndex(jobViews)`: seq → job id; `jobFor(seq)`. |
| `apps/web/app/debug/event-filter.ts` | `filterEvents(events, filter)`, `distinctValues(events)`, `windowRows(rows, count)`. |
| `apps/web/app/debug/scrub.ts` | `createFolder(viewer)`: memoized `projectThrough(events, seq)` with checkpoints every 250 events (R7). |
| `apps/web/app/debug/labels.ts` | Node names and badges as display text; `ageText(ms)`; `costText(usd | null)`. Reuses `play/labels.ts` `actorLabel`. |
| `apps/web/app/debug/use-debug-session.ts` | React hook: owns the snapshot, the poller, the client and retry state. The only effectful module. |

New components (`apps/web/app/debug/components/`):

| File | Purpose |
|---|---|
| `debug-view.tsx` | `DebugView`: the strip over a three-column grid (`xl:` 3 cols, stacked below `lg:`); holds selection state (selected job, selected seq, pinned seq) and panel state. |
| `waiting-strip.tsx` | The pinned strip (`sticky top-0`) and the retry control. |
| `job-timeline.tsx` | Card list, follow-bottom, "load older jobs". |
| `job-card.tsx` | Collapsed and expanded card; the seven sections; `CallRows`. |
| `event-log.tsx` | Filter bar, rows, payload expander, "show 500 older". |
| `type-filter.tsx` | The ARIA combobox autocomplete dropdown (R6). |
| `state-column.tsx` | The DM projection view, pin badge, "back to live", panel triggers. |
| `seed-panel.tsx`, `ledger-panel.tsx`, `journal-panel.tsx`, `cost-panel.tsx` | Panel bodies inside `Panel`. Ledger reuses `play/ledger-format.ts` `toLedgerItems` and `play/components/ledger-list.tsx`. |

New route:

- `apps/web/app/routes/play-debug.tsx` — `clientLoader` returns `{ sessionId }`;
  `HydrateFallback`; non-operator renders `OperatorOnly` with "The debug view is available to the
  operator only."; operator renders `<DebugView source={useDebugSession(sessionId)} />`.

Edited files (hotspot `apps/web/app/play/` and `routes.ts`; keep each edit minimal):

- `apps/web/app/routes.ts` — add `route("play/:sessionId/debug", "routes/play-debug.tsx")` after
  `play/:sessionId`.
- `apps/web/app/play/table-view.tsx` — accept optional `debugHref?: string`; pass it to the
  header.
- `apps/web/app/play/components/table-header.tsx` — render a "Debug" link
  (`target="_blank" rel="noopener"`) when `debugHref` is set.
- `apps/web/app/routes/play.tsx` — pass `debugHref` when `user.role === "operator"`.
- `apps/web/app/components/icons.tsx` — one `DebugIcon` if the header needs an icon (optional).

Tests (new): `apps/web/test/debug/*.test.mjs` for each pure module; `apps/web/test/debug/*.test.tsx`
for components and the route gate; one structural test `apps/web/test/debug/surfaces.test.mjs`
(no `localStorage`/`sessionStorage`/`fixed inset-0` under `app/debug`, only the four debug paths
plus the retry POST appear as fetch URLs). Edited: `apps/web/test/play/table-view.test.tsx` (Debug
link present with `debugHref`, absent without). `apps/web/test/no-dialog.test.mjs` and
`play-surfaces.test.mjs` stay unchanged and green.

Evidence (new): `specs/041-debug-page/evidence/shoot-debug.mjs`, `evidence/live-check.md`,
`evidence/shots/*.png`.

Wiki (edited): `docs/wiki/play-route.md`, `docs/wiki/debug-view.md` (created by TASK-0116),
`docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md`.

**Migrations**: none. **Server files**: none. **Frozen contracts**: none touched.

## Key design decisions (detail in research.md)

1. **Poll cadence (R2).** One tick fetches events (cursor), jobs (newest page) and calls
   (cursor) in parallel. Active → 2,000 ms; idle → 10,000 ms. Active: any job `queued` or
   `running`; or the newest event's arrival on this page within 30 s; or a retry within 30 s.
   Pause while `document.visibilityState === "hidden"`; poll at once on `visible` and after a
   retry. One tick in flight. A 401/403 stops the poller with a notice.
2. **First load (R3).** Page events with `limit=1000` while `hasMore`. Then poll with
   `after=nextAfter`. Jobs: newest 50; "load older jobs" pages by `before`. Calls: follow cursor
   from 0 with `limit=1000` while `hasMore`.
3. **Link semantics (R8).** `wroteSeqs` is the union of every `seqs` list in the result.
   `linkUnknown` is true when a non-refused submission has `seqs: []` or no `seqs`, when a
   shipped narration has no `seqs`, or when the job was reclaimed (`attempts > 1`).
4. **Cost source (R5).** Card totals sum the usage-ledger rows by `jobId` (all attempts). Node
   rows list `result.calls`, grouped to nodes by purpose: `dm.director` → director,
   `dm.interpret` → interpret, `dm.adjudicate` → adjudicate, `dm.narrate`/`dm.audit` → narrate
   and audit, `dm.companion` → companion plays, `dm.chronicle` → chronicle entries.
5. **Retry rule (R9).** `showRetry = latestFailure !== null || stuck`. `stuck`: newest
   `action.committed` seq > newest `narration` seq, no turn or companion job queued or running,
   and the commit's `ts` at least 15 s before now.
6. **Scrub (R7).** Fold with checkpoints: keep `applyEvent` snapshots every 250 events so a pin
   folds at most 249 events past a checkpoint. Live fold appends incrementally.
7. **Layout.** `grid-cols-[minmax(20rem,1fr)_minmax(24rem,1.4fr)_minmax(20rem,1fr)]` at `xl`;
   one column below `lg`. Each column scrolls on its own under the sticky strip. Tabs stay in
   reserve (D5).

## Phases (one implementer dispatch each; see tasks.md)

1. Data layer: types, readers, client, snapshot, poller, activity.
2. Derivations: waiting, job view, seq index, filters, scrub, labels.
3. Route, hook, shell, strip, retry, Debug link.
4. Columns and cross-links: timeline and cards, event log and filters, state column and pin.
5. Panels and structural gates.
6. Live check in Brave (needs TASK-0116 merged into this branch).
7. Wiki re-ground and full gate.

## Complexity Tracking

None. No gate fails.
