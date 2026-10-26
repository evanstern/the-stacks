# Playtest audit — 20261026T155348Z-greyhollow-ford-provider

**Verdict: incomplete**

- Session: ab05e88a-0ad5-428b-83a9-c396c4308d6a
- Seed: greyhollow-ford
- Commit: 5fd107fcad3ed65d54cc1650bc59826082eb5090
- Auditor mode: model
- Audited at: 2026-10-26T16:16:02.034Z

## Counts

| rows | narrations | segments | rolls | fail | warn | note |
|---|---|---|---|---|---|---|
| 229 | 29 | 29 | 26 | 11 | 36 | 25 |

## Findings

| id | severity | kind | source | segment | rows | doctrine | detail |
|---|---|---|---|---|---|---|---|
| F1 | warn | doctrine | auditor | 0 | 10 | end-on-demand | The turn ends on ambient scenery (light bleeding out of the sky) rather than the live hook of the creaking loft, so nothing demands a response. |
| F2 | warn | doctrine | auditor | 1 | 13, 16, 17 | fail-forward | The resolved search produces "nothing changes", stalling the scene instead of creating a new problem. |
| F3 | warn | doctrine | auditor | 1 | 15, 17 | world-moves | The darkness tracker advanced but the narration shows no consequence of the world moving. |
| F4 | warn | doctrine | auditor | 1 | 17 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. |
| F5 | warn | doctrine | auditor | 1 | 17 | one-sense | The beat offers no vivid non-visual detail, only an abstract statement that nothing happened. |
| F6 | note | dm-audit-flag | dm-audit | 1 | 17 | - | final: fallback; attempts: 3; issues: ledger-mismatch, doctrine |
| F7 | fail | hidden-info-leak | auditor | 2 | 19 | one-clue | Odo publicly states that goblins prize noise-makers as a ward against worse things and links it to the silenced bell, revealing the dm-only motive in one go. |
| F8 | note | dm-audit-flag | dm-audit | 2 | 25 | - | final: passed-after-regenerate; attempts: 3; issues: invented-mechanics, player-agency, doctrine |
| F9 | fail | ledger-contradiction | auditor | 3 | 28, 36 | numbers-from-state | Narration invents "the safe stones Wenna marked" although row #28 records that Wenna would not answer the party at all, so she marked nothing. |
| F10 | fail | ledger-contradiction | auditor | 3 | 30, 33, 34, 36 | dice-stand | The player followed the old timber posts and the check succeeded, yet the narration says the posts guided Tamsin off the safe path, inverting the successful result. |
| F11 | note | dm-audit-flag | dm-audit | 3 | 36 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F12 | fail | ledger-contradiction | auditor | 4 | 38, 39, 53, 54, 55 | - | The narration says Kestrel cannot act, but the ledger committed and resolved her shot and the table-mode note states she loosed on the lookout and initiative stands. |
| F13 | warn | doctrine | auditor | 4 | 38, 55 | yes-and | A declared, plausible action is met with a flat refusal instead of a resolved outcome or a set DC. |
| F14 | warn | doctrine | auditor | 4 | 55 | end-on-demand | The turn closes on a flat summary that nothing in the fiction demands a response to, and never shows what the arrow did to the camp. |
| F15 | note | dm-audit-flag | dm-audit | 4 | 55 | - | final: fallback; attempts: 3; issues: invented-mechanics, player-agency, doctrine |
| F16 | warn | doctrine | auditor | 5 | 60 | end-on-demand | Narration #60 is a bare placeholder ('Snag acts.') that states nothing concrete and gives the player nothing to respond to. |
| F17 | note | dm-audit-flag | dm-audit | 5 | 60 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics |
| F18 | warn | doctrine | auditor | 6 | 62, 63, 66 | plain-prose | The narration is only a restatement of the roll line and the attack label, with no prose rendering of what the thrown dagger did in the world. |
| F19 | warn | doctrine | auditor | 6 | 66 | end-on-demand | The turn closes on a flat mechanical statement of the miss, giving the player nothing that demands a response even though the goblin just raised the alarm. |
| F20 | note | dm-audit-flag | dm-audit | 6 | 66 | - | final: fallback; attempts: 1; issues: none |
| F21 | fail | invented-mechanics | auditor | 7 | 72, 73, 77 | numbers-from-state | Narration #77 states "vs DC 18" though no row (#72 roll, #73 resolution) records a DC, so the number is not drawn from state. |
| F22 | warn | doctrine | auditor | 7 | 77 | end-on-demand | The narration is only a restatement of the roll and ends on "success" rather than on anything the goblins or the world do that demands a response. |
| F23 | note | dm-audit-flag | dm-audit | 7 | 77 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F24 | warn | doctrine | auditor | 8 | 79, 82, 89 | world-moves | Tamsin broke parley inside an occupied goblin camp, yet the narration shows no reaction from Snag or the camp around her. |
| F25 | warn | doctrine | auditor | 8 | 89 | end-on-demand | The narration is a bare mechanical recap that closes on a damage line instead of a moment demanding the player's response. |
| F26 | note | dm-audit-flag | dm-audit | 8 | 89 | - | final: fallback; attempts: 3; issues: ledger-mismatch, doctrine, player-agency |
| F27 | warn | doctrine | auditor | 10 | 103 | end-on-demand | The narration states only that the goblin "acts" without any concrete action, detail or threat, so it ends on a non-event rather than something that demands a response. |
| F28 | note | dm-audit-flag | dm-audit | 10 | 103 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F29 | warn | doctrine | auditor | 11 | 107 | end-on-demand | The narration is a bare label announcing that a goblin acts, with no concrete event or pressure for the player to respond to. |
| F30 | note | dm-audit-flag | dm-audit | 11 | 107 | - | final: fallback; attempts: 3; issues: player-agency, invented-mechanics, doctrine, ledger-mismatch |
| F31 | warn | doctrine | auditor | 12 | 111 | end-on-demand | "Snag acts." states nothing concrete and leaves the player nothing to respond to. |
| F32 | warn | doctrine | auditor | 12 | 111 | npc-voice | Named NPC Snag acts with no voice, want, or concrete detail shown. |
| F33 | note | dm-audit-flag | dm-audit | 12 | 111 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, other |
| F34 | note | dm-audit-flag | dm-audit | 13 | 119 | - | final: passed-after-regenerate; attempts: 3; issues: ledger-mismatch, player-agency, doctrine |
| F35 | warn | doctrine | auditor | 14 | 122, 125 | fail-forward | The resolved action is narrated as "nothing changes", stalling the scene instead of creating a new problem. |
| F36 | warn | doctrine | auditor | 14 | 125 | end-on-demand | The turn closes on a flat non-event that gives the player nothing to respond to. |
| F37 | note | dm-audit-flag | dm-audit | 14 | 125 | - | final: fallback; attempts: 3; issues: doctrine, player-agency, ledger-mismatch |
| F38 | warn | doctrine | auditor | 15 | 131, 135 | fail-forward | The miss produces nothing but the dice line, so the failure stalls the scene instead of creating a new problem. |
| F39 | warn | doctrine | auditor | 15 | 135 | end-on-demand | The turn ends on a bare mechanical result with nothing demanding a response from the player. |
| F40 | warn | doctrine | auditor | 15 | 135 | blame-the-situation | The failed swing is reported as 'Tamsin Vale misses' rather than as something the world did to the attempt. |
| F41 | note | dm-audit-flag | dm-audit | 15 | 135 | - | final: fallback; attempts: 3; issues: doctrine, player-agency |
| F42 | warn | doctrine | auditor | 16 | 137 | numbers-from-state | Kestrel asserts "one hit left in me" as a hit-point figure with no ledger row establishing that state. |
| F43 | warn | doctrine | auditor | 16 | 139, 141, 144 | fail-forward | Kestrel's declared dive to cover resolves into "nothing changes," stalling the scene instead of producing a new problem or consequence. |
| F44 | warn | doctrine | auditor | 16 | 144 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. |
| F45 | note | dm-audit-flag | dm-audit | 16 | 144 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, other, ledger-mismatch |
| F46 | note | dm-audit-flag | dm-audit | 17 | 152 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, ledger-mismatch, invented-mechanics |
| F47 | warn | doctrine | auditor | 18 | 156 | end-on-demand | The narration is a bare turn label that reports no concrete event or hook, giving the player nothing that demands a response after the turn advanced in row #154. |
| F48 | note | dm-audit-flag | dm-audit | 18 | 156 | - | final: fallback; attempts: 3; issues: ledger-mismatch, player-agency, doctrine |
| F49 | fail | hidden-info-leak | auditor | 19 | 160 | one-clue | The narration states Snag's hidden motive outright — that the clapper's ring keeps the river-things off his camp — exposing dm-only information in public text. |
| F50 | note | dm-audit-flag | dm-audit | 19 | 160 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F51 | warn | doctrine | auditor | 20 | 163 | end-on-demand | The turn closes on a bare label stating the lookout acts, giving the player nothing concrete to respond to. |
| F52 | warn | doctrine | auditor | 20 | 163 | plain-prose | "Goblin lookout acts." is a stage-direction stub rather than the plain prose the story requires. |
| F53 | note | dm-audit-flag | dm-audit | 20 | 163 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, ledger-mismatch |
| F54 | fail | player-agency | auditor | 21 | 174 | hero-is-theirs | The narration moves and poses the player character, deciding that Pell scrambles free, clutches his spear tight and keeps his eyes on the goblin. |
| F55 | warn | doctrine | auditor | 21 | 174 | end-on-demand | The beat closes on the hero's own posture with the goblin already withdrawing, leaving nothing that demands a response. |
| F56 | fail | hidden-info-leak | auditor | 22 | 185 | one-clue | The narration's public text names "Snag's truce with Odo", exposing the DM-only deal in which Snag trades the clapper for safe passage. |
| F57 | warn | doctrine | auditor | 22 | 185 | end-on-demand | The prose stops on a flat status report ("Goblin lookout is wounded.") with nothing pressing the player for a response. |
| F58 | warn | doctrine | auditor | 22 | 185 | one-sense | The beat gives no non-visual sensory detail, only a restatement of the mechanical result. |
| F59 | note | dm-audit-flag | dm-audit | 22 | 185 | - | final: fallback; attempts: 3; issues: ledger-mismatch, doctrine, player-agency |
| F60 | fail | ledger-contradiction | auditor | 23 | 187, 186 | numbers-from-state | Kestrel's talk asserts Snag and his rope and charm as established facts, which row 186 flags as unsupported by state. |
| F61 | fail | hidden-info-leak | auditor | 23 | 187 | one-clue | Naming Snag in public talk surfaces a DM-only figure before any public row introduced him. |
| F62 | warn | doctrine | auditor | 23 | 196 | end-on-demand | The narration closes on a bare miss report with nothing pressing the player for a response. |
| F63 | warn | doctrine | auditor | 23 | 196 | blame-the-situation | The miss is reported as 'Kestrel misses' rather than framed as the world's doing. |
| F64 | note | dm-audit-flag | dm-audit | 23 | 196 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F65 | note | dm-audit-flag | dm-audit | 24 | 202 | - | final: fallback; attempts: 3; issues: ledger-mismatch |
| F66 | fail | ledger-contradiction | auditor | 25 | 204, 205, 208 | numbers-from-state | The prose names Pell as the target of Goblin-4's lunge while the ledger rows and the dice line both name Tamsin. |
| F67 | note | dm-audit-flag | dm-audit | 25 | 208 | - | final: passed-after-regenerate; attempts: 3; issues: player-agency, doctrine |
| F68 | warn | doctrine | auditor | 26 | 211 | end-on-demand | The narration states only that Snag acts, giving the player nothing concrete to respond to. |
| F69 | note | dm-audit-flag | dm-audit | 26 | 211 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics |
| F70 | warn | doctrine | auditor | 27 | 213, 214, 217 | fail-forward | Row 213 declares the goblin lashes out and then flees into the reeds, but the narration reports only the miss and never shows the escape or the new problem it creates, leaving the scene stalled. |
| F71 | warn | doctrine | auditor | 27 | 217 | end-on-demand | The turn ends on a bare restatement of the dice line ('vs AC 16: miss') with nothing pressing on the player, rather than on a beat that demands a response. |
| F72 | note | dm-audit-flag | dm-audit | 27 | 217 | - | final: fallback; attempts: 3; issues: invented-mechanics, doctrine, ledger-mismatch |

## Segments

| index | narration | rows | failing checks | auditor |
|---|---|---|---|---|
| 0 | 10 | 1-10 | none | fail (1 findings, 2 attempts) |
| 1 | 17 | 11-17 | none | fail (4 findings, 1 attempt) |
| 2 | 25 | 18-25 | none | fail (1 findings, 2 attempts) |
| 3 | 36 | 26-36 | none | fail (2 findings, 2 attempts) |
| 4 | 55 | 37-55 | none | fail (3 findings, 1 attempt) |
| 5 | 60 | 56-60 | none | fail (1 findings, 1 attempt) |
| 6 | 66 | 61-66 | none | fail (2 findings, 1 attempt) |
| 7 | 77 | 67-77 | none | fail (2 findings, 1 attempt) |
| 8 | 89 | 78-89 | none | fail (2 findings, 1 attempt) |
| 9 | 100 | 90-100 | none | pass (0 findings, 2 attempts) |
| 10 | 103 | 101-103 | none | fail (1 findings, 1 attempt) |
| 11 | 107 | 104-107 | none | fail (1 findings, 1 attempt) |
| 12 | 111 | 108-111 | none | fail (2 findings, 1 attempt) |
| 13 | 119 | 112-119 | none | error: parse |
| 14 | 125 | 120-125 | none | fail (2 findings, 1 attempt) |
| 15 | 135 | 126-135 | none | fail (3 findings, 2 attempts) |
| 16 | 144 | 136-144 | none | fail (3 findings, 1 attempt) |
| 17 | 152 | 145-152 | none | pass (0 findings, 1 attempt) |
| 18 | 156 | 153-156 | none | fail (1 findings, 1 attempt) |
| 19 | 160 | 157-160 | none | fail (1 findings, 2 attempts) |
| 20 | 163 | 161-163 | none | fail (2 findings, 1 attempt) |
| 21 | 174 | 164-174 | none | fail (2 findings, 2 attempts) |
| 22 | 185 | 175-185 | none | fail (3 findings, 1 attempt) |
| 23 | 196 | 186-196 | none | fail (4 findings, 2 attempts) |
| 24 | 202 | 197-202 | none | pass (0 findings, 1 attempt) |
| 25 | 208 | 203-208 | none | fail (1 findings, 1 attempt) |
| 26 | 211 | 209-211 | none | fail (1 findings, 1 attempt) |
| 27 | 217 | 212-217 | none | fail (2 findings, 1 attempt) |
| 28 | 228 | 218-228 | none | error: parse |

## Fight statistics

- Rounds: 4
- Turns: 10 players, 14 npcs
- Attack rolls: 5 players, 6 npcs
- Hits: 2 players, 2 npcs
- Damage dealt: 14 players, 15 npcs
- Damage taken: 15 players, 14 npcs
- Reduced to zero: none
- Death-save rolls: 0
- Fled or bargained: unknown (No encounter.ended, combatant.removed or scene-ending scene.changed row was logged, so how the fight ended is unknown.)
- Narrations in turn mode: 25

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

Usage: 39 calls, 206548 input tokens, 21261 output tokens, cost $1.564265.

