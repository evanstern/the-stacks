# Playtest audit — 20261026T152743Z-greyhollow-ford-provider

**Verdict: incomplete**

- Session: af4acfbb-e830-4ac8-a381-9544f4592022
- Seed: greyhollow-ford
- Commit: aa960b358242b1d5aaa680f09a65b75dd4e38c18
- Auditor mode: model
- Audited at: 2026-10-26T15:32:40.785Z

## Counts

| rows | narrations | segments | rolls | fail | warn | note |
|---|---|---|---|---|---|---|
| 63 | 5 | 6 | 8 | 2 | 5 | 3 |

## Findings

| id | severity | kind | source | segment | rows | doctrine | detail |
|---|---|---|---|---|---|---|---|
| F1 | warn | doctrine | auditor | 0 | 10 | end-on-demand | The scene closes on a silent, static loft that holds its breath rather than anything that pressures the player to respond. |
| F2 | warn | doctrine | auditor | 0 | 10 | one-clue | The beat stacks four clues at once — the cut bell rope, the gutted strongbox, the claw-drag trail to the causeway, and the stained ladder rungs — instead of one. |
| F3 | warn | doctrine | auditor | 1 | 16, 17 | fail-forward | The resolved action is narrated as a dead end — "nothing changes" — instead of creating a new problem from the failure. |
| F4 | warn | doctrine | auditor | 1 | 17 | end-on-demand | The turn ends on a flat non-event that gives the player nothing to respond to. |
| F5 | warn | doctrine | auditor | 1 | 17 | blame-the-situation | The failure is framed as the hero's act amounting to nothing rather than as something the world did to the attempt. |
| F6 | note | dm-audit-flag | dm-audit | 1 | 17 | - | final: fallback; attempts: 3; issues: ledger-mismatch, doctrine |
| F7 | note | dm-audit-flag | dm-audit | 2 | 30 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F8 | fail | ledger-contradiction | auditor | 4 | 47, 48, 49, 50, 58, 61 | - | Four goblin combatants were added and the encounter started, yet the narration shows only a single half-glimpsed shape with no fight breaking out. |
| F9 | fail | ledger-contradiction | auditor | 4 | 59, 61 | - | The state change puts the party at the mud island's edge inside the lookout's line of sight, but the narration says the track yields no path and the shape slips back unseen. |
| F10 | note | dm-audit-flag | dm-audit | 4 | 61 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |

## Segments

| index | narration | rows | failing checks | auditor |
|---|---|---|---|---|
| 0 | 10 | 1-10 | none | fail (2 findings, 1 attempt) |
| 1 | 17 | 11-17 | none | fail (3 findings, 1 attempt) |
| 2 | 30 | 18-30 | none | error: parse |
| 3 | 39 | 31-39 | none | error: parse |
| 4 | 61 | 40-61 | none | fail (2 findings, 2 attempts) |
| 5 | - | 62-63 | none | pass (0 findings, 1 attempt) |

## Fight statistics

- Rounds: 1
- Turns: 0 players, 0 npcs
- Attack rolls: 0 players, 0 npcs
- Hits: 0 players, 0 npcs
- Damage dealt: 0 players, 0 npcs
- Damage taken: 0 players, 0 npcs
- Reduced to zero: none
- Death-save rolls: 0
- Fled or bargained: unknown (No encounter.ended, combatant.removed or scene-ending scene.changed row was logged, so how the fight ended is unknown.)
- Narrations in turn mode: 1

## Models and usage

- answering: claude / cc/claude-sonnet-5
- embedding: ollama / bge-m3
- dm.director: claude / cc/claude-opus-5
- dm.interpret: claude / cc/claude-sonnet-5
- dm.adjudicate: claude / cc/claude-opus-5
- dm.narrate: claude / cc/claude-sonnet-5
- dm.audit: claude / cc/claude-haiku-4-5-20251001
- dm.chronicle: claude / cc/claude-haiku-4-5-20251001
- dm.companion: claude / cc/claude-sonnet-5
- playtest.audit: claude / cc/claude-opus-5

Usage: 9 calls, 50582 input tokens, 5246 output tokens, cost $0.38406.

