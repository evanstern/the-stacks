# Quickstart: prove hybrid retrieval

Run from this task's worktree (`.worktrees/task-0026`).

1. Bring up this worktree's own stack: `pnpm env:up`. It writes `.env` with this stack's
   `TEST_DATABASE_URL` and ports.
2. Apply migrations: `pnpm --filter @the-stacks/server db:migrate`. Expect no new migration;
   `0002_*` (spec 013) already holds every table and index retrieval reads.
3. Run the retrieval tests with the database required:
   `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/library/retrieve`
   Expect 0 skipped. The suites cover every invariant in
   [contracts/retrieval.md](contracts/retrieval.md) and use the gateway's fake provider only.
4. Mode selection (SC-002, SC-003): the integration suite runs one question under `fts`,
   `vector`, and `hybrid`, by config and by per-request override, and asserts the fake
   provider saw zero embed calls in `fts` mode.
5. Fusion (SC-004): the unit suite checks `fuseRrf` against scores computed by hand with
   `RRF_K = 60`.
6. Anchors (SC-001): for every passage returned, the suite slices the stored document text by
   `anchor.start`/`anchor.end` and expects `text` exactly.
7. Index use: the integration suite runs `EXPLAIN` on retrieval's keyword and vector queries
   with sequential scans disabled and expects `library_chunks_tsv_idx` and
   `library_embeddings_embedding_idx`.
8. Boot check: `RETRIEVAL_MODE=bogus` makes `loadRetrievalConfig` throw a message naming
   `RETRIEVAL_MODE`; an unset environment yields `hybrid`, `8`, `embedding`.
9. Full gate: `REQUIRE_DATABASE=1 pnpm ci:check`.
10. Tear down before removing the worktree: `pnpm env:down`, then `pnpm env:prune --check`
    exits 0.
