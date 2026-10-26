# Playtest audit — 20261026T150925Z-greyhollow-ford-provider

**Verdict: incomplete**

- Session: 53d8a2e9-dcd6-4418-bacf-6a04286b3c84
- Seed: greyhollow-ford
- Commit: 15f15fef89cd161fae3d4fe4a06c7567354b71ed
- Auditor mode: model
- Audited at: 2026-10-26T15:21:07.159Z

## Counts

| rows | narrations | segments | rolls | fail | warn | note |
|---|---|---|---|---|---|---|
| 115 | 12 | 13 | 15 | 5 | 4 | 10 |

## Findings

| id | severity | kind | source | segment | rows | doctrine | detail |
|---|---|---|---|---|---|---|---|
| F1 | warn | doctrine | auditor | 1 | 13, 16, 17 | fail-forward | The search resolves into "nothing changes", stalling the scene instead of creating a new problem. |
| F2 | warn | doctrine | auditor | 1 | 17 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. |
| F3 | warn | doctrine | auditor | 1 | 17 | one-sense | The beat gives no vivid non-visual detail, only a bare statement of failure. |
| F4 | note | dm-audit-flag | dm-audit | 1 | 17 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, ledger-mismatch |
| F5 | note | dm-audit-flag | dm-audit | 2 | 25 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F6 | fail | hidden-info-leak | auditor | 3 | 34 | one-clue | The goblin's line "Ring don't help you. Keeps river-things off OUR mud" hands the player the dm-only motive — that the bell's ring drives off the river-things the goblins fear and they want it for their own camp — in a single beat. |
| F7 | note | dm-audit-flag | dm-audit | 3 | 34 | - | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, doctrine |
| F8 | note | dm-audit-flag | dm-audit | 4 | 57 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F9 | note | dm-audit-flag | dm-audit | 5 | 67 | - | final: passed-after-regenerate; attempts: 3; issues: doctrine, player-agency |
| F10 | note | dm-audit-flag | dm-audit | 6 | 77 | - | final: passed-after-regenerate; attempts: 2; issues: ledger-mismatch |
| F11 | fail | player-agency | auditor | 7 | 84 | hero-is-theirs | The narration dictates the hero's actions and sensation — "she twists, but there's nowhere to go" and "Pain drops her a half-step deeper into the mire" — instead of only reporting what the world did to her. |
| F12 | warn | doctrine | auditor | 8 | 87 | end-on-demand | The narration announces that a goblin 'acts' without any concrete event, threat or detail that demands a player response. |
| F13 | note | dm-audit-flag | dm-audit | 8 | 87 | - | final: fallback; attempts: 3; issues: ledger-mismatch, player-agency, doctrine, invented-mechanics |
| F14 | note | dm-audit-flag | dm-audit | 9 | 98 | - | final: passed-after-regenerate; attempts: 3; issues: ledger-mismatch |
| F15 | fail | hidden-info-leak | auditor | 10 | 99 | - | Odo publicly states the clapper is a warding-charm, revealing the DM-only fact that the bell's ring drives off the river-things. |
| F16 | fail | hidden-info-leak | auditor | 10 | 108 | one-clue | The narration ties the pale thing's approach to "the quiet where the bell's ring should be," handing the player the hidden warding mechanism outright. |
| F17 | note | dm-audit-flag | dm-audit | 10 | 108 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F18 | fail | hidden-info-leak | auditor | 11 | 111 | one-clue | The line "says nothing of trading it — the goblins still stand, after all" discloses Snag's secret condition that he will trade the clapper once two goblins fall, which is dm-only. |
| F19 | note | dm-audit-flag | dm-audit | 11 | 111 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |

## Segments

| index | narration | rows | failing checks | auditor |
|---|---|---|---|---|
| 0 | 10 | 1-10 | none | pass (0 findings, 2 attempts) |
| 1 | 17 | 11-17 | none | fail (3 findings, 1 attempt) |
| 2 | 25 | 18-25 | none | error: parse |
| 3 | 34 | 26-34 | none | fail (1 findings, 2 attempts) |
| 4 | 57 | 35-57 | none | error: parse |
| 5 | 67 | 58-67 | none | pass (0 findings, 2 attempts) |
| 6 | 77 | 68-77 | none | error: parse |
| 7 | 84 | 78-84 | none | fail (1 findings, 1 attempt) |
| 8 | 87 | 85-87 | none | fail (1 findings, 1 attempt) |
| 9 | 98 | 88-98 | none | error: parse |
| 10 | 108 | 99-108 | none | fail (2 findings, 2 attempts) |
| 11 | 111 | 109-111 | none | fail (1 findings, 1 attempt) |
| 12 | - | 112-115 | none | pass (0 findings, 1 attempt) |

## Fight statistics

- Rounds: 2
- Turns: 3 players, 4 npcs
- Attack rolls: 2 players, 2 npcs
- Hits: 0 players, 2 npcs
- Damage dealt: 0 players, 13 npcs
- Damage taken: 13 players, 0 npcs
- Reduced to zero: Tamsin Vale
- Death-save rolls: 0
- Fled or bargained: unknown (No encounter.ended, combatant.removed or scene-ending scene.changed row was logged, so how the fight ended is unknown.)
- Narrations in turn mode: 8

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

Usage: 21 calls, 116692 input tokens, 12567 output tokens, cost $0.8976349999999998.

