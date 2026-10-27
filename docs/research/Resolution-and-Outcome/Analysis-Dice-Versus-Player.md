---
title: Analysis — What do the dice decide, what does the player decide, and how is each narrated?
aliases: [Dice Versus Player]
tags: [analysis, resolution]
type: analysis
created: 2026-10-26
updated: 2026-10-26
related: [[Resolution-and-Outcome]], [[When-to-Roll]], [[Setting-DCs-and-Modifiers]], [[Outcome-Shapes]], [[Failure-Consequences-and-Retries]], [[Contests-Group-Checks-and-Help]], [[Involuntary-Effects-and-Player-Choice]], [[Narrating-Outcomes]], [[Table-Talk-and-Questions-to-the-DM]], [[Pacing-and-Spotlight-in-Resolution]], [[The-Stacks-Resolution-Today]], [[Brief-and-Assumptions]]
---

# Analysis — What do the dice decide, what does the player decide, and how is each narrated?

_Branch 1 of TASK-0115, widened by operator approval on 2026-10-26. The question: how a DM decides what the dice decide versus what the player decides, and how each is narrated. The widened scope adds outcome richness, how DCs and modifiers are derived, contests and retries, and out-of-character questions to the DM. The answer should be stated as doctrine the AI DM can follow, plus the contract changes that doctrine needs._

## Verdict

The sources draw the dice-versus-player line in one consistent place. **Dice decide what happens to a character and what it can do; the player decides what it intends.** A good DM fixes what a roll means **before** the roll. Both halves fit the project's own anti-cheat principle that ordering beats prompting (decision-0017, X2). The project applies that principle to numbers today, but not yet to consequences or to involuntary effects. Seven recommendations follow, ordered by how much they protect against refactoring later:

1. **Capability, not decision, is the agency line. It confirms and sharpens the TASK-0113 ruling.**
   - **What a roll may decide:** state changes, such as damage, conditions, prone, grappled or forced movement. It may also decide a reflexive bodily reaction that matches a recorded fact: a stagger on a critical hit or heavy hit, a wince, a flinch on a failed save, startlement on surprise.
   - **What it may never decide:** intent, speech, purposeful movement, choices or chosen emotions.
   - **The one exception is a named control effect.** Command, Suggestion, Dominate Person, possession and the madness or stress results may compel behaviour, but only through a recorded fact naming the effect. Even then the narration shows the compulsion, not the character's inner assent.
   - **In code:** code derives an `involuntary` fact list from the ledger. The narrator may use only what the list allows. The auditor blocks volitional acts and lets listed reactions through.
2. **Stakes before dice.** Interpret declares what success and failure mean before the engine rolls: each outcome band and its consequence. Code then computes the margin and the band from the total and the DC, both of which it already holds. The narrator tells the band it is handed and invents no consequence afterwards. This turns "fail forward" (P10) and "trying costs" (P11) from prompt-only hopes (G22) into ordered data.
3. **No stakes, no roll.** A check with no stated failure consequence resolves without a roll. One endeavor gets one roll ("let it ride"). A retry that risks nothing new succeeds without a roll, given time. A retry with new risk is a new check. All of this can be checked in code against the stakes field.
4. **Numbers come from the sheet and the SRD ladder.**
   - The modifier is computed from the character's ability, proficiency and skill data.
   - The model picks a difficulty **tier** from the SRD 5.2.1 ladder (Very Easy 5 to Nearly Impossible 30), not a raw number.
   - Advantage and disadvantage come from conditions where the SRD defines them, and from model-stated circumstances that carry a reason.
   - This is the doctrine half of TASK-0104.
5. **Opposition and Help are engine shapes; group checks are a house-rule option.** SRD 5.2.1 defines the Help action. It has no contest rule: it states opposition as a check against a DC the engine derives from the opponent, such as the grapple escape DC (8 + Strength modifier + proficiency bonus). The 2014 DMG's contest (roll against roll) is the older form. So opposition becomes an engine-derived DC and Help becomes an advantage source. Group checks, which have no SRD rule, wait behind an operator flag.
6. **Outcome bands adopt the DMG's two options for ability checks only:**
   - Success at a cost: a miss by 1–2 succeeds with a complication.
   - Severe failure: a miss by 5 or more adds a worse consequence.

   Attacks and saves stay SRD-binary, with the engine owning hit, miss, crit and half damage. A natural 20 or 1 on a check stays without special effect, as both the SRD and the DMG default.
7. **An "ask the DM" channel.** Some questions are out of character: "Can I reach the ledge?", "What does my character know about this?". They get a read-only DM answer: what the character perceives or knows, and whether the attempt is possible and what it would roll. This follows the SRD's own improvised-action exchange. It is a flow change: today talk never reaches the DM (X4), and clarify runs only from the DM to the player. It amends decision-0016.

**Narration then follows one pattern:**
- Restate the declared action and join it to the band's outcome with "and" or "but".
- State only what the characters perceive.
- Show reflexes the facts allow.
- Stop where the player must choose next.

## Reasoning

### The rules already separate capability from choice

[[Involuntary-Effects-and-Player-Choice]] tabulates every SRD 5.2.1 condition and the other SRD rules that take choices away. The pattern holds without exception:
- Conditions restrict **what a character can do** and never **what it chooses**. Blinded, Poisoned, Prone, Restrained and Grappled change odds or options. Incapacitated removes actions but scripts nothing. Frightened bars moving **willingly** toward the source, yet it does not order flight. Charmed stops the character attacking the charmer and imposes no obedience.
- The SRD scripts behaviour only through named, bounded control effects: Command, Suggestion, Dominate Person, Demonic Possession, and the optional fear and stress rules.
- The DMG keeps the same split. Saves are framed as split-second reactions to another's action. Morale failure applies to monsters, not PCs. The injury variant hands the lasting effect back to the player to portray as a flaw.
- VRGtR adds the table-side rule: ask permission before imposing anything that changes how a player's character works.

The operator's TASK-0113 ruling lands on this line exactly ([[The-Stacks-Resolution-Today]]):
- "Staggered back a step" on a critical hit is a reflex that matches a recorded hit.
- "Surprise shows on your face" is a reflex that matches a surprise fact. In SRD 5.2.1, surprise is only Disadvantage on Initiative, so the reflex is pure colour and changes no state.
- "Run to meet her" is intent.

So the ruling is not a softening of agency. It is the rules' own model. The current narrate-v3 rule E3 and audit-v2 definition are stricter than both. That is why the auditor flagged legitimate reflexes and the narrator hedged into invented dodges (G1, G14, G16). One refinement the sources add: purposeful movement remains the player's. Movement the engine applies (shove, prone, grapple drag) is a fact, and a small displacement drawn as part of a reflex is colour. Narration must not turn colour into position. "Staggers back a step" is fine; "staggers back out of the doorway" moves the character in a way that matters, and needs a fact.

### Consequences belong before the roll, not in the narration

[[When-to-Roll]] and [[Narrating-Outcomes]] converge across the sources. The DMG's filter calls for a roll only when failure has a meaningful consequence. Angry GM's pre-roll questions and its Declare-Determine-Describe cycle settle what success and failure mean, and whether there is a cost, **before** rules are consulted. Sly Flourish's core loop has the DM set the stakes and difficulty before the player rolls.

In the project, fail-forward lives in narrate (P10, N7), which runs **after** the dice. That is exactly where invention happens: seq 130's near-miss (G16) and the "twists just enough" dodge (F6) are consequences invented after the fact.

Moving consequence authoring into interpret has two effects. Interpret already holds `onSuccess`/`onFailure` and runs before the engine. First, fail-forward obeys the same ordering rule as numbers. Second, the auditor gets something checkable, "did the prose deliver the declared band?", in place of a judgment call.

This is the counter-intuitive finding of the branch. The cure for thin fail-forward doctrine is not better narrator prose. It is earlier authorship.

### Outcome richness is real, but narrower than "partial success everywhere"

[[Outcome-Shapes]] shows a split:
- **SRD 5.2.1 is binary for d20 tests.** It reserves crits for attack rolls and adds shape only through half-damage saves and Influence's 24-hour lockout.
- **DMG 2014 offers bands for ability checks:** success at a cost for a miss by 1–2, and degrees of failure for a miss by 5 or more.
- **The web sources disagree on how often to use them.** Angry GM uses partial progress sparingly; Sly Flourish and the Alexandrian use graded results routinely.

The edition divergence matters. These tools are 2014-DMG advice with no SRD 5.2.1 counterpart, so they are a house-rule choice, not baseline rules. Two things favour adopting bands for checks only. Margin is pure code: total minus DC, both held. And the bands give fail-forward a mechanical home. Keeping attacks and saves binary preserves the engine's SRD-faithful ownership (C3, the R8 ruling), and it avoids the DMG's own caution against making failure toothless.

### Numbers: the model should pick a tier, never a number

[[Setting-DCs-and-Modifiers]] gives two inputs, both of which code can derive:
- the SRD 5.2.1 DC ladder;
- the DMG's guidance that DC 10, 15 and 20 cover most play and that higher DCs depend on character level.

Character data in the seed carries ability modifiers, saves and skills (C5). The free-form `expression` and numeric `dc` (G3) are where the model now invents numbers. That contradicts P21 "numbers from state", which the project enforces for narration but not for interpret. Asking for a tier keeps the model's real judgment, how hard this is, while code owns the arithmetic. Social DCs keyed to NPC attitude belong to branch 2 (TASK-0119), because attitude needs to become persistent state.

### Retries, contests, help

[[Failure-Consequences-and-Retries]] shows the sources disagree on retries:
- the Alexandrian defaults to no retries;
- Angry GM grants auto-success when nothing new is at risk;
- the DMG converts a retry loop into success over ten times the time, unless the approach is spent.

They agree on the principle underneath: a re-roll with nothing new at stake is pointless. "No stakes, no roll" covers all three positions with one checkable rule.

[[Contests-Group-Checks-and-Help]] finds Help defined in the SRD, opposition stated as a check against a derived DC, and contests only in the 2014 DMG. It finds no SRD group-check rule. So the derived DC and Help go in the engine, and group checks stay an option.

### Table talk is a missing channel, not a missing rule

[[Table-Talk-and-Questions-to-the-DM]] shows the SRD answering "can I try…?" through the improvised-action exchange, and treating location questions as the player's job when searching. Passive Perception covers what a character knows without asking. The DMG's table rules separate the player's voice from the character's.

The project has no path for any of this. A player's question is talk, and talk never reaches the DM (X4). The only question the DM can ask is clarify. Every source treats this exchange as routine, so the gap is structural. It is also cheap to close while the gate and proposal kinds are young, before M3 adds more players and more voices (TASK-0121).

### Pacing

[[Pacing-and-Spotlight-in-Resolution]] adds little that changes contracts. Fewer rolls, letting a result ride, and narrating in about one sentence all reinforce rules 2 and 3, along with the existing short-turns (P1) and brief-rulings (P24) pairs. This is doctrine text only.

## Tensions & tradeoffs

- **Stakes before dice puts authorship in interpret,** whose model already chooses too much: numbers (G3) and steps. Adding consequence text widens its surface. The mitigation is to keep the consequence as a short structured field that the narrator renders and the auditor checks. The alternative, narrate inventing consequences, is the failure we have.
- **Bands are a 2014-DMG house rule** against a 2024-rules baseline. Adopting them moves the project off pure SRD for checks. The verdict accepts this and would put them behind an operator flag that defaults on. A 2024 DMG read could reverse it, and the operator does not own that book.
- **The reflex list could become a loophole.** Its key word is "matches": a stagger needs a critical hit or heavy damage, and a flinch needs a failed save. Code must derive which reactions a fact allows from data the ledger holds, such as crit flags, damage as a share of maximum HP and save outcomes. Leave that to the model and the old drift returns.
- **The ask-the-DM channel adds a turn type,** and with it a latency and cost path that every question will hit. The counter-case is that the narrator's chime-in (TASK-0052) could carry it. But chime-in is unsolicited; a direct question needs an answer, not a chime.
- **The sources are three web authors, the 2014 DMG and the SRD.** Colville is dropped, and there is no 2024 DMG. On partial success and retries the web sources genuinely disagree, so those recommendations are choices, not consensus.

## Confidence & open questions

**Confidence:**
- High on the capability-not-decision line: every SRD condition and spell read is consistent with it.
- High that consequences must move before the dice: three sources and the project's own ordering rule point the same way.
- Medium on outcome bands: a house rule, with the sources split.
- Medium on the ask-the-DM shape: the principle is clear, the flow design is not.

**What would change my mind:** a captured run where pre-declared stakes make narration feel scripted, or interpret's consequence text leaking DM-only facts. Either would push consequence authoring to a separate node.

**Open questions for the operator:**
1. Adopt outcome bands (success at a cost, severe failure) for ability checks, as a flag that defaults on?
2. Should the reflex thresholds come from the sources? A crit always allows a stagger; damage of at least half the character's current or maximum HP allows a heavy-hit reaction, following the DMG's massive-damage threshold as a reference; a failed save allows a flinch matched to the effect. Or should the operator set the thresholds?
3. Should "ask the DM" go into decision-0016 as an amendment now, or be carded for a design round with the M3 table work?

## Operator resolution (2026-10-26)

The operator approved the seven recommendations and answered the open questions. The rulings are recorded in decision-0022 (D14) on the board:
- **Outcome bands:** adopted as a table-rules setting, default ON.
- **Natural 20 and natural 1:** natural 20 succeeds and natural 1 fails on any d20 test, default ON. This supersedes recommendation 6's "no special effect on checks".
- **Corollary on rolling:** never call for a roll that cannot succeed, or that the DM does not want to succeed.
- **Reflex thresholds:** confirmed as proposed.
- **Flavour intensity:** narration follows the natural die. A low roll gets a bigger, more dramatic failure; a high roll a more dramatic success. It never changes state or chooses for the player.
- **Ask the DM:** needed soon, and carded as a design round alongside the M3 table work.

## Basis

- [[_grounding]] — sources (SRD 5.2.1 PDF with its hash, DMG 2014 Ch 8–9, XGtE, TCoE, VRGtR, 29 web articles), method and gaps
- [[Involuntary-Effects-and-Player-Choice]] — the condition and control-effect table behind recommendation 1
- [[When-to-Roll]], [[Narrating-Outcomes]], [[Failure-Consequences-and-Retries]] — stakes before dice, no stakes no roll
- [[Outcome-Shapes]] — bands, crits and the edition divergence
- [[Setting-DCs-and-Modifiers]] — the DC ladder and modifier derivation
- [[Contests-Group-Checks-and-Help]] — contest, Help and group-check findings
- [[Table-Talk-and-Questions-to-the-DM]] — the ask-the-DM gap
- [[Pacing-and-Spotlight-in-Resolution]] — pacing reinforcements
- [[The-Stacks-Resolution-Today]] — contracts (Step, FactRoll, NarrationFacts), doctrine pairs, gaps G1, G3, G13, G14, G16, G17, G22, the TASK-0113 ruling
- [[Brief-and-Assumptions]] — the widened scope and source rules
