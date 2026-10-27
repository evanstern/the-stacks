# Playtest audit — 20261026T103427Z-greyhollow-ford-ci

**Verdict: pass**

- Session: e9d67bb0-8c17-4a2e-b3b8-dbe6e7d5f00a
- Seed: greyhollow-ford
- Commit: 0ce29e832ac857b2123cc89db5e469c322133ff9
- Auditor mode: model
- Audited at: 2026-10-26T10:34:29.379Z

## Counts

| rows | narrations | segments | rolls | fail | warn | note |
|---|---|---|---|---|---|---|
| 84 | 8 | 8 | 16 | 0 | 0 | 0 |

## Findings

No findings.

## Segments

| index | narration | rows | failing checks | auditor |
|---|---|---|---|---|
| 0 | 10 | 1-10 | none | pass (0 findings, 1 attempt) |
| 1 | 18 | 11-18 | none | pass (0 findings, 1 attempt) |
| 2 | 26 | 19-26 | none | pass (0 findings, 1 attempt) |
| 3 | 45 | 27-45 | none | pass (0 findings, 1 attempt) |
| 4 | 50 | 46-50 | none | pass (0 findings, 1 attempt) |
| 5 | 61 | 51-61 | none | pass (0 findings, 1 attempt) |
| 6 | 72 | 62-72 | none | pass (0 findings, 1 attempt) |
| 7 | 83 | 73-83 | none | pass (0 findings, 1 attempt) |

## Fight statistics

- Rounds: 1
- Turns: 2 players, 1 npcs
- Attack rolls: 3 players, 1 npcs
- Hits: 3 players, 0 npcs
- Damage dealt: 15 players, 0 npcs
- Damage taken: 0 players, 15 npcs
- Reduced to zero: none
- Death-save rolls: 0
- Fled or bargained: Snag offers the clapper for safe passage.; Snag trades the clapper for safe passage and the way is clear.
- Narrations in turn mode: 4

## Models and usage

- dm.director: scripted / scripted-chat
- dm.interpret: scripted / scripted-chat
- dm.adjudicate: scripted / scripted-chat
- dm.narrate: scripted / scripted-chat
- dm.audit: scripted / scripted-chat
- dm.chronicle: scripted / scripted-chat
- dm.companion: scripted / scripted-chat
- embedding: scripted / scripted-embed
- playtest.audit: scripted / scripted-chat

Model note: playtest.audit and dm.narrate resolve to the same provider and model; prefer a different model family for the auditor.

Usage: 8 calls, 0 input tokens, 0 output tokens, cost unknown.

