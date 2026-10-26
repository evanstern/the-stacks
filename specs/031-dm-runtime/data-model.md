# Data model: DM runtime (TASK-0046)

This feature adds no session event type and no proposal kind. It writes the existing catalog
through the gate. Its own state is operational: rows on the `jobs` table.

## `jobs` table (migration `0004`)

| Column | Change | Meaning for DM jobs |
|---|---|---|
| `id` | — | job id; also the step-marker prefix ([research R5](research.md)) |
| `kind` | CHECK widened | `turn`, `companion`, `chronicle` (plus `ingest`) |
| `book` | now nullable | null for DM jobs; CHECK keeps it required for `ingest` |
| `session_id` | **new**, `uuid` nullable | the play session; CHECK requires it for DM kinds |
| `status` | — | `queued`, `running`, `succeeded`, `failed` |
| `stage` | CHECK widened | node name (turn), `companion`, `chronicle` |
| `attempts` | — | claims so far; `> 3` at claim → `failed` |
| `claim_token` | — | fence for every post-claim write |
| `heartbeat_at` | — | lease clock |
| `input` | — | `TurnJobInput` / `CompanionJobInput` / `ChronicleJobInput` |
| `result` | — | turn: `{ checkpoint, outcome, audit, calls }`; companion: `{ submissions }`; chronicle: `{ entries }` |
| `error` | — | fixed, safe failure text |

New indexes: `jobs_turn_queued_key`, `jobs_chronicle_queued_key`,
`jobs_session_running_key` (partial unique), `jobs_dm_session_idx`. `jobs_active_book_key`
gains `kind = 'ingest'`. Details: [contracts/turn-jobs.md](contracts/turn-jobs.md).

## In-memory types

| Type | Defined in | Contract |
|---|---|---|
| `TurnContext`, `NodeResult`, `NodeDeps`, `TurnOutcome` | `dm/pipeline/` | node-seam.md |
| `AssembleOutput`, `BeatItem` | `dm/nodes/assemble.ts` | nodes.md |
| `DirectorOutput` | `dm/nodes/schemas.ts` | director.md |
| `InterpretOutput`, `Step`, `Effect` | `dm/nodes/schemas.ts` | nodes.md |
| `AdjudicateOutput`, `Ruling`, `VerifiedCitation` | `dm/nodes/adjudicate.ts` | nodes.md |
| `ResolveOutput`, `Submission` | `dm/nodes/resolve.ts` | resolve.md |
| `NarrationFacts`, `FactAction` | `dm/facts.ts` | nodes.md |
| `NarrateOutput` | `dm/nodes/narrate.ts` | nodes.md |
| `AuditOutput`, `AuditRecord`, `AuditIssue` | `dm/nodes/audit.ts` | audit.md |
| `TurnCheckpoint` | `dm/jobs.ts` | turn-jobs.md |
| `SceneSeed` | `dm/seed/schema.ts` | scene-seed.md |
| `CompanionOutput`, `ChronicleOutput` | `dm/companion.ts`, `dm/chronicle.ts` | companions.md |
| `DmScript`, `ScriptedDm` | `dm/script/` | fake-gateway-script.md |
| `DoctrinePair` | `dm/doctrine/doctrine.ts` | doctrine.md |

## Session rows the runtime writes (all through the gate)

| Row type | Proposal kind | Visibility | From |
|---|---|---|---|
| `scene.changed` | `scene` | public | Director group (start, end) |
| `party.member.changed` | `party` | public | scene start |
| engine events (batches) | `mechanics` | public | combatants, initiative, steps, turn advance, encounter end |
| `tracker.changed` | `tracker` | `dm` | Director |
| `table-mode.changed` | `table-mode` | public | Director, turn advance |
| `action.resolved` | `action.resolve` | public | each beat item |
| `narration` | `narration` | public | after audit |
| `journal.entry.added` | `journal` | `dm` (ruling, audit flag) or per entry (chronicle) | resolve, chronicle |
| `talk` | `talk` | `dm` (failure notice) / public (companion lines) | runner, companion jobs |
| `action.declared`, `action.commented`, `action.committed` | `action.*` | public | companion jobs |

Entry-id conventions: `ruling-<jobId>-<n>`, `audit-<jobId>`, `chron-<sessionShort>-<seq>`.
Action-id convention for companions: `act-<characterId>-<n>`.

## State transitions

- **Turn job**: `queued → running(assemble → … → audit) → succeeded | failed`; a lost lease
  returns it to claimable `running`.
- **Action** (session model, unchanged): `declared → discussed → committed → resolved`; the
  runtime moves `committed → resolved` only through `action.resolve`.
- **Beat**: frozen at assemble; held (Director) → resolved by the next, forced, turn job.
