# Playtest audit — 20261026T183818Z-greyhollow-ford-provider

**Verdict: incomplete**

- Session: 787ba795-b866-4e4d-9eb9-71176962863e
- Seed: greyhollow-ford
- Commit: fda4abf4a5520b2a7c906d446a790f263b69ed43
- Auditor mode: model
- Audited at: 2026-10-26T19:11:23.819Z

## Counts

| rows | narrations | segments | rolls | fail | warn | note |
|---|---|---|---|---|---|---|
| 286 | 38 | 38 | 33 | 7 | 31 | 25 |

## Findings

| id | severity | kind | source | segment | rows | doctrine | detail |
|---|---|---|---|---|---|---|---|
| F1 | warn | doctrine | auditor | 0 | 10 | end-on-demand | The narration closes on a static tableau and the open prompt "What does the party do?" rather than something that demands a response. |
| F2 | warn | doctrine | auditor | 0 | 10 | companion-opinions | Tamsin, Odo and Kestrel are all present but merely observe silently, with no voiced opinion or disagreement. |
| F3 | warn | doctrine | auditor | 0 | 10 | one-sense | The scene's details are sight and the absence of sound; no vivid non-visual sense detail is given. |
| F4 | fail | ledger-contradiction | auditor | 1 | 11, 16 | - | The journal records the ferry-house as a dark interior, but the narration lights the falling dust in "amber light" with no established source. |
| F5 | warn | doctrine | auditor | 1 | 16 | end-on-demand | The beat lands on a good demand but then appends the explicit prompt "What does Tamsin do about the loft?", the forbidden "what do you do" tag. |
| F6 | warn | doctrine | auditor | 1 | 16 | companion-opinions | Odo and Kestrel appear only as silent props with no voice or opinion in the scene. |
| F7 | warn | doctrine | auditor | 3 | 34 | end-on-demand | The beat closes on a static tableau plus the limp prompt "What does the party do with the lookout in sight?" instead of a world action that demands a response. |
| F8 | note | dm-audit-flag | dm-audit | 3 | 34 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F9 | note | dm-audit-flag | dm-audit | 6 | 68 | - | final: passed-after-regenerate; attempts: 2; issues: ledger-mismatch |
| F10 | warn | doctrine | auditor | 8 | 85 | fail-forward | The miss produces no new problem or consequence — the narration just restates the mechanical result and stalls the scene amid four readied slings. |
| F11 | warn | doctrine | auditor | 8 | 85 | end-on-demand | The turn ends on the bookkeeping line "Kestrel moves next" rather than on anything that demands a response. |
| F12 | warn | doctrine | auditor | 8 | 85 | blame-the-situation | "Tamsin Vale misses" pins the failed roll on the hero instead of showing what the world did to the attempt. |
| F13 | note | dm-audit-flag | dm-audit | 8 | 85 | - | final: fallback; attempts: 3; issues: ledger-mismatch, doctrine, player-agency |
| F14 | warn | doctrine | auditor | 9 | 95 | end-on-demand | The turn closes with a bare prompt to the player ('What does Tamsin do with the lookout still hidden behind the flames?') instead of a world event that demands a response. |
| F15 | note | dm-audit-flag | dm-audit | 9 | 95 | - | final: passed-after-regenerate; attempts: 3; issues: player-agency, invented-mechanics, doctrine |
| F16 | warn | doctrine | auditor | 11 | 104, 107 | fail-forward | The roll resolved as a failure in #104, but the prose of #107 narrates only the goblin's successful-looking lunge and never shows the attempt coming apart or the new problem it creates. |
| F17 | warn | doctrine | auditor | 12 | 110 | end-on-demand | The turn ends on a bare turn-order announcement ("Goblin lookout moves next") with no concrete event or pressure that demands a player response. |
| F18 | note | dm-audit-flag | dm-audit | 12 | 110 | - | final: fallback; attempts: 3; issues: doctrine, player-agency, invented-mechanics |
| F19 | fail | player-agency | auditor | 13 | 111, 117 | numbers-from-state | The rewritten narration repeats the exact problem flagged in #111 — asserting Tamsin's wounded state ('sways in the mud, blood dark along her sleeve') with no recorded damage or wound fact in the ledger. |
| F20 | note | dm-audit-flag | dm-audit | 13 | 117 | - | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, player-agency, doctrine |
| F21 | note | dm-audit-flag | dm-audit | 14 | 127 | - | final: passed-after-regenerate; attempts: 2; issues: ledger-mismatch |
| F22 | note | dm-audit-flag | dm-audit | 15 | 138 | - | final: passed-after-regenerate; attempts: 3; issues: doctrine, player-agency, ledger-mismatch |
| F23 | note | dm-audit-flag | dm-audit | 17 | 152 | - | final: fallback; attempts: 3; issues: ledger-mismatch, player-agency, doctrine |
| F24 | fail | player-agency | auditor | 18 | 158 | hero-is-theirs | The narration decides Tamsin's move with 'she wrenches away before the grip can set', when the failed goblin roll should be rendered as the world's doing (grip slipping on blood-slick leather) without moving the hero. |
| F25 | warn | doctrine | auditor | 19 | 161 | end-on-demand | The turn narration is a bare turn-order announcement — Snag's unspecified 'move' gives the player nothing concrete to respond to. |
| F26 | note | dm-audit-flag | dm-audit | 19 | 161 | - | final: fallback; attempts: 3; issues: invented-mechanics, player-agency, doctrine |
| F27 | warn | doctrine | auditor | 20 | 165 | end-on-demand | The turn ends on a bare turn-order announcement that demands no response from the player. |
| F28 | warn | doctrine | auditor | 20 | 165 | world-moves | The lookout's action is asserted without any shown consequence, leaving the scene frozen between beats. |
| F29 | warn | doctrine | auditor | 20 | 165 | one-sense | The beat offers no vivid non-visual detail at all, only a mechanical statement of whose turn it is. |
| F30 | note | dm-audit-flag | dm-audit | 20 | 165 | - | final: fallback; attempts: 3; issues: invented-mechanics, doctrine, player-agency |
| F31 | note | dm-audit-flag | dm-audit | 21 | 175 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F32 | fail | ledger-contradiction | auditor | 22 | 176, 184 | - | Row #176 names Snag as the pot-helm goblin, but the narration treats Snag and the pot-helm goblin as two separate creatures acting independently. |
| F33 | note | dm-audit-flag | dm-audit | 22 | 184 | - | final: passed-after-regenerate; attempts: 3; issues: player-agency, doctrine |
| F34 | note | dm-audit-flag | dm-audit | 23 | 195 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics |
| F35 | warn | doctrine | auditor | 24 | 201, 196 | end-on-demand | The turn closes with the flat prompt "What does Tamsin do?" instead of a world beat that demands a response — the same ending flaw already flagged in the audit note at #196. |
| F36 | note | dm-audit-flag | dm-audit | 24 | 201 | - | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, player-agency, doctrine |
| F37 | fail | player-agency | auditor | 25 | 206 | hero-is-theirs | The narration decides Tamsin's action for her — "Tamsin twists her arm free before it can set, boots skidding" — when the failed grab should only describe what the world did. |
| F38 | warn | doctrine | auditor | 25 | 206 | end-on-demand | The beat closes on the bare prompt "What does Tamsin do?" instead of a pressure that demands a response. |
| F39 | warn | doctrine | auditor | 26 | 209 | end-on-demand | The turn closes on a bare turn-order note ('Goblin lookout moves next') rather than a concrete event that demands a response, and never says what Snag actually did. |
| F40 | note | dm-audit-flag | dm-audit | 26 | 209 | - | final: fallback; attempts: 3; issues: invented-mechanics, player-agency, doctrine |
| F41 | warn | doctrine | auditor | 27 | 214, 210 | end-on-demand | The closing line 'Legs free, blade still in hand — what does Tamsin do?' ends on a direct prompt rather than a world event that demands response, repeating the exact fault already flagged in row #210. |
| F42 | note | dm-audit-flag | dm-audit | 28 | 226 | - | final: fallback; attempts: 3; issues: ledger-mismatch, player-agency, doctrine |
| F43 | warn | doctrine | auditor | 29 | 228, 229, 232, 235 | world-moves | With a resolved attack and an ongoing grapple and sling-ready goblin on the ledger, the narration shows no consequence or movement in the scene at all. |
| F44 | warn | doctrine | auditor | 29 | 235 | end-on-demand | The turn closes with a bare prompt ('What does Tamsin Vale do?') instead of something in the world that demands a response. |
| F45 | note | dm-audit-flag | dm-audit | 29 | 235 | - | final: fallback; attempts: 3; issues: ledger-mismatch |
| F46 | note | dm-audit-flag | dm-audit | 30 | 245 | - | final: passed-after-regenerate; attempts: 2; issues: ledger-mismatch |
| F47 | fail | player-agency | auditor | 31 | 250 | hero-is-theirs | The narration dictates Tamsin's actions — she "wrenches clear" with "blade still steady in her grip" — instead of only describing what the world did. |
| F48 | warn | doctrine | auditor | 32 | 253 | end-on-demand | The turn ends on a bare turn-order announcement with nothing that demands a response from the player. |
| F49 | note | dm-audit-flag | dm-audit | 32 | 253 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics |
| F50 | warn | doctrine | auditor | 33 | 257 | end-on-demand | The turn closes on a bare turn-order announcement rather than anything that demands a player response. |
| F51 | warn | doctrine | auditor | 33 | 257 | world-moves | The goblin lookout's action is asserted abstractly ('makes a move') with no shown consequence in the world. |
| F52 | warn | doctrine | auditor | 33 | 257 | plain-prose | The story slot contains turn-tracker bookkeeping instead of prose, leaving the beat with no scene content. |
| F53 | note | dm-audit-flag | dm-audit | 33 | 257 | - | final: fallback; attempts: 3; issues: invented-mechanics, player-agency, doctrine |
| F54 | fail | ledger-contradiction | auditor | 34 | 260, 261, 262, 264, 265 | - | Narration #265 declares Odo 'cannot do that here' although rows #260–#264 record his bargain as declared, committed, resolved, and the explicit cause of the encounter ending. |
| F55 | warn | doctrine | auditor | 34 | 265 | end-on-demand | The closing line is a flat refusal and a settled 'the fighting stops', offering nothing that demands a response from the player. |
| F56 | note | dm-audit-flag | dm-audit | 34 | 265 | - | final: fallback; attempts: 3; issues: invented-mechanics, doctrine, ledger-mismatch, player-agency |
| F57 | warn | doctrine | auditor | 35 | 271 | end-on-demand | The turn closes with a bare prompt ("What does Tamsin do with what she's found?") instead of a world event that demands a response. |
| F58 | warn | doctrine | auditor | 35 | 271 | one-clue | Three discoveries land in one beat — the sliced non-goblin clapper strap, the stamped coin in the mud, and Pell's tell-tale behavior — instead of at most one real clue. |
| F59 | note | dm-audit-flag | dm-audit | 35 | 271 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F60 | warn | doctrine | auditor | 36 | 276, 277 | fail-forward | The action resolved in row 276 but the narration shows no world response or new problem, stalling the scene. |
| F61 | warn | doctrine | auditor | 36 | 277 | end-on-demand | The narration closes on a flat restatement of the declared action and gives the player nothing to respond to. |
| F62 | note | dm-audit-flag | dm-audit | 36 | 277 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F63 | note | dm-audit-flag | dm-audit | 37 | 285 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |

## Segments

| index | narration | rows | failing checks | auditor |
|---|---|---|---|---|
| 0 | 10 | 1-10 | none | fail (3 findings, 2 attempts) |
| 1 | 16 | 11-16 | none | fail (3 findings, 2 attempts) |
| 2 | 25 | 17-25 | none | error: parse |
| 3 | 34 | 26-34 | none | fail (1 findings, 2 attempts) |
| 4 | 55 | 35-55 | none | error: parse |
| 5 | 61 | 56-61 | none | pass (0 findings, 2 attempts) |
| 6 | 68 | 62-68 | none | error: parse |
| 7 | 75 | 69-75 | none | pass (0 findings, 2 attempts) |
| 8 | 85 | 76-85 | none | fail (3 findings, 1 attempt) |
| 9 | 95 | 86-95 | none | fail (1 findings, 2 attempts) |
| 10 | 102 | 96-102 | none | error: parse |
| 11 | 107 | 103-107 | none | fail (1 findings, 1 attempt) |
| 12 | 110 | 108-110 | none | fail (1 findings, 1 attempt) |
| 13 | 117 | 111-117 | none | fail (1 findings, 1 attempt) |
| 14 | 127 | 118-127 | none | error: parse |
| 15 | 138 | 128-138 | none | error: parse |
| 16 | 147 | 139-147 | none | pass (0 findings, 2 attempts) |
| 17 | 152 | 148-152 | none | pass (0 findings, 1 attempt) |
| 18 | 158 | 153-158 | none | fail (1 findings, 2 attempts) |
| 19 | 161 | 159-161 | none | fail (1 findings, 1 attempt) |
| 20 | 165 | 162-165 | none | fail (3 findings, 1 attempt) |
| 21 | 175 | 166-175 | none | pass (0 findings, 1 attempt) |
| 22 | 184 | 176-184 | none | fail (1 findings, 2 attempts) |
| 23 | 195 | 185-195 | none | pass (0 findings, 1 attempt) |
| 24 | 201 | 196-201 | none | fail (1 findings, 1 attempt) |
| 25 | 206 | 202-206 | none | fail (2 findings, 1 attempt) |
| 26 | 209 | 207-209 | none | fail (1 findings, 1 attempt) |
| 27 | 214 | 210-214 | none | fail (1 findings, 1 attempt) |
| 28 | 226 | 215-226 | none | error: parse |
| 29 | 235 | 227-235 | none | fail (2 findings, 1 attempt) |
| 30 | 245 | 236-245 | none | error: parse |
| 31 | 250 | 246-250 | none | fail (1 findings, 2 attempts) |
| 32 | 253 | 251-253 | none | fail (1 findings, 1 attempt) |
| 33 | 257 | 254-257 | none | fail (3 findings, 1 attempt) |
| 34 | 265 | 258-265 | none | fail (2 findings, 1 attempt) |
| 35 | 271 | 266-271 | none | fail (2 findings, 1 attempt) |
| 36 | 277 | 272-277 | none | fail (2 findings, 1 attempt) |
| 37 | 285 | 278-285 | none | error: parse |

## Fight statistics

- Rounds: 5
- Turns: 12 players, 17 npcs
- Attack rolls: 8 players, 6 npcs
- Hits: 3 players, 2 npcs
- Damage dealt: 15 players, 11 npcs
- Damage taken: 11 players, 15 npcs
- Reduced to zero: none
- Death-save rolls: 0
- Fled or bargained: Morale condition met — two goblins down, Snag offers the clapper for safe passage; Odo's bargain closes the encounter, no further rounds needed.
- Narrations in turn mode: 30

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

Usage: 57 calls, 312518 input tokens, 34610 output tokens, cost $2.4278400000000007.

