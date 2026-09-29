# Contract amendment — `GET /health` gains `commit`

**Amends:** `specs/003-hono-server/contracts/health.md` (FIXED SEAM CONTRACT).
**Authority:** TASK-0020 AC #4 and doc-0002 ("The app reports its commit at `/health`"),
ratified by the operator 2026-09-28. The amendment is additive; no existing consumer changes.

## Response (amended)

```json
{
  "status": "ok" | "degraded",
  "process": { "uptimeSeconds": <number> },
  "database": { "reachable": <boolean> },
  "commit": "<40-hex sha>" | "<40-hex sha>-dirty" | "unknown"
}
```

- `commit` — the git commit the running image was built from, baked in at build time
  (`GIT_COMMIT` build arg). `-dirty` suffix when built from a tree with uncommitted changes.
  `"unknown"` when built without the arg (plain `docker compose up`, local `pnpm dev`).
- `commit` does not feed `status`. An `"unknown"` commit is not degraded.

## Unchanged guarantees

Always 200; bounded within 5 seconds; `status` honest and recovering. The compose
healthcheck (`healthcheck.js`) reads only `status` and needs no change.
