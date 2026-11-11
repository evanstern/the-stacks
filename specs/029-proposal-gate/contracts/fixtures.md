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
| `group-signoff` | AI seat; Ana and Cleo (players) and Bram (companion) join; Ana declares party action P1; Cleo objects, then approves; the approval row is followed by a `presence.recorded` marker (`signoff`, `[Ana, Cleo]`, P1) and `action.committed` (`group`, actor Cleo); Ana declares party action P2; Cleo objects; `ai:dm` commits P2 (`dm`) | P1 `committed.authority` is `group`, P2 is `dm`; the marker names both players and P1; `commitAuthority` for Ana on P2 with both present returns `GROUP_SIGNOFF_REQUIRED` with `objecting: [Cleo]` |
| `turn-floor` | AI seat; Ana and Bram (players) and Pip (companion) fight a goblin; `table-mode.changed` free → turn; Ana ends her turn (`floor` request: `turn.advance` batch then `table-mode.changed`); Bram declares and commits (`active-player`), resolve advances; Pip ends her turn; the goblin's turn closes round 1; round 2: `dm.seat.changed` to a human DM, the DM takes and returns the floor, the seat returns to the AI; `ai:dm` passes Ana's turn as absent (`presence.recorded` `floor` marker `[Bram]`, then the batch); Bram declares party action `act-party`; `ai:dm` commits it with the stall override (`presence.recorded` `signoff` `[Ana, Bram]`, then `action.committed` `dm`) | `table-mode.changed` holders: Ana, Bram, Pip, `ai:dm`, Ana, the DM, Ana, Bram; `encounter.round` is 2; Bram's commit is `active-player`; the `floor` marker names only Bram and precedes the row whose `before.activeActor` is Ana; the `signoff` marker is the row directly before the stall commit |

> **Amendment (TASK-0049).** The `group-signoff` row is added by the 2026-10-27 operator
> ruling ("I accept the defaults on the TASK-0099 and TASK-0049 cards, including the
> frozen-contract amendments to spec 029 and spec 006"). The fixtures list has eight entries.

Amended 2026-10-27 (TASK-0050, operator ruling FT-4): the `turn-floor` row above. The fixtures
list has nine entries. The fixture uses the human DM seat for one `take`/`return` pair, so it
carries two `dm.seat.changed` rows.

> "TASK-0050: I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the
> frozen-contract amendments to 029, 031 and 044 and the one jobs migration."

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
4. The SC-006 replay check (policy-and-authority.md) holds for every fixture. For each
   `action.committed`, `present` is the `present` of the latest `presence.recorded` row with
   purpose `signoff` and the same `actionId` before the commit, or omitted when none exists
   (Amendment TASK-0049).
   Amended 2026-10-27 (TASK-0050, operator ruling FT-4), two more checks. For a `dm`
   `action.committed` directly preceded by a `signoff` marker, `signoffState` against the
   marker's `present`, folded before the marker, has empty `objecting`. For a `floor` marker,
   the next `table-mode.changed` row has a `before.activeActor` absent from the marker's
   `present`.

Amended 2026-11-11 (TASK-0268, C-GATE ruling "Approve all"): `proposalExamples` holds one example per kind, 16 in code, and gains an `intent` example (a confirmed `attack`). The fixture test is total over kinds.

> "Approve all" (operator, C-GATE ruling, 2026-11-11: approves spec 102 plan.md "C-GATE: frozen contract amendments" and OQ-1 to OQ-14 as recommended)
