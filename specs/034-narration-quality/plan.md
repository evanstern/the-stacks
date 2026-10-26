# Implementation Plan: First Scene — narration stays in fiction, keeps DM secrets and matches the ledger

**Branch**: `task-0106-narration-quality` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: [spec.md](spec.md), [research.md](research.md),
[contracts/player-facing-context.md](contracts/player-facing-context.md),
[contracts/narration-facts.md](contracts/narration-facts.md),
[contracts/fallback-summary.md](contracts/fallback-summary.md),
[contracts/audit-criteria.md](contracts/audit-criteria.md), [quickstart.md](quickstart.md).

## Summary

Evidence first, as 033 did. The run-5 classification (research.md) is done and committed with
this spec. Phase 1 commits reproduction tests that pass on the unfixed code. Phase 2 stops
DM-only facts at the source: a typed player-facing seed view, four seed edits, a neutral doctrine
example, and public, named transcript lines. Phase 3 extends the narration facts and rewrites
the fallback. Phase 4 gives narrate and audit the party roster and the no-rules-effect meaning,
fixes the clarify relay, and makes LLM craft issues advisory. Phase 5 is an orchestrator-run paid
verification. Phase 6 is the full gate.

## Technical Context

**Language/Version**: TypeScript (Node 24), ESM
**Primary Dependencies**: zod v4, vitest. No new dependency.
**Storage**: `jobs.result` (jsonb) gains fields inside the audit record. No migration.
**Testing**: vitest; database suites with `REQUIRE_DATABASE=1` on the worktree's stack.
**Target Platform**: the server's DM worker (`apps/server`).
**Project Type**: web application (pnpm monorepo).
**Performance Goals**: fewer narration attempts per turn (run 5: 95 for 39 turns).
**Constraints**: the engine owns every number (R8); the attempt budget stays 3; no tracker in
player-facing text.
**Scale/Scope**: about 12 source files (`dm/facts.ts`, `dm/fallback.ts`, `dm/audit-words.ts`,
`dm/nodes/audit.ts`, `dm/nodes/narrate.ts`, `dm/companion.ts`, `dm/chronicle.ts`,
`dm/seed/views.ts` (new), `dm/doctrine/doctrine.ts`, `dm/prompts/{common,narrate,audit,
companion,chronicle,director}.ts`), the seed JSON, about 8 test files, 1 fixture.

## Constitution Check (2.0.0)

- [x] **I. Agent-operable** — the audit record stays a typed jsonb row the route serves. It now
  says which issues blocked. The fallback rate is computed from the transcript (quickstart C5).
- [x] **II. Content contract** — the seed schema does not change. The field classes and the
  authoring rule are documented in contracts/player-facing-context.md. The seed stays typed.
- [x] **III. Data planes** — no plane change. The seed is a code-shipped stand-in for codex
  content (decision-0009); the view is a read projection.
- [x] **IV. Event-sourced play** — no event shape changes. Narration and journal proposals keep
  their shapes. LLM output still reaches the log only through the gate.
- [x] **V. Citations** — not applicable; no rules answer changes.
- [x] **VI. 5e engine boundary** — no engine change. No number is computed or coerced; the
  fallback states none and the dice lines stay code-rendered (R8).
- [x] **VII. Structured first** — `AuditModelOutput` stays strict. Code, not the model,
  derives pass or fail from typed issue kinds.
- [x] **VIII. Operator-owned content** — the seed text is original; the doctrine example
  replacement is original. NOTICE attribution unchanged.
- [x] **IX. Self-hostable** — no new service; models stay operator configuration.

No violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/034-narration-quality/
├── spec.md
├── plan.md
├── research.md                       # the classification (card AC #3)
├── quickstart.md                     # orchestrator runbook: composite worktree, paid run, CI
├── contracts/
│   ├── player-facing-context.md      # field classes, view, transcript, seed + doctrine edits
│   ├── narration-facts.md            # facts v2, narrate prompt v2
│   ├── fallback-summary.md           # fallback v2
│   └── audit-criteria.md             # blocking vs advisory, checks, audit prompt v2, record
├── evidence/
│   ├── run5-20261026T171359Z-greyhollow-ford-provider/
│   ├── run5-classification.json
│   └── verify-<runId>/               # Phase 5 (orchestrator)
└── tasks.md
```

### Source Code

```text
apps/server/src/dm/
├── seed/views.ts            # new: PlayerSeedView, playerFacingSeed, dmOnlySeedText
├── facts.ts                 # party, npcNames, events, roll target, setting
├── fallback.ts              # v2
├── audit-words.ts           # match-quoting helpers
├── nodes/audit.ts           # blocking/advisory, clarify check, words, record
├── nodes/narrate.ts         # passes the view
├── companion.ts, chronicle.ts   # pass the view / roster
├── doctrine/doctrine.ts     # villains-believe example
└── prompts/{common,narrate,audit,companion,chronicle,director}.ts
apps/server/seeds/greyhollow-ford.json
```

## Phases and dispatch

| Phase | Kind | Card AC |
|---|---|---|
| 1 Reproduce | sonnet dispatch | #3 |
| 2 Player-facing context | sonnet dispatch | #1, #3 |
| 3 Facts and fallback | sonnet dispatch | #2, #3 |
| 4 Narrate and audit v2 | sonnet dispatch | #3 |
| 5 Verification run | orchestrator, paid | #4 |
| 6 Full gate | sonnet dispatch + orchestrator | #5 |

## Operator checkpoints

1. **Spend ceiling** for Phase 5. Proposal: $22, as runs 4 and 5 (run 5 spent $7.52).
2. **Seat-fallback cut** (spec Assumptions). Default: research.md R5. Confirm before Phase 5
   reports a pass.
3. **Contingency only**: if Phase 5 fails on the fallback rate alone, a `dm.audit` model change
   (Haiku to Sonnet) is a config change in `.env` and an operator checkpoint. It is not planned.

## Risks

- The playtest auditor can report false positives (F77). A `ledger-contradiction` or
  `hidden-info-leak` fail that research.md's method attributes to the playtest auditor still
  fails AC #4. Commit it as evidence and stop for an operator ruling.
- Relaxing `dm.audit` may let through narration the playtest auditor fails as `player-agency`
  (run 5 F82). That is "a fail of another kind": commit and stop for a ruling.
- `goalNote` is model text derived from DM-side input and still reaches narrate.

## Complexity Tracking

Empty.
