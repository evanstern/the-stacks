# Design: the DM/debug view of a live play session

- **Status:** agreed with the operator, 2026-10-26 (design Q&A session; no mockup rounds)
- **Milestone:** M3 — The Table, first in line
- **Cards:** TASK-0116 (card A, server), TASK-0117 (card B, web; depends on TASK-0116), TASK-0118 (unseated-operator viewer gap; depends on TASK-0048)
- **Origin:** the M2 demo (TASK-0048). The operator played Tamsin with an AI DM and two AI
  companions and could not see the machinery from the table. A companion's uncommitted
  action looked like a frozen table. Narration fallbacks had to be diagnosed by SQL.
- **Operator's request (verbatim):** "I would like to add a new view, if possible, which can
  be enabled for DMs and/or when debugging -- potentially a /play/[id]/debug page -- which
  shows details of the events as they happen, characters, logs... all the data organized in
  a way that can be visualized in an organized way that happens behind the scenes. it would
  make debugging and visualizing the inner workings a bit easier."

## What exists today (grounding)

Read at commit `fb61397`.

- **Events.** The socket delivers events per viewer through `canSee`. Only the user holding a
  *human* DM seat gets the DM view (`apps/server/src/ws/registry.ts` `viewerFor`, the
  TASK-0045 ruling). With an AI DM seat, every human — the operator included — receives
  player-filtered events. DM-visibility rows never reach the browser.
- **Jobs.** DM work runs as `turn`, `companion` and `chronicle` rows on the shared `jobs` table
  (`docs/wiki/dm-turn-jobs.md`). Columns: status, stage, attempts, `heartbeat_at`, `started_at`,
  `finished_at`, `input` (trigger), `result`, `error`. Jobs are not on the socket.
- **Checkpoint.** `jobs.result.checkpoint` (`TurnCheckpoint`, `apps/server/src/dm/jobs.ts`)
  holds the frozen beat, npc turn, director output (incl. `goalNote`), interpret and
  adjudicate outputs, every gate `Submission` (step ref, kind, result, refusal, batch and
  proposal ids), `lastSeq`, and narration attempts. A failed turn adds `failure` with bounded
  model-output excerpts (`docs/wiki/dm-failure-and-gates.md`).
- **Audit.** `AuditRecord` keeps each attempt's word count, deterministic and `dm.audit`
  issues with `blocking`, prose hash, and whether the fallback shipped
  (`docs/wiki/dm-narration-quality.md`).
- **Model calls.** `jobs.result.calls` (`ModelCallRecord`) stores purpose, prompt version,
  attempt, outcome and error kind only. The gateway's `UsageRecord` (provider, model, input
  and output tokens, `costUsd`, `durationMs`, attempts) goes to a log line (`ai/usage.ts`
  `logSink`) and is not persisted. Prompt text is never stored, by contract.
- **Existing route.** `GET /dm/sessions/:id/turns?limit` (operator-only) lists jobs with
  outcome, audit and call metadata. `POST /dm/sessions/:id/turn` queues a manual retry.
- **Client.** `project(events, viewer)` is pure and already runs in the browser, so state
  as of any seq is a cheap fold.

## Decisions

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Who can open it | **Operator only**, enforced on the server (`role === "operator"`), same rule as `/dm` and `/library`. | Jobs and model calls are system internals, not table state. A seated human DM getting the view is a later card if wanted. |
| D2 | Spoilers while the operator plays | **Show everything.** No masking, no player-safe mode. | The operator accepts spoilers when opening the page; masking adds UI and state for little value in a debug tool. |
| D3 | Transport | **HTTP polling** of new operator-only endpoints (~2 s, seq cursor for the log). | Leaves the TASK-0045 seat-based socket rule untouched. Jobs are not on the socket anyway. |
| D4 | Model-call detail | **Persist usage, no text.** Extend the stored call record with provider, model, input/output tokens, `costUsd`, `durationMs`. | Cost and latency per node are the main missing numbers. The never-store-prompt-text contract stays; failure excerpts stay as they are. |
| D5 | Layout | **Three linked columns.** Tabs are held in reserve as an extra axis, used only if three columns run out of room. | Selecting a job highlights the seqs it wrote, and the reverse — the cross-link is the point of the view. |
| D6 | Live vs history | **Live, plus seq scrub.** Follows live by default; clicking an event pins the state column to that seq; "back to live" unpins. | The fold is pure and client-side, so scrubbing costs nothing extra on the server. A full replay player is later. |
| D7 | MVP panels | **All four:** the "why waiting?" strip, job timeline with pipeline, event log with state, seed/ledger/journal. | Each one answered a real question during the M2 demo. |
| D8 | Actions | **Read-only, plus retry.** One control: "retry turn", wired to the existing `POST /dm/sessions/:id/turn`, shown when a turn failed or the table is stuck. | Retry was a curl step during the demo. Cancel/requeue, forcing a companion and policy edits are later. |
| D9 | Process | **Straight to spec.** No `/pdlc:design-rounds`. | An internal tool with its layout settled here; visual language follows `docs/design/chat-ui/decision.md` (Daylight tokens, `Panel` slide-outs). Mockup rounds would mostly re-confirm. |
| D10 | Cards | **Two TASKs:** A (server) then B (web). B depends on A. | One task, one PR. The server PR carries a reviewable contract change (persisted usage, a new operator API); the web PR carries the page. |
| D11 | Milestone | **M3, first in line.** | Keeps the M2 sweep closing on its current scope. |

## The page

Route: `play/:sessionId/debug`, client-only like `play/:sessionId`. A non-operator gets the
`OperatorOnly` render. An operator sees a "Debug" link in the `/play` header.

### "Why waiting?" strip (pinned top)

Answers "is the table frozen, or waiting on something?" at a glance:

- queued and running jobs, each with kind, stage, attempts and heartbeat age;
- uncommitted actions (declared, not committed), with actor;
- table mode and whose turn it is;
- pending proposals and their policy;
- companion holds (a director `hold` decision and its companion job);
- the last failed turn, if newer than the last shipped narration, with the retry control (D8).

### Left column: job timeline

One card per DM job, newest at the bottom, live-appended. A collapsed card shows kind,
trigger, status, duration, attempts, call count, total tokens and cost, and an outcome badge
(shipped, fallback, failed, held). An expanded turn card shows the pipeline in node order:

1. **assemble** — frozen beat (action ids, linked to their seqs), npc turn.
2. **director** — decision, `goalNote`, scene/tracker/mode changes, hold.
3. **interpret** — steps per action, `needsAdjudication`.
4. **adjudicate** — rulings (when run).
5. **resolve** — every `Submission`: step ref, kind, result or refusal code, linked seqs.
6. **narrate / audit** — each attempt: word count, issues split blocking vs advisory, prose
   hash; fallback flag.
7. **failure** — node, kind, message, and the attempt excerpts, when the job failed.

Each node row lists its model calls: purpose, prompt version, attempt, outcome, model,
tokens, cost, duration. Jobs from before D4 lands show "usage not recorded".

### Center column: event log

Every event, all visibilities: seq, time, actor (resolved to a display name), type,
visibility, payload (collapsed JSON). Filters: type (autocomplete dropdown), actor,
visibility. Rows written by the selected job are highlighted. Clicking a row pins the state
column to that seq (D6).

### Right column: state

The DM projection folded through the pinned seq (or live): party and characters, combatants,
trackers, table mode, encounter, DM seat and gate policy, pending proposals. Below it, as
slide-out `Panel`s opened from the column header (no modals):

- **Seed** — the full scene seed, DM-only facts marked as such.
- **Ledger** — the dice ledger (reuses `ledger-format.ts`).
- **Journal** — journal entries, including the `dm`-visibility fallback flags.
- **Cost** — session totals by purpose and model.

## Card A (TASK-0116, server): debug API and persisted usage

- Extend `ModelCallRecord` with `provider`, `model`, `inputTokens`, `outputTokens`,
  `costUsd`, `durationMs`. Fill them from the gateway's usage on every call path
  (`callJson`, `callText`, companion, chronicle).
- Store no prompt or completion text.
- Add operator-only routes beside `/dm` (exact paths settled in the spec):
  - the full event log after a seq, all visibilities, paginated;
  - the session's DM jobs with full `input` and `result` (checkpoint, audit, calls, failure);
  - the session's scene seed, as loaded.
- Keep the existing `GET /dm/sessions/:id/turns` contract unchanged.
- Update `contracts/dm-api.md` and re-ground the wiki notes the change touches.

## Card B (TASK-0117, web): the debug page

- Add the `play/:sessionId/debug` route and the `/play` header link, operator-only.
- Poll card A's endpoints about every 2 s; advance the log by seq cursor.
- Build the strip, the three columns, the seq scrub, and the seed/ledger/journal/cost panels.
- Wire the retry control to `POST /dm/sessions/:id/turn`.
- Use the Daylight tokens and `Panel`; use no modals.
- Verify in Brave (screenshots in the PR).

## Separate bug card (TASK-0118, side finding)

The server gives the DM view only to a seated human DM (`ws/registry.ts` `viewerFor`).
TASK-0048 (commit `53a78fa`, branch `task-0048-playtest`) already moved the `/play` client to
`apps/web/app/play/viewer.ts` `viewerFor(user, projections)`: the human DM seat holder views
as DM, and a user who controls a party character views as a player. One case stays open on
purpose: an unseated operator still falls back to the DM viewer. With an AI DM seat, that
operator gets DM UI (approvals panel, `isDm`) over player-filtered events. TASK-0118 closes
that case only and depends on TASK-0048. The debug view is where an unseated operator sees
DM-only data.

## Later (not MVP)

- Tabs as a second axis, if three columns run out of room (D5).
- A full replay player with play/step/rewind (D6).
- Operator controls beyond retry: cancel or requeue a job, force a companion act, edit gate
  policy (D8).
- The view for a seated human DM, with whatever spoiler handling that seat needs (D1, D2).
- Push delivery (a debug socket channel or job-change notifications) if polling proves too
  slow (D3).
- Persisting prompt/completion text behind a debug flag, if prompt work needs it (D4).

## Open questions (for the spec)

1. Log page size and whether the page loads the whole log up front or windows it.
2. Exact endpoint paths and whether they live under `/dm` or a new `/debug` mount.
3. Whether the poll interval backs off when the session is idle.
4. Whether the debug page is reachable on hosted dev (vm-104). Operator-only gating makes it
   safe; the question is only whether it is wanted there.
