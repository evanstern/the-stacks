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

   *Amended by spec 079 (TASK-0208):* a party action group whose `attack` step names a foreign
   `attackerId`, or whose `move` step names a foreign `combatantId`, is refused whole with
   `STEP_ACTOR_MISMATCH` (failure reason `not-the-actor`) before any step runs. The actor is the
   action's character combatant; a party-scope action may name any party combatant. The NPC
   group and the monster turn are not checked. Spec 077's `askUndeclared` covers only another
   human's PC roll (a clarify), so it supplies no refusal code to reuse.

   *Amended by spec 068 (TASK-0194):* when an `ok` verdict carries `pull`, resolve pulls each
   id into the scene before that group's steps run: `combatant.add` from the NPC's SRD block
   (`identity.srdMonsterId`, default `commoner`), then `initiative.join` when an encounter is
   active, the actor can act and its presence is `present`. Pull rows carry `actionId: null`,
   so they never change the group's outcome. The NPC group pulls the same way.
   Amended by `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md` (spec 058 / TASK-0161):
   the plan gate also checks each step reason against S0 with `checkClaims`. A reason-refused action
   group submits `action.resolve` `refused` with the verdict's code and runs no step. A reason-refused
   NPC group runs no step; the turn still advances. `resolveAction` takes the refusal code from the
   verdict instead of the literal `UNKNOWN_COMBATANT`.
1. **Opening moves** ([director.md](director.md)): scene, party, combatants and trackers (scene
   start); the `turn` decision's combatants, initiative and turn mode. After initiative,
   **settling** runs for the first active combatant (group 6, "Settling").

   **Seed-presence group** (code only; `seedPresence` in `nodes/resolve.ts`). Amended 2026-10-27
   (TASK-0142, operator rulings OQ-2, OQ-3, OQ-4): "I accept the recommended defaults OQ-1 to
   OQ-6 (a)". The group is code-owned. It reads the seed and the projections only, never a
   Director field. Its submission keys start `seed:presence:<moment>:<npcId>`.
   - Scene start, after the trackers: one `scene-presence` proposal per NPC whose `beats[0]`
     value is not `present`. Reason `removed` (absent) or `conceded` (yielded), `actionId: null`,
     visibility `dm`. These rows never reach narration facts.
   - Encounter start, after the monsters' `combatant.add` and before `initiative.roll`: one
     `arrived` proposal per NPC the encounter's beat declares `present` whose logged value is not
     `present`. `actionId: null`, visibility `public`. No encounter is active yet, so the
     planner plans no `initiative.join`.
   - No other beat change writes presence. A later arrival is a presence effect (spec 048).
   - A NPC whose logged value already equals the target gets no proposal. A reclaim replays
     recorded submissions by key, and `findLanded` covers a row that landed before its checkpoint.
2. **Ruling group**: one `journal` proposal per ruling, visibility `dm`, entry id
   `ruling-<jobId>-<n>`, `sourceActionIds: [actionId]`.
3. **Action groups**, one per beat item in commit `seq` order (AC #9). Skip items with
   status `resolved` (they need narration only).
4. **NPC group** for an `npc-turn` trigger.
5. **Closing moves** ([director.md](director.md)): tracker advances, the `free` decision, scene
   end. The batch gate (TASK-0147) will run after this group; the slot is empty.
6. **Turn advance group** in turn mode, after the active actor's action or the NPC turn
   resolved: `mechanics` `turn.advance`, then settling, then `table-mode` with the next active
   actor. It runs only while the encounter is active and the mode is still turn. A reclaim whose
   checkpoint holds the `advance` submission runs the group again, so the settling and the mode
   row still land.

   Amended 2026-10-27 (TASK-0141, operator ruling OQ-2): when the combatant active at the start
   of the turn left the order (`initiative.leave` already handed the turn on), resolve skips its
   own `turn.advance`. Settling and the `table-mode` row still run.

   Amended by spec 073 (TASK-0209): a human's clarify (committed, actor not `ai:`, reading
   `clarify` set, no ruling names it) does not count as the active actor's resolved action. The
   group does not run for it, and the floor stays with the active actor.

   Amended 2026-10-27 (TASK-0050, operator rulings FT-1, FT-3, Q6): the two skips are one "turn
   moved" guard. Resolve records the turn at assemble (`{ round, activeCombatantId }`) and
   compares it with a fresh projection:
   - the active combatant left the order (spec 048): skip `turn.advance`; settle; set the mode;
   - the turn moved otherwise (a `floor` batch): skip the advance, the settling and the mode
     row, because the floor batch wrote them. A reclaim whose checkpoint holds the `advance`
     submission is not "moved": it runs the group again as before;
   - the seated human DM holds the floor (`floorHeld`): skip the whole group.

   `activeActorFor`, `canAct` and `nextSettleStep` come from `@the-stacks/session-model`; the
   gate's `floor` planner and resolve share them. Submission keys are unchanged.

   **Settling** (code only; `settleTurn` in `nodes/settle.ts`). Amended 2026-10-27 (TASK-0112,
   operator ruling). Settling runs in the turn advance group and at the encounter start. It
   repeats while the active combatant cannot act (not `conscious`, or holding an incapacitating
   condition):
   - An `unconscious` combatant with `zeroHpRule: death-saves` gets one engine `death-save.roll`
     (`mode: normal`), submission key `settle:<n>:save`. A natural 20 returns it to 1 HP,
     conscious. Settling then stops and the combatant keeps the turn.
   - Otherwise (stable, dead, monster or NPC, incapacitating condition) no roll is made.
   - The turn passes with `turn.advance`, submission key `settle:<n>:advance`.
   - The loop runs at most once around the initiative order (one lap), then stops.
   - A `table-mode` row for the actor it stops on follows (`advance:table-mode`, or
     `director:table-mode` at the encounter start). `nextJob` keeps its rule over that mode.

In hold mode (runner step 2.7), resolve runs the opening moves, then the closing moves.

## Action group

For one beat item with its reading (or ruling, which replaces the reading's steps):

1. `clarify` set → submit `action.resolve` `no-effect`. Record the question for narrate.
   Amended by spec 073 (TASK-0209): the resolve is `no-effect`, and a human's clarify holds the
   turn advance (see the Turn advance group).
2. `steps` is `[{ step: "none" }]` → submit `action.resolve` `no-effect`.
3. Otherwise run each step:
   - `check` → `mechanics` `check.roll` with `actionId`. When the batch applies, read the
     `check.resolved` event. Run `onSuccess` or `onFailure` effects, each as one `mechanics`
     command (`damage.apply`, `healing.apply`, `condition.apply`, `condition.remove`).
     Amended by specs/070-stakes-before-dice: the effects follow the band (see the amendment below).
   - `attack` → `mechanics` `attack.roll`. On `hit` or `critical-hit`, run `onHit` effects;
     a damage effect sets `critical: true` exactly when the outcome is `critical-hit`. On
     `miss`, run nothing.
   - `effect` → each effect as one `mechanics` command.

   Amended 2026-10-27 (TASK-0141, operator ruling OQ-2, "... OQ-2 (a)"). A presence effect
   `{ effect: "presence", targetId, reason }` may stand in an `effect` step and in `onSuccess`,
   `onFailure` and `onHit`. Resolve submits it as a `scene-presence` proposal (`actorId:
   targetId`, `reason`, `actionId`) as `ai:dm`, in effect order, and records the result as any
   effect. The gate's policy for the kind is `ask`. The plan gate refuses an `absent` actor id with
   `UNKNOWN_COMBATANT` (reason `absent`), except an `arrived` presence effect.
   - `roll` → `mechanics` `roll`.
   - `move` → Amended by spec 079 (TASK-0208). The step submits nothing itself. For each
     `leavesReachOf` id that is an unspent, able encounter monster, resolve submits a
     `mechanics` `attack.roll` with `reaction: true` (attacker the hostile, target the mover,
     `attack` the hostile's first melee entry in its engine stats), then `damage.apply` on a hit
     with the entry's damage (critical on `critical-hit`). Amended by
     specs/082-engine-derived-numbers. The reaction batches join the action's `batchIds`.
     A refusal of a reaction does not stop the mover's chain; a pending proposal pauses it.
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

Amended by specs/057-human-dm-roll-resume/contracts/turn-resume.md.

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
| `scene-presence` | each presence effect (TASK-0141); the seed-presence group (TASK-0142) |
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

## Amendment 2026-11-02 (specs/070-stakes-before-dice, TASK-0127): resolve by band

Amended by specs/070-stakes-before-dice. A `check` step sends `houseRules` from the seed's
`tableRules` and the stakes ride the `Submission`. Resolve reads `band` from the `check.resolved`
row (`findLanded` and `refreshSubmission` read it too) and runs `effectsForBand` (`stakes.ts`):
`success` runs `onSuccess`; `success-at-cost` runs `onSuccess` then `onCost`; `severe-failure` runs
`onFailure` then `onSevere`; any other or missing band runs `onFailure`. A free retry sends
`autoSuccess`: an ability check with a combatant, no `newRisk`, no `autoFail`, and an earlier failed
ability check in the current scene's ledger with the same combatant, ability and skill (`isFreeRetry`).
A saving throw is never a free retry. A presence effect in `onCost` or `onSevere` counts as a
presence target.

## Amendment 2026-11-03 (specs/080-declared-outcome, TASK-0170): applied outcome and revealed clue

Amended by specs/080-declared-outcome. A `Submission` gains optional `reveals` (the step's clue
reference, else null) and `revealedText` (`clueFor(seed, reveals)`: the seed clue text, null when
none or unknown; an unknown reference logs `dm.reveals.unknown`). Both are checkpointed and never
in a public row; an older checkpoint lacks them. `consequenceFor` now returns `stakes.success` for
the `success` band and falls back from a null `severe` to `failure`. No effect or band logic changes.

## Amended by specs/082-engine-derived-numbers (TASK-0104)

- `check` submits `check.roll` with `difficulty` and `mode` (`circumstance.mode` or `normal`), and
  no `expression` or `dc`. Everything else spec 070 and 080 added stays.
- `attack` submits `attack.roll` with `attack` and `mode`, and no `expression` or `targetAc`. On
  `hit` or `critical-hit` resolve reads the attacker's entry from the fresh projections and submits
  `damage.apply` at key `<key>:dmg` with the entry's components and `critical`. `onHit` effects
  follow.
- `checkPlan` receives the engine combatants. A step the stats cannot derive refuses its group with
  `STAT_UNDEFINED` before any step runs.
