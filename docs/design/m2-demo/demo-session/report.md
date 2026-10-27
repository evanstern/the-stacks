# Playtest audit — 20261027T021335Z-session-e8c848ec

**Verdict: incomplete**

- Session: e8c848ec-11e9-442d-9bfa-8c26a0d84fcd
- Seed: greyhollow-ford
- Commit: 2b9b1f1ecdb2fb74b21499635396ee7eeb765bc1
- Auditor mode: model
- Audited at: 2026-10-27T02:23:56.596Z

## Counts

| rows | narrations | segments | rolls | fail | warn | note |
|---|---|---|---|---|---|---|
| 333 | 44 | 44 | 32 | 11 | 24 | 23 |

## Findings

| id | severity | kind | source | segment | rows | doctrine | detail |
|---|---|---|---|---|---|---|---|
| F1 | warn | doctrine | auditor | 2 | 22, 23, 25 | fail-forward | The failed stealth check produces no new problem — the loft creaker neither reacts nor advances anything, leaving the scene stalled. |
| F2 | warn | doctrine | auditor | 2 | 25 | end-on-demand | The narration ends on a flat summary of the miss rather than anything that demands a response from the player. |
| F3 | warn | doctrine | auditor | 2 | 25 | blame-the-situation | "Tamsin Vale comes up short" pins the failure on the hero instead of on something the world did (a loose board, a shifting chain). |
| F4 | note | dm-audit-flag | dm-audit | 2 | 25 | - | final: fallback; attempts: 3; issues: invented-mechanics, doctrine, player-agency |
| F5 | warn | doctrine | auditor | 3 | 26, 33 | end-on-demand | Narration #33 closes with the direct prompt "What does Tamsin do with the loft gone quiet above her?" instead of ending on a world detail that demands response — the same closing-question habit already flagged in row #26. |
| F6 | fail | player-agency | auditor | 4 | 42 | hero-is-theirs | The closing line "What does Tamsin say to Wenna..." decides for the player that Tamsin speaks rather than acts, and names Wenna before the hero could know the name. |
| F7 | fail | player-agency | auditor | 7 | 58, 65 | hero-is-theirs | The player only asked Kestrel for a suggestion, but narration #65 decides that Tamsin Vale accepts and commits to the scouting plan. |
| F8 | warn | doctrine | auditor | 7 | 65 | end-on-demand | The turn closes on a flat summary line that gives the player nothing to respond to. |
| F9 | note | dm-audit-flag | dm-audit | 7 | 65 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F10 | warn | doctrine | auditor | 8 | 70, 74 | world-moves | The darkness tracker advanced to 3/4 but the narration shows no consequence of the failing light. |
| F11 | warn | doctrine | auditor | 8 | 74 | end-on-demand | The beat closes on stillness and an open prompt ('Nothing stirs nearby... What does Kestrel do now?') instead of something demanding a response. |
| F12 | note | dm-audit-flag | dm-audit | 8 | 74 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F13 | warn | doctrine | auditor | 9 | 83 | end-on-demand | The narration closes with a bare prompt ("What does Tamsin do...") rather than a world event that demands a response. |
| F14 | note | dm-audit-flag | dm-audit | 9 | 83 | - | final: passed-after-regenerate; attempts: 2; issues: doctrine |
| F15 | note | dm-audit-flag | dm-audit | 12 | 125 | - | final: fallback; attempts: 3; issues: ledger-mismatch |
| F16 | warn | doctrine | auditor | 13 | 126, 129 | one-sense | After three rejected attempts the surviving narration is a mechanical stub with no vivid sensory detail of what Snag actually did. |
| F17 | warn | doctrine | auditor | 13 | 129 | end-on-demand | The narration closes on a bare turn-order announcement that demands nothing of the player. |
| F18 | note | dm-audit-flag | dm-audit | 13 | 129 | - | final: fallback; attempts: 3; issues: player-agency, invented-mechanics, doctrine |
| F19 | fail | player-agency | auditor | 14 | 137, 130 | hero-is-theirs | The narration still dictates Tamsin's reaction and perception — "before Tamsin can even mark its face" and "before she can flinch away" — the same agency problem flagged at row #130. |
| F20 | note | dm-audit-flag | dm-audit | 14 | 137 | - | final: passed-after-regenerate; attempts: 2; issues: ledger-mismatch |
| F21 | note | dm-audit-flag | dm-audit | 15 | 140 | - | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, player-agency, other |
| F22 | fail | invented-mechanics | auditor | 16 | 147, 148, 152 | numbers-from-state | The narration asserts Odo has "no second mercy left in him tonight", declaring a depleted healing resource that no ledger row tracks or spends. |
| F23 | note | dm-audit-flag | dm-audit | 16 | 152 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F24 | warn | doctrine | auditor | 17 | 157, 161 | fail-forward | The miss produces no new problem or pressure — the narration just restates the whiff and passes the turn, stalling the scene. |
| F25 | warn | doctrine | auditor | 17 | 161 | blame-the-situation | The failed roll is narrated as "Tamsin Vale misses" with no world cause (mud, pot-helm, firelight) given for it. |
| F26 | warn | doctrine | auditor | 17 | 161 | end-on-demand | The turn closes on bookkeeping ("Kestrel moves next") rather than on something that demands a response. |
| F27 | note | dm-audit-flag | dm-audit | 17 | 161 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics |
| F28 | note | dm-audit-flag | dm-audit | 18 | 169 | - | final: passed-after-regenerate; attempts: 2; issues: doctrine |
| F29 | note | dm-audit-flag | dm-audit | 19 | 176 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, ledger-mismatch |
| F30 | warn | doctrine | auditor | 20 | 180 | end-on-demand | The narration is a flat turn-order status line ('Snag makes a move. Goblin lookout moves next.') that neither shows what Snag did nor ends on anything demanding a player response. |
| F31 | note | dm-audit-flag | dm-audit | 20 | 180 | - | final: fallback; attempts: 3; issues: player-agency, invented-mechanics, doctrine |
| F32 | fail | player-agency | auditor | 21 | 181, 184 | hero-is-theirs | After the row #181 flag that Pell is a party member only the player controls, the rewrite still narrates his action — 'Pell thrashes' — deciding a player character's move. |
| F33 | note | dm-audit-flag | dm-audit | 21 | 184 | - | final: passed-after-regenerate; attempts: 2; issues: doctrine |
| F34 | fail | player-agency | auditor | 22 | 187 | hero-is-theirs | The narration assigns the hero an inner state and inaction by calling Snag delighted at 'the big-feet's hesitation' and declaring Odo 'kneeling spent'. |
| F35 | note | dm-audit-flag | dm-audit | 22 | 187 | - | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, doctrine |
| F36 | note | dm-audit-flag | dm-audit | 25 | 220 | - | final: passed-after-regenerate; attempts: 2; issues: ledger-mismatch |
| F37 | warn | doctrine | auditor | 26 | 225 | end-on-demand | The beat closes on a static prompt — "What does the party do while he weighs his dwindling odds?" — instead of something that demands a response. |
| F38 | warn | doctrine | auditor | 28 | 231 | end-on-demand | The turn ends on a bare schedule note ("Brother Odo moves next") with the goblin's action left as an empty "makes a move", so nothing concrete demands a response. |
| F39 | note | dm-audit-flag | dm-audit | 28 | 231 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics |
| F40 | fail | ledger-contradiction | auditor | 30 | 248, 253 | numbers-from-state | The roll line calls Pell "her" but the narration calls Pell "he", contradicting the committed check description. |
| F41 | warn | doctrine | auditor | 30 | 253 | end-on-demand | The turn closes with the flat prompt "What does Kestrel do now?" instead of a pressure that demands a response. |
| F42 | warn | doctrine | auditor | 32 | 267 | end-on-demand | The turn closes on a bare turn-order note ("Snag moves next") instead of a concrete world event that demands the player's response, and never says what the pot-helmed goblin actually did. |
| F43 | note | dm-audit-flag | dm-audit | 32 | 267 | - | final: fallback; attempts: 3; issues: ledger-mismatch, invented-mechanics, doctrine |
| F44 | fail | invented-mechanics | auditor | 33 | 268, 271 | numbers-from-state | The narration again gives Snag a bleeding shoulder wound that row #268 already flagged as having no backing fact record. |
| F45 | warn | doctrine | auditor | 34 | 274 | end-on-demand | The turn closes on a flat procedural note ("Brother Odo moves next") with no concrete event from the goblin's action that demands a response. |
| F46 | note | dm-audit-flag | dm-audit | 34 | 274 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics |
| F47 | warn | doctrine | auditor | 35 | 283, 275 | end-on-demand | The narration closes with the direct prompt "What does Tamsin do?" instead of a world beat demanding response — the same flaw the audit flag at #275 already called out. |
| F48 | note | dm-audit-flag | dm-audit | 37 | 299 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, invented-mechanics, doctrine |
| F49 | fail | ledger-contradiction | auditor | 38 | 300, 302 | numbers-from-state | Row #300 states Snag and both remaining goblins fled, but the narration has only Snag and the pot-helm goblin leaving while the fire-goblin's coals hiss untended, dropping one fleeing goblin from the scene. |
| F50 | warn | doctrine | auditor | 38 | 302 | end-on-demand | The turn closes on a quiet, settled tableau and then asks "What does Tamsin do?", the exact pattern end-on-demand forbids. |
| F51 | note | dm-audit-flag | dm-audit | 38 | 302 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, invented-mechanics, doctrine |
| F52 | fail | ledger-contradiction | auditor | 39 | 303, 307 | - | The narration declares "No goblins left to fight for it now" and the camp abandoned, but the last recorded state has Snag and a pot-helmed goblin at the bloodied Tamsin's back with no row showing them killed, driven off or the clapper dropped. |
| F53 | warn | doctrine | auditor | 39 | 307 | end-on-demand | The turn closes on a quiet prompt, "What do you do about the rope?", instead of something in the world that demands a response. |
| F54 | note | dm-audit-flag | dm-audit | 39 | 307 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F55 | fail | player-agency | auditor | 41 | 317 | hero-is-theirs | The phrase "before she can wave him off" assigns Tamsin an intent and a thwarted gesture the player never declared. |
| F56 | warn | doctrine | auditor | 41 | 317 | end-on-demand | The beat closes on a settled, quiet tableau and a bare prompt ("What does Tamsin do with the rope?") rather than on something that demands a response. |
| F57 | note | dm-audit-flag | dm-audit | 41 | 317 | - | final: passed-after-regenerate; attempts: 3; issues: player-agency, doctrine |
| F58 | warn | doctrine | auditor | 42 | 326 | end-on-demand | Narration #326 closes on a slack prompt ("What does Tamsin do now that the line is caught?") instead of a world beat that demands a response. |

## Segments

| index | narration | rows | failing checks | auditor |
|---|---|---|---|---|
| 0 | 10 | 1-10 | none | pass (0 findings, 2 attempts) |
| 1 | 17 | 11-17 | none | pass (0 findings, 2 attempts) |
| 2 | 25 | 18-25 | none | fail (3 findings, 1 attempt) |
| 3 | 33 | 26-33 | none | fail (1 findings, 2 attempts) |
| 4 | 42 | 34-42 | none | fail (1 findings, 2 attempts) |
| 5 | 50 | 43-50 | none | error: parse |
| 6 | 55 | 51-55 | none | error: parse |
| 7 | 65 | 56-65 | none | fail (2 findings, 1 attempt) |
| 8 | 74 | 66-74 | none | fail (2 findings, 2 attempts) |
| 9 | 83 | 75-83 | none | fail (1 findings, 1 attempt) |
| 10 | 95 | 84-95 | none | error: parse |
| 11 | 118 | 96-118 | none | error: parse |
| 12 | 125 | 119-125 | none | pass (0 findings, 1 attempt) |
| 13 | 129 | 126-129 | none | fail (2 findings, 1 attempt) |
| 14 | 137 | 130-137 | none | fail (1 findings, 2 attempts) |
| 15 | 140 | 138-140 | none | pass (0 findings, 1 attempt) |
| 16 | 152 | 141-152 | none | fail (1 findings, 2 attempts) |
| 17 | 161 | 153-161 | none | fail (3 findings, 1 attempt) |
| 18 | 169 | 162-169 | none | error: parse |
| 19 | 176 | 170-176 | none | pass (0 findings, 1 attempt) |
| 20 | 180 | 177-180 | none | fail (1 findings, 1 attempt) |
| 21 | 184 | 181-184 | none | fail (1 findings, 1 attempt) |
| 22 | 187 | 185-187 | none | fail (1 findings, 2 attempts) |
| 23 | 196 | 188-196 | none | pass (0 findings, 1 attempt) |
| 24 | 208 | 197-208 | none | error: parse |
| 25 | 220 | 209-220 | none | pass (0 findings, 1 attempt) |
| 26 | 225 | 221-225 | none | fail (1 findings, 2 attempts) |
| 27 | 228 | 226-228 | none | pass (0 findings, 1 attempt) |
| 28 | 231 | 229-231 | none | fail (1 findings, 1 attempt) |
| 29 | 242 | 232-242 | none | error: parse |
| 30 | 253 | 243-253 | none | fail (2 findings, 2 attempts) |
| 31 | 264 | 254-264 | none | pass (0 findings, 2 attempts) |
| 32 | 267 | 265-267 | none | fail (1 findings, 1 attempt) |
| 33 | 271 | 268-271 | none | fail (1 findings, 1 attempt) |
| 34 | 274 | 272-274 | none | fail (1 findings, 1 attempt) |
| 35 | 283 | 275-283 | none | fail (1 findings, 1 attempt) |
| 36 | 291 | 284-291 | none | error: parse |
| 37 | 299 | 292-299 | none | pass (0 findings, 2 attempts) |
| 38 | 302 | 300-302 | none | fail (2 findings, 2 attempts) |
| 39 | 307 | 303-307 | none | fail (2 findings, 1 attempt) |
| 40 | 312 | 308-312 | none | error: parse |
| 41 | 317 | 313-317 | none | fail (2 findings, 2 attempts) |
| 42 | 326 | 318-326 | none | fail (1 findings, 1 attempt) |
| 43 | 332 | 327-332 | none | error: parse |

## Fight statistics

- Rounds: 5
- Turns: 12 players, 14 npcs
- Attack rolls: 4 players, 5 npcs
- Hits: 2 players, 3 npcs
- Damage dealt: 15 players, 15 npcs
- Damage taken: 15 players, 15 npcs
- Reduced to zero: none
- Death-save rolls: 0
- Fled or bargained: Encounter over: goblin-3 dead, Snag and both remaining goblins have fled into the reeds. No hostiles left on the mud island — initiative serves nothing.
- Narrations in turn mode: 27

## Models and usage

- playtest.audit: claude / cc/claude-opus-5
- dm.narrate: claude / cc/claude-sonnet-5

Usage: 68 calls, 370310 input tokens, 40896 output tokens, cost $2.873950000000001.

