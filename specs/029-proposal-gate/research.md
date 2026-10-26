# Research: First Scene — proposal gate

Each entry records a decision, why, and the alternatives rejected. Inputs: decision-0014 to
decision-0017, decision-0020, decision-0021; architecture A4, A10–A12; constitution 2.0.0;
the engine contracts (spec 026) and the session-model contracts (spec 028).

## R1. Where the code lives: pure rules in the session-model package, a thin server gate

**Decision.** Proposal schemas, the policy table, the permission matrix, commit authority,
the planner and the proposal projection live in `packages/session-model/src/gate/`. The
server gate (`apps/server/src/gate/`) only loads projections, calls the planner, appends with
an expected sequence and publishes.

**Why.** TASK-0047 must render pending proposals and decide who sees the commit control
without a server (FR-019). The planner is pure because the engine is pure. The package
already has a client-importable boundary rule with violating fixtures, and the proposal
events must join its catalog anyway.

**Rejected.** A new `packages/gate`: a new workspace package touches root `tsconfig.json`,
`pnpm-workspace.yaml`, the Dockerfile and `biome.json` (all hotspots), and would need its own
boundary rule and fixtures, for code that depends on session-model's projections in every
function. Server-only rules: TASK-0047 would re-implement commit authority in the client and
the two would drift.

## R2. The policy table governs the AI DM only

**Decision.** The table is total over the eleven kinds the AI DM may propose. Human
proposers route `direct`. AI companions route `direct` after commit authority.

**Why.** decision-0015 is about LLM output in the DM's chair; decision-0016 says player
actions are proposals "with a sign-off policy", which is commit authority. decision-0014
makes companions actors "through the same gate as a human", so a companion must not need DM
approval that a human player would not. A per-kind table cannot tell a companion's `talk`
from the narrator's; scoping the table to `ai:dm` resolves that.

**Rejected.** One table for every proposer: a human DM would have to approve companion chatter
or let the narrator speak unasked; neither matches the decisions.

## R3. AI seat means auto

**Decision.** With the AI DM seated, the effective policy is `auto` for every kind.

**Why.** `ask` and `suggest` exist for a human DM (decision-0015, goal 4). Under an AI seat
nobody can approve; an `ask` would stall the game.

## R4. The DM seat is logged session state

**Decision.** `dm.seat.changed` records who is DM; the default is the AI DM; only an operator
changes it. The WebSocket registry derives the DM viewer from the seat, not from the user's
role.

**Why.** The M2 demo has the operator in the human player seat with an AI DM (runbook,
"TASK-0048 demo"). Mapping operator role to DM view would stream secret trackers and hidden
rolls to the player's browser — the honour-system spoilers decision-0021 names as
tabletop-dm's gap. A logged seat is replayable and agent-operable.

**Rejected.** Operator role as DM (leaks secrets in the demo). A config value (not per
session; not in the log).

## R5. Optimistic concurrency on the append

**Decision.** `appendBatch` gains `expectedLastSeq`. The gate plans against the DM projection
through `throughSeq`, appends with that expectation, and retries up to three attempts.

**Why.** The engine's events carry `before`/`after` computed from the state the gate read. A
write landing between read and append (a turn job, a player, a second approval) would make
those values stale or double-apply an approval. The check runs inside the existing advisory
lock, so it costs one comparison. It holds across processes, unlike an in-process mutex.

**Rejected.** An in-process per-session mutex: correct only while exactly one process writes
(the hosted dev swap can briefly run two). Checking pending status in a separate query: still
racy without the lock.

## R6. Proposal events and atomic approval

**Decision.** `proposal.created`, `proposal.approved` and `proposal.rejected` are catalogued
`dm`-only events. An approval's effects and its `proposal.approved` row land in one
`appendBatch`.

**Why.** decision-0015: pending proposals live in the log so they survive restarts and are
filtered per viewer. One atomic batch means a crash can never leave an approved-but-unapplied
or applied-but-pending proposal (which a re-approval would apply twice).

## R7. Refuse before write, at creation and at approval

**Decision.** `ask` and `suggest` proposals are planned (legality only) before
`proposal.created` is written. Approval re-plans; a refusal writes nothing and leaves the
proposal pending.

**Why.** decision-0021 idea 1 and AC #8. The engine refuses before drawing a die (engine
invariant 3), so the legality verdict does not depend on the dice; a throwaway `seededRng(0)`
suffices. Leaving a now-illegal proposal pending keeps "a refusal writes nothing" absolute;
the DM rejects it.

**Rejected.** Appending a `proposal.failed` event on an illegal approval: a write on a
refusal path.

## R8. The send path

**Decision.** A WebSocket `send` whose `eventType` is a gate request kind goes to the gate;
any other catalogued type is refused; uncatalogued types keep the M0 raw append.

**Why.** Today a client can append `dice.rolled` or `tracker.changed` directly, which breaks
constitution IV. Frame shapes are a checkpointed contract, so the frame stays and its
`eventType` names the request. Uncatalogued types are inert (projections skip them) and the
M0 play route and load bench depend on them until TASK-0047 replaces the composer.

**Follow-up.** Retiring the uncatalogued path needs a board card ordered after TASK-0047
(decision-0020). The orchestrator creates it before this task's PR merges (Open Question 2).

## R9. The write-boundary proof is an import-graph test

**Decision.** contracts/write-boundary.md.

**Why.** "No code path" is a transitive property. Biome's `noRestrictedImports` is per-file
and cannot see that a module reaches `ai/` through another module. The TypeScript compiler
API is already a dev dependency.

## R10. The RNG

**Decision.** Live plans use `seededRng(randomInt(0, 2**32))` from `node:crypto`, one per
plan; tests inject `scriptedRng`.

**Why.** The engine leaves the seed to the gate (engine-api.md). The roll ledger records every
face, so the seed is not part of the audit record.

## R11. Dependencies and migration

None. Proposals are rows in the existing `events` table; the new log function reads by the
existing primary key; Zod and the TypeScript compiler API are already installed.
