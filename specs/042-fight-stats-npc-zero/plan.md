# Implementation Plan: Fight statistics count NPCs reduced to zero

**Branch**: `task-0134-fight-stats-npc-zero` | **Date**: 2026-10-27 | **Spec**: `specs/042-fight-stats-npc-zero/spec.md`

## Summary

Remove the `side === "players"` guard from the `hp.changed` branch of `fightStats`
(`apps/server/src/playtest/auditor/stats.ts`). Add one unit test file that proves an NPC drop and
a party drop both count, and that recomputes the M2 demo session's fight statistics from its
committed run directory. Re-ground the `playtest-harness` wiki note.

## Technical Context

- **Language**: TypeScript (Node, ESM). **Tests**: Vitest, `apps/server/test/playtest/`.
- **Inputs**: `LedgerRow[]` and `StoredEvent[]` from `@the-stacks/session-model`.
- **Test standard**: `apps/server/test/playtest/audit.test.ts` and `helpers.ts`. Tests load run
  directories through `readRunDir` (`apps/server/src/playtest/export.ts`) and the doctored fixture
  through `loadDoctored()`.
- **Database**: none. `fightStats` is a pure fold. The new tests need no stack.
- **Model calls**: none. The tests call `fightStats` directly, not `runAudit`.

## Research (decisions)

- **D1. Fix by deleting the guard.** The contract (`specs/032-playtest-harness/contracts/auditor.md`
  line 104, "characters reduced to zero hit points") has no side filter. The report renders one
  unlabelled list. Deleting `&& side === "players"` is the whole code change. `side` is still used
  by the damage tallies above it.
- **D2. Keep the schema.** `reducedToZero` stays `string[]`. A per-side split would change
  `FightStatsSchema`, `contracts/audit-report-schema.md` and `render.ts` for no card AC.
- **D3. Test `fightStats` directly.** `runAudit` adds segments and an auditor gateway that the
  statistic does not need. A direct call keeps the test small and model-free.
- **D4. Recompute from the committed run directory.** `docs/design/m2-demo/demo-session/` holds
  `run.json`, `transcript.jsonl`, `ledger.json` and `jobs.json`, which is everything `readRunDir`
  reads. The test compares the recompute to the committed `report.json` `fight` object, so it
  proves the fix changes only `reducedToZero`.
- **D5. Expected value is "Goblin lookout".** goblin-3 is added at transcript seq 106 with name
  "Goblin lookout". No `combatant.removed` row exists, so `nameOf` resolves the name.

## Constitution Check (2.0.0)

- [x] **I. Agent-operable** — the report an agent reads becomes correct. No new interface.
- [x] **II. Content contract** — no codex entity. N/A.
- [x] **III. Data planes** — no data-plane change.
- [x] **IV. Event sourcing** — the fold reads the ledger and transcript only. It writes nothing.
- [x] **V. Citations** — no retrieval change. N/A.
- [x] **VI. 5e engine boundary** — the harness reads engine output (`hp.changed`). No engine import
      added. HP numbers still come from the engine's rows.
- [x] **VII. Structured first** — `FightStatsSchema` still validates the report. Shape unchanged.
- [x] **VIII. Operator-owned content** — reads a committed demo run only. No private content.
- [x] **IX. Self-hostable** — no new service or dependency.

**Stack conformance**: TypeScript and Vitest only. No departure.

## Files touched

Edited:

- `apps/server/src/playtest/auditor/stats.ts` — drop `&& side === "players"` from the
  `reducedToZero` condition. Update the file's top comment to say drops count on both sides.

New:

- `apps/server/test/playtest/stats.test.ts` — three cases (tasks.md T002, T003).

Wiki (Phase 2):

- `docs/wiki/playtest-harness.md` — state that reduced-to-zero counts party and NPC drops; add
  `apps/server/test/playtest/stats.test.ts` to `sources:`; re-pin.
- `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md` — only if the note's `description` changes.

Not touched: `auditor/schema.ts`, `auditor/render.ts`, `auditor/audit.ts`, every contract under
`specs/032-playtest-harness/contracts/`, every file under `docs/design/m2-demo/`.

**Migrations**: none. **New runtime dependencies**: none. **New dev dependencies**: none.

## Gates

- Phase 1: `pnpm --filter @the-stacks/server test -- test/playtest/stats.test.ts`, then
  `pnpm lint && pnpm typecheck`, then `pnpm ci:check`.
- Phase 2: wiki freshness prints `OK`; spec-bridge check exits 0; `pnpm ci:check` green.

## Project Structure

```
apps/server/src/playtest/auditor/stats.ts        (edit)
apps/server/test/playtest/stats.test.ts          (new)
docs/wiki/playtest-harness.md                    (edit, Phase 2)
specs/042-fight-stats-npc-zero/                  (this spec)
```

## Open questions

- OQ-1 in spec.md (an erratum beside the signed M2 demo record). Not blocking.

## Complexity Tracking

None. One condition removed, one test file added.
