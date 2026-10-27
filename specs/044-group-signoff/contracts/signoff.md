# Contract: group sign-off (TASK-0049)

Package: `@the-stacks/session-model` (`src/gate/signoff.ts`, `src/gate/authority.ts`,
`src/gate/plan.ts`), exported from the main entry. Binding for the server gate, the play
route and TASK-0050 (which reuses `PlanContext`). Rulings: TASK-0049, 2026-10-27 (all
defaults). Amends `specs/029-proposal-gate/contracts/policy-and-authority.md` step 4 and
`gate-api.md` §1–§3.

## The rule

```ts
export type SignoffStance = "approve" | "object" | "waiting";

export interface SignoffRow {
  userId: string;          // a human who controls at least one party member
  present: boolean;        // in the quorum's present set
  stance: SignoffStance;   // latest approve/object; the declarer defaults to approve
}

export interface SignoffState {
  rows: SignoffRow[];      // every party human, sorted by userId
  quorum: string[];        // userIds of rows with present: true, sorted
  waiting: string[];       // quorum members with stance "waiting", sorted
  objecting: string[];     // quorum members with stance "object", sorted
  met: boolean;            // quorum non-empty and every quorum member approves
}

/**
 * Pure over public projection data. `present` is the present set (user ids); `actingUserId`,
 * when given, is added to it and counted as approving (FR-015, FR-016).
 * Returns null for an unknown or character-scope action.
 */
export function signoffState(
  p: SessionProjections,
  actionId: string,
  present: readonly string[],
  actingUserId?: string,
): SignoffState | null;
```

Stance per human: the latest `action.commented` row by that user on the action with stance
`approve` or `object`; a `comment` stance changes nothing. With no such row, the declarer
(the `action.declared` row actor) is `approve` and everyone else is `waiting`. AI companions
and non-party users never appear in `rows`.

## Commit authority

```ts
export type CommitDecision =
  | { ok: true; authority: ActionAuthority }
  | { ok: false; code: "UNKNOWN_ACTION" | "ACTION_NOT_OPEN" | "COMMIT_NOT_ALLOWED" }
  | { ok: false; code: "GROUP_SIGNOFF_REQUIRED"; waiting: string[]; objecting: string[] };

export function commitAuthority(
  p: SessionProjections, committer: Proposer | { actor: string }, actionId: string,
  present?: readonly string[],
): CommitDecision;
```

Step 4 (party scope), replacing 029's text:

- The committer is not a party human → `COMMIT_NOT_ALLOWED` (unchanged).
- One party human → `group` (unchanged; FR-014).
- More than one, `present` omitted → `GROUP_SIGNOFF_REQUIRED` with `waiting` = every other
  party human and `objecting` = `[]` (today's behaviour, now with details).
- More than one, `present` given → `signoffState(p, actionId, present, committer)`; `met` →
  `group`, else `GROUP_SIGNOFF_REQUIRED` with its `waiting` and `objecting`.

Steps 1–3 and 5 are unchanged: the DM always commits with `dm`.

## The planner

```ts
export interface PlanContext { present?: readonly string[] }

export function planProposal(
  p, proposer, proposal, rng, ids, proposalId, context?: PlanContext,
): PlanResult;
```

| Request | Condition | Rows |
|---|---|---|
| `action.commit` | authority `group`, more than one party human | `presence.recorded` (signoff), `action.committed` |
| `action.commit` | any other authority, or one party human | `action.committed` (unchanged) |
| `action.comment` | stance `approve`, proposer a party human, more than one party human, open party action, `signoffState(p′, …, present, proposer).met` where `p′` folds the comment | `action.commented`, `presence.recorded` (signoff), `action.committed` (`group`, actor = proposer) |
| `action.comment` | otherwise | `action.commented` (unchanged) |

The marker row: actor `system`, visibility `public`, payload
`{ present: sorted unique (context.present ∪ {committer}), purpose: "signoff", actionId }`.
A `GROUP_SIGNOFF_REQUIRED` refusal carries `details: { waiting, objecting }`.

## The server gate

`createGate` passes `{ present: presence.presentUsers(sessionId).map((e) => e.userId) }` to
every `planProposal` call. `submit`, `handle` and `recordPresence` keep their signatures.

## Replay (SC-006, amended)

For every `action.committed` in every fixture, `commitAuthority(before, { actor }, actionId,
present)` returns the recorded authority, where `present` is the `present` of the latest
`presence.recorded` row with purpose `signoff` and that `actionId` before the commit, or
omitted when none exists.

## Client

`apps/web/app/play/signoff.ts` maps `signoffState` to display rows
`{ userId, label, state: "approved" | "objects" | "waiting" | "absent", isViewer }`.
A non-present party human is `absent`. When the live present set is unknown (`null`), every
row is shown present. No modal: rows render inside the action card.

## Note: the AI DM's stall override (spec 049)

Amended 2026-10-27 (TASK-0050, operator ruling FT-5):

> "TASK-0050: I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the
> frozen-contract amendments to 029, 031 and 044 and the one jobs migration."

Spec 049 adds `override: "stall"` to `action.commit` for `ai:dm`. It commits a party action with
authority `dm` when no present quorum member objects, and writes a `signoff` marker first. The
rule "a `dm` commit writes no marker" (FR-008) has this one exception. `signoffState` is
unchanged. See `specs/049-turn-floor/contracts/floor-request.md`.
