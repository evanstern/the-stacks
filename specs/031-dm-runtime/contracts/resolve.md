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
}
```

## Order of work

Resolve runs these groups in order. Each group is a list of submissions.

1. **Director group** ([director.md](director.md)): scene, party and combatants (scene
   start), trackers, table mode and encounter setup, scene end.
2. **Ruling group**: one `journal` proposal per ruling, visibility `dm`, entry id
   `ruling-<jobId>-<n>`, `sourceActionIds: [actionId]`.
3. **Action groups**, one per beat item in commit `seq` order (AC #9). Skip items with
   status `resolved` (they need narration only).
4. **NPC group** for an `npc-turn` trigger.
5. **Turn advance group** in turn mode, after the active actor's action or the NPC turn
   resolved: `mechanics` `turn.advance`, then `table-mode` with the next active actor.

In hold mode (runner step 2.7), resolve runs the Director group only.

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

The gate itself has no idempotency key. This contract adds none.

## Proposal kinds resolve uses

| Kind | When |
|---|---|
| `scene`, `party`, `tracker`, `table-mode` | Director group |
| `mechanics` | combatants, initiative, encounter end, every step, turn advance |
| `journal` | rulings; the audit flag ([audit.md](audit.md)) |
| `action.resolve` | each beat item |
| `narration` | `submitNarration`, after audit ([audit.md](audit.md)) |
| `talk` | the failure notice (FR-012), visibility `dm`, channel `ooc` |

Every proposal uses the `ai:dm` proposer, `summary` (one line for a human DM's panel) and
`rationale` (the node's reason), so a human seat sees why.
