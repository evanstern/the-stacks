# Deviations: spec 081

- Seam check (2026-11-03): after merging main (0208, 0127, 0170), every named hunk moved only.
  Versions are now interpret-v9, narrate-v12, audit-v8, so this spec bumps to interpret-v10,
  narrate-v13, audit-v9.
- `talk-fallback-line.test.ts`: the third refused audit uses `ledger-mismatch`, not `doctrine`.
  `doctrine` is non-blocking (`BLOCKING_LLM_KINDS`), so it would pass the attempt, not refuse it.
  The `player-agency` detail names a party member, as the E2 filter requires to block.
