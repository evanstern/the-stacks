---
title: Analysis — Which DM-craft areas carry refactor risk, and in what order should deep dives run?
aliases: [Deep-Dive Order]
tags: [analysis, dm-craft]
type: analysis
created: 2026-10-26
updated: 2026-10-26
related: [[DM-Craft-Map]], [[The-Stacks-Doctrine-Today]], [[Coverage-Matrix]], [[Adjudication-and-Dice]], [[Narrating-Outcomes-and-Description]], [[Players-Agency-and-the-Table]], [[NPCs-and-Social-Interaction]], [[Secrets-and-Information]], [[Exploration-Hazards-Traps-and-Puzzles]], [[Pacing-and-Time]], [[Session-Zero-and-Safety-Tools]], [[Running-Combat]], [[Encounter-Design]], [[Adventure-Design-Prep-and-Improvisation]], [[World-and-Tone]], [[Horror]], [[Rewards-and-House-Rules]], [[SRD-5.2.1-Rules-Pass]], [[Brief-and-Assumptions]]
---

# Analysis — Which DM-craft areas carry refactor risk, and in what order should deep dives run?

_The operator's worry (TASK-0115, 2026-10-26): researching one topic deeply may miss something that later forces a large refactor. This analysis answers: across the 14 mapped craft areas, which ones can force a structural change to the AI DM if they are learned late, and so in what order should the deep-dive branches run?_

## Verdict

**The refactor risk is concentrated in one place: what the typed contracts can say.** The contracts are the step grammar, the narration facts, the event catalog and the seed schema. Doctrine text is cheap to revise. A pair in `doctrine.ts` or a narrate rule is one edit plus a captured re-run. A missing field in a contract is expensive: every node, prompt, auditor check, fallback and test that reads the contract must change with it. So rank the deep dives by **how much contract each area implies**, not by how much the sources write about it or how much pain it causes today.

Each area falls into one of three refactor classes:

- **Contract.** The area needs a fact, field or piece of state that no contract carries today. It is expensive to learn late.
- **Flow.** The area changes who decides, or when the pipeline runs: a new trigger, node or gate path. It is moderate to expensive.
- **Doctrine.** The area needs prompt or audit wording only. It is cheap at any time.

Recommended order:

1. **Branch 1: resolution and outcome.** It covers how a DM decides what the dice decide versus what the player decides, and how each is narrated. This is the operator's question, widened by three findings below. Class: contract and flow. *Run now.*
2. **Branch 2: NPCs, social interaction and information.** It covers attitudes as state, social checks, what NPCs know and whether they lie, and how clues flow. Class: contract. *Run next.*
3. **Branch 3: exploration, awareness and time.** It covers passive scores, noticing and surprise, stealth, time scales, travel and hazards. Class: contract, much of it in the engine. *Run third.*
4. **Branch 4: the table contract.** It covers session zero, safety tools, content settings, spotlight and multiple players. Class: contract and flow, but there is no pain yet, because the First Scene seats one human. *Run before multiplayer or any non-default content.*
5. **Branch 5: running combat.** It covers morale, monster tactics, the parked Grit, budgeting and downed-target rules, and injuries. Class: mostly engine. The engine already owns the arithmetic. *Run on TASK-0048's playtest evidence, which is the trigger TASK-0055 already names.*
6. **Bound to triggers, not ordered now:**
   - Encounter design, and adventure design, prep and improvisation. Trigger: the Codex spec (TASK-0060), because these areas shape the seed and Codex schema.
   - World and tone, and horror. Trigger: the first campaign whose tone differs from the default `content-pg13`.
   - Rewards and house rules. Trigger: the first multi-session campaign, or adopting a house rule.

## Reasoning

### Why contracts, not counts

The [[Coverage-Matrix|Coverage Matrix]] has the most entries for adventure design (136), adjudication (127) and players and the table (106). Entry count measures what the sources care about, not what the system must hold. [[The-Stacks-Doctrine-Today|The Stacks Doctrine Today]] shows a fixed pipeline of typed contracts. `InterpretReading`/`Step`, `NarrationFacts`/`FactRoll`, `SessionProjections` and the seed schema carry every fact between the nodes. The project's own anti-cheat rests on those contracts: decision-0017 and X2 say ordering replaces prompting. The TASK-0113 ruling already showed the cost pattern. The operator's involuntary-reaction ruling could not be met by rewording narrate-v3 E3 alone. The proposed shape needs code to derive the allowed involuntary effects from the ledger, as facts for both narrator and auditor (G1). That is a contract change. Every area below is judged by the same test.

### Branch 1 is right, but needs to be wider than the seven sub-topics

[[Adjudication-and-Dice|Adjudication and Dice]] and [[Narrating-Outcomes-and-Description|Narrating Outcomes]] show the DMG treating outcomes as more than pass or fail. DMG 2014 › Ch 8 › Resolution and Consequences covers three options:

- success at a cost;
- degrees of failure;
- special weight for natural extremes on checks.

Today's contracts are binary. `FactRoll.outcome` is hit, miss, critical-hit, success or failure. A check step has only `onSuccess`/`onFailure`. So "fail forward" (P10) and "trying costs" (P11) are prompt-only aspirations with no field to carry them (G22). This is the single most likely future refactor. Branch 1 must decide whether outcome becomes richer (a margin, a cost or a complication) **before** anyone fixes TASK-0113's involuntary-effects facts, because both land in the same `NarrationFacts` shape. Designing them apart risks doing that contract twice.

Branch 1 should also take in three neighbours the map surfaced, which share the same seam:

- **What decides the number.** DCs, modifiers and target AC are model-chosen (G3, TASK-0104). The DMG ties DCs to tables by task and by social attitude, and the SRD 5.2.1 Playing the Game text is **not in the repo** ([[SRD-5.2.1-Rules-Pass|SRD Rules Pass]]). Branch 1 cannot ground "when to roll and how to set DCs" against the project's own rules baseline until that text is sourced. That is a precondition, not a footnote.
- **Contests, group checks and retries.** DMG 2014 › Ch 8 › Contests and › Multiple Ability Checks cover these. The project has no stated rule for contested or group checks, and only P11 covers retries. Each would be a new step kind or a new outcome rule: contract again.
- **Out-of-character questions to the DM.** [[Players-Agency-and-the-Table|Players, Agency and the Table]] lists the DMG's table-talk norms (Ch 8 › Table Rules). In the project, talk never triggers a DM turn (X4), the narrator's chime-in is not built (G17), and clarify runs only from DM to player. A player who asks "how far is the ledge?" has no path to an answer. That is a flow gap, and it is one of the operator's seven sub-topics, so it belongs in branch 1.

### Branch 2: NPCs and information hold the next contract-sized gap

[[NPCs-and-Social-Interaction|NPCs and Social Interaction]] shows that DMG 2014 › Ch 8 › Resolving Interactions uses a four-step structure: starting attitude, conversation, Charisma check, repeat. Each check's DC depends on the attitude. Attitude is **persistent, changeable state**. The seed's NPC portrayal is static voice, want and detail, and no projection holds an attitude. [[Secrets-and-Information|Secrets and Information]] adds the clue economy. The Alexandrian's Three Clue Rule is listed, though only by title. Against it stands the project's own P22 one-clue pacing and G6: no prompt reads NPC `hooks.secrets`. Both pull on the seed schema and the DM-only view. They also pull on Branch 1's DC question, which is why they come second, not in parallel.

### Branch 3: awareness and time are engine-shaped

[[Exploration-Hazards-Traps-and-Puzzles|Exploration]] and the adjudication note list three sources:

- noticing other creatures (DMG Ch 8 › Exploration);
- passive-score-first traps (XGtE › Traps Revisited);
- random-encounter cadence by hours and rests ([[Pacing-and-Time|Pacing and Time]]).

The doctrine inventory lists no stated rule for passive scores, stealth, surprise, travel, time or resources. Passive scores and surprise belong in the engine (C3) as derived values. An in-world clock is event-log state. These are contract changes, but no current card is blocked on them, so third.

### Why the table contract waits despite being contract-class

[[Session-Zero-and-Safety-Tools|Session Zero and Safety Tools]] draws on TCoE › Session Zero and VRGtR's safety material. Content limits are hard-coded as P23 `content-pg13`. A real lines-and-veils setting would be campaign config. A mid-scene "stop" signal would be a new proposal or talk kind. Both are contract work, but decision-0014 seats one human plus companions. The cost of learning this late is real but bounded, and it has a natural trigger: the multiplayer milestone or any non-default content.

### Combat is the least risky contract area

The engine already owns attack, save and damage arithmetic, conditions, initiative and death saves (C3 and the R8 ruling). What [[Running-Combat|Running Combat]] adds is morale, tactics and optional injury rules (DMG Ch 9 › Combat Options). These are mostly Director doctrine plus optional engine variants, and TASK-0055 already parks them behind playtest evidence.

## Tensions & tradeoffs

- **Contract-first can over-build.** A richer outcome type, attitudes as state and an in-world clock are each a cost paid before any narration proves it needs them. The counter-case: the regenerate loop and the audit already absorb a lot. Prompt fixes moved the fallback rate from 0.59 to 0.18 across spec 034's runs without any contract change (G15). The verdict accepts this risk, because each branch ends in a decision, not code. A contract change still needs its own spec and evidence.
- **The ranking reads the project side well and the source side thinly.** The refactor class comes from A3's file:line inventory, which is solid. The DM-practice side comes from heading paths and web titles; most web entries are title-only. A deep read could move an area's class. For example, if well-read sources prefer narrative-only partial success, outcome richness could stay doctrine-class.
- **Edition skew.** The operator's DMG is the 2014 edition. The rules baseline is SRD 5.2.1, which follows the 2024 rules. The 2024 DMG may reorganise or drop options this analysis leans on, such as success at a cost and degrees of failure. The branch cannot tell.
- **Ordering versus pain.** TASK-0113 (Low) and TASK-0104 (Medium) are the live pain, and both sit inside branch 1. That is a coincidence of this ranking, not its basis. If pain shifts to NPC behaviour first, branch 2 does not become safer to run before branch 1. It shares branch 1's DC question.

## Confidence & open questions

**Confidence:**
- High that contract-class areas are the refactor risk and doctrine text is not, because the project's own architecture says so.
- Medium on the exact order of branches 2 and 3.
- Low on whether "partial success" must be a contract field; that is branch 1's question to settle.

**What would change the order:**
- A 2024 DMG read that drops the outcome options would move them to doctrine class.
- Multiplayer moving ahead of milestone m-3 would pull branch 4 forward.

**Open questions for the operator before branch 1:**
1. **SRD 5.2.1 Playing the Game text.** It is not in `packages/srd/`. Should branch 1 read it from the official PDF, which is CC-BY-4.0 and the project's rules baseline? Adding it to the package would be a separate card.
2. **2024 DMG.** Do you own the 2024 Dungeon Master's Guide? If so, add it as a source; it matches the SRD 5.2.1 baseline better than the 2014 edition.
3. **Web depth.** Branch 1 needs full reads of about 10–15 title-only articles, among them Angry GM's adjudication series and the Alexandrian's Null Result and Rolling for Riddles. It also needs Colville transcripts from a legitimate source, or Colville gets dropped. Proceed?
4. **Widened scope.** Is branch 1 widened as above: richer outcome, DC derivation, contests and group checks, and out-of-character questions to the DM?
5. **Cards.** Should branches 2–5 and the three trigger-bound areas be carded now? This would follow the project's no-unplanned-deferrals rule (decision-0020): ordered cards, plus revisit cards with named triggers.

## Basis

- [[_grounding]] — sources, method and gaps, including the SRD Playing the Game gap and the edition note
- [[The-Stacks-Doctrine-Today]] — components C1–C21, contracts, doctrine P/N/A/S/X/K, gaps G1–G24, the TASK-0113 ruling
- [[Coverage-Matrix]] — entry counts and doctrine coverage by area
- [[Adjudication-and-Dice]], [[Narrating-Outcomes-and-Description]], [[Players-Agency-and-the-Table]] — branch 1 inputs
- [[NPCs-and-Social-Interaction]], [[Secrets-and-Information]] — branch 2 inputs
- [[Exploration-Hazards-Traps-and-Puzzles]], [[Pacing-and-Time]] — branch 3 inputs
- [[Session-Zero-and-Safety-Tools]] — branch 4 input
- [[Running-Combat]], [[Rewards-and-House-Rules]] — branch 5 and trigger-bound inputs
- [[Encounter-Design]], [[Adventure-Design-Prep-and-Improvisation]], [[World-and-Tone]], [[Horror]] — trigger-bound areas
- [[SRD-5.2.1-Rules-Pass]], [[Brief-and-Assumptions]] — scope findings and open questions
