# TASK-0024 merge condition — real-export run (T034, T035)

Run 2026-09-29 by the orchestrator on the worktree stack `stacks-task-0024` (Mac, loopback).
Embeddings used the gateway `fake` provider (operator ruling 2026-09-29). No book text was
copied anywhere; scratch zips lived under the job tmp dir and were deleted.

| Upload (delivered form) | HTTP | Job | Pages | Duplicate pages | Chunks | Embedding |
|---|---|---|---|---|---|---|
| Monster Manual — single zip, 134,279,220 B, 3,219 entries | 202 | succeeded | 30 | 0 | 1,226 | embedded |
| Player's Handbook — zip of 39 chapter zips, 114 MB | 202 | succeeded | 39 | 0 | 1,788 | embedded |
| Dungeon Master's Guide — single zip | 202 | succeeded | 22 | 0 | 1,465 | embedded |
| Xanathar's Guide — single zip (first parser run) | 202 | succeeded | 14 | 0 | 849 | embedded |
| Lost Mine of Phandelver — zip of chapter zips + combined zip, 90 MB | 202 | succeeded (after fix 5121083) | 7 | 6 | 360 | embedded |
| Single HTML page (PHB preface) | 202 | succeeded | 1 | 0 | 2 | embedded |
| Markdown file (original text) | 202 | succeeded | 1 | 0 | 3 | embedded |

- **Streaming (AC #7):** app RSS during the MM upload: baseline 137,236 kB, peak 160,064 kB,
  delta ~23 MB (pass: < 64 MB). Upload took 2.3 s over loopback (6 samples at 0.5 s).
- **Ceiling:** `UPLOAD_MAX_BYTES` defaults to 1 GiB; documented in `.env.example` and the
  `configuration` wiki note.
- **Found and fixed:** the first LMoP run failed `Zip read failed: unexpected end of file`.
  Root cause: per-level temp-name counter in `zip.ts` let a nested extraction overwrite its
  still-open parent. Fixed in 5121083 with a reproducing synthetic test.
- **Worker resilience:** the failed LMoP job did not crash the worker; later jobs ran.
- **Restart mid-ingest (T035):** MM re-uploaded; app restarted at `running store`. The job
  was reclaimed (`attempts` 2) and finished `succeeded` with 1,226 chunks (equal to T034),
  `replaced: true`.
