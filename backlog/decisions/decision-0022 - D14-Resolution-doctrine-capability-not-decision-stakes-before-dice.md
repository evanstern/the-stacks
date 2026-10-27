---
id: decision-0022
title: 'D14 Resolution doctrine: capability not decision, stakes before dice'
date: '2026-10-27 02:32'
status: accepted
---
## Context

Every M2 First Scene narration-quality problem traced to thin doctrine definitions: player
agency, fail-forward, "no effect", and what a roll may decide (TASK-0106 evidence; spec 034).
The operator ruled on 2026-10-26 (TASK-0113) that a roll may justify an involuntary reaction,
while volitional choices stay the player's. TASK-0115 then grounded resolution doctrine in
DM practice. Sources: SRD 5.2.1 (CC-BY-4.0) Playing the Game and Rules Glossary, DMG 2014
Ch 8-9, XGtE, TCoE, VRGtR, and 29 articles from The Alexandrian, The Angry GM and Sly
Flourish. Research: docs/research/Resolution-and-Outcome/ and its analysis
Analysis-Dice-Versus-Player.md. Ordering basis: docs/research/DM-Craft-Map/ (analysis
Analysis-Refactor-Risk-and-Deep-Dive-Order.md).

Two findings drive this record. First, SRD 5.2.1 conditions limit what a character can do,
never what it chooses; only named control effects compel behaviour. Second, the sources fix
what success and failure mean before the roll. The project already applies that ordering to
numbers (decision-0017: ordering is the anti-cheat) but not to consequences, which narrate
invents after the dice today.

## Decision

1. **Agency line: capability, not decision.** Dice decide state changes and reflexes that
   match a recorded fact. The player decides intent, speech, purposeful movement, choices and
   chosen emotions. Only a recorded control effect (Command, Suggestion, Dominate Person,
   possession, fear or stress) compels behaviour. Code derives the allowed involuntary effects
   from the ledger; the narrator and the auditor read the same list. Reflex triggers
   (operator-confirmed): a critical hit allows a stagger; damage of about half the
   character's HP or more allows a heavy-hit reaction; a failed save allows a flinch matched
   to the effect; surprise allows startlement. A small displacement inside a reflex is colour;
   a position change that matters needs an engine fact.
2. **Stakes before dice.** Interpret declares each check's consequence per outcome band before
   the engine rolls. Code computes margin and band. Narration tells the band and invents no
   consequence.
3. **No stakes, no roll.** Roll only when success and failure are both possible and failure
   has a consequence. Do not call for a roll the DM does not want to succeed. One endeavor gets
   one roll. A retry with no new risk succeeds without a roll.
4. **Numbers from the sheet.** Code derives modifiers from character data. The model picks a
   difficulty tier from the SRD 5.2.1 ladder, never a raw number. Conditions set advantage and
   disadvantage where the SRD defines them.
5. **Opposition and Help in the engine.** Opposition is a check against a DC derived from the
   opponent, per SRD 5.2.1. Help grants advantage. Group checks have no SRD rule.
6. **Table-rules settings (house rules, operator ruling 2026-10-26).**
   - Outcome bands for ability checks, default ON: success at a cost on a miss by 1-2; severe
     failure on a miss by 5 or more. Attacks and saves stay SRD-binary.
   - Natural 20 succeeds and natural 1 fails on any d20 test, default ON.
   - Group checks, default OFF.
7. **Flavour intensity matches the natural die** (operator ruling 2026-10-26). A low natural
   roll gets a bigger, more dramatic failure; a high one a more dramatic success. Flavour never
   changes state and never chooses for the player.
8. **Ask the DM.** A player's out-of-character question gets a read-only DM answer. The
   channel is chosen by a design round alongside the M3 table work and amends decision-0016.

## Consequences

- TASK-0113 implements point 1 and reserves the outcome-band field in NarrationFacts.
- TASK-0127 implements points 2, 3 and 6 (depends on TASK-0113).
- TASK-0104 implements point 4; TASK-0128 implements point 5 (depends on TASK-0104).
- TASK-0129 runs the Ask-the-DM design round (point 8).
- TASK-0130 rewrites the resolution doctrine pairs, narrate rules and audit definitions to
  match, and adds point 7 (depends on TASK-0127 and TASK-0104).
- TASK-0055 carries the DMG 2014 optional combat rules found; branch 5 (TASK-0122) decides them.
- Points 6 and 7 move the project off pure SRD 5.2.1 for checks. The settings make that
  visible and reversible.
- Narrate-v3 rule E3 and the audit-v2 player-agency definition are stricter than point 1 and
  are superseded when TASK-0113 and TASK-0130 land.
