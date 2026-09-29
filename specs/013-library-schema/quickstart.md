# Quickstart: prove the library schema

Run from this task's worktree (`.worktrees/task-0022`).

1. Bring up this worktree's own stack: `pnpm env:up`. It writes `.env` with this stack's
   `TEST_DATABASE_URL` and ports.
2. Apply migrations to it: `pnpm --filter @the-stacks/server db:migrate`.
   Expect the new `0002_*` migration to apply, and `\dx` in `psql` to list `vector`.
3. Run the library tests with the database required:
   `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/library/store`
   Expect 0 skipped. The integration suite covers every invariant in
   [contracts/library-store.md](contracts/library-store.md).
4. Index use (SC-002, SC-003): the integration suite runs `EXPLAIN` on a keyword query and a
   single-model nearest-neighbour query after `SET enable_seqscan = off` and asserts the plan
   names the GIN and HNSW indexes.
5. Immutability from a raw session (SC-004): the suite issues a raw `UPDATE library_chunks …`
   and expects the trigger's error.
6. Full gate: `pnpm ci:check`.
7. Tear down before removing the worktree: `pnpm env:down`, then `pnpm env:prune --check`
   exits 0.
