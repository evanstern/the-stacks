# Playtest audit — 20261026T171359Z-greyhollow-ford-provider

**Verdict: incomplete**

- Session: aa5fd84f-4484-4b96-a795-bfc3bc729ba1
- Seed: greyhollow-ford
- Commit: 1db60e3007b49f301b3e663e2f56534adb2cff1b
- Auditor mode: model
- Audited at: 2026-10-26T17:47:50.431Z

## Counts

| rows | narrations | segments | rolls | fail | warn | note |
|---|---|---|---|---|---|---|
| 301 | 39 | 39 | 14 | 13 | 64 | 32 |

## Findings

| id | severity | kind | source | segment | rows | doctrine | detail |
|---|---|---|---|---|---|---|---|
| F1 | warn | doctrine | auditor | 1 | 15, 16 | fail-forward | The resolved search produces nothing at all, stalling the scene instead of creating a new problem. |
| F2 | warn | doctrine | auditor | 1 | 16 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. |
| F3 | note | dm-audit-flag | dm-audit | 1 | 16 | - | final: fallback; attempts: 3; issues: ledger-mismatch, player-agency, doctrine, invented-mechanics |
| F4 | warn | doctrine | auditor | 3 | 29, 32, 33 | fail-forward | The resolved action into the reeds produces "nothing changes" — a stalled scene with no new problem. |
| F5 | warn | doctrine | auditor | 3 | 31, 33 | world-moves | The dark-falls tracker advanced to 3/4 but the narration shows no consequence of the world moving. |
| F6 | warn | doctrine | auditor | 3 | 33 | end-on-demand | The narration ends on a dead beat that gives the player nothing to respond to. |
| F7 | note | dm-audit-flag | dm-audit | 3 | 33 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, ledger-mismatch |
| F8 | warn | doctrine | auditor | 4 | 53 | end-on-demand | Narration #53 ends on a flat meta-summary ('The party enters a fight') rather than a concrete beat that demands a response. |
| F9 | warn | doctrine | auditor | 4 | 53 | fail-forward | 'Tamsin Vale acts, and nothing changes' stalls the scene instead of turning the failure into a new problem. |
| F10 | warn | doctrine | auditor | 4 | 53 | plain-prose | 'One action needs a clearer description' is out-of-fiction system commentary in place of prose. |
| F11 | warn | doctrine | auditor | 4 | 53 | world-not-hero | Four combatants and a triggered lookout sighting (rows 39-42, 51) are reduced to an abstract statement with no world detail or named threat. |
| F12 | note | dm-audit-flag | dm-audit | 4 | 53 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, other |
| F13 | warn | doctrine | auditor | 5 | 55, 58 | world-moves | The alert tracker filled to 3/3 at row #55, but the narration at row #58 shows no consequence of the camp being fully alerted. |
| F14 | warn | doctrine | auditor | 5 | 58 | end-on-demand | The narration is a two-word stub that names an action without showing anything concrete, so it leaves nothing for the player to respond to. |
| F15 | warn | doctrine | auditor | 5 | 58 | one-sense | The scene offers no vivid non-visual detail at all, only the bare assertion that Snag acts. |
| F16 | note | dm-audit-flag | dm-audit | 5 | 58 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F17 | fail | ledger-contradiction | auditor | 6 | 60, 61, 64 | - | The ledger resolves a melee jab by Goblin-3 at Tamsin, but the narration recasts it as a dagger thrown down from a lookout above in the reeds. |
| F18 | note | dm-audit-flag | dm-audit | 6 | 64 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F19 | warn | doctrine | auditor | 8 | 77, 80 | fail-forward | The attack resolved in the ledger but the narration says nothing changes, stalling the scene instead of creating a new problem. |
| F20 | warn | doctrine | auditor | 8 | 80 | end-on-demand | The turn ends on a flat non-event that gives the player nothing to respond to. |
| F21 | warn | other | auditor | 8 | 80 | - | The second sentence is out-of-fiction meta-commentary about the player's phrasing rather than prose narration of the world. |
| F22 | note | dm-audit-flag | dm-audit | 8 | 80 | - | final: fallback; attempts: 3; issues: doctrine, player-agency, other, ledger-mismatch |
| F23 | fail | ledger-contradiction | auditor | 9 | 85, 86, 88 | fail-forward | The ledger records a real shift — encounter ended, initiative dropped, the scene turned social — but the narration says "nothing changes," stalling a beat the state says moved. |
| F24 | warn | doctrine | auditor | 9 | 88 | end-on-demand | The turn closes on the flat summary "The fight is over," offering nothing that demands a response from the player while Snag stands there listening. |
| F25 | note | dm-audit-flag | dm-audit | 9 | 88 | - | final: fallback; attempts: 1; issues: none |
| F26 | warn | doctrine | auditor | 10 | 90, 95 | fail-forward | The miss is narrated as nothing changing, stalling the scene instead of creating a new problem. |
| F27 | fail | hidden-info-leak | auditor | 10 | 93 | - | Odo publicly states the clapper wards off worse things than the party, revealing the DM-only fact that the bell's ring drives off the river-things the goblins fear. |
| F28 | warn | doctrine | auditor | 10 | 95 | end-on-demand | The turn ends on a flat non-event plus a meta request rather than something demanding a response. |
| F29 | warn | doctrine | auditor | 10 | 95 | plain-prose | The narration breaks the fiction with an out-of-world instruction about action descriptions. |
| F30 | note | dm-audit-flag | dm-audit | 10 | 95 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F31 | warn | doctrine | auditor | 11 | 98, 101 | ask-when-unclear | If 'I press on toward the ferry before dark' was too vague, the narration should have asked one short in-fiction question rather than reporting that an action 'needs a clearer description'. |
| F32 | warn | doctrine | auditor | 11 | 100, 101 | fail-forward | The resolved action produces 'nothing changes', stalling the scene instead of creating a new problem. |
| F33 | warn | doctrine | auditor | 11 | 101 | end-on-demand | The turn ends on a flat non-event plus a meta note, giving the player nothing that demands a response. |
| F34 | note | dm-audit-flag | dm-audit | 11 | 101 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F35 | warn | doctrine | auditor | 12 | 107, 108 | fail-forward | The resolved action produces a flat stall ('nothing changes') with no new problem for the scene. |
| F36 | warn | doctrine | auditor | 12 | 108 | end-on-demand | Narration closes on an out-of-fiction request for a clearer description instead of something in the world that demands a response. |
| F37 | note | dm-audit-flag | dm-audit | 12 | 108 | - | final: fallback; attempts: 3; issues: doctrine, player-agency, other |
| F38 | warn | doctrine | auditor | 13 | 111, 113, 114 | fail-forward | The action resolved at #113 but narration #114 says nothing changes, stalling the scene instead of creating a new problem. |
| F39 | warn | doctrine | auditor | 13 | 114 | end-on-demand | The turn ends on a flat non-event with nothing in the world demanding a response. |
| F40 | warn | doctrine | auditor | 13 | 114 | ask-when-unclear | It reports out-of-fiction that the action needs a clearer description instead of asking one short in-fiction question. |
| F41 | note | dm-audit-flag | dm-audit | 13 | 114 | - | final: fallback; attempts: 3; issues: doctrine, player-agency, other |
| F42 | warn | doctrine | auditor | 14 | 117, 120 | fail-forward | The narration for Tamsin's push toward the ferry resolves as "nothing changes," stalling the scene instead of creating a new problem. |
| F43 | warn | doctrine | auditor | 14 | 120 | ask-when-unclear | Instead of asking one short in-fiction question about the unclear intent, it emits a meta notice that "one action needs a clearer description." |
| F44 | warn | doctrine | auditor | 14 | 120 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. |
| F45 | note | dm-audit-flag | dm-audit | 14 | 120 | - | final: fallback; attempts: 3; issues: doctrine, player-agency |
| F46 | fail | hidden-info-leak | auditor | 16 | 127 | one-clue | Odo publicly states the bell's ring works as a warding charm against goblins, revealing the dm-only reason the goblins want it. |
| F47 | warn | other | auditor | 17 | 134, 135, 136 | npc-voice | Kestrel names "Pell" and "Snag" as known figures though no public row ever introduces those names, only an unnamed boy and older figure. |
| F48 | warn | doctrine | auditor | 17 | 139, 140 | fail-forward | The resolved action produces "nothing changes", stalling the scene instead of creating a new problem. |
| F49 | fail | invented-mechanics | auditor | 17 | 140 | plain-prose | The narration breaks fiction with an out-of-world system complaint about needing "a clearer description" instead of plain prose. |
| F50 | note | dm-audit-flag | dm-audit | 17 | 140 | - | final: fallback; attempts: 3; issues: doctrine, player-agency |
| F51 | warn | doctrine | auditor | 18 | 146, 147 | fail-forward | The resolved action is narrated as "nothing changes", stalling the scene instead of creating a new problem. |
| F52 | warn | doctrine | auditor | 18 | 147 | end-on-demand | The turn closes on out-of-fiction meta-commentary about needing "a clearer description" rather than a world beat demanding response. |
| F53 | note | dm-audit-flag | dm-audit | 18 | 147 | - | final: fallback; attempts: 3; issues: ledger-mismatch, doctrine, player-agency |
| F54 | fail | hidden-info-leak | auditor | 19 | 153 | one-clue | Snag's demand openly states the goblins' hidden motive — that the bell's sound and the river-things are what they want handled — revealing dm-only information in public prose. |
| F55 | note | dm-audit-flag | dm-audit | 19 | 153 | - | final: passed-after-regenerate; attempts: 2; issues: doctrine |
| F56 | fail | hidden-info-leak | auditor | 20 | 158 | one-clue | Odo states Snag's terms outright — a ringing ward and bearing the river-things' burden — exposing the dm-only motive behind the silenced bell in one beat. |
| F57 | warn | doctrine | auditor | 20 | 160 | fail-forward | The narration resolves the action with nothing happening, stalling the scene instead of creating a new problem. |
| F58 | warn | doctrine | auditor | 20 | 160 | end-on-demand | The turn ends on a flat non-event and a request for clarification rather than something demanding a response. |
| F59 | warn | doctrine | auditor | 20 | 160 | ask-when-unclear | Unclear intent should prompt one short in-fiction question, not a meta note that an action needs a clearer description. |
| F60 | warn | doctrine | auditor | 20 | 160 | hero-is-theirs | The narration asserts Tamsin acted and achieved nothing, overriding the player's declared move to press on toward the ferry. |
| F61 | note | dm-audit-flag | dm-audit | 20 | 160 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F62 | warn | doctrine | auditor | 21 | 168 | plain-prose | Narration #168 is bare mechanical output restating the check description and dice math instead of prose describing what happened in the scene. |
| F63 | warn | doctrine | auditor | 21 | 168 | end-on-demand | The turn ends on a success label and a dice line rather than on a world-state that demands a response, and it even hedges about what Snag may still press for instead of showing it. |
| F64 | note | dm-audit-flag | dm-audit | 21 | 168 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F65 | warn | doctrine | auditor | 22 | 171, 173, 174 | fail-forward | The declared and resolved action at #171-#173 is narrated at #174 as producing no change, stalling the scene instead of creating a new problem. |
| F66 | warn | doctrine | auditor | 22 | 174 | end-on-demand | The turn ends on an inert meta-statement that nothing changed rather than on something demanding a response. |
| F67 | warn | doctrine | auditor | 22 | 174 | ask-when-unclear | Instead of one short in-fiction question, #174 emits a vague out-of-world request that 'one action needs a clearer description'. |
| F68 | note | dm-audit-flag | dm-audit | 22 | 174 | - | final: fallback; attempts: 3; issues: doctrine, player-agency |
| F69 | note | dm-audit-flag | dm-audit | 23 | 184 | - | final: passed-after-regenerate; attempts: 3; issues: player-agency, doctrine |
| F70 | warn | doctrine | auditor | 24 | 185, 189 | companion-opinions | Odo's reply is dressed as a rebuttal but restates Kestrel's point that Snag wants Wenna's own voice, so no real disagreement occurs. |
| F71 | warn | doctrine | auditor | 24 | 195 | fail-forward | The narration resolves both committed actions with nothing happening, stalling the scene instead of creating a new problem. |
| F72 | warn | doctrine | auditor | 24 | 195 | end-on-demand | The turn ends on an out-of-world request for a clearer description rather than on something in the scene that demands a response. |
| F73 | note | dm-audit-flag | dm-audit | 24 | 195 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F74 | warn | doctrine | auditor | 25 | 204 | one-clue | The single tracking success delivers two separate revelations in one beat — that Wenna climbed up into the loft and that she carried off the strongbox key — instead of at most one real clue. |
| F75 | warn | doctrine | auditor | 26 | 210 | end-on-demand | The beat closes on a static non-answer ("She hasn't said yes. She hasn't said no.") rather than anything pressing the player to respond. |
| F76 | fail | ledger-contradiction | auditor | 27 | 211, 212, 215 | numbers-from-state | The ledger names the acting hero Kestrel, but the narration calls her Tamsin. |
| F77 | fail | ledger-contradiction | auditor | 27 | 211, 215 | - | Row 211 has Odo hurrying along the bank, while the narration places him above at the cut-rope tower. |
| F78 | warn | doctrine | auditor | 27 | 214, 215 | fail-forward | The resolved action yields nothing new and no fresh problem, leaving the scene stalled at the same chain, pole and empty housing. |
| F79 | warn | doctrine | auditor | 27 | 215 | end-on-demand | It closes on a vague 'something seems to be waiting' rather than a concrete event demanding a response. |
| F80 | note | dm-audit-flag | dm-audit | 27 | 215 | - | final: passed-after-regenerate; attempts: 3; issues: ledger-mismatch, player-agency, doctrine |
| F81 | fail | ledger-contradiction | auditor | 28 | 219, 216, 222 | - | The journal states Odo had fallen silent and would not answer, yet Odo speaks at length in the same scene. |
| F82 | fail | player-agency | auditor | 28 | 225 | hero-is-theirs | The narration moves Tamsin's body for her — "Tamsin's hand finds the chain" — deciding the hero's action instead of leaving it to the player. |
| F83 | note | dm-audit-flag | dm-audit | 28 | 225 | - | final: passed-after-regenerate; attempts: 2; issues: invented-mechanics, player-agency, doctrine |
| F84 | fail | hidden-info-leak | auditor | 29 | 234 | one-clue | The narration puts the stolen clapper-bell openly on Snag's hip, handing the player the hidden truth that the reed-camp goblins took the bell's clapper instead of revealing it slowly. |
| F85 | note | dm-audit-flag | dm-audit | 29 | 234 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F86 | note | dm-audit-flag | dm-audit | 30 | 242 | - | final: passed-after-regenerate; attempts: 2; issues: player-agency, doctrine |
| F87 | fail | hidden-info-leak | auditor | 31 | 247 | one-clue | Odo states the dm-only truth outright — that the goblin wants the bell as a ward against the river-things — before any clue has been uncovered in play. |
| F88 | warn | doctrine | auditor | 31 | 251 | one-clue | The beat reveals two real clues at once: that Snag's bell wards off the 'deep ones' and that a named human boy with a red-rag spear is at the goblin camp. |
| F89 | note | dm-audit-flag | dm-audit | 31 | 251 | - | final: passed-after-regenerate; attempts: 3; issues: player-agency, doctrine |
| F90 | warn | doctrine | auditor | 32 | 253, 256 | world-not-hero | The declared push toward the ferry before dark gets no world reaction — no reeds, no dusk, no ferry — only an abstract report that the hero "acts". |
| F91 | warn | doctrine | auditor | 32 | 255, 256 | fail-forward | The resolved action is narrated as "nothing changes", stalling the scene instead of creating a new problem. |
| F92 | warn | doctrine | auditor | 32 | 256 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. |
| F93 | note | dm-audit-flag | dm-audit | 32 | 256 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F94 | warn | doctrine | auditor | 33 | 259, 261, 262 | fail-forward | The committed action resolves into "nothing changes," stalling the scene instead of creating a new problem. |
| F95 | warn | doctrine | auditor | 33 | 262 | end-on-demand | The turn ends on a meta-request for a clearer description rather than on something in the world demanding a response. |
| F96 | warn | doctrine | auditor | 33 | 262 | plain-prose | "One action needs a clearer description" is out-of-fiction procedural commentary inserted into the narration instead of prose. |
| F97 | note | dm-audit-flag | dm-audit | 33 | 262 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, other |
| F98 | note | dm-audit-flag | dm-audit | 34 | 270 | - | final: fallback; attempts: 3; issues: doctrine, player-agency |
| F99 | note | dm-audit-flag | dm-audit | 35 | 278 | - | final: passed-after-regenerate; attempts: 2; issues: doctrine |
| F100 | warn | doctrine | auditor | 36 | 282, 283 | fail-forward | The resolved action produces explicitly nothing, stalling the scene instead of creating a new problem. |
| F101 | warn | doctrine | auditor | 36 | 283 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. |
| F102 | warn | doctrine | auditor | 36 | 283 | world-not-hero | The narration reports only that the hero acted, never what the world — Snag, the reeds, the falling dark — did to the attempt. |
| F103 | note | dm-audit-flag | dm-audit | 36 | 283 | - | final: fallback; attempts: 3; issues: player-agency, doctrine, invented-mechanics |
| F104 | note | dm-audit-flag | dm-audit | 37 | 292 | - | final: fallback; attempts: 3; issues: player-agency, doctrine |
| F105 | warn | doctrine | auditor | 38 | 296, 299 | ask-when-unclear | The declared intent was vague, so the DM should have asked one short question instead of resolving it into a null result. |
| F106 | warn | doctrine | auditor | 38 | 298, 299 | fail-forward | The resolution narrates "nothing changes" — a stalled scene with no new problem created. |
| F107 | warn | doctrine | auditor | 38 | 299 | end-on-demand | The turn closes on a meta note about description quality rather than anything the player must respond to. |
| F108 | warn | doctrine | auditor | 38 | 299 | plain-prose | "One action needs a clearer description" is procedural commentary intruding into the story prose. |
| F109 | note | dm-audit-flag | dm-audit | 38 | 299 | - | final: fallback; attempts: 3; issues: invented-mechanics, player-agency, doctrine |

## Segments

| index | narration | rows | failing checks | auditor |
|---|---|---|---|---|
| 0 | 10 | 1-10 | none | pass (0 findings, 2 attempts) |
| 1 | 16 | 11-16 | none | fail (2 findings, 1 attempt) |
| 2 | 26 | 17-26 | none | error: parse |
| 3 | 33 | 27-33 | none | fail (3 findings, 1 attempt) |
| 4 | 53 | 34-53 | none | fail (4 findings, 2 attempts) |
| 5 | 58 | 54-58 | none | fail (3 findings, 1 attempt) |
| 6 | 64 | 59-64 | none | fail (1 findings, 2 attempts) |
| 7 | 73 | 65-73 | none | pass (0 findings, 2 attempts) |
| 8 | 80 | 74-80 | none | fail (3 findings, 1 attempt) |
| 9 | 88 | 81-88 | none | fail (2 findings, 1 attempt) |
| 10 | 95 | 89-95 | none | fail (4 findings, 2 attempts) |
| 11 | 101 | 96-101 | none | fail (3 findings, 1 attempt) |
| 12 | 108 | 102-108 | none | fail (2 findings, 2 attempts) |
| 13 | 114 | 109-114 | none | fail (3 findings, 1 attempt) |
| 14 | 120 | 115-120 | none | fail (3 findings, 1 attempt) |
| 15 | 126 | 121-126 | none | error: parse |
| 16 | 133 | 127-133 | none | fail (1 findings, 1 attempt) |
| 17 | 140 | 134-140 | none | fail (3 findings, 2 attempts) |
| 18 | 147 | 141-147 | none | fail (2 findings, 1 attempt) |
| 19 | 153 | 148-153 | none | fail (1 findings, 2 attempts) |
| 20 | 160 | 154-160 | none | fail (5 findings, 2 attempts) |
| 21 | 168 | 161-168 | none | fail (2 findings, 2 attempts) |
| 22 | 174 | 169-174 | none | fail (3 findings, 1 attempt) |
| 23 | 184 | 175-184 | none | error: parse |
| 24 | 195 | 185-195 | none | fail (3 findings, 2 attempts) |
| 25 | 204 | 196-204 | none | fail (1 findings, 1 attempt) |
| 26 | 210 | 205-210 | none | fail (1 findings, 2 attempts) |
| 27 | 215 | 211-215 | none | fail (4 findings, 2 attempts) |
| 28 | 225 | 216-225 | none | fail (2 findings, 2 attempts) |
| 29 | 234 | 226-234 | none | fail (1 findings, 2 attempts) |
| 30 | 242 | 235-242 | none | pass (0 findings, 2 attempts) |
| 31 | 251 | 243-251 | none | fail (2 findings, 2 attempts) |
| 32 | 256 | 252-256 | none | fail (3 findings, 1 attempt) |
| 33 | 262 | 257-262 | none | fail (3 findings, 1 attempt) |
| 34 | 270 | 263-270 | none | error: parse |
| 35 | 278 | 271-278 | none | error: parse |
| 36 | 283 | 279-283 | none | fail (3 findings, 1 attempt) |
| 37 | 292 | 284-292 | none | error: parse |
| 38 | 299 | 293-299 | none | fail (4 findings, 1 attempt) |

## Fight statistics

- Rounds: 1
- Turns: 2 players, 2 npcs
- Attack rolls: 0 players, 1 npcs
- Hits: 0 players, 0 npcs
- Damage dealt: 0 players, 0 npcs
- Damage taken: 0 players, 0 npcs
- Reduced to zero: none
- Death-save rolls: 0
- Fled or bargained: No blades have landed; Odo's parley holds and Kestrel just stood down. The encounter has turned social — drop initiative so the talk can breathe.
- Narrations in turn mode: 5

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

Usage: 62 calls, 327110 input tokens, 36273 output tokens, cost $2.542375.

