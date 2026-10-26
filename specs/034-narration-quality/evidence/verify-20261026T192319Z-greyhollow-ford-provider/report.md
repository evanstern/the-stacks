# Playtest audit — 20261026T192319Z-greyhollow-ford-provider

**Verdict: incomplete**

- Session: 00cbb89b-0fe4-463c-887c-ca51d2d32b1c
- Seed: greyhollow-ford
- Commit: 3ae5a544c85f671e9c939b27325fdb1be12c7184
- Auditor mode: model
- Audited at: 2026-10-26T19:47:26.403Z

## Counts

| rows | narrations | segments | rolls | fail | warn | note |
|---|---|---|---|---|---|---|
| 222 | 27 | 28 | 26 | 3 | 16 | 15 |

## Findings

| id | severity | kind | source | segment | rows | doctrine | detail |
|---|---|---|---|---|---|---|---|
| F1 | fail | player-agency | auditor | 0 | 10 | hero-is-theirs | The narration moves the player's hero for them — "Tamsin Vale leads the way up from the bank" — deciding her position and action. |
| F2 | warn | doctrine | auditor | 3 | 30 | end-on-demand | Narration closes with the bare prompt "What does Tamsin do with the camp so close?" instead of a world beat that demands a response. |
| F3 | note | dm-audit-flag | dm-audit | 5 | 60 | - | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, doctrine |
| F4 | warn | doctrine | auditor | 7 | 76 | end-on-demand | The turn closes on a flat mechanical status line, "Goblin by the fire moves next", instead of a world event that demands a response. |
| F5 | note | dm-audit-flag | dm-audit | 7 | 76 | - | final: fallback; attempts: 3; issues: ledger-mismatch |
| F6 | fail | player-agency | auditor | 8 | 82, 79 | hero-is-theirs | The narration dictates the hero's action and dodge ("Tamsin twists just enough") when the ledger only records a missed attack; the miss should be the world's doing, not the hero's chosen move. |
| F7 | fail | player-agency | auditor | 9 | 87 | hero-is-theirs | The narration moves the player character and assigns his intent — "Brother Odo steps forward, weighing the line of goblins before him" — before asking what he does. |
| F8 | note | dm-audit-flag | dm-audit | 9 | 87 | - | final: passed-after-regenerate; attempts: 2; issues: ledger-mismatch |
| F9 | warn | other | auditor | 10 | 94 | - | The narration is truncated mid-sentence ("waiting on"), leaving the beat unfinished. |
| F10 | note | dm-audit-flag | dm-audit | 10 | 94 | - | final: passed-after-regenerate; attempts: 3; issues: player-agency, doctrine, invented-mechanics |
| F11 | warn | doctrine | auditor | 12 | 110 | hero-is-theirs | "Her blade cuts a desperate arc" assigns Tamsin's inner state (desperation) to the player's hero instead of narrating only what the world did. |
| F12 | note | dm-audit-flag | dm-audit | 12 | 110 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F13 | note | dm-audit-flag | dm-audit | 13 | 121 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, invented-mechanics, doctrine |
| F14 | note | dm-audit-flag | dm-audit | 14 | 126 | - | final: passed-after-regenerate; attempts: 3; issues: ledger-mismatch |
| F15 | warn | doctrine | auditor | 15 | 129 | end-on-demand | The turn closes on a turn-order note ("Goblin lookout moves next") rather than anything that demands a response from the player. |
| F16 | warn | doctrine | auditor | 15 | 129 | plain-prose | "Goblin by the fire makes a move" is bare initiative bookkeeping, not prose describing what the goblin actually did. |
| F17 | note | dm-audit-flag | dm-audit | 15 | 129 | - | final: fallback; attempts: 3; issues: invented-mechanics, player-agency, doctrine |
| F18 | warn | doctrine | auditor | 16 | 139 | end-on-demand | The turn closes on the bare turn-order note "Brother Odo moves next." rather than anything that demands a response. |
| F19 | warn | doctrine | auditor | 16 | 139 | plain-prose | The narration is a mechanical echo of rows #132-#136 with "Tamsin Vale falls unconscious" printed twice, not plain prose. |
| F20 | warn | doctrine | auditor | 16 | 139 | one-sense | A burning brand striking home gives no non-visual detail anywhere in the beat. |
| F21 | note | dm-audit-flag | dm-audit | 16 | 139 | - | final: fallback; attempts: 3; issues: ledger-mismatch |
| F22 | warn | doctrine | auditor | 17 | 149 | end-on-demand | The narration closes on a rhetorical question asking the player what the NPC Snag does, rather than a concrete world event that demands a response. |
| F23 | warn | doctrine | auditor | 19 | 156, 157, 161 | blame-the-situation | The failed death save is narrated as Tamsin "coming up short" instead of the world acting on her dying body. |
| F24 | warn | doctrine | auditor | 19 | 157, 161 | fail-forward | The failure produces no new pressure in the scene, only a handoff to the next turn. |
| F25 | warn | doctrine | auditor | 19 | 161 | end-on-demand | The turn closes on a flat turn-order note ("Kestrel moves next") rather than anything the player must answer. |
| F26 | note | dm-audit-flag | dm-audit | 19 | 161 | - | final: fallback; attempts: 3; issues: ledger-mismatch, player-agency, doctrine |
| F27 | note | dm-audit-flag | dm-audit | 20 | 169 | - | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, player-agency, doctrine |
| F28 | note | dm-audit-flag | dm-audit | 21 | 172 | - | final: passed-after-regenerate; attempts: 3; issues: player-agency, doctrine |
| F29 | warn | doctrine | auditor | 24 | 197, 198, 199, 200 | end-on-demand | Narration #200 closes a resolved social action with a flat restatement of the declared intent, offering no goblin reaction or pressure that demands a response. |
| F30 | note | dm-audit-flag | dm-audit | 24 | 200 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F31 | note | dm-audit-flag | dm-audit | 25 | 210 | - | final: passed-after-regenerate; attempts: 2; issues: ledger-mismatch, player-agency, doctrine |
| F32 | warn | doctrine | auditor | 26 | 214, 215 | world-moves | A resolved action produces no consequence in the world — no reaction from Snag, the reeds or the ford — so the scene is frozen. |
| F33 | warn | doctrine | auditor | 26 | 215 | end-on-demand | The narration closes on a flat summary that demands nothing from the player, leaving Snag's demand for coin or blood hanging unanswered. |
| F34 | note | dm-audit-flag | dm-audit | 26 | 215 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, ledger-mismatch |

## Segments

| index | narration | rows | failing checks | auditor |
|---|---|---|---|---|
| 0 | 10 | 1-10 | none | fail (1 findings, 1 attempt) |
| 1 | 17 | 11-17 | none | error: parse |
| 2 | 23 | 18-23 | none | pass (0 findings, 2 attempts) |
| 3 | 30 | 24-30 | none | fail (1 findings, 2 attempts) |
| 4 | 50 | 31-50 | none | error: parse |
| 5 | 60 | 51-60 | none | pass (0 findings, 2 attempts) |
| 6 | 69 | 61-69 | none | error: parse |
| 7 | 76 | 70-76 | none | fail (1 findings, 1 attempt) |
| 8 | 82 | 77-82 | none | fail (1 findings, 2 attempts) |
| 9 | 87 | 83-87 | none | fail (1 findings, 1 attempt) |
| 10 | 94 | 88-94 | none | fail (1 findings, 2 attempts) |
| 11 | 101 | 95-101 | none | error: parse |
| 12 | 110 | 102-110 | none | fail (1 findings, 2 attempts) |
| 13 | 121 | 111-121 | none | error: parse |
| 14 | 126 | 122-126 | none | pass (0 findings, 1 attempt) |
| 15 | 129 | 127-129 | none | fail (2 findings, 1 attempt) |
| 16 | 139 | 130-139 | none | fail (3 findings, 1 attempt) |
| 17 | 149 | 140-149 | none | fail (1 findings, 2 attempts) |
| 18 | 152 | 150-152 | none | pass (0 findings, 1 attempt) |
| 19 | 161 | 153-161 | none | fail (3 findings, 2 attempts) |
| 20 | 169 | 162-169 | none | error: parse |
| 21 | 172 | 170-172 | none | error: parse |
| 22 | 182 | 173-182 | none | error: parse |
| 23 | 195 | 183-195 | none | error: parse |
| 24 | 200 | 196-200 | none | fail (1 findings, 1 attempt) |
| 25 | 210 | 201-210 | none | error: parse |
| 26 | 215 | 211-215 | none | fail (2 findings, 1 attempt) |
| 27 | - | 216-222 | none | pass (0 findings, 1 attempt) |

## Fight statistics

- Rounds: 3
- Turns: 8 players, 8 npcs
- Attack rolls: 4 players, 6 npcs
- Hits: 1 players, 3 npcs
- Damage dealt: 8 players, 13 npcs
- Damage taken: 13 players, 8 npcs
- Reduced to zero: Tamsin Vale
- Death-save rolls: 1
- Fled or bargained: Morale clause triggered: Snag has called the halt and dropped the clapper, the goblins are withdrawing into the reeds. No one is still fighting — the encounter is over; Tamsin's dying and Pell's spear are a free-mode problem now.
- Narrations in turn mode: 17

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

Usage: 46 calls, 253040 input tokens, 29140 output tokens, cost $1.9937000000000002.

