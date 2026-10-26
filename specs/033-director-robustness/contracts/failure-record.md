# Contract: the turn failure record

Amends `specs/031-dm-runtime/contracts/turn-jobs.md` ("`jobs.result` for a turn job") and
`contracts/node-seam.md` ("Model calls"). Modules: `apps/server/src/dm/pipeline/call.ts`,
`apps/server/src/dm/worker.ts`, `apps/server/src/jobs/queue.ts`.

## `jobs` row of a failed turn job

| Column | Value |
|---|---|
| `status` | `failed` |
| `error` | `stopped at <node>: <kind>` — unchanged, fixed strings only |
| `result` | `TurnFailureResult` below (was `null`) |

```ts
interface TurnFailureResult {
  checkpoint: TurnCheckpoint;          // the last checkpoint the job saved
  outcome: { status: "failed" };
  audit: null;
  calls: ModelCallRecord[];            // every model call the failed run made
  failure: TurnFailure;
}

interface TurnFailure {
  node: NodeName;                      // the node that failed ("resolve" for a thrown turn)
  kind: NodeErrorKind | "seed";        // "seed" only for the bad-seed path below
  message: string;
  detail: Record<string, unknown> | null;
}
```

`fenced` and `aborted` failures leave the job for a reclaim and write nothing (unchanged).
The bad-seed path (`stopped at assemble: seed`) writes `failure: { node: "assemble", kind:
"seed", message: "the scene seed did not load", detail: null }` beside its fixed error string,
with the checkpoint it loaded and `calls: []`.

## `invalid-output` detail (built by `callJson`)

```ts
interface InvalidOutputDetail {
  purpose: DmPurpose;
  promptVersion: string;
  issues: string;                      // the last attempt's issues, at most 8 lines (unchanged)
  attempts: AttemptExcerpt[];          // one per attempt, in order
}

interface AttemptExcerpt {
  attempt: 1 | 2;
  outputTokens: number | null;         // from the attempt's `done` event; null when absent
  chars: number;                       // length of the full raw text
  issues: string;                      // this attempt's issues
  excerpt: string;                     // bounded raw text, rule below
}
```

**Excerpt rule.** Let `text` be the joined `text` events of the attempt, unmodified.

1. If `text.length <= 8000`, the excerpt is `text`.
2. Otherwise the excerpt is `text.slice(0, 6000)`, then `\n…[<n> characters elided]…\n`, then
   `text.slice(-2000)`, where `n = text.length - 8000`.

Export the rule as `excerptOf(text: string): string` from `call.ts`.

## `gateway` detail

Unchanged: `{ errorKind, purpose }`. No excerpt; a gateway error has no complete output.

## Where the record is visible

| Reader | Sees |
|---|---|
| Database (`jobs.result.failure`) | the whole record |
| `GET /dm/sessions/:id/turns` | unchanged item shape; `calls` is now filled for a failed turn; `failure` is NOT served |
| `dm.turn.failed` log line | `node`, `kind`, and `detail` without `attempts` |

The route and the log never carry model text.

## Tracker advance issue text

`DirectorOutput.trackers[].advance` keeps `.int().min(-3).max(3)` and the non-zero refine. The
refine gains the message `advance must be a non-zero integer from -3 to 3`. The rule itself is
unchanged.
