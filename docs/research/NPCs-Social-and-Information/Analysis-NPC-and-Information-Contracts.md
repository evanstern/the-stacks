---
title: Analysis — Which NPC and information facts need contract fields, and in what order?
aliases: [NPC and Information Contracts]
tags: [analysis, npcs, information, contracts]
type: analysis
created: 2026-10-26
updated: 2026-10-26
related: [[NPCs-Social-and-Information]], [[Attitudes-as-Persistent-State]], [[Social-Checks-and-DCs]], [[NPC-Knowledge-Limits-and-Lying]], [[Clue-Economy]], [[NPC-Records-and-Motives]], [[DM-Side-Reading-of-NPC-Secrets]], [[The-Stacks-NPCs-and-Information-Today]], [[Brief-and-Assumptions]]
---

# Analysis — Which NPC and information facts need contract fields, and in what order?

_Branch 2 of TASK-0119. The question: which facts about NPCs and the information they carry need contract fields (seed schema, event kinds, step effects, prompt views), which can stay doctrine text, and in what order the contracts should land. The analysis also decides TASK-0107: should DM-side nodes read NPC secrets through a DM-only seed view. Two inputs bind every recommendation. decision-0022 (D14) fixes stakes before dice, numbers from the sheet and opposition as a derived DC. The TASK-0135 operator ruling at checkpoint C3 (2026-10-26, formulation 3, "ledger + opposition dice") says plot changes only through a recorded fact, and a change to any actor other than the acting one, disposition included, needs a roll against that actor or an SRD rule that decides it. The same ruling gives seed NPCs minimal presence state in M3 and leaves richer NPC records to the Codex (M4)._

## Verdict

**Information and attitude are plot.** The C3 ruling already names disposition as plot. The sources show that what an NPC knows, hides and tells moves a scenario as surely as flight or surrender does. So both must follow the ruling's one law: they change only through recorded facts. Today neither is state. No field holds an attitude, no fact records that the party learned something, and no prompt reads a beat clue or an NPC secret ([[The-Stacks-NPCs-and-Information-Today]]). Six recommendations follow, ordered by how much they protect against refactoring later:

1. **Seed information gets ids, and learning is a recorded fact.**
   - **Ids:** each entry in `hooks.knows`, `hooks.secrets` and beat `clues` gets a stable id. Today these are free strings.
   - **The fact:** a new `info.revealed` fact records which item reached whom (the party, or named characters), from what source (an NPC, a Search, a Study), and at which seq. A projection holds the party's known set.
   - **The leak rule:** player-facing text may state a DM-only item only after a reveal fact exists for it. This replaces leak detection by exact string with a ledger check, and it is the contract every later item keys to.
2. **NPC attitude becomes tracked state, on the SRD 5.2.1 three-step scale.**
   - **Scale:** Friendly, Indifferent, Hostile.
   - **Seed field:** the seed carries a starting attitude. The default is Indifferent, the SRD's default for a monster.
   - **How it changes:** an `npc.attitude` fact moves it one step at most. The fact comes only from a recorded check outcome against that NPC, or from a recorded harmful act against it, which makes it Hostile.
   - **Scope:** the actor snapshot (TASK-0135 U1) carries it beside presence.
   - **Not adopted:** DMG 2014's DC-by-attitude table.
3. **Adopt TASK-0107: DM-side nodes read a DM-only seed view, and the Director's free-text `goalNote` stops reaching narrate.**
   - **Readers:** the Director, Interpret, Adjudicate and the audit read `hooks.knows`, `hooks.secrets` and `hooks.relationships`.
   - **Excluded readers:** narrate, the companion and the chronicle keep the `PlayerSeedView`.
   - **The guard is structural, not a filter.** Narrate gets the Director's guidance as structured fields only. A type-level test proves that no Director free text, and no DM-only view field, can reach a player-facing prompt builder.
4. **A social check is the SRD 5.2.1 Influence action, run by the engine.**
   - **The reading:** Interpret reads each request as willing, unwilling or hesitant.
   - **Willing and unwilling resolve without a roll.** Willing complies; unwilling refuses. This is an SRD rule that decides the outcome, so the ruling admits it. A Hostile NPC is never willing, and code checks that.
   - **Hesitant rolls against the NPC.** Code derives the DC: 15 or the NPC's Intelligence score, whichever is higher. Attitude grants Advantage (Friendly) or Disadvantage (Hostile).
   - **A failed check records a lockout.** The same request to the same NPC cannot be rolled again for the rest of the scene. The SRD lets the GM set that duration.
   - **Shape:** Influence rides TASK-0128's derived-DC shape and D14's stakes and outcome bands.
5. **The clue economy is authored as conclusions, not as a per-beat cap.**
   - **Conclusions:** the seed lists conclusions (the revelations the party needs). Each conclusion lists the clue ids that point to it.
   - **Authoring lint:** a lint asks for three clue paths per conclusion (the Three Clue Rule).
   - **Core conclusions cannot be lost to a failed roll.** A conclusion marked core is delivered on a failed check as success at a cost, under D14's outcome band.
   - **No invented clues:** a reveal fact may name only a seed clue, so no invented clue can establish a conclusion.
   - **The pair `one-clue` (P22) is rewritten** as "advance at most one conclusion per beat". Several clues may point to the same conclusion.
6. **NPC knowledge and lies are bounded by authored data; detection never lies back.**
   - **Knowledge:** an NPC may reveal only items from its own `knows` and `secrets`.
   - **Lies:** an NPC may lie only through an authored public claim that a DM-only secret contradicts.
   - **Detection:** a failed Insight check yields no evidence, never a false read.
   - **Contract cost:** this is mostly doctrine text. The only contract piece is the reveal check from recommendation 1.

**The narration pattern that follows.** NPCs speak and react freely as flavour. They voice only what they know. They tell only what a reveal fact allows. They warm, cool, yield or flee only when a recorded fact says so.

## Reasoning

### The C3 ruling already decides most of this; the sources supply the shape

The ruling lists disposition beside harm, condition, flight, surrender and handover as changes to another actor that need a roll or an SRD rule. A disposition that is not state cannot be gated, so the ruling implies attitude as a field. The project has none: no attitude, disposition, mood, loyalty or standing anywhere in the seed, the session model or the engine ([[The-Stacks-NPCs-and-Information-Today]]).

The surprising finding is how closely SRD 5.2.1's Influence action matches the ruling ([[Social-Checks-and-DCs]]). The GM first reads the request as willing, unwilling or hesitant. Willing and unwilling resolve with no check. Only hesitant rolls, with attitude as Advantage or Disadvantage and a DC derived from the target. That is formulation 3 in miniature: an SRD rule decides the uncontested cases, a roll against the target decides the contested one, and the DC comes from the opponent, which is D14 point 5. The 2024 baseline needs no house rule here.

The DMG 2014 alternative sets the DC by attitude (0, 10 or 20 through the Conversation Reaction table). It conflicts with D14 point 4, where the model picks a tier and code derives the number, and it diverges from the SRD edition ([[Attitudes-as-Persistent-State]]). So the SRD shape wins on both counts.

### Information is plot, and the project already pays for treating it as prose

The M2 and TASK-0106 evidence is all about information. Companion Odo stated the hidden bell motive in a captured run, six hidden-info fails in all. TASK-0106 fixed it by moving the motive out of reach of every prompt ([[DM-Side-Reading-of-NPC-Secrets]]). That fix detects leaks by exact string: `dmOnlySeedText` and the playtest auditor's `hidden-info` check compare seed strings, and a paraphrase passes ([[DM-Side-Reading-of-NPC-Secrets]]).

The sources treat learning as an event with a cause:
- a clue is found by a search, a check or an NPC who approaches the party;
- a secret is uncovered and then used for leverage (DMG 2014 Ch 4, Flaw or Secret);
- a leveraged clue unlocks new testimony once the party holds a prerequisite (the Alexandrian, Returning to the Scene of the Crime) ([[Clue-Economy]], [[NPC-Knowledge-Limits-and-Lying]]).

If learning is a fact, the leak rule becomes checkable: a DM-only item may appear in player-facing text only after its reveal fact. That is the same move decision-0017 made for numbers and the C3 ruling made for actor state: ordering in code instead of a promise in a prompt. It also gives beat `clues` their first reader. And it gives "the party learned the safe path" a ledger home, which no table has today.

This is recommendation 1, and it goes first. Recommendations 3, 5 and 6 all key to item ids. Changing the seed's string lists to records with ids after more seeds exist is the costliest refactor in the set.

### Attitude: small scale, one step per fact, scoped to the snapshot

The sources disagree on granularity. The SRD and DMG use three steps, the Alexandrian about four bands, the Angry GM about five levels plus a draining Patience and a temporary Mood ([[Attitudes-as-Persistent-State]]). Three steps is the right contract: it is the only scale with rules attached (Advantage and Disadvantage), and the operator ruled seed NPC state minimal for M3.

DMG 2014 limits a shift to one step per interaction. That limit is cheap to check in code, and it stops a single persuasive turn from flipping a Hostile NPC into an ally. The Odo bargain that ended the TASK-0110 encounter with no dice is exactly such a flip (TASK-0135 inventory, gap G3).

Harm as a cause needs one line of reasoning. An attack is a roll against the NPC, so the ruling already admits a recorded harmful act as the trigger. The DMG names a harmful deed as a cause of a worse attitude. Setting Hostile in code means narration cannot keep a wounded NPC cordial.

Patience and Mood are not adopted as fields. Patience overlaps the SRD lockout and D14's "no stakes, no roll". Mood is a situational modifier that the model can state as a reason for Advantage or Disadvantage under D14 point 4.

### TASK-0107: the ruling turns secrets from pacing colour into resolution input

The card asked whether the Director needs Snag's motive to pace the scene. The C3 ruling raises the stakes. Interpret must now read each social request as willing, unwilling or hesitant, and that reading depends on what the NPC really wants. Snag's secret in the shipped seed is a willingness condition: he trades the clapper for safe passage if two goblins fall ([[DM-Side-Reading-of-NPC-Secrets]]). Without it, Interpret reads "give us the clapper" blind, and must roll or refuse a deal the seed author intended. With it, the condition is checkable against the ledger, because two dead goblins is engine state.

The card's second trigger, "a seed needs a villain's secret to drive pacing", is met by the shipped seed text. The first trigger, a captured Director ignoring a motive, was not searched for ([[_grounding]], Gaps). The verdict rests on the seed and the ruling, not on run evidence.

Every source has one DM hold the hidden data and play from it: the secret loyalty score, the villain's secret weakness, notes of what each NPC knows, wants and might reveal ([[DM-Side-Reading-of-NPC-Secrets]], [[NPC-Records-and-Motives]]). The project's split into planner and narrator nodes is new, and no gathered source addresses it. The reasonable reading is that the DM-side nodes are the DM and the player-facing nodes are the DM's mouth. TASK-0106 removed secrets from the mouth and, by accident, from the DM. The 034 contract's line "Neither DM-side node gains secrets" was the cautious default then. Adopting TASK-0107 amends it.

**Keeping `goalNote` clean.** `goalNote` is up to 300 characters of Director model text, copied into narration facts and rendered into narrate as a "Private note" ([[DM-Side-Reading-of-NPC-Secrets]]). Once the Director reads secrets, any filter on that text has to catch paraphrase, and the project's only leak checks match exact strings. Three options were weighed:
- **Filter the text** with the TASK-0135 output gate (U3) plus an exact-secret match. It misses paraphrase, which is the failure mode that matters.
- **Keep the field and forbid secrets by prompt instruction.** That is prompting, not ordering, which decision-0017 rejects.
- **Remove the path.** `goalNote` stays a DM-side note that Interpret reads, as it does today. Narrate gets the Director's guidance only as structured fields: pacing, the active beat id, the spotlight target. Narrate already receives pacing.

The third is the only one a test can prove: the narrate prompt builder's input type has no field typed from Director free text or from the DM-only view.

The same rule governs D14 point 2's stakes text. Interpret will read secrets, and it declares consequences that narrate renders. So a stake that names a DM-only item must carry that item's reveal id, and the output gate checks the reveal like any other. The D14 analysis named "interpret's consequence text leaking DM-only facts" as the result that would change its mind. Recommendation 1 is the guard against it.

The companion stays on the player-facing side. It is a seat, not the DM (TASK-0135 inventory, companion row), and it is the node that leaked in TASK-0106.

### Social checks: Influence fits D14 without a new resolution model

The SRD structure lines up with D14 at every joint ([[Social-Checks-and-DCs]]):
- **The reading before the roll** is D14 point 2, stakes before dice. Interpret declares willing, unwilling or hesitant, and for hesitant the consequence per band.
- **Willing and unwilling as no-roll outcomes** are D14 point 3. TASK-0127 records them as engine outcomes without a roll.
- **The DC of 15 or the Intelligence score, whichever is higher,** is D14 point 5, a DC derived from the opponent. It needs an Intelligence score for every seed NPC that can be influenced. Seed NPCs with an `srdMonsterId` have one. The rest need a seed field, defaulting to 10, which gives DC 15.
- **Attitude as Advantage or Disadvantage** is D14 point 4.
- **The 24-hour wait, "or a duration the GM sets",** makes a scene-length lockout SRD-faithful. A failed request cannot be re-rolled the same way in the same scene. A new approach is a new request, and the sources agree that a new approach earns a new check (DMG Repeat?, the Angry GM's third repeat).

Two guards stop the willing reading from becoming a loophole. Without them, Interpret could read every hard bargain as willing and move plot with no dice, which is the G3 failure again. First, a Hostile NPC is never willing; code checks that against the snapshot. Second, a willing reading must cite the seed field it rests on: a want, or a secret condition whose predicate the ledger meets. The audit can check the citation.

One existing rule needs restating rather than changing. Talk never moves state (decision-0016), so persuasion is a declared action, not a line of talk. The Angry GM's practice of turning each declaration into an intention plus an approach is what Interpret already does.

### Clue economy: the Three Clue Rule and `one-clue` measure different things

The apparent conflict dissolves on inspection ([[Clue-Economy]]). The Three Clue Rule counts **clues per conclusion across a scenario**. P22 `one-clue` caps **clues revealed per beat**. Both can hold, but P22 as worded fights redundancy. Three paths to one conclusion means the party may find two in one beat, and a second clue to a known conclusion reveals nothing new. Restating P22 as "at most one conclusion advances per beat" keeps its intent (reveal the truth slowly) and lets redundancy work.

GUMSHOE and the Alexandrian's Null Result article pull opposite ways. GUMSHOE delivers core clues with no roll. The Null Result article warns against inventing a clue so that every search succeeds. D14's bands reconcile them without a new rule:
- A core conclusion's clue on a failed check arrives as success at a cost. The scenario cannot stall on one die, which is the Alexandrian's main failure point.
- A reveal fact may name only a seed clue, so the DM cannot invent a clue to rescue a theory. Improvised colour is still flavour; it simply cannot establish a conclusion.

The three-path count is an authoring lint over seeds, not a runtime gate. A runtime gate cannot add clues; an author can.

### Knowledge and lies: thin sources, so bound them by data and keep the rule small

No SRD or book rule limits NPC knowledge or governs NPC lies. Books treat knowledge as an authored field (DMG Useful Knowledge, the Alexandrian's Key Info), and web sources treat lying as motive plus signals ([[NPC-Knowledge-Limits-and-Lying]]). That fits the ledger cleanly:
- An NPC reveals only its own `knows` and `secrets` items. A reveal fact naming another NPC's item is refused.
- A lie is an authored public claim that a DM-only secret contradicts. The narrator, who sees only the public view, can voice the claim without knowing it is false. The Player Trust article's fairness test, define motives in advance, is met by the seed author, not by the model at play time.
- Detection is a Search with Insight against the NPC (SRD p.187). Success reveals a tell: the NPC is hiding something. It does not reveal the secret.

The DMG 2014 option where a failed Insight check by 10 or more yields a false characteristic is rejected. Under the ledger law, a false read would be a recorded false fact. The search-lead consensus the branch found also reads a failed Insight check as no evidence. This recommendation is mostly doctrine text. Its only contract piece is the reveal check from recommendation 1, which is why it is last.

## Tensions & tradeoffs

- **The C3 ruling said "minimal" for seed NPCs.** Attitude is one step past presence. The case for adding it in M3: the ruling itself names disposition as gated plot, and a gate needs state. The case against: scope. The Codex (M4) will own NPC records, and attitude may belong there. The verdict adds attitude in M3 as one three-valued field and leaves Patience, Mood, loyalty and cross-scene standing to the Codex. This is operator question 1.
- **Ids on seed information raise the authoring burden.** Each `knows`, `secrets` and `clues` entry becomes a record. The shipped seed is small, and the cost only grows with every new seed, which is the argument for paying it now.
- **Removing `goalNote` from narrate loses the Director's nuance,** such as "keep Wenna reluctant until the party mentions Pell". Structured fields cannot say that. The tradeoff is deliberate: free-text nuance is exactly the channel a secret leaks through. If narration quality drops measurably, the fix is a small closed set of public-safe directives, not free text.
- **The willing reading is still a model judgment.** The Hostile check and the cited seed field narrow it, but an Interpret that cites a want loosely can still grant a deal. The C3 ruling accepted the same residue when it left "is this contested" to Interpret.
- **A scene-length lockout stands in for the SRD's 24 hours.** It is SRD-faithful by the rule's own escape clause. Branch 3 (TASK-0120, exploration and time) may key it to a clock once one exists.
- **The sources are thin where the contract is new.** No source addresses a split planner-and-narrator DM. Lying rests on one blog and search summaries. GUMSHOE is second-hand (its pages returned 403). The Three Clue Rule page has an unread tail. Recommendations 3 and 6 are reasoned from the project's own law more than from source consensus.

## Confidence & open questions

**Confidence:**
- High on recommendations 1 and 2: the C3 ruling requires a recorded fact for disposition and plot, and nothing in the project records either today.
- High on recommendation 4's shape: the SRD Influence action matches formulation 3 and D14 point for point.
- Medium-high on adopting TASK-0107: the shipped seed's willingness condition makes the case, but no captured run shows the Director failing for lack of it.
- Medium on the clue-economy rewrite. Medium-low on the lying rule: the sources are split or thin.

**What would change my mind:**
- A captured run where narration without `goalNote` loses pacing that structured fields cannot restore would push toward a closed directive set.
- A seed author finding information with ids unworkable would push toward ids on secrets and clues only, not on `knows`.

**Open questions for the operator:**
1. Is NPC attitude in M3, beside the minimal presence state, or with the Codex in M4? The analysis recommends M3.
2. Is attitude held toward the party as a whole, or per character? The analysis recommends a `toward` field: the party by default, a character id when one character earned it.
3. Should the three-clue lint fail seed load, or only warn? The analysis recommends a warning test over shipped seeds, plus a load error for a core conclusion with no clue path.
4. Confirm rejecting the DMG 2014 DC-by-attitude table in favour of the SRD 5.2.1 Influence DC.

**Gaps the orchestrator should know:** no capture was searched for the TASK-0107 trigger evidence; the 2024 DMG and the 2014 PHB social chapter were not read; time and clocks belong to branch 3 (TASK-0120).

## Proposed implementation cards (not created)

Each card cites decision-0026 (D18). All are Track C unless noted.

- **K1 — Seed information ids and the reveal fact.** Outcome: `hooks.knows`, `hooks.secrets` and beat `clues` entries carry stable ids, and an `info.revealed` fact records what the party learned. ACs: (1) the seed schema and loader require ids and reject duplicates; (2) a reveal fact names an item id, a source and recipients, and a projection holds the known set; (3) a reveal by an NPC must name that NPC's own item; (4) the output gate refuses player-facing text that states a DM-only item with no reveal fact, and a test drives it with a paraphrased secret. Depends on TASK-0135 U1 and U3.
- **K2 — NPC attitude as tracked state (per character).** Outcome: each seed NPC tracks an attitude toward each PC in the actor snapshot, changing only through recorded facts. ACs: (1) the seed takes one starting attitude per NPC, applied to every PC, default Indifferent; (2) an `npc.attitude` fact names the NPC and the PC, moves that pair at most one step, and cites a check by that PC against that NPC or a recorded harmful act by that PC; (3) a recorded harmful act by a PC sets Hostile toward that PC; (4) the snapshot and the audit render attitude per PC. Depends on U1 and the TASK-0135 seed-NPC presence card.
- **K3 — TASK-0107 adopted: a DM-only seed view for DM-side nodes.** Outcome: the Director, Interpret, Adjudicate and the audit read NPC `knows`, `secrets` and `relationships`; no player-facing prompt can receive them or Director free text. ACs: (1) a DM-only seed view type feeds the four DM-side prompts; (2) narrate takes Director guidance only as structured fields, and `goalNote` reaches Interpret only; (3) a type-level test proves no player-facing prompt builder accepts the DM-only view or Director free text; (4) the 034 contract's "Who gets what" table is amended. Carried by TASK-0107 itself.
- **K4 — Influence as an engine shape.** Outcome: social requests resolve per the SRD 5.2.1 Influence action. ACs: (1) Interpret reads willing, unwilling or hesitant, with a cited seed field for willing; (2) code refuses willing for a Hostile NPC; (3) hesitant rolls against a code-derived DC of 15 or the NPC's Intelligence score, whichever is higher, with Advantage or Disadvantage from attitude; (4) a failed check records a lockout, and the same request to the same NPC is refused for the rest of the scene. Depends on TASK-0104, TASK-0128, TASK-0127 and K2.
- **K5 — Conclusions and the clue economy in the seed.** Outcome: seeds list conclusions and their clue paths, and a core conclusion cannot be lost to one failed roll. ACs: (1) the seed schema takes conclusions, each with clue ids and a core flag; (2) a test over shipped seeds warns below three paths, and the loader refuses a core conclusion with none; (3) a failed check on a core conclusion's clue resolves as success at a cost; (4) a reveal fact names only seed clue ids. Depends on K1 and TASK-0127.
- **K6 — NPC doctrine pass (doctrine text).** Outcome: the NPC doctrine pairs match decision-0026 (D18). ACs: (1) P22 `one-clue` reads "at most one conclusion advances per beat"; (2) new pairs cover knowledge bounds, authored lies and "a failed Insight check gives no evidence"; (3) P14 and P16 name their data sources (portrayal fields, the DM-only view); (4) the narrate rule N6 states that an NPC reaction that changes state needs a fact. Depends on K1–K5; runs beside TASK-0130.

## Basis

- [[_grounding]] — sources (SRD 5.2.1 PDF with its hash, DMG 2014 Ch 3, 4 and 8, XGtE, TCoE, VRGtR, 19 web articles read), method and gaps
- [[Attitudes-as-Persistent-State]] — the three-step scale, the one-step limit, the edition divergence
- [[Social-Checks-and-DCs]] — the Influence action, its DC and lockout, the DMG table
- [[NPC-Knowledge-Limits-and-Lying]] — knowledge as an authored field, lying by motive and signal, detection
- [[Clue-Economy]] — the Three Clue Rule, core clues, the Null Result, the `one-clue` pair
- [[NPC-Records-and-Motives]] — public versus hidden NPC data in the sources
- [[DM-Side-Reading-of-NPC-Secrets]] — the TASK-0107 facts, the `goalNote` path, the exact-string leak checks
- [[The-Stacks-NPCs-and-Information-Today]] — seed schema, readers, doctrine pairs P14, P16, P22, gaps
- [[Brief-and-Assumptions]] — scope, source rules, open questions
- Binding project inputs outside the vault: decision-0022 (D14); the TASK-0135 C3 ruling and `docs/design/actor-state-gate.md` on branch `task-0135-actor-state-gate`

## Operator rulings (2026-10-26)

1. **Attitude is per character.** "Per character." Each NPC tracks an attitude toward each PC. This replaces the recommendation of attitude toward the party with a per-character override. K2 is updated to match.
2. **Clue lint.** "Warn; fail only core." The test warns below three paths. Seed load fails only for a core conclusion with no path.
3. **Influence DC.** "SRD Influence DC." The DMG 2014 DC-by-attitude table is rejected.
4. **Placement.** "K3 now, K1-K6 after demo." TASK-0107 (K3) joins m-3 Track C now. K1, K2, K4, K5 and K6 are m-3 cards ordered after the demo subset.
