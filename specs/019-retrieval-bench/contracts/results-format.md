# Contract: results file format (schemaVersion 1)

Path: `apps/server/bench/retrieval/results/<YYYY-MM-DD>-<sha7>-<runId8>.json`. Tracked in git.
Commit a run worth comparing; delete a scratch run. A dirty-tree run is marked, not refused.

```ts
const ResultsSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().uuid(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),   // git rev-parse HEAD
  dirty: z.boolean(),                          // git status --porcelain non-empty
  host: z.object({ node: z.string(), platform: z.string() }),
  corpusHash: z.string(),                      // sha-256 hex, data-model.md
  questionsHash: z.string(),
  matrixHash: z.string(),
  matrix: MatrixSchema,                        // the parsed config, verbatim
  models: z.record(z.string(), z.object({      // matrix model name → what served
    embeddingModel: z.string(),                // model name the gateway reported
    provider: z.string(),                      // AI_PROVIDERS key, or "builtin"
  })),
  rows: z.array(BenchRowSchema),               // data-model.md BenchRow
});
```

Rules:

- No corpus or passage text, no question text. Question ids only (constitution VIII).
- No key, no base URL, no env value. Provider appears by its config name only.
- Formatted with two-space indentation and a trailing newline, so diffs stay readable.
- A later incompatible change bumps `schemaVersion`; `report` skips unknown versions with a
  warning naming the file.
