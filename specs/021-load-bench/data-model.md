# Data model: Load and stress benchmark

No database schema change and no migration. The bench reads the existing `jobs`,
`library_documents`, `users`, and `auth_sessions` tables in its own load database. Every entity
below is a Zod schema in `apps/server/src/bench/load/`.

## Tier

`"commit" | "demand" | "dev"`. One per case, fixed in the registry (research R10).

## Case (registry entry, `cases.ts`)

| Field | Type | Rule |
|---|---|---|
| `id` | string | kebab-case, unique |
| `tier` | Tier | exactly one |
| `target` | `"local" \| "dev"` | `dev` only for tier `dev` |
| `summary` | string | one line, printed in skip lines and `list` |
| `run` | `(ctx, profile) => Promise<CaseOutcome>` | never throws for an expected failure; returns `status: "fail"` |

## Profile (`apps/server/bench/load/profiles/<tier>.json`)

```ts
const ProfileSchema = z.object({
  tier: TierSchema,
  ingest: z.object({
    volumes: z.array(z.number().int().positive()).min(2),   // cumulative steps, ascending
    workers: z.array(z.number().int().min(1).max(8)).min(1),
    docBytes: z.number().int().min(1024).max(1_048_576),    // default 32768
    historyRows: z.number().int().min(0),                   // preloaded terminal rows
    stepTimeoutMs: z.number().int().positive(),
    thresholds: z.object({
      throughputFloor: z.number().gt(0).lt(1),              // 0.7
      serviceMultiple: z.number().gt(1),                    // 2.0, floor 100 ms
      enqueueMultiple: z.number().gt(1),                    // 3.0, floor 20 ms
    }),
  }).optional(),
  concurrency: z.object({
    users: z.array(z.number().int().positive()).min(2),     // first entry is the baseline
    durationMs: z.number().int().positive(),
    thinkMs: z.number().int().min(0),
    wsSend: z.boolean(),                                    // forced false on dev
    thresholds: z.object({
      latencyMultiple: z.number().gt(1),                    // 3.0, floor 50 ms
      errorRate: z.number().min(0).max(1),                  // 0.01
    }),
  }).optional(),
  exhaustion: z.object({ holdMs: z.number().int().positive(), recoverTimeoutMs: z.number().int().positive() }).optional(),
  restart: z.object({ followers: z.number().int().min(0), reclaimTimeoutMs: z.number().int().positive() }).optional(),
});
```

Validation: `volumes` and `users` strictly ascending; the `dev` profile's max `users` ≤ 25 and
total duration ≤ 180 s (SC-005); `wsSend` must be `false` in the `dev` profile.

Committed profiles: `commit.json` (smoke sizes), `demand.json` (volumes `[10, 50, 100, 250,
500]`, workers `[1, 2]`, historyRows 10000, users `[1, 10, 25, 50, 100]` × 30 s), `dev.json`
(users `[1, 5, 10, 25]` × 20 s).

## Step

Ingest step: `{ workers, volume, stepJobs, tableRows, wallMs, throughputPerSec, queueWaitP50Ms,
queueWaitP95Ms, serviceP50Ms, serviceP95Ms, enqueueP95Ms, failed, timedOut }`.

Concurrency step: `{ users, requests, errors, errorRate, httpP50Ms, httpP95Ms, httpP99Ms,
wsConnectP95Ms, wsSubscribeP95Ms, wsRoundTripP95Ms | null, errorKinds: Record<string, number> }`.
`errorKinds` keys are fixed: `http_4xx`, `http_5xx`, `timeout`, `network`, `ws_refused`,
`ws_closed`.

## Verdict

`{ degraded: false, through: number } | { degraded: true, at: number, workers?: number,
rules: ("throughput" | "service" | "enqueue" | "failed" | "latency" | "errors")[] }`.
One per series: per worker count for ingest, one for concurrency. `at` is the step's volume or
user count.

## Expectation (stress cases)

`{ name: string, pass: boolean, observed: string | number | null }`. Names are fixed, e.g.
`health-degraded`, `request-bounded`, `ws-503-not-401`, `process-alive`, `recovered`,
`followers-succeeded`, `target-attempts-2`, `target-succeeded`, `one-document-per-book`.
Numbers recorded beside them: `recoverySec`, `reclaimSec`, `heldConnections`, `maxConnections`.

## CaseOutcome

```ts
{ id, tier, target, status: "pass" | "fail" | "skipped", reason?: string,
  durationMs, steps?: Step[], verdicts?: Verdict[], expectations?: Expectation[],
  observed?: Record<string, number> }
```

`reason` is required when `skipped` and when `fail`. It is a fixed string or an error message
with no URL, credential, or document text.

## Synthetic document

Not stored beyond the run. `synthDoc(seed, bytes)` returns Markdown; same inputs, same output.
Book name `load-<runId8>-<n>`.
