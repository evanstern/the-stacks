# Contract: proposal fixtures (for TASK-0047 and the gate's tests)

Extends `specs/028-session-model/contracts/fixtures.md`. Same location
(`packages/session-model/src/fixtures/`), same import subpath
(`@the-stacks/session-model/fixtures`), same conventions (fixed UUIDs, fixed timestamps,
original characters, SRD-generic monsters, no book text). Adding a fixture is not a contract
change; changing the events or facts below is.

## Added identity

| Name | Value | Role |
|---|---|---|
| `dmUserId` | `00000000-0000-4000-8000-000000000003` | a human operator seated as DM |

`fixtureIds` gains `dmUserId`. Every existing identity is unchanged.

## Changed fixture: `unknown-and-invalid`

Its last row (`proposal.created`, payload `{ proposalId: "prop-1" }`) would now decode as an
invalid catalogued type and change the counters. Retype that row to `x-test.future-type`
(an id the catalog will never use) with the same payload. Update its `description` ("a future
proposal type" becomes "a future type"). Every listed fact stays: `skippedUnknownType` 2,
`skippedUnknownVersion` 1, `skippedInvalid` 2, `outOfOrder` 1.

## New fixtures

| Name | Exercises | Facts a test asserts |
|---|---|---|
| `dm-approvals` | `dm.seat.changed` AI → human (`dmUserId`, actor `dmUserId`); `scene.changed` and two party joins (Ana: player; Bram: companion), all by `dmUserId` (direct); `gate.policy.changed` (`journal`: auto → ask) by `dmUserId`; Ana declares and commits a lockpick in free mode (`declarer`); P1 `mechanics` `check.roll` proposal from `ai:dm` (`ask`) then `proposal.approved` by `dmUserId` landing **after** the `check.roll` batch (consecutive seqs, envelopes carry `proposalId` P1); `action.resolved` (`applied`) by `ai:dm`; P2 `narration` (`ask`) then `proposal.rejected` with a reason; P3 `scene` (`suggest`), left pending; P4 `tracker` create (`ask`), left pending; P5 `table-mode` free → turn (`ask`), left pending | DM viewer: `proposals` has P1–P5 in that order with statuses approved, rejected, pending, pending, pending and policies ask, ask, suggest, ask, ask; `pendingProposals` returns P3, P4, P5; `gate.seat` is the human DM; `gate.policyOverrides` is `{ journal: "ask" }`; `trackers` is `[]` (P4 is only proposed). Each player viewer: `proposals` is `[]`; serialized projections contain none of P1–P5's ids and none of P4's tracker name; the ledger holds the approved roll |
| `commit-authority` | AI seat; Ana (player) and Bram (companion) join; free mode: Ana declares A1 (character), Bram declares B1 (character), Ana declares a party action P1 (party), Bram comments `approve` on P1; `table-mode.changed` free → turn with `activeActor` Bram; Ana declares A2 | The table below |

`commit-authority` facts: `commitAuthority(dmFold, { actor }, actionId)` at the end of the
stream (turn mode, Bram active):

| Actor | Action | Result |
|---|---|---|
| `playerUserId` | A1 | `COMMIT_NOT_ALLOWED` (turn mode, not active) |
| `ai:companion:bram` | B1 | `active-player` |
| `ai:companion:bram` | A2 | `COMMIT_NOT_ALLOWED` (does not control Ana) |
| `playerUserId` | P1 | `group` (one human in the party) |
| `ai:companion:bram` | P1 | `COMMIT_NOT_ALLOWED` (companions do not commit party actions) |
| `ai:dm` | A2 | `dm` |
| `otherPlayerUserId` | A1 | `COMMIT_NOT_ALLOWED` (not a controller) |

The same fixture folded through the event before the mode change (free mode) gives
`playerUserId` / A1 → `declarer` and `ai:companion:bram` / A1 → `COMMIT_NOT_ALLOWED`. The
fixtures test asserts both tables.

## Example proposals

```ts
export const proposalExamples: Readonly<Record<ProposalKind, Proposal>>;
```

One valid proposal per kind, each with a `summary` and, for DM kinds, a `rationale`, written
against the `free-mode-action` fixture's ids (Ana, Bram, the vault scene). The `mechanics`
example is a `check.roll` with DC 15. A test asserts every example parses with
`ProposalSchema` and that every key equals its proposal's `kind`. TASK-0047 renders each
kind's body in the approval panel from these.

## Guarantees (each has a test)

1. Every event in `dm-approvals` and `commit-authority` decodes as `known`.
2. Every `dm-approvals` mechanics batch regenerates from its recipe through `execute` with
   scripted dice (028 guarantee 3), recipes added to `recipes.ts`.
3. Re-planning P1 with `planProposal` against the DM fold just before its approval, with the
   recipe's faces and the fixture's batch id, yields exactly the fixture's batch rows and
   `proposal.approved` row payloads.
4. The SC-006 replay check (policy-and-authority.md) holds for every fixture.
