# Implementation Plan: Group sign-off for party-scope actions

**Branch**: `task-0049-group-signoff` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/044-group-signoff/spec.md`, with the operator
rulings of 2026-10-27 (every recommended default: FT-1 A, FT-2 A, FT-3, FT-4, Q1 A, Q2 A,
Q3 C, Q4 confirmed, Q5 to TASK-0050).

## Summary

A party-scope action in a party of two or more humans commits with authority `group` once
every present party human's latest stance is `approve`. The declarer's declaration counts as
approval. The commit fires automatically on the completing approval, or on an explicit
commit once the quorum is met. Each `group` commit batch carries a `presence.recorded` row
with purpose `signoff`, so the decision replays from the log. Objections block a non-DM
commit and name the objectors in the refusal. The DM commits or withdraws at any time.

One pure rule decides all of it: a new `signoffState` in `packages/session-model/src/gate/`.
`commitAuthority` (gate and client) and the SC-006 replay check call it. The planner gains
an optional context carrying the present set; the server gate fills it from the
`PresenceReader`. The play route renders per-player sign-off rows from the same rule.

No new event type, gate request kind, WebSocket frame, migration or runtime dependency.

## Technical Context

**Language/Version**: TypeScript 5 on Node 22 (server), React 19 + React Router 8 (web).

**Primary Dependencies**: Zod (schemas), Vitest (tests), existing workspace packages
`@the-stacks/session-model`, `@the-stacks/dnd5e-engine`. No new dependency.

**Storage**: Postgres 17 event log, unchanged schema. No migration.

**Testing**: Vitest unit tests in `packages/session-model/test/`; server integration tests in
`apps/server/test/` against the worktree stack with `REQUIRE_DATABASE=1`; web tests in
`apps/web/test/play/` (node `--test` `.mjs` and Vitest `.tsx`, as present).

**Target Platform**: The one Node process (`apps/server`) and the SSR web app.

**Project Type**: pnpm monorepo: a pure package, a server app, a web app.

**Performance Goals**: The sign-off rule is O(party size × comments on one action). The gate
already folds the DM projection per attempt; no new read is added.

**Constraints**: The planner stays pure (no clock, no I/O; presence arrives as data). Refuse
before write. One append per decision (atomic batch). No modal UI.

**Scale/Scope**: A party of at most a handful of humans; the marker caps `present` at 64.

## Constitution Check (against `.specify/memory/constitution.md` 2.0.0)

*Gate before design: PASS. Re-checked after design: PASS.*

- [x] **I. Agent-operable** — Approve, object and commit are the existing gate requests
      `action.comment` and `action.commit`, sent over the same `gate.handle`/`gate.submit`
      every agent and human uses. AI companions comment through `gate.submit`; the AI DM
      commits through `gate.submit` as `ai:dm`. No human-only path.
- [x] **II. Content contract** — No codex entity. Not applicable.
- [x] **III. Data planes** — All new state is session-plane: stances (`action.commented`)
      and the `signoff` marker (`presence.recorded`). The live present set crosses into the
      gate only through the declared `PresenceReader` seam (decision-0024).
- [x] **IV. Event sourcing** — Every sign-off decision is a projection of the log plus the
      logged present set in the same batch (FR-012). Rows are typed, catalogued, versioned
      (`action.commented` v1, `presence.recorded` v1, `action.committed` v1), server-
      validated by the planner, written in one atomic batch. A refusal appends nothing. No
      LLM output path changes.
- [x] **V. Citations** — No library-derived claim. Not applicable.
- [x] **VI. 5e engine boundary** — No mechanics. A committed party action reaches the engine
      only through the unchanged DM pipeline.
- [x] **VII. Structured first** — No generated artifact. Not applicable.
- [x] **VIII. Operator-owned content** — Fixture text is original. No book text.
- [x] **IX. Self-hostable** — No new service or container; `docker compose up` unchanged.

**Stack conformance**: within the Architecture Constraints table. No departure.

## Design decisions (Phase 0 research, consolidated)

- **D1. One rule, `signoffState`.** Decision: a pure
  `signoffState(p, actionId, present)` returns the per-human rows and `met`. Rationale: the
  gate, the client and the replay check must agree byte for byte (Constitution IV,
  CR-003). Alternative: separate checks in gate and client — rejected (drift).
- **D2. `commitAuthority(p, committer, actionId, present?)`** (ruling FT-1 A). Without
  `present` the behaviour is today's, so every existing caller and test is unchanged until
  it opts in. With `present`, step 4 for more than one human returns `group` when the quorum
  is met, else `GROUP_SIGNOFF_REQUIRED` with `waiting` and `objecting`. The committer counts
  as present and as approving (FR-015, FR-016).
- **D3. Planner context** (ruling FT-2 A). `planProposal(p, proposer, proposal, rng, ids,
  proposalId, context?)` with `PlanContext = { present?: readonly string[] }`. The trailing
  optional parameter keeps every call site source-compatible. TASK-0050's `floor` purpose
  reuses `PlanContext`.
- **D4. Rows.** `action.commit` with authority `group` and more than one party human plans
  `[presence.recorded(signoff), action.committed]`. `action.comment` with stance `approve`
  from a party human, in a party with more than one human, that meets the quorum, plans
  `[action.commented, presence.recorded(signoff), action.committed]` (ruling Q3 C, FR-017).
  The marker row: actor `system`, visibility `public`, payload
  `{ present, purpose: "signoff", actionId }`. The committed row's actor is the committer
  or the completing approver. A single-human party plans exactly today's rows (FR-014).
- **D5. Marker `present`** = sorted unique (`context.present` ∪ {committer}), capped at 64 by
  the existing schema. The gate passes the reader's user ids; with no reader the default is
  nobody, so only the committer is present.
- **D6. Replay** (ruling FT-3). SC-006 passes `present` from the latest `presence.recorded`
  row with purpose `signoff` and the same `actionId` before the commit, when one exists. A
  one-human `group` commit and every `dm`/character commit replay without it, as today.
- **D7. Refusal details** (ruling FT-4). The planner copies `waiting` and `objecting`
  (sorted user ids) into `GateRefusal.details`. In-process callers (the DM runtime, the
  playtest harness, tests) read them there. The WebSocket error frame carries the code and
  message only (`ws/gateway.ts`, frozen frame shape), so the client derives the same lists
  from `signoffState` over its own projection. No frame change.
- **D8. Enqueuer.** `dm/enqueue.ts` rule 1 (any `action.committed` enqueues a turn) already
  fires on the three-row batch. Rule 3 (react on a human comment on a companion's open
  action) loads projections after the append, so a committed action is not open. Phase 3
  adds a test proving no `react` job is queued for an auto-committed companion-declared
  party action; code changes only if the test fails.
- **D9. Client present set.** Live: `source.presence` user ids (the `presence` frame). Before
  the first frame (`null`), the client treats the present set as unknown and shows every
  party human as `waiting` (never `absent`); the gate decides. Fixture: `fixturePresence`.
- **D10. UI.** Sign-off rows sit inside the action card under the comments (no modal,
  FR-010). The viewer's own row carries Approve and Object buttons that send
  `action.comment` with that stance through the existing `onComment`. `commitAuthorityFor`
  gains a `present` argument so the commit control appears once the quorum is met (the
  explicit path, Q3 C). Props are additive (ruling Q4).

## Contract amendments (rulings FT-1 to FT-4; land in this PR)

Each amended file gets an "Amendment (TASK-0049)" paragraph citing the 2026-10-27 ruling,
as the TASK-0114 amendments do.

| File | Change |
|---|---|
| `specs/029-proposal-gate/contracts/policy-and-authority.md` | Step 4 rewritten to the quorum (D2); "advisory in M2" sentence replaced; `CommitDecision` gains `waiting`/`objecting`; SC-006 paragraph amended (D6). |
| `specs/029-proposal-gate/contracts/gate-api.md` | §1 `planProposal` gains `context?: PlanContext`; rows table for `action.comment` and `action.commit` (D4); §2 `details` for `GROUP_SIGNOFF_REQUIRED` (D7); §3 step 2 fills the context from the `PresenceReader`. |
| `specs/029-proposal-gate/contracts/fixtures.md` | New `group-signoff` fixture row and its facts; check 4 wording. |
| `specs/030-play-route/contracts/proposal-seam.md` | One amendment line: the sign-off props on the action card are additive (ruling Q4); `CommitAuthority` is unchanged. |

The new binding contract for this feature is [contracts/signoff.md](contracts/signoff.md).

## Project Structure

### Documentation (this feature)

```text
specs/044-group-signoff/
├── spec.md
├── plan.md              # this file
├── data-model.md
├── quickstart.md
├── contracts/
│   └── signoff.md
├── checklists/requirements.md
└── tasks.md
```

### Source code touched

```text
packages/session-model/
├── src/gate/signoff.ts                 # NEW: signoffState, SignoffRow, SignoffState
├── src/gate/authority.ts               # commitAuthority(…, present?) + waiting/objecting
├── src/gate/plan.ts                    # PlanContext; marker + commit rows; auto-commit
├── src/index.ts                        # export signoffState, types, PlanContext
├── src/fixtures/group-signoff.ts       # NEW fixture
├── src/fixtures/index.ts               # register it
├── test/gate-signoff.test.ts           # NEW unit tests
├── test/gate-authority.test.ts         # present-set cases; SC-006 reads the marker
├── test/gate-plan.test.ts              # rows for group commit and auto-commit
├── test/fixtures.test.ts               # group-signoff facts; fixture count
└── test/exports.test.ts                # new exports

apps/server/
├── src/gate/gate.ts                    # pass { present } from PresenceReader to planProposal
├── test/gate.signoff.integration.test.ts   # NEW: two human seats on the real log (merge condition)
└── test/dm/companion-react.integration.test.ts   # D8 case: no react job on an auto-commit

apps/web/app/play/
├── signoff.ts                          # NEW: signoffRows(action, party, present, viewer)
├── authority.ts                        # commitAuthorityFor(…, present)
├── view-model.ts                       # card.signoff rows
├── table-view.tsx                      # pass present ids into the view model
├── use-fixture-table.ts                # present ids from fixturePresence
└── components/action-card.tsx          # sign-off rows + own-row Approve/Object
apps/web/test/play/
├── signoff.test.mjs                    # NEW
├── authority.test.mjs, view-model.test.mjs, action-card.test.tsx  # amended
└── no-dialog.test.mjs                  # unchanged; must stay green

specs/029-proposal-gate/contracts/{policy-and-authority,gate-api,fixtures}.md   # amendments
specs/030-play-route/contracts/proposal-seam.md                                 # one line
docs/wiki/{proposal-gate,play-route,session-model,presence}.md, INDEX.md, CAPSULES.md
```

**Migrations**: none. **New runtime dependencies**: none.

**Structure Decision**: the existing monorepo layout. The rule lives in the pure package
beside `authority.ts`; the server only feeds presence in; the web app only renders.

## Overlap with siblings

- **TASK-0099** (spec 043; ruled the same day): edits `apps/server/src/ws/gateway.ts`,
  `apps/server/src/session/events.ts`, `apps/server/test/helpers/import-graph.ts`, 029's
  `ws-delivery.md` and `write-boundary.md`, and spec 006's protocol. This plan edits none of
  those files. Shared: the `proposal-gate` wiki note (both amend it; the later branch
  re-reads and merges prose) and the `apps/server/src/gate/` hotspot (this plan edits
  `gate.ts`; 0099 does not, per its spec). Different files in 029's `contracts/`. Expect one
  reconcile merge on `docs/wiki/proposal-gate.md` and `INDEX.md`.
- **TASK-0050** (floor passing) reuses `PlanContext` and the marker pattern with purpose
  `floor`, and inherits ruling Q5 (AI DM override of a stalled sign-off). Merge this first.
- **TASK-0100**: `apps/web/app/play/` and `gate/`; coordinate on `action-card.tsx` and
  `view-model.ts`.

## Complexity Tracking

No Constitution Check violation. Nothing to justify.
