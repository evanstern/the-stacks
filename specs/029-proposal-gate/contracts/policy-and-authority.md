# Contract: the policy table, the effective policy and commit authority

Package: `@the-stacks/session-model` (`src/gate/policy.ts`, `src/gate/authority.ts`). Pure:
every function reads projections and returns data. Binding for TASK-0046 (which proposals
apply at once) and TASK-0047 (who sees the commit control and the approve button).

## The policy table (AC #2)

The table maps each of the eleven `DmProposalKind`s to a policy. It governs proposals from
the AI DM (`ai:dm`) only. Players and AI companions follow commit authority instead, which is
decision-0016's "sign-off policy". A seated human DM's own requests are already approved.

```ts
export type Policy = "auto" | "ask" | "suggest";
export type PolicyTable = Readonly<Record<DmProposalKind, Policy>>;

export const DEFAULT_POLICIES: PolicyTable = {
  "talk":           "ask",      // the narrator speaking while a human DMs is the DM's call
  "action.comment": "ask",
  "action.commit":  "ask",      // the AI overriding a player's commit
  "action.resolve": "auto",     // bookkeeping after approved mechanics, or a no-roll resolution
  "mechanics":      "ask",      // dice and state changes: the core of goal 4
  "narration":      "ask",
  "table-mode":     "ask",
  "scene":          "suggest",  // a scene change is a story decision: show it, let the DM act
  "party":          "ask",
  "tracker":        "ask",
  "journal":        "auto",     // chronicle, off the hot path; the DM may dial it
};
```

Every kind has an entry; a test asserts the table's keys equal `DmProposalKindSchema.options`.

## The effective policy

```ts
/**
 * AI seat: always "auto" (no human DM can be asked; decision-0015 goal 3).
 * Human seat: the session's override for the kind, else DEFAULT_POLICIES.
 */
export function effectivePolicy(gate: GateView, kind: DmProposalKind): Policy;
```

`GateView` is the projection field described in proposal-events.md:
`{ seat: DmSeat; policyOverrides: Partial<Record<DmProposalKind, Policy>> }`.
A `gate.policy` request sets one override (`gate.policy.changed`). Overrides persist across
seat changes; they apply whenever a human is seated.

## How the gate routes a proposal

```ts
export type Route =
  | { route: "direct" }                       // human proposer: apply now (AC #7 for a DM kind)
  | { route: "policy"; policy: Policy }       // ai:dm: auto applies, ask/suggest records
  | { route: "refuse"; code: "NOT_AUTHORIZED" };

export function routeProposal(p: SessionProjections, proposer: Proposer, proposal: Proposal): Route;
```

- Human proposers and AI companions route `direct` once permitted (proposals.md matrix).
- `ai:dm` routes `policy` with `effectivePolicy(p.gate, proposal.kind)`.
- `ai:dm` submitting `action.declare` is `NOT_AUTHORIZED`.

## Commit authority (AC #6)

decision-0016's table, made executable:

| Mode | Who commits | Authority recorded |
|---|---|---|
| Turn mode | the active actor (`tableMode.activeActor`), for a character it controls (and equal to `activeCharacterId` when that is not null) | `active-player` |
| Free mode | the declaring actor, for a character it controls | `declarer` |
| Party scope, any mode | group sign-off; with one human player in the party, that player | `group` |
| Always | the DM: the seated human DM, or `ai:dm` (through its policy) | `dm` |

```ts
export type CommitDecision =
  | { ok: true; authority: "declarer" | "active-player" | "group" | "dm" }
  | { ok: false; code: "UNKNOWN_ACTION" | "ACTION_NOT_OPEN" | "COMMIT_NOT_ALLOWED"
                     | "GROUP_SIGNOFF_REQUIRED" };

export function commitAuthority(
  p: SessionProjections, committer: Proposer | { actor: string }, actionId: string,
): CommitDecision;
```

Checks, first failure wins:

1. The action exists in `p.actions`, else `UNKNOWN_ACTION`.
2. Its status is `declared` or `discussed`, else `ACTION_NOT_OPEN`.
3. The committer is the seated human DM or `ai:dm` → `{ ok: true, authority: "dm" }`.
4. **Party scope.** Let *humans* be the distinct `userId`s of party members whose controller
   is a player.
   - The committer is not a human in *humans* → `COMMIT_NOT_ALLOWED` (companions approve or
     object by comment; they do not commit for the party).
   - *humans* has more than one member → `GROUP_SIGNOFF_REQUIRED`. TASK-0049 defines the
     quorum. This is decision-0016's M2 reduction ("group sign-off reduces to that player plus
     the DM"), not a deferral: M2 seats one human (decision-0014).
   - Otherwise → `group`. Objections recorded as `object` comments are advisory in M2.
5. **Character scope.** The committer must control `action.characterId`, else
   `COMMIT_NOT_ALLOWED`.
   - Turn mode: the committer's actor equals `tableMode.activeActor`, and
     `activeCharacterId` is null or equals `action.characterId` → `active-player`; else
     `COMMIT_NOT_ALLOWED`.
   - Free mode: the committer's actor equals `action.actor` (the declarer) → `declarer`;
     else `COMMIT_NOT_ALLOWED`.

Every input is public projection data (`actions`, `party`, `tableMode`, `gate.seat`), so a
player's own projection gives the same answer the server's DM projection gives. TASK-0047
calls `commitAuthority(projections, { actor: viewerActor }, actionId)` to decide whether to
show the commit control. The `{ actor }` form treats the actor as a non-DM unless it equals
`ai:dm` or the seated human's user id.

### Fixture replay check (SC-006)

For every `action.committed` event in every session-model fixture, `commitAuthority` on the
DM projection folded through the preceding event, with the event's actor as committer,
returns `ok: true` and the event's recorded `authority`. Fixtures carry no `dm.seat.changed`,
so their seat is the AI DM.
