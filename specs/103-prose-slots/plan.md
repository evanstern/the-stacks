# Implementation Plan: Narration as prose slots; retire the audit loop

**Branch**: `task-0272-prose-slots` | **Date**: 2026-11-11 | **Spec**: `specs/103-prose-slots/spec.md`
**Upstream plans**: spec 098 `a370041c`, spec 093 `beae54aa`, spec 097 `a34d5d39`, spec 102 `86d425b6`; base `0b3c378b`.

## Summary

Replace the `audit` node (deterministic checks, `dm.audit` call, three-attempt regenerate loop,
fallback summary) with a pure `check` node. One `dm.narrate` call fills the slots. Code then runs a
leak check and a contradiction check. A leak drops the sentence and appends a `dm` correction. A
contradiction ships the reply and appends a public correction. No path re-calls the model. The
fact sheet gains `why` rows from `PlanFact`. `dm/claims.ts`, `dm/fallback.ts`, `dm/nodes/audit.ts`
and `dm/prompts/audit.ts` are deleted.

## Technical context

- TypeScript, Node 22, pnpm workspace. Server code in `apps/server/src/dm/`.
- Tests: vitest under `apps/server/test/`, fake gateway only. No paid run.
- **New runtime dependencies: none.** C5 does not fire.
- **Migrations: none.** `jobs.result` is JSON. Old rows keep their `audit` field; readers accept
  both shapes. `dm_model_calls` is unchanged; old `dm.audit` rows stay valid.
- **Catalog: unchanged.** Correction rows reuse the `talk` proposal (spec OQ-2). TASK-0272 leaves
  the `catalog.ts` hotspot.

## Constitution Check (3.0.0)

| Principle | Verdict | Note |
|---|---|---|
| I Agent-operable | Pass | No new surface. The DM seat writes corrections through the gate like any seat. |
| II One Intent vocabulary | Pass | No world write is added. `why` rows only read `intent.recorded.facts`. |
| III Event-sourced, server authority | Pass | Model output reaches the log only as a prose slot. A leak is dropped before ship, so no client receives an unrevealed id. Corrections pass the gate with explicit visibility. |
| IV Three planes | Pass | No plane crossing. |
| V Many views, one state | Pass | Corrections appear in the text stream. |
| VI Engine owns the numbers | Pass | Every digit comes from a fact row or the State line. `why` row DCs come from `PlanFact.dc`. |
| VII Narration around facts | **This feature** | Slots only; no digits; leak and contradiction check after narration; a failure appends a correction and never blocks; the audit loop (post-hoc primary defence) is deleted. Gate: fact-sheet tests show every digit comes from a row. |
| VIII–XIII | N/A or pass | No codex, UI, citation, content, hosting or planning change. IX latency improves: one model call per turn. |

No Complexity Tracking entry.

## Design

### D1 — The check module: `apps/server/src/dm/narration-check.ts` (new, pure)

```ts
export interface CheckInput {
  slots: NarrationSlots;            // describe and ask are checked; restate is code-validated
  rows: readonly string[];          // sheet.rows text plus sheet.state
  hasRoll: boolean;
  snapshot: ActorSnapshot;          // S1
  dmOnlyText: readonly string[];    // dmOnlySeedText(seed), lower-cased
  unmetSuccess: readonly string[];  // FactRoll.unmetSuccess of this beat
}
export interface CheckIssue {
  check: "leak" | "contradiction";
  kind: "absent-actor" | "fogged-zone" | "dm-only-text" | "unmet-success"
      | "digit" | "dice-language" | "life-state";
  actorIds: string[];
  matched: string;                  // at most 60 characters
  sentence: string;                 // the sentence the hit sits in
  detail: string;
}
export function checkNarration(input: CheckInput): CheckIssue[];
export function dropSentences(text: string, sentences: readonly string[]): string;
```

**Leak check compares** each describe and ask sentence against:

1. Actors with `presence: "absent"` in S1, matched by unique alias (`namedActorIds`, D3).
   Quoted speech, negation and "no sign of" do not count (today's `unmetReveals` rules).
2. Zones with `revealed: false` in `snapshot.zones`, matched by whole-word zone name.
3. DM-only seed text: a sentence that contains a whole entry of `dmOnlySeedText` (today's
   `talk-turn.ts` `secrets` rule, lifted).
4. `unmetSuccess` text: a sentence that names an actor the unmet text names, when that actor is
   absent (today's `unmetReveals`).

**Contradiction check compares** each describe and ask sentence against:

1. Digits: any `[0-9]` (spec FR-004). The sentence is dropped as well as recorded.
2. Dice language (`DICE_LANGUAGE`) when `hasRoll` is false.
3. Life state: a `DEATH_WORDS` or `UNCONSCIOUS_WORDS` clause whose subject is a unique alias of
   an actor whose S1 life state is not dead or unconscious.

ponytail: life-state uses subject-by-proximity (the alias in the same clause before the word),
not today's full clause grammar. Upgrade to a token walk when a playtest shows a missed subject.

Only these three contradiction kinds ship. Off-turn acts, omissions and counts are deliberately
not checked: constitution VII makes the fact rows, not a lexical gate, the defence.

### D2 — The `check` node (replaces `audit`)

- `NodeName` `"audit"` → `"check"` in `pipeline/context.ts`; `NodeOutputs.check: CheckOutput`.
- `CheckOutput = { record: CheckRecord; shipped: { text; prose; actionIds; corrections: Correction[] } | null }`.
- `CheckRecord = { leak: CheckIssue[]; contradiction: CheckIssue[]; corrected: boolean; shippedProseSha256 }`.
- The node takes narrate's output, runs `checkNarration`, drops leak and digit sentences from the
  slots, recomposes with `composeReply`, and builds corrections:
  - leak: `dm` visibility, `Correction (hidden): dropped "<matched>" — <detail>`.
  - contradiction (life-state, dice-language): public, `Correction: <the fact row or State line text>.`
  - digit: no row; the sentence drop is the correction. Recorded in the record only.
- A narrate failure (call error) no longer fails the turn: narrate returns empty describe and ask,
  and the reply ships as restate, rows and State. The record notes `narrateError`.
- `runner.ts`: the landed-narration reclaim path builds an empty `CheckRecord` in place of today's
  synthetic `AuditRecord`.
- `resolve.ts` `submitNarration(ctx, check, checkpoint)`: submits the narration, then each
  correction as an AI-DM `talk` proposal (channel `ic`, `characterId: null`; keys
  `correction-<n>`), replacing the `audit-flag` journal entry.
- `jobs.ts`: `TurnCheckpoint.narration` becomes `{ check: CheckRecord; shipped; seqs }`.
  The old `attempts` field stays readable as `LegacyAuditRecord` (moved from `nodes/audit.ts`) for
  the debug view and playtest export of pre-0272 rows.

### D3 — Surviving helpers

- `namedActorIds` moves from `claims.ts` to `snapshot/aliases.ts` (spec OQ-6). Resolve's arrival
  hold (spec 089) imports it from there.
- `spellDigits` moves from `fallback.ts` into `fact-sheet.ts` (its only survivor caller).
- `audit-words.ts` → `narration-words.ts`, keeping only `DICE_LANGUAGE`, `DEATH_WORDS`,
  `UNCONSCIOUS_WORDS`, `EITHER_OR_END`, `STOCK_ENDING`, `hasCountClaim` and their helpers.
  The playtest auditor's `checks.ts` imports the new path.
- `withholdRefusedInputs` (narrate) stops calling `checkClaims`. It withholds a ruling, follow-up,
  monster line or `goalNote` when `checkNarration` reports a `life-state` or `dm-only-text` hit on
  it; the count rule (`hasCountClaim`) stays. `AuditIssue` there becomes `CheckIssue`.
- The plan gate's spec 058 reason check is deleted with `claims.ts` (spec OQ-1). The
  `REASON_CONTRADICTS_STATE` code and its tests go with it.

### D4 — `why` rows (spec 098 contract §6)

- `FactRow.kind` gains `"why"` (minor, contract §2).
- `FactSheetInput.planFacts?: PlanFact[]`; type `IntentRecorded["facts"][number]` from
  `@the-stacks/session-model` (spec OQ-7).
- `renderWhyRows(facts)` maps per the §6 table. `dc` with a number renders `DC <dc> (<rule>)`;
  `rule` renders the SRD record title via the `srd` id loader, else the id. `unserved` renders
  nothing. Rows render after the change rows, before the State line.
- `narrate.ts` collects `planFacts` from the `intent.recorded` rows the beat covers (spec OQ-8)
  and passes them to `buildFactSheet`.

### D5 — Talk path

- `talk-turn.ts`: drop the second `ask`. Run `checkNarration` on `react.text` (as describe). A leak
  drops the sentence; an empty result ships nothing (outcome `none`, reason `leak`). Corrections
  follow the D2 rules.
- `prompts/react.ts`: remove the `prior` section.

### D6 — Prompt versions

- `dm.narrate-v23` → **`dm.narrate-v24`**: remove the `Previous text` / `Issue` regenerate section
  and the `prior` input; render `why` rows in the Settled section.
- `dm.react-v2` → **`dm.react-v3`**: remove the regenerate section.
- `dm.audit-v17`: **retired**. The `dm.audit` purpose leaves `purposes.ts`, `PURPOSE_OF`,
  `maxTokens` and `playtest/budget.ts`.
- If another narration card merges first and takes v24, re-bump at reconcile (runbook lane note).

### D7 — Consumers of the job record

- `playtest/export.ts` `JobItem`: add `check: CheckRecord | null`; keep `audit` for old rows.
- `playtest/auditor/audit.ts`: the `dm-audit-flag` note reads `check` (kind list from issues) and
  falls back to `audit` on old rows. Schema enum unchanged.
- `routes/dm.ts`: same two fields.
- `apps/web/app/debug/{job-view.ts,read-result.ts,labels.ts,components/job-card.tsx}`: section
  `narrate-check` shows `check` or legacy `audit`; a fallback badge reads only legacy rows.

## Files

**Deleted**

- `apps/server/src/dm/claims.ts`
- `apps/server/src/dm/fallback.ts`
- `apps/server/src/dm/nodes/audit.ts`
- `apps/server/src/dm/prompts/audit.ts`
- `apps/server/test/dm/{claims.test.ts,claim-fixtures.ts,claim-evidence.test.ts,fallback.test.ts,audit.test.ts,audit.integration.test.ts,combat-audit-replay.test.ts,declared-outcome-audit.test.ts,stakes-audit.test.ts,talk-fallback-line.test.ts}` — each case that still names a leak or contradiction is ported to `narration-check.test.ts` first.

**Renamed**: `apps/server/src/dm/audit-words.ts` → `apps/server/src/dm/narration-words.ts`.

**New**

- `apps/server/src/dm/narration-check.ts`, `apps/server/src/dm/nodes/check.ts`
- `apps/server/src/cli/replay-checks.ts` (C-AUD replay)
- `apps/server/test/dm/{narration-check.test.ts,why-rows.test.ts,check-node.test.ts}`
- `apps/server/test/cli/replay-checks.test.ts`, `apps/server/test/fixtures/c-aud-export.sample.json`

**Touched**

- `apps/server/src/dm/{fact-sheet.ts,jobs.ts,talk-turn.ts,worker.ts,purposes.ts}`
- `apps/server/src/dm/nodes/{narrate.ts,resolve.ts}`
- `apps/server/src/dm/prompts/{narrate.ts,react.ts}`
- `apps/server/src/dm/pipeline/{context.ts,runner.ts}` (`pipeline/call.ts`: no change expected;
  `callJson` stays for other nodes)
- `apps/server/src/dm/gates/plan-gate.ts`, `apps/server/src/dm/snapshot/aliases.ts`
- `apps/server/src/playtest/{export.ts,budget.ts,auditor/audit.ts,auditor/checks.ts}`
- `apps/server/src/routes/dm.ts`
- `apps/web/app/debug/{job-view.ts,read-result.ts,labels.ts,components/job-card.tsx}`
- Existing tests that import the deleted modules (`narrate.test.ts`, `fact-sheet*.test.ts`,
  `facts.test.ts`, `reclaim.integration.test.ts`, `npc-turn-narration.test.ts`,
  `narration-quality-repro.test.ts`, `playtest-narration-labels.test.ts`, `call-schemas.test.ts`,
  `test/playtest/checks.test.ts`, plan-gate tests, `fixtures/task-0203-shapes.ts`).
- Any AI config purpose list that names `dm.audit` (implementer greps `dm.audit` repo-wide).
- `specs/103-prose-slots/c-aud-export.sql` (new, the C9 export query)
- `docs/wiki/{dm-narration-quality,output-claim-gate,dm-runtime,INDEX,CAPSULES}.md` (Phase 6).

## C-AUD replay

The PR deletes the audit loop and `claims.ts`: a one-way door. Before merge the orchestrator
replays session `bb4952dc-8600-48e8-a15f-2f4cf154625d` (runbook B2, 2026-11-07, hosted dev at
code `087ecb7f`) through the new checks and attaches the count table to the PR. The operator
approves the merge after reading it (C-AUD).

### (a) Data needed per turn

| Source | Columns or fields | Use |
|---|---|---|
| `events` (session) | `seq, actor, type, payload, payload_version, visibility, ts` | Fold `project()` up to each narration seq to rebuild S1; read each `narration` row's `payload.narration.text` and `actionIds`. |
| `jobs` (`kind` in turn, floor, companion, chronicle) | `id, kind, status, attempts, input, result, created_at, finished_at` | `input.seedId` (seed for `dmOnlySeedText` and `buildSnapshot`); `result.checkpoint.narration.seqs` maps a job to its narration row; `result.audit` gives the old ruling (`final`, per-attempt issue kinds). |
| `dm_model_calls` | `job_id, purpose, prompt_version, call_attempt, outcome` | Count old `dm.audit` and `dm.narrate` calls per job. No text is stored there. |

No prompt or completion text exists for rejected attempts (spec OQ-9). The replay checks shipped
text only.

### (b) Read-only export (C9: the operator's go on this exact command)

The SQL is tracked at `specs/103-prose-slots/c-aud-export.sql`. Run from the worktree root on the
operator's machine. The session is forced read-only (`default_transaction_read_only=on`), and the
JSON lands locally; nothing is written on vm-104.

```sh
mkdir -p ~/.cache/stacks-sweep && ssh stacks@vm-104.local.infinity-node.win "docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' stacks-dev-db-1 sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v ON_ERROR_STOP=1 -At'" < specs/103-prose-slots/c-aud-export.sql > ~/.cache/stacks-sweep/c-aud-bb4952dc.json
```

- Confirm the container name first with `ssh stacks@vm-104.local.infinity-node.win docker ps --format '{{.Names}}'` (read-only, under the 2026-11-09 ssh grant). Compose v2 names it `stacks-dev-db-1`.
- The export holds game events, job results and call metadata only: no keys, no account rows.
- Check the file parses: `node -e 'JSON.parse(require("fs").readFileSync(process.argv[1]))' ~/.cache/stacks-sweep/c-aud-bb4952dc.json`.

### (c) Replay script: `apps/server/src/cli/replay-checks.ts`

`pnpm --filter @the-stacks/server exec tsc -b && node apps/server/dist/cli/replay-checks.js <export.json> [--seed-dir apps/server/seeds]`

1. Parse the export. Load the seed named by the first turn job's `input.seedId`.
2. For each `narration` event in seq order: fold `project()` over events with `seq` below it,
   `buildSnapshot(projections, seed)` (S1), find the job whose
   `result.checkpoint.narration.seqs` holds the seq.
3. Split the shipped text: B2-era text is prose, then the dice lines. Prose is the text before the
   first line that `renderRollLine`/`renderChangeLine` output shape matches (a line holding a
   digit); rows are the rest. The implementer confirms the 087ecb7f ship format from
   `git show 087ecb7f:apps/server/src/dm/nodes/audit.ts`.
4. Run `checkNarration` with `slots.describe` = prose, `rows`, `hasRoll` = rows non-empty,
   `dmOnlyText` from the seed, `unmetSuccess` = [] (not recorded on events).
5. Print a table, also as JSON with `--json`:

```
turns narrated: N        dm.audit calls: A        dm.narrate calls: R
old ruling        | turns | new clean | leak hits | contradiction hits
passed            |       |           |           |
passed-after-regen|       |           |           |
fallback          |       |           |           |   (fallback text is code text; reported, not judged)
no audit record   |       |           |           |
leak hits by kind: ...    contradiction hits by kind: ...
per-turn rows: seq, job id, old final, old issue kinds, new hits (matched text)
```

The script reads a file only. It opens no database and makes no model call.

## Phases (one phase = one sonnet dispatch)

1. Check module and helper moves (pure).
2. `why` rows and the digit drop on the fact sheet.
3. Turn pipeline swap and deletions.
4. Job-record consumers (playtest, routes, web debug).
5. C-AUD replay script.
6. Wiki re-ground.

Phase 3 depends on 1 and 2. Phase 4 depends on 3. Phase 5 depends on 1. Phase 6 runs last.
