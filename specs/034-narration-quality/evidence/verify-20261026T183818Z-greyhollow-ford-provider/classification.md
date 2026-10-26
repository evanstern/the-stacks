# Classification: verification run 20261026T183818Z (TASK-0106, Phase 5, quickstart C11)

**Run**: composite `fda4abf` (origin/task-0048-playtest `a99ddd8` + this branch). Outcome
`stalled`, `stallReason: seat-exhausted`, 11 moves, no failed job. Spend $7.18 over 321 calls
of the $22 ceiling.

**Verdict: FAIL on card AC #4.**

| Measure | Run 5 | This run | Bar |
|---|---|---|---|
| Fallback rate, seat-fallback turns excluded | 7/14 (0.50) | 12/34 (0.35) | ≤ 0.10 |
| Fallback rate, all turns | 23/39 (0.59) | 13/38 (0.34) | reported |
| `hidden-info-leak` fails | 6 | 0 | 0 ✓ |
| `ledger-contradiction` fails | 5 | 3 | 0 ✗ |
| `player-agency` fails | 1 | 4 | stop for ruling (orchestrator ruling 3) |

Selector: the C5 `jq` with `$fbs` = every text in `moves.fallback` (5 entries after TASK-0048
`b3f09ca`). 4 seat-fallback moves in this run.

## Why 12 turns fell back (13 flags, 3 attempts each)

Blocking issues across all fallback attempts: player-agency 21, invented-mechanics 14,
ledger-mismatch 10 (4 are the deterministic digits check), doctrine 9 (all nine are the
deterministic "The narration is empty").

| Id | Cause | Evidence | Kind of fix |
|---|---|---|---|
| E1 | **Narrate truncated by hidden reasoning.** `dm.narrate` maxTokens is 500. 17 of 79 narrate calls stopped at exactly 500 output tokens; 9 attempts returned empty prose. Same mechanism as 033 R10 (interpret). | `usage.json` (`dm.narrate` outputTokens); flags "The narration is empty" ×9 | Operator config: raise `dm.narrate` maxTokens. No code. |
| E2 | **dm.audit still flags world NPCs as player-agency** despite audit-v2's party section. Of 21 player-agency blocks, 10 name Pell (6) or Snag (4), who are world characters; 1 names companion Odo. | flags.txt (this dir's journal rows) | Code: a `player-agency` issue blocks only when its detail names a party character (deterministic filter over `facts.party`); otherwise it is advisory. Needs a catalog row (spec amendment). |
| E3 | **Narrator invents hero wounds and moves the hero on a foe's failed attack** ("sways, blood dark along her side" with no damage fact; "wrenches away before the grip can set"). | invented-mechanics ×14; auditor F19, F24, F37, F47 | Prompt: narrate-v3 rule — a foe's missed or failed attack leaves the party character unchanged and unmoved; describe only what the foe did. Needs a catalog row. |
| E4 | Digits in prose (deterministic) | 4 | Narrate rule exists; recurs within E1 truncation turns. No new fix. |

## The 7 playtest-auditor fails

| Finding | Kind | Cause | Classification |
|---|---|---|---|
| F4 | ledger-contradiction | "amber light" vs a dark interior in the journal | Auditor craft nitpick, no ledger fact contradicted. **False positive** (ruling 3: stop for operator). |
| F32 | ledger-contradiction | Journal row 176 (the **chronicle**, haiku) merged "a pot-helm goblin named Snag"; the narration correctly treats them as two creatures | **Chronicle error**, judged against the narration. Not a narration fault. |
| F54 | ledger-contradiction | Odo's bargain ended the encounter by morale (rows 262–263) and the action then resolved `refused` (row 264); the fallback faithfully said "Brother Odo cannot do that here." | **Runtime ordering**: an action that caused the encounter end is refused after it. The fallback matches the ledger; the ledger is the odd part. |
| F19, F24, F37, F47 | player-agency | E3 | Narrator fault; E3 fix. |

## Not selected

- `dm.audit` model change (Haiku → Sonnet): the spec's contingency "if Phase 5 fails on the rate
  alone". It does not fail on the rate alone, and E1/E2 explain most of the rate.
- Attempt budget, word limit: unchanged (spec rulings).
