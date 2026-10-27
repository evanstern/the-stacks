---
id: decision-0026
title: >-
  D18 NPC and information doctrine: attitude and knowledge move only through
  recorded facts
date: '2026-10-27 03:53'
status: accepted
---
## Context

The AI DM has no NPC state and no information state. No field holds an NPC's attitude. No
fact records what the party learned. No prompt reads beat clues or NPC secrets. TASK-0106
(spec 034) moved Snag's hidden motive into `hooks.secrets` after companion Odo leaked it, so
the Director lost the motive too (TASK-0107). Leak checks today match exact seed strings, so
a paraphrase passes.

Two rulings bind this record. decision-0022 (D14) fixes stakes before dice, numbers from the
sheet and opposition as a DC derived from the opponent. The TASK-0135 operator ruling at
checkpoint C3 (2026-10-26, formulation 3, "ledger + opposition dice") says plot changes only
through a recorded fact. A change to another actor, disposition included, needs a roll
against that actor or an SRD rule that decides it. Seed NPCs get minimal presence state in
M3; richer NPC records stay with the Codex (M4).

Research: docs/research/NPCs-Social-and-Information/ and its analysis
Analysis-NPC-and-Information-Contracts.md (TASK-0119). Sources: SRD 5.2.1 (CC-BY-4.0)
Social Interaction and Rules Glossary (Influence, Friendly, Hostile, Indifferent, Search,
Study); DMG 2014 Ch 3, 4 and 8; XGtE, TCoE, VRGtR; 19 web articles from The Alexandrian, The
Angry GM, Sly Flourish and Pool Time.

## Decision

Status: accepted. The operator ruled on four questions on 2026-10-26. The rulings are recorded below and change points 2 and 5.

1. **Information moves only through recorded facts.** Each `hooks.knows`, `hooks.secrets`
   and beat `clues` entry gets a stable id. An `info.revealed` fact records the item, its
   source (an NPC, a Search, a Study) and its recipients. Player-facing text may state a
   DM-only item only after a reveal fact for it exists. The output gate checks this against
   the ledger, not by string match.
2. **NPC attitude is tracked state, per character.** The scale is SRD 5.2.1's Friendly,
   Indifferent and Hostile. Each NPC tracks an attitude toward each PC. The seed sets one
   starting value per NPC, and it applies to every PC; the default is Indifferent. An
   `npc.attitude` fact names the NPC and the PC, and moves that pair at most one step. The
   fact cites a check by that PC against that NPC, or a recorded harmful act by that PC. A
   harmful act sets Hostile toward that PC. The actor snapshot carries attitude per PC.
   Patience, Mood, loyalty and cross-scene standing are not adopted; they stay with the
   Codex (M4).
3. **TASK-0107 is adopted.** The Director, Interpret, Adjudicate and the audit read NPC
   `knows`, `secrets` and `relationships` through a DM-only seed view. Narrate, the companion
   and the chronicle keep the `PlayerSeedView`. The Director's free-text `goalNote` reaches
   Interpret only; narrate gets Director guidance as structured fields only. A type-level
   test proves no player-facing prompt builder accepts the DM-only view or Director free
   text. Interpret's stakes text that names a DM-only item must carry that item's reveal id.
   This amends the 034 contract line "Neither DM-side node gains secrets".
4. **A social check is the SRD 5.2.1 Influence action.** Interpret reads a request as
   willing, unwilling or hesitant. Willing complies and unwilling refuses, both without a
   roll, under the SRD rule. A Hostile NPC is never willing; code checks that. A willing
   reading cites the seed field it rests on. Hesitant rolls against a code-derived DC of 15
   or the NPC's Intelligence score, whichever is higher; a seed NPC with no SRD monster
   defaults to Intelligence 10. Friendly grants Advantage and Hostile grants Disadvantage. A
   failed check locks the same request to the same NPC for the rest of the scene, as the
   SRD's GM-set duration. The DMG 2014 DC-by-attitude table is not adopted.
5. **The clue economy is authored as conclusions.** The seed lists conclusions, each with
   the clue ids that point to it and a core flag. A test over shipped seeds warns below three
   clue paths per conclusion. Seed load fails only for a core conclusion with no clue path.
   A failed check on a core conclusion's clue resolves as success at a cost (D14 point 6). A
   reveal fact names only seed clue ids. The doctrine pair `one-clue` (P22) becomes "at most
   one conclusion advances per beat".
6. **NPC knowledge and lies are bounded by authored data.** An NPC reveals only its own
   `knows` and `secrets` items. An NPC lies only through an authored public claim that a
   DM-only secret contradicts. A successful Insight read reveals a tell, not the secret. A
   failed Insight check yields no evidence, never a false read.

## Operator rulings (2026-10-26)

1. **Attitude scope.** "Per character." Each NPC tracks an attitude toward each PC. The
   analysis recommended attitude toward the party with a per-character override; the operator
   chose per character only.
2. **Clue lint.** "Warn; fail only core." The test warns below three paths. Seed load fails
   only for a core conclusion with no path.
3. **Influence DC.** "SRD Influence DC." The DMG 2014 DC-by-attitude table is rejected.
4. **Placement.** "K3 now, K1-K6 after demo." TASK-0107 (K3) joins m-3 Track C now. K1, K2,
   K4, K5 and K6 are created in m-3, ordered after the demo subset.

## Consequences

- TASK-0107 carries point 3 and joins m-3 Track C now. Its trigger: the shipped seed's
  secret is a willingness condition ("trade the clapper for safe passage if two goblins
  fall") that Interpret needs under the C3 ruling. No captured run was searched for the
  Director ignoring a motive.
- Cards (titles, outcomes and ACs in the analysis). K1, K2, K4, K5 and K6 are m-3 cards ordered after the demo subset:
  K1 seed information ids and the reveal fact (point 1); K2 NPC attitude as tracked state
  (point 2); K3 is TASK-0107 (point 3); K4 Influence as an engine shape (point 4); K5
  conclusions and the clue economy (point 5); K6 NPC doctrine pass (points 5 and 6, P14,
  P16, P22, N6).
- Dependencies: K1 needs TASK-0135 U1 (actor snapshot) and U3 (output gate). K2 needs U1 and
  the TASK-0135 seed-NPC presence card. K4 needs TASK-0104, TASK-0128, TASK-0127 and K2. K5
  needs K1 and TASK-0127. K6 follows K1 to K5, beside TASK-0130.
- The 034 contract `specs/034-narration-quality/contracts/player-facing-context.md` "Who gets
  what" table is amended by K3.
- Branch 3 (TASK-0120, exploration and time) may key the point 4 lockout to a clock.
- Talk still moves nothing (decision-0016). Persuasion is a declared action.
