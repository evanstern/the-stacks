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
  "scene-presence": "ask",      // a presence change is a story decision (TASK-0141)
  "journal":        "auto",     // chronicle, off the hot path; the DM may dial it
  "floor":          "ask",      // the AI DM passes an absent human's turn (TASK-0050)
};
```

Every kind has an entry; a test asserts the table's keys equal `DmProposalKindSchema.options`.

Amended 2026-10-27 (TASK-0141, operator ruling OQ-1): the table gains the `"scene-presence": "ask"` row, and the DM kinds number twelve.

> "TASK-0141 OQ-1 (a) scene-presence.changed via a new scene-presence proposal kind including
> the frozen 029 and 028 amendments, OQ-2 (a)"

Amended 2026-10-27 (TASK-0050, operator ruling FT-2): the table gains the `"floor": "ask"` row, and the DM kinds number thirteen. An AI seat still resolves every kind to `auto`.

> "TASK-0050: I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the
> frozen-contract amendments to 029, 031 and 044 and the one jobs migration."

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
- `ai:dm` submitting `action.declare` or `action.withdraw` is `NOT_AUTHORIZED` (`action.withdraw`: TASK-0114 amendment, W-A ruling).

## Commit authority (AC #6)

decision-0016's table, made executable:

| Mode | Who commits | Authority recorded |
|---|---|---|
| Turn mode | the active actor (`tableMode.activeActor`), for a character it controls (and equal to `activeCharacterId` when that is not null) | `active-player` |
| Free mode | the declaring actor, for a character it controls | `declarer` |
| Party scope, any mode | group sign-off; with one human player in the party, that player | `group` |
| Always | the DM: the seated human DM, or `ai:dm` (through its policy) | `dm` |

Amended 2026-10-27 (TASK-0050, operator ruling FT-5): the "Always" row also covers the stall
override. An `action.commit` from `ai:dm` with `override: "stall"` commits an unopposed party
action with authority `dm`. The planner refuses `GROUP_SIGNOFF_REQUIRED` while a present quorum
member objects.

> "TASK-0050: I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the
> frozen-contract amendments to 029, 031 and 044 and the one jobs migration."

```ts
export type CommitDecision =
  | { ok: true; authority: "declarer" | "active-player" | "group" | "dm" }
  | { ok: false; code: "UNKNOWN_ACTION" | "ACTION_NOT_OPEN" | "COMMIT_NOT_ALLOWED" }
  | { ok: false; code: "GROUP_SIGNOFF_REQUIRED"; waiting: string[]; objecting: string[] };

export function commitAuthority(
  p: SessionProjections, committer: Proposer | { actor: string }, actionId: string,
  present?: readonly string[],
): CommitDecision;
```

> **Amendment (TASK-0049).** The operator ruled on 2026-10-27 ("I accept the defaults on the
> TASK-0099 and TASK-0049 cards, including the frozen-contract amendments to spec 029 and
> spec 006"). `commitAuthority` takes an optional present set. `GROUP_SIGNOFF_REQUIRED`
> carries `waiting` and `objecting`. Step 4 below defines the quorum. The rule lives in
> `specs/044-group-signoff/contracts/signoff.md`.

Checks, first failure wins:

1. The action exists in `p.actions`, else `UNKNOWN_ACTION`.
2. Its status is `declared` or `discussed`, else `ACTION_NOT_OPEN`.
3. The committer is the seated human DM or `ai:dm` → `{ ok: true, authority: "dm" }`.
4. **Party scope.** Let *humans* be the distinct `userId`s of party members whose controller
   is a player.
   - The committer is not a human in *humans* → `COMMIT_NOT_ALLOWED` (companions approve or
     object by comment; they do not commit for the party).
   - *humans* has exactly one member → `group`.
   - *humans* has more than one member and `present` is omitted → `GROUP_SIGNOFF_REQUIRED`
     with `waiting` = every other human and `objecting` = `[]`.
   - *humans* has more than one member and `present` is given → compute
     `signoffState(p, actionId, present, committer)` (specs/044-group-signoff/contracts/signoff.md).
     Its quorum is the present humans plus the committer. A human's stance is the latest
     `approve` or `object` comment they made on the action. The declarer defaults to
     `approve`. Everyone else defaults to `waiting`. The committer counts as approving.
     When every quorum member approves → `group`. Otherwise → `GROUP_SIGNOFF_REQUIRED` with
     the quorum's `waiting` and `objecting` ids. An `object` comment blocks until its author
     approves, or the DM commits or withdraws the action.
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

**Amendment (TASK-0188).** Amended 2026-11-02 (decision-0028 §8; operator ruling 2026-11-02: "All (a), amend"). Spec `specs/066-one-chat-stream` (FR-027).

The policy table gains `"action.suggest": "auto"`, and the DM kinds number fourteen. An AI seat
still resolves every kind to `auto`. `routeProposal` refuses `ai:dm` `action.accept` with
`NOT_AUTHORIZED`, beside `action.declare` and `action.withdraw`.

decision-0016's commit-authority table gains a first row (decision-0028 §4):

| Mode | Who commits | Authority recorded |
|---|---|---|
| Any mode, a DM-suggested action | the acceptor of the item (below), by `action.accept` | `group` for a `party` item; else `active-player` in turn mode; else `declarer` |

**The accept rule.** Checks, first failure wins:

1. The suggestion and its item exist, else `SUGGESTION_NOT_FOUND`.
2. The suggestion is not stale, else `SUGGESTION_STALE`. It is stale when a later public
   `action.suggested` row or a later public `narration` row with empty `actionIds` exists.
3. The derived action id `<suggestionId>.<itemId>` is unused, else `ACTION_EXISTS`.
4. A `character` item: the proposer is the human controller of `characterId`. A `party` item: the
   proposer is a human party member. Else `NOT_AUTHORIZED`. The acceptor counts as present, as the
   spec 044 committer does; no other presence is consulted.
5. The character is able (`CHARACTER_UNABLE`, the `action.declare` rule).
6. Turn mode, a `character` item: the proposer is the active actor, else `COMMIT_NOT_ALLOWED`.

`ai:dm` `action.suggest` is also refused `SUGGESTION_STALE` when a readable post (spec 066 FR-005)
is newer than its `readSeq`.

New refusal codes: `SUGGESTION_STALE`, `SUGGESTION_NOT_FOUND`. `commitAuthority` is unchanged and
still governs direct commits, the spec 044 quorum included (OQ-11 (a)).

Amended 2026-11-11 (TASK-0268, C-GATE ruling "Approve all"): the table gains the `"intent": "ask"` row. `ai:dm` Intents under a human seat route by this policy (spec 102 FR-011, OQ-9). An AI seat still resolves every kind to `auto`.

> "Approve all" (operator, C-GATE ruling, 2026-11-11: approves spec 102 plan.md "C-GATE: frozen contract amendments" and OQ-1 to OQ-14 as recommended)

**Amendment (TASK-0199).** Amended 2026-11-11 (spec `specs/066-one-chat-stream`, plan.md "Frozen-contract amendments", row C-3; P-04, decision-0030).

> "Approve all" (operator, C-GATE ruling, 2026-11-11: approves C-1 to C-9 as written in spec 066 plan.md)

The first row of the decision-0016 commit-authority table (TASK-0188) is withdrawn.
`action.accept` plans the item's Intent as `confirmed` through `planIntent`, with `source:
"composer"` and the acceptor as actor. No commit-authority row applies.

The accept rule becomes, first failure wins:

1. The suggestion and its item exist, else `SUGGESTION_NOT_FOUND`.
2. The item is not stale (`suggestionState` is not `stale`), else `SUGGESTION_STALE`.
3. A `character` item: the proposer controls the item's character. A `party` item: the proposer controls a party member. Else `NOT_AUTHORIZED`.
4. Someone in scope can act, else `CHARACTER_UNABLE` (the `action.declare` rule).
5. `planIntent` decides the rest (`NOT_YOUR_TURN`, `INTENT_EXISTS`, and the others in spec 102).

A second 👍 on a confirmed item is `INTENT_EXISTS` (it was `ACTION_EXISTS`).

Dated note, 2026-11-11 (T043): the code stamps a `party` item with the first party member the acceptor controls. `ai:dm` `action.accept` is refused `NOT_AUTHORIZED` by `routeProposal` and by the permission matrix (humans only).
