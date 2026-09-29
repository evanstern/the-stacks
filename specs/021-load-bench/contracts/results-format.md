# Contract: load results file (schemaVersion 1)

Path: `apps/server/bench/load/results/<YYYY-MM-DD>-<sha7>-<runId8>.json`. Tracked in git.
Same naming, formatting, and provenance rules as TASK-0029's retrieval results
(`specs/019-retrieval-bench/contracts/results-format.md`). Commit a run worth comparing; delete
a scratch run. A dirty-tree run is marked, not refused.

```ts
const LoadResultsSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().uuid(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),   // git rev-parse HEAD (the bench's code)
  dirty: z.boolean(),
  host: z.object({ node: z.string(), platform: z.string(), arch: z.string(),
                   cpus: z.number().int(), memGiB: z.number() }),
  tier: z.enum(["commit", "demand", "dev"]),
  target: z.object({
    kind: z.enum(["local", "dev"]),
    postgres: z.string().nullable(),          // server_version, local only
    maxConnections: z.number().int().nullable(),
    appCommit: z.string().nullable(),         // dev: /health commit; local: same as commit
  }),
  profileHash: z.string(),                    // sha-256 of canonical sorted-key JSON
  profile: ProfileSchema,                     // verbatim
  cases: z.array(CaseOutcomeSchema),          // data-model.md; includes skipped cases
});
```

Rules:

- Every registered case appears once in `cases`, run or skipped. A skipped case has `reason`.
- No URL, hostname, username, password, cookie, token, or document text. The dev target is
  identified by `target.kind: "dev"` and its `/health` commit only.
- Two-space indentation and a trailing newline.
- An incompatible change bumps `schemaVersion`; `report` skips unknown versions with a warning.
