# Probe record: TASK-0312 throw-stub run

Stubs (reverted, never committed): `runSteps`, `pullIn`, the gathering block, `adjudicate` node, `stepIds`, `askUndeclared` legacy branch, `firstStage`, `findResumedPlans` legacy accept.

Run 1 stubbed all eight with `pullIn` throwing unconditionally: 283 failed / 1630 passed (51 files). Run 2 made `pullIn` throw only when `ids.length > 0` (a live Intent verdict always passes an empty pull, so an unconditional throw hit every live resolve) and removed the gathering stub (Phase 2 removes it): 168 failed / 1747 passed (16 files).

## Result

All stub-hitting failures in run 2 are in test files that inject legacy `Step`/`Ruling` fixtures (`checkStep`, `attackStep`, `spellStep`, `helpStep`, `reading()`, `steps:`) or that test a deleted symbol directly. No failure came from a non-legacy input. Failures with no stub hit: 0.

## Gathering stub (run 1)

90 tests hit the gathering stub. Each starts an encounter in a seeded scene where a party member is outside the encounter zone. Gathering is not legacy input; Phase 2 deletes it on purpose (spec OQ-4). These are the tests Phase 2 must fix or port.

## Run 2 failures (stub, test file, test name, legacy input)

| Stub | Test | Legacy input |
|---|---|---|
| adjudicate | `test/dm/adjudicate.integration.test.ts` > adjudicate (database) > carries the SRD page on an SRD citation and drops an unknown record | yes |
| adjudicate | `test/dm/adjudicate.integration.test.ts` > adjudicate (database) > keeps a verified library citation with its anchor and drops an unverifiable quote | yes |
| adjudicate | `test/dm/adjudicate.integration.test.ts` > adjudicate (database) > marks a ruling improvised when no citation verifies | yes |
| adjudicate | `test/dm/adjudicate.integration.test.ts` > adjudicate (database) > retrieves once per adjudicated action | yes |
| adjudicate | `test/dm/adjudicate.integration.test.ts` > adjudicate (database) > ships an uncited ruling when retrieval finds nothing | yes |
| findResumedPlans-legacy | `test/dm/assemble.test.ts` > assemble: resume (specs/057) > holds the paused plan in output.resumed once its proposal is approved | yes |
| stepIds | `test/dm/clarify-keeps-turn.integration.test.ts` > clarify keeps the turn (database) > control: the same declaration without a clarify advances the turn | yes |
| stepIds | `test/dm/clarify-keeps-turn.integration.test.ts` > clarify keeps the turn (database) > the answer resolves and advances the turn exactly once | yes |
| stepIds | `test/dm/companion-own-turn.integration.test.ts` > a companion acts in its own turn (database) > replays run 1 seq 206-230: the cast waits, then resolves once on Odo's turn | yes |
| stepIds | `test/dm/derived-numbers.integration.test.ts` > engine-derived numbers (database) > Kestrel's Shortbow rolls 1d20+5 against the record AC and applies 1d6+3 piercing | yes |
| stepIds | `test/dm/derived-numbers.integration.test.ts` > engine-derived numbers (database) > a medium Athletics check rolls 1d20+5 against DC 15 | yes |
| stepIds | `test/dm/derived-numbers.integration.test.ts` > engine-derived numbers (database) > an attack naming Warhammer is refused STAT_UNDEFINED with no dice row | yes |
| runSteps | `test/dm/encounter-auto-end.integration.test.ts` > code-owned encounter end (database) > a downed party with a hostile standing does not end the fight (OQ-6) | yes |
| stepIds | `test/dm/encounter-auto-end.integration.test.ts` > code-owned encounter end (database) > the last hostile surrenders: it goes neutral and the fight ends | yes |
| firstStage | `test/dm/first-stage.test.ts` > cutPlans > cuts in free mode and writes reasons as follow-ups | yes |
| firstStage | `test/dm/first-stage.test.ts` > cutPlans > keeps model follow-ups, merges, dedupes and caps at six | yes |
| firstStage | `test/dm/first-stage.test.ts` > cutPlans > leaves model follow-ups when nothing is cut | yes |
| firstStage | `test/dm/first-stage.test.ts` > firstStage > cuts a different-skill second check | yes |
| firstStage | `test/dm/first-stage.test.ts` > firstStage > cuts nothing without a check | yes |
| firstStage | `test/dm/first-stage.test.ts` > firstStage > keeps a same-skill check run whole and cuts the rest | yes |
| stepIds | `test/dm/fled-combatant.integration.test.ts` > a fled combatant (database) > fled mid-fight: the batch holds the departure and the monster gets no turn | yes |
| stepIds | `test/dm/opportunity-attack.integration.test.ts` > opportunity attack (database) > a second move before goblin-2's turn writes no second attack row | yes |
| stepIds | `test/dm/opportunity-attack.integration.test.ts` > opportunity attack (database) > replays run 1 seq 151-161: goblin-2 reacts on its own side, then Kestrel's check runs | yes |
| stepIds | `test/dm/opportunity-attack.integration.test.ts` > opportunity attack (database) > the turn reaching goblin-2 resets its Reaction | yes |
| stepIds | `test/dm/opposition-and-help.integration.test.ts` > opposition and help (database) > Kestrel's help gives Tamsin's Acrobatics check two d20s and the assist ends used | yes |
| stepIds | `test/dm/opposition-and-help.integration.test.ts` > opposition and help (database) > Tamsin's Athletics check opposed by Snag rolls against DC 9 and records the opposition | yes |
| stepIds | `test/dm/opposition-and-help.integration.test.ts` > opposition and help (database) > an unused assist ends at the start of Kestrel's next turn in an encounter | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > asks before rolling for another human's PC | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > asks on a ruling's steps and removes the ruling | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > asks the manner question first for run 1 seq 24 (Kestrel's Stealth) | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > asks the manner question for the declarer's own Stealth | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > asks when an attack rolls for another PC | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > covers Deception and Intimidation cues | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > passes a saving throw for another PC | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > passes a second PC held by the same user | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > passes a stated manner for the declarer and a companion | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > passes heal and damage effects on another PC | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > run 1 seq 114: Athletics passes, Stealth asks | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > skips the manner rule for a companion's action | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared (spec 077) > skips the rule for a party-scope action | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared: help (spec 084 D12) > asks when the helper is another human's PC | yes |
| askUndeclared, askUndeclaredred-legacy | `test/dm/plan-gate.test.ts` > askUndeclared: help (spec 084 D12) > passes when only the ally is another human's PC | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan > accepts a plan whose ids are all S0 combatants | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan > accepts the ids an encounter start adds | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan > does not map an alias to its combatant | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan > gates the NPC group (actionId null) | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan > lets a ruling replace the reading's steps | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan > passes a damage effect on a seed NPC with no combatant, pulling it (spec 075) | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan > refuses an unknown id as not-in-snapshot | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan > reports the first failure of the group only | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan > skips null actor ids and clarify readings | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan > walks nested onHit, onSuccess and onFailure targets in step order | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan actor rule (spec 079 D5) > a party-scope action may name any party member, not a monster | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan actor rule (spec 079 D5) > does not check the monster turn | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan actor rule (spec 079 D5) > refuses a foreign mover, and passes the actor's own move | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan turn hold (TASK-0244) > does not hold a downed companion | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan turn hold (TASK-0244) > does not hold in free mode | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan turn hold (TASK-0244) > does not hold the active companion with no own group | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan turn hold (TASK-0244) > leaves a human-only party group unchanged | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: STAT_UNDEFINED (spec 082 D8) > passes a derivable attack and check | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: STAT_UNDEFINED (spec 082 D8) > refuses a combatant with no stats | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: STAT_UNDEFINED (spec 082 D8) > refuses a missing ability modifier | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: STAT_UNDEFINED (spec 082 D8) > refuses an unknown attack name | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: STAT_UNDEFINED (spec 082 D8) > skips a joining combatant | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: absent actors > lets an arrived presence effect name an absent actor | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: absent actors > passes a presence effect on a seed NPC with no combatant | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: absent actors > passes a yielded target | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: absent actors > passes an attack on an absent NPC that is arriving, pulling it (spec 078) | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: absent actors > refuses a non-arrived presence effect on an absent actor | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: absent actors > refuses an absent attackerId | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: absent actors > refuses an absent check combatantId | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: absent actors > refuses an absent onHit effect target | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: absent actors > refuses an absent targetId | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: absent actors > still reports an unknown id as not-in-snapshot | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: non-combatant NPC pull (specs 068, 075) > does not pull a presence-effect target and dedupes in step order | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: non-combatant NPC pull (specs 068, 075) > passes a check combatantId, a condition effect and a heal effect on pell | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: non-combatant NPC pull (specs 068, 075) > passes attack ids and damage effects on pell (spec 075) | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: non-combatant NPC pull (specs 068, 075) > pulls a combatant outside the order; skips in-order and joining ids | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: non-combatant NPC pull (specs 068, 075) > refuses an absent pell as absent | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: non-combatant NPC pull (specs 068, 075) > refuses an absent pell as an attack targetId | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: non-combatant NPC pull (specs 068, 075) > refuses an alias of pell | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: non-combatant NPC pull (specs 068, 075) > refuses pell's alias as an attack targetId | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: opposition and help (spec 084 D12) > passes a derivable opposition and a help | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: opposition and help (spec 084 D12) > refuses a help step naming an unknown id | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: opposition and help (spec 084 D12) > refuses an opponent without stats and skips a joining one | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: presence ids > lets an id failure win over a reason failure in the same group | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: presence ids > never rewrites a passing reading | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: presence ids > passes an arrived presence effect with the arrival reason | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: presence ids > refuses an absent id in onSevere (spec 070) | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: presence ids > replaces a reading's steps with its ruling's steps | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: presence ids > still runs the id check for a resumed action id | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: spells (spec 083 D6) > passes a prepared, resolvable spell | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: spells (spec 083 D6) > refuses a cantrip with a slot level and a leveled spell below its level | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: spells (spec 083 D6) > refuses a caster with no spellcasting ability | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: spells (spec 083 D6) > refuses a monster caster, which has no list | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: spells (spec 083 D6) > refuses a spell not on the caster's list | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: spells (spec 083 D6) > refuses a spell with no table entry | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: spells (spec 083 D6) > refuses an id with no SRD record | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: spells (spec 083 D6) > refuses intent spell with only check and effect steps | yes |
| stepIds | `test/dm/plan-gate.test.ts` > checkPlan: spells (spec 083 D6) > skips a joining caster | yes |
| stepIds | `test/dm/plan-gate.test.ts` > monster arrivals (spec 088) > refuses goblin-lookout not-in-snapshot and passes goblin-3 via joining | yes |
| stepIds | `test/dm/resolve.human-seat.integration.test.ts` > resolve with a human DM seat (database) > comes back pending, leaves the action committed, and the approval shows in priorSteps | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > S1 and the diff > a reclaim rebuilds an equal S1 | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > S1 and the diff > a scripted-dice damage hit gives S1 the lowered HP and the exact diff | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > applies damage on a hit, with critical false on a plain hit | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > ends every mechanics reason with its marker | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > finds the in-flight submission by its marker | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > marks a clarify or none step no-effect | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > names the seqs each submission appended; a refusal names none | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > never reads a model | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > records an engine refusal as a refused action with the engine's code | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > replays recorded submissions on a reclaim and submits nothing twice | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > TASK-0213: a PC attack on a present non-combatant renders the joiner's initiative line once | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > TASK-0213: a plan-refused action stays refused and reports no pull | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > TASK-0213: an NPC turn that pulls Pell in renders his initiative roll as a dice line | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > a refused action still resolves before the encounter ends (rows 260-265 of the F54 evidence) | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > an action resolves before a free decision ends the encounter, and no turn advances | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > an encounter start runs before an action that names a combatant it adds | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > an npc-turn job runs its step rows before the encounter ends | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > plan gate (TASK-0112) > a refused NPC group runs no step and the turn still advances | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > plan gate (TASK-0112) > records an all-valid verdict and runs the plan unchanged | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > plan gate (TASK-0112) > refuses the whole action group when a later step names an unknown id, with no row from step 0 | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > plan gate: roll reasons (spec 058; refusal removed by spec 103 OQ-1) > a passing reason applies, and its dice.rolled reason is the step reason plus the marker | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > settling (TASK-0112, plan D4) > a reclaim after a landed advance does not skip the turn-advance group and writes no duplicate rows | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > settling (TASK-0112, plan D4) > a reclaim finds the landed death save by its marker and rolls nothing twice | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > settling (TASK-0112, plan D4) > a third failed save kills the combatant and the turn passes | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > settling (TASK-0112, plan D4) > keeps the turn on a natural 20: 1 HP, conscious, table mode on it | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > settling (TASK-0112, plan D4) > passes a stable combatant with no roll | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > settling (TASK-0112, plan D4) > passes an unable non-party combatant with no roll and queues no job for it | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > settling (TASK-0112, plan D4) > rolls the unconscious party member's death save, then the turn passes | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > settling (TASK-0112, plan D4) > stops after one lap when every combatant is unable | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolve order (decision-0025 §4) > tracker advances and the scene end follow the action, in order | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolves a check and runs the success effects only | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > resolves actions in commit order | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > runs no damage on a miss and still marks the action applied | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > runs the failure effects on a failed check | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve (database) > sets critical only on a critical hit | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > End turn lands while the turn job resolves the same action: one turn.advance | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > a crash after End turn and a reclaim of the same job do not advance again | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > a held floor skips the turn-advance group | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > outcome bands and the free retry (spec 070) > a failed check, then the same check with no new risk, succeeds without a roll (card AC #5) | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > outcome bands and the free retry (spec 070) > a retry that names a new risk rolls | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > outcome bands and the free retry (spec 070) > an unknown reveals reference records null and still applies the band (spec 080) | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > outcome bands and the free retry (spec 070) > bands off applies only onFailure | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > outcome bands and the free retry (spec 070) > margin -2 applies onSuccess then onCost | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > outcome bands and the free retry (spec 070) > margin -6 applies onFailure then onSevere | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > outcome bands and the free retry (spec 070) > naturals off resolves a natural 20 by total (card AC #3) | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > resolve turn-moved guard (spec 049) > outcome bands and the free retry (spec 070) > records the revealed clue text on the submission (spec 080) | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > scene presence effects (spec 048) > a fled active NPC followed by a downed party member still settles | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > scene presence effects (spec 048) > a fled active NPC hands the turn on once: no double advance, no later turn over two rounds | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > scene presence effects (spec 048) > a reclaim after the leave landed but before its checkpoint advances the turn only once | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > scene presence effects (spec 048) > an Intimidation success runs onSuccess presence fled: one scene-presence submission, S1 absent | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > scene presence effects (spec 048) > an adjudicate ruling's effect step with a presence effect lands | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > scene presence effects (spec 048) > an attack on an absent goblin is refused UNKNOWN_COMBATANT, verdict absent, no row lands | yes |
| stepIds | `test/dm/resolve.integration.test.ts` > scene presence effects (spec 048) > the same check failing writes no presence row: S1 present | yes |
| findResumedPlans-legacy | `test/dm/resume.test.ts` > findResumedPlans > also resumes a suggested submission | yes |
| findResumedPlans-legacy | `test/dm/resume.test.ts` > findResumedPlans > carries the ruling when present | yes |
| findResumedPlans-legacy | `test/dm/resume.test.ts` > findResumedPlans > only keeps submissions keyed for the action | yes |
| findResumedPlans-legacy | `test/dm/resume.test.ts` > findResumedPlans > returns a plan when the last submission is pending and approved | yes |
| findResumedPlans-legacy | `test/dm/resume.test.ts` > findResumedPlans > takes the newest job when two hold keys | yes |
| firstStage | `test/dm/runner.test.ts` > runTurn post-planning cut (specs/064) > asks before an undeclared method and holds the turn (spec 077) | yes |
| firstStage | `test/dm/runner.test.ts` > runTurn post-planning cut (specs/064) > cuts once before resolve and stores cut: true in one save | yes |
| stepIds | `test/dm/spells.integration.test.ts` > spells through the engine (database) > Odo's cure-wounds heals a downed Kestrel 2d8+3 and she wakes | yes |
| stepIds | `test/dm/spells.integration.test.ts` > spells through the engine (database) > Odo's sacred-flame lands a DC 13 save and radiant damage on a failure | yes |
| stepIds | `test/dm/spells.integration.test.ts` > spells through the engine (database) > bless is refused SPELL_UNRESOLVED with no dice row | yes |
| stepIds | `test/dm/spells.integration.test.ts` > spells through the engine (database) > no-such-spell is refused SPELL_UNKNOWN | yes |
| stepIds | `test/dm/spells.integration.test.ts` > spells through the engine (database) > replays run 1 seq 204-210: a 0 HP revive spends the last slot, then a cast is refused | yes |
| stepIds | `test/dm/spells.integration.test.ts` > spells through the engine (database) > three cure-wounds casts spend both slots; the third is refused with no healing row | yes |

## Run 1 gathering-only failures (file: count)

- `test/dm/ai-actor-parity.integration.test.ts`: 3
- `test/dm/clarify-keeps-turn.integration.test.ts`: 3
- `test/dm/companion-own-turn.integration.test.ts`: 2
- `test/dm/duo.integration.test.ts`: 1
- `test/dm/encounter-auto-end.integration.test.ts`: 3
- `test/dm/encounter-end-resolves.integration.test.ts`: 1
- `test/dm/encounter-resume.integration.test.ts`: 2
- `test/dm/fled-combatant.integration.test.ts`: 2
- `test/dm/floor-jobs.integration.test.ts`: 13
- `test/dm/intent-runner.integration.test.ts`: 4
- `test/dm/mid-fight-arrival.integration.test.ts`: 1
- `test/dm/npc-turn-intents.integration.test.ts`: 2
- `test/dm/opportunity-attack.integration.test.ts`: 4
- `test/dm/opposition-and-help.integration.test.ts`: 1
- `test/dm/resolve.integration.test.ts`: 34
- `test/dm/scene-start-space.integration.test.ts`: 1
- `test/dm/talk-turn.integration.test.ts`: 1
- `test/dm/trio.integration.test.ts`: 1
- `test/dm/turn-floor-round.integration.test.ts`: 1
- `test/gate.floor.integration.test.ts`: 6
- `test/gate.intent.integration.test.ts`: 4
