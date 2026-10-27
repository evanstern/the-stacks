# Contract: resolve (proposals, steps, branching, idempotence)

Module: `apps/server/src/dm/nodes/resolve.ts`. It is the only runtime module that calls
`gate.submit` for the AI DM (AC #5). Companion and chronicle jobs call the gate as their own
actors ([companions.md](companions.md), [turn-jobs.md](turn-jobs.md)). Gate API:
`specs/029-proposal-gate/contracts/gate-api.md`.

## Output

```ts
export interface ResolveOutput {
  submissions: Submission[];          // every gate call, in order
  actionResults: { actionId: string; outcome: "applied" | "refused" | "no-effect" | "awaiting-dm";
                   batchIds: string[]; refusalCode: string | null }[];
  appendedRows: StoredEvent[];        // rows the gate appended for this turn (applied results)
  nextJob: { kind: "turn"; trigger: "npc-turn" } | { kind: "companion"; companions: string[]; reason: "turn" | "prompt" } | null;
  chronicle: boolean;                 // true when narration will apply (set after narration ships)
}

export interface Submission {
  stepRef: string;                    // "<jobId>#<n>", n counts submissions in this job
  kind: ProposalKind;
  result: "applied" | "pending" | "suggested" | "refused";
  refusal: GateRefusal | null;
  batchId: string | null;
  proposalId: string | null;
  seqs: number[];                     // TASK-0116: seqs the gate returned, ascending; [] on a refusal
}
```

## Order of work

Resolve runs these groups in order. Each group is a list of submissions. The order is stated in
[turn-jobs.md](turn-jobs.md) "Resolve order (decision-0025 §4)".

0. **Plan gate** (pure, runs once before any write). `checkPlan` tests every actor and target id of
   every action group and the NPC group against the S0 actors' `combatantId`s plus the ids the
   turn's encounter start adds. A refused action group submits `action.resolve` `refused`
   `UNKNOWN_COMBATANT` and runs no step. A refused NPC group runs no step; the turn still
   advances. The verdicts go to `TurnCheckpoint.planGate`.
1. **Opening moves** ([director.md](director.md)): scene, party, combatants and trackers (scene
   start); the `turn` decision's combatants, initiative and turn mode.
2. **Ruling group**: one `journal` proposal per ruling, visibility `dm`, entry id
   `ruling-<jobId>-<n>`, `sourceActionIds: [actionId]`.
3. **Action groups**, one per beat item in commit `seq` order (AC #9). Skip items with
   status `resolved` (they need narration only).
4. **NPC group** for an `npc-turn` trigger.
5. **Closing moves** ([director.md](director.md)): tracker advances, the `free` decision, scene
   end. The batch gate (TASK-0147) will run after this group; the slot is empty.
6. **Turn advance group** in turn mode, after the active actor's action or the NPC turn
   resolved: `mechanics` `turn.advance`, then `table-mode` with the next active actor. It runs
   only while the encounter is active and the mode is still turn.

In hold mode (runner step 2.7), resolve runs the opening moves, then the closing moves.

## Action group

For one beat item with its reading (or ruling, which replaces the reading's steps):

1. `clarify` set → submit `action.resolve` `no-effect`. Record the question for narrate.
2. `steps` is `[{ step: "none" }]` → submit `action.resolve` `no-effect`.
3. Otherwise run each step:
   - `check` → `mechanics` `check.roll` with `actionId`. When the batch applies, read the
     `check.resolved` event. Run `onSuccess` or `onFailure` effects, each as one `mechanics`
     command (`damage.apply`, `healing.apply`, `condition.apply`, `condition.remove`).
   - `attack` → `mechanics` `attack.roll`. On `hit` or `critical-hit`, run `onHit` effects;
     a damage effect sets `critical: true` exactly when the outcome is `critical-hit`. On
     `miss`, run nothing.
   - `effect` → each effect as one `mechanics` command.
   - `roll` → `mechanics` `roll`.
4. Then submit `action.resolve`:
   - `applied` with every applied `batchId`, when at least one batch applied;
   - `refused` with the engine's code, when the first mechanics step was refused by the
     engine (`source: "engine"`) and nothing applied;
   - `no-effect` otherwise.

Command `reason` strings carry the step text plus the marker ` [<stepRef>]` (R5). The marker
fits inside the engine's 500-character reason; resolve truncates the step text first.

## Outcomes by gate result

| Gate result | Effect on the action |
|---|---|
| `applied` | continue the chain |
| `refused`, source `engine` | stop the chain; resolve the action `refused` (or `applied` if earlier steps applied) |
| `refused`, code `CONFLICT` | resubmit up to 2 more times, 200 ms then 800 ms apart; then fail the node with kind `gate` |
| `refused`, other gate or append code | fail the node with kind `gate` (a planner bug or a stale reading) |
| `pending` / `suggested` (human seat) | stop the chain; no `action.resolve`; record `awaiting-dm` |

An `awaiting-dm` action stays `committed`. `proposal.approved` and `proposal.rejected`
enqueue a turn job ([turn-jobs.md](turn-jobs.md)). That job's interpret sees the applied
batches in `priorSteps` and plans only what remains.

## Idempotence on reclaim (FR-006)

1. Before each submission, resolve checks the fence. On `false` it returns `fenced`.
2. After each submission, resolve saves the checkpoint (fenced) with the submission record.
3. On a later attempt, resolve replays the recorded submissions instead of resubmitting
   them, then continues.
4. For the one submission that may have landed after the last checkpoint save, resolve
   looks for its marker: a ledger row whose `reason` ends with ` [<stepRef>]`, or (for
   non-ledger kinds) an `ai:dm` row of the expected type after the checkpoint's `lastSeq`.
   When found, it records the submission as applied and continues.
5. The narration row carries no marker. On a reclaim the runner looks for an `ai:dm` narration row
   after the highest of resolve's `lastSeq`, the checkpoint's `lastSeq` and the trigger seq. When it
   finds one, narrate and audit do not run and `submitNarration` ships nothing.

The gate itself has no idempotency key. This contract adds none.

## Proposal kinds resolve uses

| Kind | When |
|---|---|
| `scene`, `party`, `tracker`, `table-mode` | opening moves and closing moves |
| `mechanics` | combatants, initiative, encounter end, every step, turn advance |
| `journal` | rulings; the audit flag ([audit.md](audit.md)) |
| `action.resolve` | each beat item |
| `narration` | `submitNarration`, after audit ([audit.md](audit.md)) |
| `talk` | the failure notice (FR-012), visibility `dm`, channel `ooc` |

Every proposal uses the `ai:dm` proposer, `summary` (one line for a human DM's panel) and
`rationale` (the node's reason), so a human seat sees why.


`Submission.seqs` links a job to the events it wrote. `TurnCheckpoint.narration.seqs` holds the
shipped narration's seqs. A replayed checkpoint submission keeps its stored seqs. A submission
recovered by `findLanded` after a reclaim carries `seqs: []`: the rows exist, but the replay
cannot name them. Rows stored before TASK-0116 lack the field.
