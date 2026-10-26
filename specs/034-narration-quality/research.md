# Research: narration quality — evidence classification of run 5

**Feature**: TASK-0106 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

**Evidence**: `evidence/run5-20261026T171359Z-greyhollow-ford-provider/` (TASK-0048 paid
provider run 5, commit `1db60e3`, outcome `stalled`, 30 moves committed, $7.52 of a $22
ceiling). Per-turn table with every label: `evidence/run5-classification.json`.

**Method**. `jobs.json` holds 44 turn jobs. Five were `held` and have no audit record. The other
39 carry `result.audit` (every attempt's deterministic and `dm.audit` issues). They pair 1:1, in
order, with the 39 `narration` rows of `transcript.jsonl`. Every `dm.audit` issue was read. The
`player-agency`, `ledger-mismatch`, `invented-mechanics` and `other` issues were labelled by hand
from their detail. The LLM `doctrine` issues were labelled by keyword (noted where it is noisy).
Rejected prose is not stored (031 audit record keeps only its hash). So a label judges the
auditor's stated reason, not the prose itself.

**This file is the classification (card AC #3).** Implement only the causes marked
**selected**.

---

## R0. The seat's fallback move skews the rates

The scripted seat (scenario `greyhollow-ford.json` on `origin/task-0048-playtest`) has three free
moves, one combat move and a fallback move: "I press on toward the ferry before dark." The seat
used the fallback for every move after `act-strike`: actions `pt-4`, `pt-6` … `pt-30` (26
declarations). It is the same vague text each time, so interpret often asked a clarify question.

The dispatch ruling names "the 12 turns from pt-19 on". The evidence shows the fallback move from
`pt-4`. Both cuts are reported. The measurement for AC #4 uses the evidence cut (R5).

| Cut | Narrated turns | passed | passed after regenerate | fallback | Fallback rate |
|---|---|---|---|---|---|
| All turns | 39 | 7 | 9 | 23 | 59% |
| Excluding `pt-19` … `pt-30` (dispatch ruling) | 27 | 7 | 3 | 17 | 63% |
| `pt-19` … `pt-30` only | 12 | 0 | 6 | 6 | 50% |
| Excluding seat-only fallback-move turns (R5 rule) | 14 | 6 | 1 | 7 | 50% |

The rate is high under every cut. The first narrated action (`act-search`, seq 16) already shipped
the fallback. The harness defect inflates the count; it does not cause the rejections.

95 narration attempts ran for 39 turns. Only 7 turns passed on the first attempt.

---

## R1. Problem 1 — why `dm.audit` rejected narration

### Issue kinds by cause (all 39 turns, all attempts)

183 issues plus 1 audit-call failure. Columns are the labels; R1 defines them.

| Issue kind (source) | Count | Auditor wrong | Narrator wrong | Craft (judgment) | Unverifiable |
|---|---|---|---|---|---|
| player-agency (LLM) | 62 | 54 (NPC 29, DECL 10, NOEFFECT 6, MISFILED 6, CONFUSED 3) | 8 (PC 8) | — | — |
| doctrine (LLM) | 90 | 6 (NPCSTATE 6) | — | 84 (ENDING 37, LENGTH 36, EITHEROR 10, DOC-OTHER 1) | — |
| doctrine (deterministic) | 15 | — | 15 (DET-EITHEROR 13, EMPTY 2) | — | — |
| ledger-mismatch (LLM) | 3 | 2 (NOEFFECT 2) | 1 (INVENT-CLUE 1) | — | — |
| ledger-mismatch (deterministic) | 3 | — | — | — | 3 (DEATHWORD 3) |
| invented-mechanics (LLM) | 4 | 3 (NOEFFECT 3) | 1 (INVENTED 1) | — | — |
| other (LLM) | 6 | 3 (NOEFFECT 3) | 2 (CLARIFY 2) | 1 (EITHEROR 1) | — |
| audit call failed | 1 | — | — | — | 1 (infra) |
| **Total** | **184** | **68** | **27** | **85** | **4** |

### Labels

| Label | Meaning | Example (attempt) |
|---|---|---|
| NPC | The auditor treats a non-player character (or the world) as player-controlled. | "Pell is a player character; only the player chooses their words" (seq 58, a1). "Only the player controlling Snag may decide what Snag says" (seq 58, a3). |
| DECL | The prose shows the hero carrying out the declared action itself. The auditor calls that deciding the hero's moves. | "Narration decides Tamsin's physical action ('boot finds mud again')" for "I press on toward the ferry" (seq 101, a1). |
| NOEFFECT | The auditor reads the resolve outcome `no-effect` as "nothing may happen in the world". | "A no-effect action produces no narration; the world state doesn't change" (seq 225, a1). |
| MISFILED | An option-menu or ending complaint filed as `player-agency`. | "presents two paths as 'Two ways wait'" (seq 53, a2). |
| CONFUSED | The auditor attributes one character's line or state to another. | "decides Tamsin's emotional state ('grinning wide')" — Snag grins (seq 184, a2). |
| NPCSTATE | A `doctrine` issue that forbids an NPC's inner state as if the NPC were the hero. | "Pell's inner state ('not scared') violates the rule against narrating the hero's feelings" (seq 58, a1). |
| PC | The narrator decided a party member's words, feelings or choices beyond the declaration. | "Tamsin's breath goes short" (seq 53, a1); "ignoring Wenna's warning entirely" (seq 33, a1). |
| INVENT-CLUE | The prose grants a guarded discovery the engine did not roll for. | A no-roll search finds Wenna in the loft (seq 16, a1). |
| INVENTED | The prose shows a mechanical result with no roll. | "the pole striking Tamsin's shoulder" (seq 299, a1). |
| CLARIFY | The facts asked a clarify question and the prose did not ask it. | seq 53 a3; seq 80 a2. |
| DET-EITHEROR | The deterministic option-menu check failed: the prose ends on an "A or B?" question. | 13 issues, every one on a clarify turn (R1.3). |
| EMPTY | The narrator returned empty prose. | seq 16 a3 and seq 215 a2; each after an auditor told it a no-effect turn gets no narration. |
| ENDING, LENGTH, EITHEROR, DOC-OTHER | Craft judgments on the closing beat, the word count, hidden choices, density. Keyword-labelled. | "Ends on atmosphere rather than a demand" (37×); "exceeds one hundred fifty words (approximately 165)" (36×). |
| DEATHWORD | The deterministic death-word check fired. The run had no damage at all. The matched words are not recorded. | seq 80 a3; seq 147 a1 and a3. |

### R1.1 Cause A1 — the auditor has no party roster (selected)

The `dm.audit` prompt holds only the facts and the prose. It never says who the player
characters are. 29 NPC + 6 NPCSTATE + 3 CONFUSED = 38 issues follow from that gap. The narrate
prompt has the same gap. Its "Present characters" section lists NPCs only, and it never names the
party. The narrator then decides a companion's state (seq 215: "Odo's voice has gone quiet"),
which is F81's root (R4).

**Fix**: the facts carry a party roster (name, human or AI companion) and the NPC names. Narrate
and audit both render it. `player-agency` is defined as a party member only
(contracts/audit-criteria.md, contracts/narration-facts.md).

### R1.2 Cause A2 — `no-effect` is undefined for both models (selected)

`resolve` sets `no-effect` when an action ran no engine batch: a `none` step, a clarify, or no
steps (`nodes/resolve.ts`). The narrate and audit prompts print `-> no-effect` with no meaning.
The auditor reads it as "nothing happens" (NOEFFECT 14, and 2 EMPTY prose after it). The old
fallback prints "acts, and nothing changes", which is false whenever the turn changed anything
else (F23).

**Fix**: the facts render `no-effect` as "no rules effect: nothing was rolled and no game state
changed; the attempt still happens in the fiction". A clarify action renders as "on hold: nothing
happened yet". The auditor fails only a granted rules result (a hit, damage, a condition, a
death, a success at an uncertain task, a guarded discovery).

### R1.3 Cause A3 — the clarify question is relayed as an option menu (selected)

On a clarify turn the narrate prompt says "Ask the player of `<id>` one short question:
`<question>`". Interpret writes that question, often as an either-or. Example from seq 160: "Walk
past the standoff to the ferry, or do something about Snag's terms first?". The narrator relays
it. The deterministic option-menu check then fails the prose (13 of 13 DET-EITHEROR issues are on
clarify turns). At least 16 turns had a clarify. All 16 shipped the fallback.

**Fix**: narrate states the unclear intent and asks for one short open question in its own words,
with no options. A new deterministic check requires the prose to end with a question when the
facts carry a clarify. The fallback asks an open question too. Interpret is unchanged (no
interpret prompt change).

### R1.4 Cause A4 — craft judgments block the gate (selected)

The LLM `doctrine` issues are craft judgments (ENDING 37, LENGTH 36, EITHEROR 10). They conflict
across attempts: one attempt fails for ending on a question, the next for ending on atmosphere.
The length complaints are estimates ("approximately 165"). One flags "~150, within tolerance". The
deterministic check already holds the hard limit (220 words). 031's contract states that a fail
with only `doctrine` or `other` issues still fails the attempt. That rule turns craft advice into
fallbacks. Each regeneration also carries every earlier issue, so contradictory craft advice
accumulates.

**Fix**: LLM `doctrine` and `other` issues become advisory. They are recorded and never trigger
a regenerate or the fallback. Deterministic checks stay blocking. Regeneration passes only
blocking issues. The auditor is told that code checks the length.

### R1.5 Cause A5 — the narrator decides party members' states (selected; covered by A1)

PC 8 issues are real narrator errors. Examples: Tamsin's breath, Tamsin's inner reasoning, Odo's
posture and intent, a companion's silence. The narrate rule already forbids it. The narrator
cannot apply it because it does not know who the party is. A1's roster and a rule that companions
are player characters too cover it. The auditor keeps `player-agency` blocking for party members.

### R1.6 Not selected

| Candidate | Evidence | Decision |
|---|---|---|
| Change the attempt budget (3) | 9 turns passed after regenerating; no turn shows the count as the limit. | Not selected. The budget stays. |
| Change the `dm.audit` model (Haiku) | CONFUSED is 3 of 184. The large groups follow from missing context (A1, A2), not capacity. | Not selected. A model change is an operator checkpoint if Phase 5 fails on the rate (plan.md). |
| Retry `dm.audit` on a call failure | 1 turn (seq 88, `invalid-output`). | Not selected. The in-fiction fallback (R2) makes this turn harmless. |
| Narrow the death-word check | 3 issues on 2 turns; the prose is not stored, so a figurative "dies" cannot be told from a threat. | Not selected. Selected instead: the deterministic issue detail quotes the matched words, and each attempt records its word count (evidence for the next run). |
| Give `dm.audit` the seed secrets to catch leaks | Both narration leaks have a source fix (R3). A Haiku leak check adds rejections. | Not selected. |
| Lower the deterministic length limit to 150 | Rejected drafts' real lengths are unknown. Shipped narrations run 37–105 words. | Not selected. The limit stays 220; the attempt's word count is now recorded. |

### R1.7 Counterfactual

Apply the selected rules to the recorded labels: R1.1–R1.4 issues stop blocking, and
deterministic checks still block. Then 20 of the 23 fallback turns had at least one attempt with
no blocking issue. The 3 that remain are seq 80 (clarify relay plus a death word), seq 88 (audit
call failure) and seq 147 (clarify relay, a death word, one PC issue). R1.3 targets two of them.
This is an estimate: the models will see new prompts and behave differently. Phase 5 measures the
real rate.

---

## R2. Problem 2 — the fallback text

`factualSummary` (`apps/server/src/dm/fallback.ts`) shipped on 23 turns. Its sentences:

| Sentence | Turns | Defect |
|---|---|---|
| "`<Name>` acts, and nothing changes." | 21 | Out of fiction. False when anything else changed (F23: an encounter ended). |
| "One action needs a clearer description." | 16 | System commentary (F10, F29, F49 fail `invented-mechanics`, F96, F108). |
| "The party enters a fight." / "The fight is over." | 2 | Meta summary (F8, F24). |
| "`<Name>` acts." (NPC turn, no roll) | 1 | Stub (F14). |
| "`<Name>` succeeds." + dice line | 1 | Bare mechanics (F62). |

Ledger changes in run 5 that the fallback does not model:

| Public row type | Seen in run 5 | In the old facts? |
|---|---|---|
| `encounter.started` (+ `combatant.added` per monster) | seq 39–50 | No (only `modeChange` free→turn) |
| `encounter.ended` | seq 85 | No (only `modeChange` turn→free) |
| `turn.advanced` | seq 56, 62, 71, 78 | No |
| `table-mode.changed` | seq 51, 57, 63, 72, 79, 86 | Partly (free↔turn only) |
| `tracker.changed` | seq 8, 9, 14, 22, 31, 55, 290 | No — and it must stay out: visibility `dm` |
| `hp.changed`, conditions, life states | none in run 5 | Yes |

**Selected**: rewrite the fallback per contracts/fallback-summary.md. It stays code-only and
deterministic. It writes in-fiction plain sentences, one per public change, and never a number.
It uses the opening framing at scene start. It ends with an open question on a clarify. It names
no hidden tracker. The facts gain `events` for the public row types above
(contracts/narration-facts.md).

---

## R3. Problem 3 — hidden-info leaks (6 fails)

The playtest auditor (`apps/server/src/playtest/auditor/prompt.ts` on `origin/task-0048-playtest`)
treats as DM-only: `location.hooks.secrets`, every `npcs[].hooks.secrets`, and every non-public
`tracker.changed` row. The relevant secret is the first location secret: "Goblins from the
reed-camp took the bell's clapper; the bell's ring drives off the river-things they fear, and they
want it for their own camp."

### Which prompt carries what (code read, commit `81dfb7d`)

No prompt receives any `hooks.secrets` field or any NPC `hooks.knows`. The secret still reaches
player-facing prompts through three non-secret fields that restate it:

| Path | Text | Reaches | Field class today |
|---|---|---|---|
| L1 | Doctrine pair `villains-believe`, Right: "The goblins want the bell because its ring scares off river things." | The narrate **system** prompt (and the director's). The narrate doctrine set is about 700 tokens, under the 900 cap, so it is always sent. | Doctrine example |
| L2 | Snag `portrayal.want`: "To keep the clapper, because its ring keeps the river-things off his camp." | Narrate user prompt, "Present characters", on the `reed-camp` beat (`facts.presentNpcs`). Also director and interpret (`seedEntries`). | NPC portrayal |
| L3 | Odo `hooks.knows`: "Goblins value noise-makers as wards." | The companion prompt for Odo ("Knows:"). | Character hooks |
| L4 | Public narrations and talk that already carry L1–L3 | Later narrate, companion and chronicle transcripts | Propagation |
| L5 | Snag `portrayal.detail` "Wears the bell's leather clapper-strap as a belt", and Wenna's check-free clue | Narrate (detail). The secret's first clause ("goblins took the clapper") is public by the seed's own design. | Seed overlap |

### The six fails

| Finding | Row | Speaker | Leak path |
|---|---|---|---|
| F27 | 93 talk | Odo | L3 ("keep the clapper if it wards off worse things than us") |
| F46 | 127 talk | Odo | L3 ("That bell hums like a warding charm to goblin ears") |
| F54 | 153 narration | narrator | L1 + L2 ("a promise the river-things stay his trouble") |
| F56 | 158 talk | Odo | L3 + L4 (narration 153) |
| F84 | 234 narration | narrator | L5 (the clapper on Snag's hip) |
| F87 | 247 talk | Odo | L3 + L4 |

**Selected**:

1. A typed player-facing seed view is the only seed input of the narrate and companion prompt
   builders and of `facts.presentNpcs` (contracts/player-facing-context.md). It holds no
   `hooks.secrets`, no NPC `hooks.knows`, no beat, clue, encounter, tracker or goal-condition
   text.
2. Rewrite the `villains-believe` Right example so it names nothing in the shipped seed (L1).
3. Edit the seed (L2, L3, L5): Snag's `want` keeps the surface want; the motive moves to Snag's
   `hooks.secrets`. Odo's `knows` drops the ward claim. The location secret drops the clause the
   seed itself makes public. Exact text: contracts/player-facing-context.md.
4. Player-facing prompts (narrate, companion, chronicle) take public transcript entries only.

**Director and adjudicate**: no change. Neither prompt receives secrets today. The Director
prompt changes only through the doctrine example (director v2). The Director loses Snag's motive
from `want`. Whether DM-side nodes should read NPC secrets is a separate design question, not in
this card's evidence. The Director's `goalNote` still reaches narrate. It is model text, not a
seed fact (AC #1 scope). Run 5 does not record it. Phase 5 catches any leak through it.

---

## R4. Problem 4 — ledger contradictions (5 fails)

| Finding | Rows | What happened | Cause | Decision |
|---|---|---|---|---|
| F17 | 60, 61, 64 | Goblin-3's melee jab (`attack.resolved` reason: "jabs at Tamsin with its dagger") was narrated as a thrown dagger from a lookout. | The facts give an NPC turn only its name, outcomes and changes. `factEntries` drops every roll's `reason`. Narrate and audit never saw "jab". | **Selected**: render each roll's reason and target in the facts (contracts/narration-facts.md). |
| F23 | 85, 86, 88 | The fallback said "Kestrel acts, and nothing changes. The fight is over." The encounter had ended and initiative dropped. | The fallback (R2). Triggered by an audit call failure. | **Selected**: R2. |
| F76 | 211, 212, 215 | The playtest auditor says the ledger names Kestrel and the narration says Tamsin. Row 212 is Tamsin's `pt-19`; the narration is right. Row 211 is a public chronicle entry that credits Tamsin's `pt-18` to "Kestrel". | `transcriptLine` prints the declaring actor (a user id for a human) and never the character. The chronicle guessed the name. | **Selected**: player-facing transcript lines name the character (contracts/player-facing-context.md). |
| F77 | 211, 215 | The auditor says Odo is on the bank (row 211), the narration puts him at the tower. Rows 207–210 (previous segment) show Odo climbing the tower and the narration placing him in the loft. | A playtest-auditor segment-window false positive. Row 211 is a lagging chronicle entry. | **Not a generator defect.** Not fixed here. Recorded as a TASK-0048 auditor observation. |
| F81 | 216, 219, 222 | The journal (219) says Odo fell silent; Odo talks at 216 and 222. | Narration 215 decided a companion's state ("Odo's voice has gone quiet"). The chronicle copied it. Cause A1/A5: narrate has no party roster. | **Selected**: R1.1 roster and the companions-are-player-characters rule. |

---

## R5. Measuring AC #4

A **seat-fallback turn** is a narration whose `actionIds` are non-empty and all name seat
actions declared with the scenario's `moves.fallback.text`. A turn that mixes a seat-fallback
action with another action counts as narrated. A **fallback turn** is a `journal.entry.added`
row titled `Audit flag: narration replaced`. The fallback rate is fallback turns over narrated
turns, both excluding seat-fallback turns. quickstart.md C5 gives the exact `jq` command. On run
5 it reports 7 of 14 (50%); over all turns, 23 of 39 (59%).

If the TASK-0048 seat fix changes how the seat records a fallback move, the orchestrator adapts
the selector to it. The orchestrator records the selector used on the card.

---

## R6. Decisions recorded

| Decision | Choice | Alternatives rejected |
|---|---|---|
| Where to stop DM-only facts | At the source (seed text, doctrine example) plus a typed player-facing view | A prompt instruction "do not reveal secrets" (unenforceable); sending secrets to `dm.audit` |
| Which `dm.audit` kinds block | `ledger-mismatch`, `invented-mechanics`, `player-agency` (party only); every deterministic check | Keep `doctrine` blocking (R1.4) |
| Model verdict | Code derives pass or fail from the issue kinds; the model's `verdict` is recorded only | Trust the model verdict |
| Clarify handling | Narrate asks an open question; deterministic check requires a closing question | Change interpret's prompt (no evidence interpret is wrong to ask) |
| Transcript naming | Narrate, companion and chronicle only | Also director and interpret (no evidence; would bump interpret) |
| Seed location secret | Drop the clause the seed makes public | Hide Snag's strap (changes the designed clue path) |
| Migration | None. Seeds are JSON files; `jobs.result` is jsonb. | — |
| New dependency | None | — |

---

## R7. Verification run (Phase 5) — causes of the fail

**Evidence**: `evidence/verify-20261026T183818Z-greyhollow-ford-provider/` (composite `fda4abf`,
outcome `stalled`, `seat-exhausted`, 11 moves, $7.18 of a $22 ceiling). The orchestrator's
classification: `classification.md` in that directory. **Verdict: FAIL on card AC #4.**
Fallback rate 12/34 (0.35) excluding seat-fallback turns; `ledger-contradiction` 3;
`hidden-info-leak` 0; `player-agency` 4.

**Operator approval 2026-10-26**: "amend spec 034 with E2 (player-agency blocks only when it
names a party character) and E3 (narrate-v3: a foe's failed attack leaves the hero unchanged and
unmoved)".

### R7.1 E1 — narrate truncated by hidden reasoning (fixed by operator config)

`dm.narrate` had `maxTokens` 500 (code default `PURPOSE_MAX_TOKENS` in
`apps/server/src/dm/purposes.ts`). 17 of 79 narrate calls stopped at exactly 500 output tokens.
9 attempts returned empty prose ("The narration is empty", deterministic). Same mechanism as
033 R10 (interpret).

**Decision**: the operator raised `dm.narrate` `maxTokens` to 1500 in the provider configuration.
No code change. The code default stays 500. The Phase 5b rerun assumes 1500 (quickstart C12).
The estimate's upper bound with 1500 is $23.40.

### R7.2 E2 — `dm.audit` still flags world characters as `player-agency` (selected)

Audit v2 names the party in its prompt. The model still filed world characters' feelings as
`player-agency`. Of 21 blocking `player-agency` issues, 10 name Pell (6) or Snag (4) and 1 names
the companion Odo.

**Decision**: a deterministic filter. A `player-agency` issue blocks only when its detail names
a party member; otherwise it is advisory (contracts/audit-criteria.md, "The party-name
filter"). Companions count as party members, as in narrate v2 and audit v2.

Applied to the run's 21 issues, the filter keeps 13 blocking and makes 8 advisory.

**Residual, pending operator ruling** (not decided here):

- 4 of the 13 name a world character first and a party member only in passing (seq 162, 227,
  254, 266, e.g. "Pell's physical state ... without Tamsin's declared action"). An alternative
  rule — block only when the first character named in the detail is a party member — makes
  these advisory and keeps 9 blocking. It needs world-name matching over `facts.npcNames`. It
  departs from the approved wording, so it is not adopted.
- 3 of the 13 are closing-question complaints filed as `player-agency` (seq 196 attempt 2,
  210 attempt 1, 258 attempt 3: "Final line 'What does Tamsin do?' ..."). Audit v2 statement 3
  already says an open question is correct. The filter cannot tell these apart.

### R7.3 E3 — the narrator wounds or moves the hero on a foe's failed attack (selected)

Examples: "sways on her knees, blood dark along her side" after a failed lunge with no damage
fact (seq 111); "wrenches away before the grip can set" on a failed grab. `dm.audit`
`invented-mechanics` ×14. Playtest auditor F19, F24, F37, F47 (`player-agency`).

**Decision**: narrate v3 rule (contracts/narration-facts.md, "Narrate prompt v3"). On a foe's
miss, failed grab or a party member's successful save, describe only what the foe did; the
party member stays unchanged and unmoved. `dm.audit` keeps v2: statement 2 already names an
unrecorded wound.

### R7.4 E4 — digits in prose (no new fix)

4 deterministic digit fails. The narrate rule exists. They recur inside E1 truncation turns.

### R7.5 Non-narration fails — pending operator ruling

These three `ledger-contradiction` fails count against AC #4. None is decided here. Each needs
an operator ruling before Phase 5b reports a pass or a fail.

| Finding | Rows | What happened | Orchestrator's classification | Status |
|---|---|---|---|---|
| F4 | — | The playtest auditor says "amber light" contradicts a dark interior in the journal. | Playtest-auditor false positive; no ledger fact contradicted. | **Pending operator ruling** |
| F32 | 176 | The chronicle (journal row 176) merged "a pot-helm goblin named Snag". The narration treats them as two creatures. | Chronicle error, judged against the narration. | **Pending operator ruling** |
| F54 | 262–264 | Odo's bargain ended the encounter by morale (262–263). The action then resolved `refused` (264). The fallback said "Brother Odo cannot do that here." | Runtime ordering: an action that ended the encounter is refused after it. The fallback matches the ledger. | **Pending operator ruling** |

### R7.6 Not selected

- `dm.audit` model change (Haiku to Sonnet): the contingency applies only to a fail on the rate
  alone. This run does not fail on the rate alone.
- Attempt budget and word limit: unchanged (spec rulings).
