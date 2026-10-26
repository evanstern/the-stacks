# Data model: playtest harness and auditor

All entities are Zod schemas in `apps/server/src/playtest/` (files listed in plan.md). No
database table is added. Every document carries `v: 1`.

## Scenario

Full schema: [contracts/scenario.md](contracts/scenario.md).

| Field | Meaning |
|---|---|
| `name` | scenario name, used in the run id |
| `seedId` | the scene seed (`apps/server/seeds/<seedId>.json`) |
| `seat` | `{ characterId, userId }`: the human seat (the seed's one `seat: "human"` character) |
| `moves.free[]` | ordered `{ text, actionId? }` while the table is free |
| `moves.combat` | `{ text, firstActionId? }` committed on each turn the human is active |
| `moves.fallback` | `{ text }` committed in free mode once `free[]` is spent |
| `limits` | `{ maxMoves, maxWallMs }` |
| `dice` | `{ faces: number[], seed: number \| null }` (provider mode) |
| `ci` | `{ dmScript, auditScript, retrieve }`: file paths relative to the scenario file |

## Run manifest (`run.json`)

| Field | Meaning |
|---|---|
| `runId` | `<UTC timestamp>-<scenario name>-<mode>` |
| `mode` | `ci` \| `provider` |
| `commit` | `git rev-parse HEAD` |
| `sessionId`, `seedId` | the played session |
| `dice` | `{ scriptedFaces, seed, drawn }` |
| `models` | purpose → `{ provider, model }` (names only) |
| `startedAt`, `finishedAt` | ISO times |
| `outcome` | `ended` \| `stalled` \| `failed` \| `budget-stopped` \| `timed-out` |
| `failedJobId` | set when `outcome = failed` |
| `moves` | `{ committed, refusals: { moveIndex, code }[] }` |
| `spend` | `{ calls, inputTokens, outputTokens, costUsd, ceilingUsd }` |
| `scriptRemaining` | CI mode: `remaining()` of the scripted DM |

State transitions of `outcome`: the harness starts in `running` (not persisted) and ends in
exactly one terminal value; the first stop condition met wins, checked in the order
`failed`, `budget-stopped`, `ended`, `timed-out`, `stalled`.

## Transcript, ledger, jobs, usage

[contracts/run-directory.md](contracts/run-directory.md). Transcript rows are the existing
`StoredEvent`; ledger rows the existing `LedgerRow`; job rows the existing `listDmJobs` items.

## Segment

| Field | Meaning |
|---|---|
| `index` | 0-based |
| `narrationSeq` | seq of the narration row, or `null` for the tail |
| `fromSeq`, `toSeq` | inclusive row range |
| `rows` | the segment's `StoredEvent`s |
| `ledger` | ledger rows with `seq` in range |

## Finding

| Field | Meaning |
|---|---|
| `id` | `F<n>`, stable within one report, in segment then source order |
| `source` | `check` \| `auditor` \| `dm-audit` |
| `check` | the code-check id when `source = check` |
| `kind` | `ledger-contradiction` \| `invented-mechanics` \| `hidden-info-leak` \| `player-agency` \| `doctrine` \| `other` \| `roll-without-reason` \| `dm-audit-flag` \| `no-scene` |
| `severity` | `fail` \| `warn` \| `note` (fixed by kind, [contracts/audit-report-schema.md](contracts/audit-report-schema.md)) |
| `segment` | segment index or `null` |
| `doctrineId` | a `DOCTRINE` id or `null` |
| `seqs` | cited row seqs |
| `detail` | ≤ 400 chars |

## Report

[contracts/audit-report-schema.md](contracts/audit-report-schema.md). Verdict `pass` | `fail` | `incomplete`.

## Demo record

A Markdown document, not a schema: [contracts/demo-runbook.md](contracts/demo-runbook.md). Its
failure table has one row per report finding and per DM-runtime audit flag.
