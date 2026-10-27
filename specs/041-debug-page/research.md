# Research: the debug page (TASK-0117)

Each entry: decision, rationale, alternatives considered.

## R1 — Client-only route, gated on the root loader's user

- **Decision**: `routes/play-debug.tsx` uses `clientLoader` + `HydrateFallback` and no server
  `loader`, like `routes/play.tsx`. The component reads `useRouteLoaderData("root").user`. A role
  other than `operator` renders `OperatorOnly` before any hook that fetches mounts. The server
  still enforces the rule on every debug route (TASK-0116, `requireOperator`).
- **Rationale**: same rule and pattern as `play-fixtures.tsx`. The client gate is display only;
  the server is the authority.
- **Alternatives**: a server `loader` that redirects. Rejected: the play routes are client-only by
  ruling (specs/030), and a redirect hides why the page refused.

## R2 — One hand-written poller with adaptive cadence

- **Decision**: `debug/poller.ts` `createPoller({ tick, delayMs, timers, visibility })`. It runs
  `tick()`, waits for it to settle, then schedules the next by `delayMs()`: 2,000 ms when
  `isActive`, else 10,000 ms. `kick()` cancels the wait and ticks at once (after a retry, and on
  `visibilitychange` to visible). While hidden it schedules nothing. `stop()` ends it; an auth
  error from `tick` calls `stop()`.
- **Active** (`debug/activity.ts`): any job `queued` or `running`; or the page received a new
  event within the last 30 s (receipt time, page clock, so server clock skew cannot matter); or
  a retry was sent within the last 30 s.
- **Rationale**: TASK-0116's recommendation, made concrete. Receipt time keeps the rule
  testable with an injected clock. Settle-then-schedule means polls never overlap (FR-011).
- **Alternatives**: `setInterval` (overlaps on a slow poll); a data-fetching library (a new
  dependency for one page); a push channel (D3 rules it out).

## R3 — Whole log up front, by cursor

- **Decision**: first load loops `GET .../events?after=<n>&limit=1000` while `hasMore`. Later
  polls send `after=<last nextAfter>&limit=1000` and loop the same way if `hasMore`. Calls use
  the same pattern on `.../calls`. Jobs: one newest page (`limit=50`) per tick; "load older jobs"
  pages with `before=<nextBefore>`.
- **Rationale**: the scrub and the cross-links need every event in memory; a session holds a few
  thousand at most. Cursor paging bounds each response.
- **Alternatives**: windowed fetch of the log. Rejected for now: the fold needs the prefix anyway.
  A log too long to hold is an open question for the orchestrator to card, not built here.

## R4 — Render a 500-row window, no virtual list

- **Decision**: the log renders the newest 500 rows that match the filters, plus "show 500
  older", which extends the window by 500. The window resets on a filter change.
- **Rationale**: 500 rows of collapsed payloads render fast without a dependency.
- **Alternatives**: a virtual-list package. Rejected: a new runtime dependency for a debug page.

## R5 — Tolerant readers over `unknown` results; ledger for cost

- **Decision**: `DebugJob.input` and `result` arrive as `unknown`. `read-result.ts` narrows them
  by hand with type guards. Every field is optional on read. An absent usage field reads as
  `null` ("usage not recorded"); an absent `seqs` reads as `undefined` ("link not recorded").
  Card totals sum `/calls` ledger rows by `jobId`; node rows list `result.calls`.
- **Rationale**: the web app cannot import `apps/server` (plane and package boundary), and old
  rows lack fields (debug-api.md "Old rows"). The contract names the ledger as the cost authority,
  because it keeps aborted attempts.
- **Alternatives**: Zod schemas in web. Rejected: they would duplicate server schemas and throw on
  old shapes; a guard that degrades is what a debug view needs.

## R6 — Autocomplete dropdown without a dependency

- **Decision**: `type-filter.tsx` is an ARIA 1.2 combobox: an `<input role="combobox"
  aria-expanded aria-controls aria-activedescendant>` and a `<ul role="listbox">` of matching
  types, positioned under the input (absolute, in flow; no portal, no overlay). Arrow keys move,
  Enter adds, Escape closes. Chosen types show as removable chips. Actor and visibility use the
  same component over their own value lists.
- **Rationale**: the project rule allows slide-outs and autocomplete dropdowns only. No combobox
  exists in `apps/web` today, and shadcn's Command/Popover would add packages.
- **Alternatives**: native `<select multiple>` (poor for 40+ types); `<datalist>` (no multi-select,
  inconsistent styling).

## R7 — Fold checkpoints for the scrub

- **Decision**: `scrub.ts` `createFolder({ role: "dm" })` keeps an array of projections at every
  250th event. `projectThrough(events, seq)` starts from the nearest checkpoint at or below `seq`
  and applies `applyEvent` up to `seq`. New events extend the live fold and add checkpoints.
- **Rationale**: `applyEvent` is pure and never mutates, so saved projections stay valid. A pin
  folds at most 249 events, well inside SC-004's 100 ms.
- **Alternatives**: refold from zero on every pin (fine at small sizes, linear at large ones).

## R8 — The seq↔job index and "link unknown"

- **Decision**: `job-view.ts` computes `wroteSeqs` as the union of
  `checkpoint.submissions[].seqs`, `checkpoint.narration.seqs`, `plays[].submissions[].seqs` and a
  chronicle's `seqs`. `linkUnknown` is true when any non-refused submission has `seqs` absent or
  `[]` (the `findLanded` edge), when `narration.shipped` is true and `narration.seqs` is absent, or
  when `attempts > 1` (a reclaim may have written unnamed rows). `seq-index.ts` maps each seq to
  its job; a seq claimed by two jobs maps to the newer job and logs nothing.
- **Rationale**: debug-api.md's three edges. Showing "link unknown" stops the operator reading an
  absent link as "wrote nothing".
- **Alternatives**: infer links from `lastSeq` ranges. Rejected: other writers interleave.

## R9 — When the retry control shows

- **Decision**: `latestFailure` is the newest `failed` turn whose `finishedAt` is later than the
  newest `narration` event's `ts` (none when no narration exists counts as later). `stuck` is
  true when the newest `action.committed` seq exceeds the newest `narration` seq, no turn or
  companion job is `queued` or `running`, and the commit's `ts` is at least 15 s old. The control
  shows when either holds. After a POST, it disables until the next tick shows the queued job.
- **Rationale**: D8 says "shown when a turn failed or the table is stuck". 15 s clears the gap
  between a commit and its turn job's enqueue and claim.
- **Alternatives**: always show retry. Rejected by D8.

## R10 — Live check on the fake gateway, in Brave

- **Decision**: the worktree's own stack runs the app with the `dm.*` purposes routed to a
  `fake` provider (`apps/server/src/ai/config.ts` kind `fake`, no key). The operator starts a
  scene, a player-seat commit triggers a turn, and `evidence/shoot-debug.mjs` (modelled on
  `specs/030-play-route/evidence/shoot.mjs`: playwright-core from outside the repo, Brave by
  `executablePath`, untracked creds file) captures the page while the turn job is running and
  after it ends, with the `stacks-theme` cookie set to `light` and then `dark`, at 1280 px (and
  390 px for the stacked layout).
- **Rationale**: the runbook's merge condition; no paid run. The fake's unscripted default may
  ship a fallback or fail the turn; either outcome is a real turn and exercises the timeline. A
  failure also exercises the retry control.
- **Alternatives**: screenshots of a fixture session. Rejected: the condition says live.
- **Note**: the AI config override goes in the shell environment of the app process for the run,
  never in the root `.env`. The implementer reads and prints no key.
