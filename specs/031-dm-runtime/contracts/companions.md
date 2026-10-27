# Contract: AI companions and chronicle (jobs that act as their own actors)

Modules: `apps/server/src/dm/companion.ts` (purpose `dm.companion`),
`apps/server/src/dm/chronicle.ts` (purpose `dm.chronicle`). Both run in the DM worker as
their own job kinds ([turn-jobs.md](turn-jobs.md)). Neither is a pipeline node.

## Companions (AC #10)

A companion is a party member whose controller is `{ kind: "ai-companion", actor:
"ai:companion:<characterId>" }`. The proposer is `{ kind: "ai", actor:
"ai:companion:<characterId>" }`. It passes through the same permission matrix and commit
authority as a human player (`specs/029-proposal-gate/contracts/proposals.md`). Only server
code can build an AI proposer; no client input can name one.

### One companion's play

For each id in the job's `companions`, in order:

1. Fold the DM projections. Skip the companion if it is not in the party, or if its combatant
   is dead or unconscious.
   For `reason: "react"`, also skip the companion, with no model call, when none of its open
   actions carries a human comment newer than the companion's own last event on that action.
2. Call `dm.companion` with: the companion's seed portrayal and hooks, the party, the scene,
   the transcript tail, the table mode, whether it is the active actor, and the beat's
   committed actions (so it can agree or disagree).
3. Parse `CompanionOutput`. On `invalid-output`, record it and continue with the next id.
4. Submit, in order, through `gate.submit` with the companion proposer:
   1. `talk` (channel `ic`, `characterId` = the companion) when `say` is set;
   2. `action.comment` when `comment` is set (stance `approve` or `object`, to a named open
      action);
   3. `action.commit` for each of the companion's own open actions (see "Pending actions");
   4. `action.declare` when `act` is set, with a new action id `act-<companionId>-<n>`;
   5. `action.commit` for that action when `act.commit` is true.
5. Record each gate result in the job's `result`. A refusal (for example
   `COMMIT_NOT_ALLOWED`) is recorded and does not fail the job.

```ts
export const CompanionOutput = z.object({
  say: z.string().min(1).max(400).nullable(),
  comment: z.object({ actionId: RefIdSchema, stance: z.enum(["approve", "object", "comment"]),
    text: z.string().min(1).max(400) }).nullable(),
  act: z.object({ text: z.string().min(1).max(400), commit: z.boolean() }).nullable(),
  pending: z.array(z.object({ actionId: RefIdSchema, decision: z.literal("commit"),
    text: z.string().min(1).max(400).nullable() })).max(4),
});
```

Rules:

- A companion declares only `character`-scope actions for itself. Party-scope actions belong
  to the human (commit authority `group`).
- In turn mode, the active companion MUST act: `act` non-null with `commit: true`. A null
  `act` in that case is replaced by code with "holds position and watches for an opening"
  (no mechanics), committed, so the turn advances.
- In free mode, any field may be null.
- Doctrine for companions ([doctrine.md](doctrine.md)): about one unprompted opinion per
  scene; sometimes disagree; never speak or act for the human's character.

Amended by specs/034-narration-quality/contracts/player-facing-context.md.

### Pending actions

Every companion run (reasons `hold`, `turn`, `prompt` and `react`) shows the model the
companion's own open actions (status `declared` or `discussed`), each with its comments and
stances, apart from other players' open actions. The model returns one `pending` entry per own
open action. The decision is `commit`.

- Code applies the default decision, `commit`, to an own open action that `pending` leaves
  unaddressed, and to every own open action when the output is invalid. The run's play status
  is then `invalid-output`.
- `commit` submits `action.commit` for the existing action id. The run declares no new action
  while it started with an own open action: a non-null `act` is dropped and logged as
  `dm.companion.act-dropped`.
- In turn mode, only the active companion's commit is submitted (authority `active-player`).
  A non-active companion's commit is not submitted, and the action stays open for its turn.
  The active companion with an own open action commits it instead of declaring the hold act.
- `PROMPT_VERSION` is `dm.companion-v3`.

Amended by specs/036-companion-react.

### Trigger: reason `react`

A human `action.commented` row (any stance) on an open action whose actor is
`ai:companion:<id>` queues a `react` companion job naming that companion. Comments by `ai:dm`
and by companions queue none. One queued `react` job exists per session: a further reaction
merges its companion id into the queued job and moves its start time to
"now plus a quiet window", capped at "first reaction plus a maximum wait" (defaults 3 s and
10 s, injectable). A reaction that arrives while a `react` job runs queues one new `react` job.
The worker claims the job only after its start time ([turn-jobs.md](turn-jobs.md)).

Amended by specs/036-companion-react.

### Ending

- `reason: "hold"` → `enqueueTurnForced(sessionId)` so the held beat resolves next.
- `reason: "turn"` → nothing more; the commit already enqueued the next turn job.
- `reason: "prompt"` → nothing more.
- `reason: "react"` → nothing more; the companion's commit already enqueued the next turn job.

Amended by specs/036-companion-react.

## Chronicle (AC #12)

Runs only when no turn or companion job of a higher priority is claimable. No turn job
waits for it.

1. Fold the DM projections. Find the last journal entry whose id starts with `chron-`; its
   `sourceActionIds` and seq bound what is already chronicled.
2. Collect the transcript after that point, up to `throughSeq`. If it holds no narration,
   finish with `{ entries: 0 }`.
3. Call `dm.chronicle` with the collected transcript, the scene goal, and the trackers'
   names (never their notes).
4. Parse `ChronicleOutput`; submit each entry as a `journal` proposal with entry id
   `chron-<sessionShort>-<seq>`, the entry's visibility, and its `sourceActionIds`.

```ts
export const ChronicleOutput = z.object({
  entries: z.array(z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(1200),
    sourceActionIds: z.array(RefIdSchema).max(50),
    visibility: z.enum(["public", "dm"]),
  })).max(3),
});
```

Doctrine: one journal line at every scene change; name new people and places once; hidden
facts go to `dm` entries.

Amended by specs/034-narration-quality/contracts/player-facing-context.md.
