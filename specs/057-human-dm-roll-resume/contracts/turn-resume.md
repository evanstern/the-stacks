# Contract: a turn resumes a paused action plan

Amends `specs/031-dm-runtime/contracts/resolve.md` ("Outcomes by gate result", the paragraph after
the table) and `specs/031-dm-runtime/contracts/nodes.md` ("interpret", the `priorSteps` sentence).
Changes no frozen contract: no `specs/029-proposal-gate/contracts/` file, no
`specs/030-play-route/contracts/proposal-seam.md`, no ws-protocol frame shape, no event or
proposal schema.

## Replaces (resolve.md)

> An `awaiting-dm` action stays `committed`. `proposal.approved` and `proposal.rejected`
> enqueue a turn job. That job's interpret sees the applied batches in `priorSteps` and plans
> only what remains.

## With

An `awaiting-dm` action stays `committed`. `proposal.approved` and `proposal.rejected` enqueue a
turn job ([turn-jobs.md](../../031-dm-runtime/contracts/turn-jobs.md)). Every turn classifies each
committed beat candidate at assemble:

| Class | Rule | Effect |
|---|---|---|
| awaiting | a pending `ai:dm` proposal of kind `mechanics`, `scene-presence` or `action.resolve` names the action | left out of the beat |
| resumable | the latest earlier turn job holding a submission keyed `act:<actionId>:` ends that action's submissions with a `pending` or `suggested` one, and its proposal is now `approved` | resumed from that job's plan |
| fresh | anything else (no record, a rejected proposal, a finished chain) | interpreted as before; `priorSteps` and `REJECTION_LIMIT` unchanged |

## The resumed plan

```ts
interface ResumedPlan {
  actionId: string;
  fromJobId: string;            // the job whose checkpoint holds the plan
  reading: InterpretReading;    // that job's reading for the action
  ruling: Ruling | null;        // that job's ruling for the action, if any
  submissions: Submission[];    // that job's submissions whose key starts `act:<actionId>:`
}
```

- `TurnCheckpoint` gains `resumed?: ResumedPlan[] | null`. The runner writes it with the beat on
  the first attempt. A later attempt reads it and does not search again. A stored row without the
  field reads as `[]`.
- Interpret asks only about fresh beat items (and the monster turn). With none, it makes no call.
  Its output holds the resumed readings, merged in beat order.
- Adjudicate rules only on fresh readings. Its output holds the resumed rulings. The runner's
  "needs adjudication" test ignores resumed readings.
- Resolve rewrites each resumed submission whose proposal is `approved` as `result: "applied"`,
  `batchId` = the proposal view's `decided.batchId`, `outcome` = the `check.resolved` or
  `attack.resolved` outcome in that batch (else null), `seqs: []`. `stepRef` is kept. Resolve adds
  each resumed submission whose key its run does not hold yet. A recorded key replays; the chain
  continues from the engine outcome; `action.resolve` carries every batch of the chain.

## Unchanged

The fixed node order, the policy table, the gate, narrate, audit, facts and the claim gate. Under
an AI seat no action is awaiting or resumable.
