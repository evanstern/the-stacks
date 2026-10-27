# Contract: the run directory (transcript, ledger and the other artifacts)

Module: `apps/server/src/playtest/export.ts` (`exportSession`, `writeRunDir`, `readRunDir`).
FR-007, FR-009. Default location: `.playtests/<runId>/` at the repository root (gitignored);
`--out <dir>` overrides it.

## Files

| File | Written by | Content |
|---|---|---|
| `run.json` | `run` | the run manifest (data-model.md). `audit --session` writes a manifest with `mode: "session"`, no `spend`, no `dice` |
| `transcript.jsonl` | `run`, `audit --session` | every row of the session as `StoredEvent` (`seq`, `type`, `version`, `actor`, `visibility`, `payload`, `createdAt`), DM view, ascending `seq`, one JSON object per line |
| `transcript.md` | `run`, `audit --session` | the player view (rows a player in the human seat can see, by `canSee`), rendered: talk and narration as text, actions with their status, ledger lines through `play/ledger-format`-equivalent server rendering (the facts renderers). DM-only rows are left out |
| `ledger.json` | `run`, `audit --session` | `loadProjections(db, sessionId, { role: "dm" }).ledger`, as a JSON array |
| `jobs.json` | `run`, `audit --session` | `listDmJobs(db, sessionId, 500)` mapped to the `/dm` turns item shape (dm-api.md): no prompt text, audit records with hashes |
| `usage.json` | `run` | the counting sink's `UsageRecord[]` and totals (no prompt or completion text by construction) |
| `report.json` | `audit` (and `run` unless `--no-audit`) | the report (audit-report-schema.md) |
| `report.md` | same | the rendered report |

## Rules

1. `exportSession` reads only: `readFrom` in pages of 1000 until exhausted, `loadProjections`,
   `listDmJobs`. It never writes to the database it reads.
2. Rows are written verbatim. Narration and talk text appear in the transcript because they are
   play text, already in the log. No environment value, key, prompt or retrieved passage is
   written to any file.
3. `readRunDir(dir)` parses `transcript.jsonl` with the session-model `StoredEvent` schema and
   `ledger.json` with the `LedgerRow` schema, so `audit --dir` can re-audit saved artifacts with
   no database.
4. Writing is atomic per file (write to `<file>.tmp`, then rename).
5. `runId` = `YYYYMMDDTHHMMSSZ-<scenario name>-<mode>`; for `audit --session`,
   `YYYYMMDDTHHMMSSZ-session-<first 8 chars of the session id>`.

## Committed evidence

- PR evidence: `specs/032-playtest-harness/evidence/ci-playtest/` holds one CI-mode run
  directory (Phase 4).
- Milestone evidence: `docs/design/m2-demo/provider-playtest/` and
  `docs/design/m2-demo/demo-session/` (Phase 6), each a full run directory.
