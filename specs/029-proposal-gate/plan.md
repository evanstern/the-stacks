# Implementation Plan: First Scene — proposal gate (autonomy policies and commit authority)

**Branch**: `task-0045-proposal-gate` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/029-proposal-gate/spec.md` (board card TASK-0045).

## Summary

Add the one gate between intent and the session log. Pure rules go into
`@the-stacks/session-model` (`src/gate/`): twelve Zod-typed proposal kinds and four
supervision requests; the default policy table (`auto`/`ask`/`suggest`) over the eleven kinds
the AI DM may propose, with per-session overrides; the DM seat; the permission matrix;
decision-0016's commit authority; and a pure planner that turns a proposal into catalog rows,
calling the engine's `execute` for mechanics. Five catalog entries (`proposal.created`,
`proposal.approved`, `proposal.rejected`, `dm.seat.changed`, `gate.policy.changed`) and two
projection fields (`gate`, `proposals`) extend the 028 contracts additively. Two fixture
streams (`dm-approvals`, `commit-authority`) and one example proposal per kind are published
for TASK-0047.

A thin server gate (`apps/server/src/gate/`) folds the DM projection, plans, and appends with
an expected last sequence (optimistic concurrency, three attempts), then publishes the rows
to WebSocket subscribers. The WebSocket gateway routes gate request kinds to the gate,
refuses raw catalogued types, and filters delivery with `canSee` using the session's DM seat,
so the seated human DM's connection receives `dm` events. An import-graph test proves that
only the gate and the session seam write the log and that neither can reach the AI gateway
(AC #1). A database test restarts the server and shows pending proposals intact (AC #9).

No new dependency. No migration.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), ES2022, Node 22.

**Primary Dependencies**: Zod 4 (installed), `@the-stacks/dnd5e-engine` and
`@the-stacks/session-model` (workspace), Hono and `ws` (server, installed), the TypeScript
compiler API (dev, installed) for the write-boundary test.

**Storage**: the M0 `events` table, unchanged. `log.ts` gains an optional
`expectedLastSeq` on `appendBatch` and a `readLatestOfType` read.

**Testing**: Vitest. Package tests run in memory. Server tests: the write-boundary test (no
database); gate, WebSocket and restart suites on the worktree's own stack with
`REQUIRE_DATABASE=1`.

**Target Platform**: the one Node process (server); the package also runs in the browser
(TASK-0047).

**Project Type**: monorepo — a pure package plus server modules.

**Performance Goals**: a gate request folds the session log once per attempt. M2 sessions
hold hundreds of events; the fold is the same `project` the replay tests exercise.

**Constraints**: refuse before write (no row on any refusal path); the package stays pure and
client-importable (028 boundary rule); frame shapes unchanged except the optional
`error.code` (spec Open Question 1).

**Scale/Scope**: 12 proposal kinds, 4 supervision requests, 5 catalog entries, 15 gate
refusal codes, 2 fixtures.

## Constitution Check

*Pre-research gate: pass. Post-design re-check: pass.* Against constitution 2.0.0.

- [x] **I. Agent-operable** — the agent interface is `gate.submit` (and `gate.handle`), the
      same planner and append path a human's WebSocket requests reach. AI companions submit
      the same four table-side kinds a player does. The only human-only requests (approve,
      reject, seat) supervise agents; under an AI seat the AI DM needs none of them.
- [x] **II. Content contract** — N/A: no codex entity.
- [x] **III. Data planes** — all state is session-plane: events in the session log and
      projections of it. Server code sits in `apps/server/src/gate/` and
      `apps/server/src/session/`. The gate imports neither `library/` nor `codex/`; the
      write-boundary test asserts it cannot reach `ai/`. Pure code stays under the existing
      session-model boundary rule (no server, database, network, model or clock).
- [x] **IV. Event sourcing, server authority** — every catalogued write goes through the
      gate and, for mechanics, the engine; refusals write nothing; LLM output reaches the log
      only as a parsed proposal (AC #1 test); pending proposals are `dm`-visibility events;
      new types are versioned catalog entries; projections still tolerate unknown types.
      The legacy uncatalogued send path writes only inert types (research R8) and is
      retired by a card the orchestrator creates (Open Question 2).
- [x] **V. Citations** — N/A: no library claim.
- [x] **VI. 5e engine boundary** — mechanics reach the log only as `execute` output; the
      gate passes `command` through unparsed so the engine is the one validator; the RNG is
      seeded or scripted; no rule is computed outside the engine.
- [x] **VII. Structured first** — N/A.
- [x] **VIII. Operator-owned content** — fixtures use original characters and SRD-generic
      monsters; no book text.
- [x] **IX. Self-hostable** — no service, container or dependency added.

**Stack conformance**: TypeScript, Zod, Hono/`ws`, Postgres through the existing log. No
departure.

## Project Structure

### Documentation (this feature)

```text
specs/029-proposal-gate/
├── plan.md              # this file
├── research.md          # R1–R11
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── proposals.md             # kinds, schemas, requests, proposers, permission matrix
│   ├── policy-and-authority.md  # policy table, effective policy, routing, commit authority
│   ├── proposal-events.md       # catalog additions, payloads, projection additions
│   ├── gate-api.md              # planner, refusals, server gate, seam and log additions
│   ├── ws-delivery.md           # canSee in the registry, the send path, error code
│   ├── fixtures.md              # dm-approvals, commit-authority, proposalExamples
│   └── write-boundary.md        # the AC #1 import-graph test
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/session-model/src/
├── gate/                                 # NEW, pure
│   ├── proposals.ts                      # ProposalKind, ProposalSchema, GateRequestSchema, mechanicsProposal, Proposer, actorOf
│   ├── policy.ts                         # Policy, DEFAULT_POLICIES, effectivePolicy, routeProposal
│   ├── seat.ts                           # DmSeatSchema
│   ├── permissions.ts                    # the permission matrix
│   ├── authority.ts                      # commitAuthority
│   ├── refusals.ts                       # GateRefusal, GateRefusalCodeSchema
│   └── plan.ts                           # planProposal, mechanicsRows
├── events/proposals.ts                   # NEW: ProposalCreated/Approved/RejectedV1
├── events/gate-config.ts                 # NEW: DmSeatChangedV1, GatePolicyChangedV1
├── catalog.ts                            # + 5 entries, EventKind "proposal"
├── projections/{types,apply}.ts          # + gate, proposals; projections/proposals.ts NEW
├── index.ts                              # + gate exports
└── fixtures/                             # + dm-approvals.ts, commit-authority.ts, proposal-examples.ts; unknown-and-invalid row retyped; recipes + fixtureIds.dmUserId

apps/server/src/
├── gate/                                 # NEW
│   ├── gate.ts                           # createGate: submit, handle, onAppended
│   └── index.ts
├── session/events.ts                     # + appendSessionEvents, appendUncataloguedEvent, loadDmSeat; appendMechanicsBatch via mechanicsRows
├── events/log.ts                         # + appendBatch expectedLastSeq, SeqConflictError, readLatestOfType
├── ws/registry.ts                        # canSee + viewerFor + seat cache (isVisible removed)
├── ws/subscribe.ts                       # replay filters with the same rule; loads the seat
├── ws/gateway.ts                         # send → gate / refuse catalogued / legacy; publish(); error code
├── ws/protocol.ts                        # ErrorFrame.code?
└── index.ts                              # createGate, wiring

apps/server/test/
├── gate.integration.test.ts              # NEW: AC #3, #4, #5, #7, #8, concurrency (DB)
├── gate.restart.integration.test.ts      # NEW: AC #9 (DB)
├── write-boundary.test.ts                # NEW: AC #1
├── helpers/import-graph.ts               # NEW
├── fixtures/write-boundary/src/…         # NEW: three seeded violations (excluded from tsc and Biome)
├── ws.integration.test.ts                # updated: catalogued raw types now refused; dm delivery to the seated DM
└── events.integration.test.ts            # + expectedLastSeq, readLatestOfType

specs/028-session-model/contracts/{session-events,projections,fixtures,package-api}.md   # pointer notes
specs/006-ws-gateway/contracts/ws-protocol.md                                           # pointer note
specs/004-event-log/contracts/event-log.md                                              # pointer note
apps/server/test/tsconfig.json, biome.json                                              # exclude the violation tree
```

**Structure Decision**: pure rules in the existing session-model package, a thin server gate
(research R1). `apps/web` is not touched; TASK-0047 consumes the package, the fixtures and
the WebSocket requests.

## Dependencies and migrations

- **New runtime dependency**: none.
- **Migration**: none. Proposals and gate configuration are rows in the existing `events`
  table. `readLatestOfType` reads through the existing `(session_id, seq)` primary key with a
  `type` filter; M2 session sizes need no new index.

## Phases (one implementer dispatch each; see tasks.md)

1. **Proposal contracts in code** — proposal and request schemas, seat, policy table,
   refusal codes, the five catalog entries, `EventKind "proposal"`, the projection additions,
   and the `unknown-and-invalid` retype. Package tests.
2. **Pure decision core** — permissions, `routeProposal`, `commitAuthority`, the planner,
   `mechanicsRows`. Package tests, including the SC-006 fixture replay check.
3. **Fixtures** — `dm-approvals`, `commit-authority`, `proposalExamples`, recipes; the
   fixture guarantees; 028 contract pointer notes.
4. **Server gate and seam** — `log.ts` additions, the seam functions, `createGate`; the gate
   database suite (AC #3, #4, #5, #7, #8, conflicts).
5. **WebSocket delivery and restart** — registry `canSee` with the seat cache, replay, the
   send path, `publish`, the error code, `index.ts` wiring; WebSocket suite updates; the
   restart test (AC #9).
6. **Write boundary and full gate** — the import-graph test and its violation tree (AC #1);
   contract pointer notes for 004 and 006; `pnpm ci:check` green.

## Open Questions (operator; defaults applied, nothing blocks dispatch)

Spec Open Questions 1–5 carry their defaults into this plan. Question 2 needs an artifact,
not just a default: the orchestrator creates the board card "Retire the uncatalogued
WebSocket send path", ordered after TASK-0047, before this task's PR merges
(decision-0020). Tasks.md Phase 6 checks that the card exists and cites it in the PR body.

No other deferral. The group sign-off reduction is decision-0016's stated M2 behaviour, owned
by TASK-0049.

## Complexity Tracking

No constitution violation and no new package. The optimistic-concurrency option on
`appendBatch` is the one change to the M0 log's behaviour; it is opt-in and justified in
research R5.

## Agent context

The Spec Kit agent-context script was not run: this project's `CLAUDE.md` is a PDLC-managed
grounding block, and the wiki re-pin after merge (runbook: `event-log`,
`server-entrypoint-and-app`, `websocket-gateway`, `error-contract`, plus a new gate note)
carries the context instead.
