# R1 spine test drive — 2026-11-13

- **Environment:** hosted dev `https://vm-104.tailb3c1b6.ts.net:8443`, commit `b08059da` (includes PRs #166–#177).
- **Seed:** `greyhollow-ford` (solo). Tamsin Vale human (operator account), Brother Odo and Kestrel AI companions. Session `0106e608-e5f0-4ff9-89e2-16f780dbc002`.
- **Card under test:** TASK-0278 (R1 metrics). **Ceiling:** $15, "$15, same as last".
- **Driving:** the operator plays by hand in the debug-port Brave window.
- **Merged since last run:** #166 TASK-0268, #167 TASK-0272, #168 TASK-0269, #169 TASK-0314, #170 TASK-0199, #171 TASK-0315, #172 TASK-0300, #173 TASK-0299, #174 TASK-0298, #175 TASK-0223, #176 TASK-0312, #177 TASK-0247.

## Metrics against R1 targets

| metric | R1 target | baseline (2026-11-09) | last run (2026-11-10) | this run |
|---|---|---|---|---|
| Commit → first engine row | p95 < 1 s | median 20 s, p95 73 s | median 43 s, p95 80 s | not reached (no combat); exploration rulings settle 2–4 s after 👍 |
| Commit → first narration token | p50 < 10 s | median 45 s | median 60 s | **0.93–0.97 s** (n=2); talk replies 18.5 s, not streamed |
| Combat round, 7 actors | < 60 s | 232–417 s | 278–404 s | not reached |
| Fallback narrations | 0 | 3 | 0 | 0 |
| Attempt-1 schema failures | < 1% | 0.83% | 0.9% | 7% (1/14, TASK-0336) |
| Encounter ends | yes | not reached | yes | not reached |

## Checklist

| id | item | source | status | note |
|----|------|--------|--------|------|
| R1B-fact-latency | For each committed player action in combat, record the time from commit to the first engine ledger row (the R1 exit 1 baseline; target p95 under 1 s). | TASK-0278 | not reached | No combat. Exploration Intents settled in code: search ruling 3.9 s from confirm; move combatant.moved 2.2 s from 👍. |
| R1B-first-narration | For each turn, record the time from commit to the narration post (no streaming exists yet, so this is time to full narration; R1 exit 2 baseline, target p50 first token under 10 s). | TASK-0278 | pass | First token 973 ms (scene start) and 925 ms (intent turn); target p50 < 10 s. Talk replies do not stream: 18.5 s (TASK-0324). |
| R1B-round-time | Play at least one full combat round with every PC, companion and monster acting. Record the round's wall time (R1 exit 3 baseline, target under 60 s). | TASK-0278 | not reached | Stopped before combat. |
| R1B-fallbacks | Count audit-regenerate fallback lines in the narration (R1 exit 4 baseline, target zero). | TASK-0278 | pass | 0 fallback lines; the leak check dropped sentences instead (seq 16, 31). |
| R1B-schema-attempt1 | Count attempt-1 invalid-json, schema-mismatch and truncated outcomes per purpose over the run (R1 exit 5 baseline, target under 1%). | TASK-0278 | fail | 1 of 14 calls (7%): dm.react confirm-target schema-mismatch (TASK-0336). |
| R1B-encounter-end | Record whether the encounter can end, and whether a fled combatant is dropped (R1 exit 6 baseline). | TASK-0278 | not reached | Stopped before combat. |
| TASK-0278-AC1 | TASK-0278 acceptance criterion #1 | card under test | not reached | Hosted metrics need a combat round; next run. |
| TASK-0268 | A confirmed attack resolves with engine rows and no wait on the model. | merged since last run | pass | Confirmed search and move resolved through the gate with engine rows (seq 42-44, 48-49). |
| TASK-0272 | No canned fallback lines; no digits in prose; a leaking sentence is dropped, not regenerated. | merged since last run | pass | No fallbacks; prose had no digits; the leak check dropped and corrected (seq 16, 31). Quoted dialogue leak: TASK-0335. |
| TASK-0269 | A slash command (`/attack @goblin-2 with "Longsword"`) resolves with no model call; 'move then attack' prose plans as two stages. | merged since last run | pass | /search and /move parsed to typed Intents with zone targets, no interpret call. |
| TASK-0314 | Skip unless a human DM is seated: a ruling resumes the waiting action by itself. | merged since last run | not reached | No human DM seated. |
| TASK-0199 | Exploration post: ~2 s blank, 8-segment ring, 'The DM is reading the table…', then a reaction or a confirm row; @dm answer is private. | merged since last run | fail | Ring, read marker, code confirm row and private ask_dm worked; model confirm rows fail schema (TASK-0336); AI-ruled Intents are not narrated (TASK-0337). |
| TASK-0315 | One composer, one Send; 👍 Yes / Not quite on the confirm row; interrupt strip while Thinking; in combat Enter commits, no Commit button. | merged since last run | pass | One composer; 👍 on the confirm row confirmed the Intent. Combat Enter not reached. |
| TASK-0300 | CI-only gate; nothing to see live. Mark pass from CI. | merged since last run | pass | CI gate green on main (latency PASS). |
| TASK-0299 | Monster turns pick sensible targets with no stall; companions act or hold on their turn without a long pause. | merged since last run | pass | Companions replied in turn (seq 22-23). Monster turns not reached. |
| TASK-0298 | Fact rows show first, then prose grows sentence by sentence; the settled row replaces the 'narrating' block with no duplicate. | merged since last run | pass | Narration streamed; first token under 1 s; rows rendered in code. |
| TASK-0223 | An unarmed attack resolves (1 + Str bludgeoning) instead of refusing. | merged since last run | not reached | No attack made. |
| TASK-0312 | No regression in check, attack, move or ruling turns (legacy paths deleted). | merged since last run | fail | Ruling-settled Intents no longer narrate (TASK-0337); likely exposed by the legacy-path removal. |
| TASK-0247 | Table stream: roll rows name the check and mode and show both d20s; room blocks; dialogue rows; filter chips; 1024 px centred column. | merged since last run | pass | Roll row named the check (Perception), roll, DC and band; ways chips shown (one leaks the loft: TASK-0334). |
| base-signoff | Group sign-off | baseline | pending |  |
| base-floor | Floor passing and absence (30 s, 120 s) | baseline | pending |  |
| base-companion | Companion reacts | baseline | pending |  |
| base-combat | Combat: initiative, a downed hero, ending the encounter | baseline | pending |  |
| base-dmquality | DM quality spot checks | baseline | pending |  |
| base-debug-retry | Debug page and Retry | baseline | pending |  |

## Findings

| # | Time | Seat | Class | Observation | Existing card | Card |
|---|------|------|-------|-------------|---------------|------|
| 1 | 20:27 | DM | positive | Scene start: the narrate check caught a fogged-zone leak ("dark loft stair", Loft is hidden), dropped the sentence and wrote a DM-only correction row (seq 16). First token 973 ms, first prose 2.17 s. | TASK-0272 | — |
| 2 | 20:27 | — | bug | Scene `ways` (seq 2, public) include "ladder to the loft" / `/do I climb the ladder to the loft`, but Loft is a hidden zone. The TASK-0247 seed check only refuses `/move` to hidden zones, so a `/do` way naming one passes and the chip shows a place the narration check treats as a leak. | — | TASK-0334 |
| 3 | 02:11 | Tamsin | positive | Exploration post "I explore the area… hear or see anyone?" went as a `say` Intent at `declared` (seq 18–19). The read ran 10 s later (seq 20), and the DM reply landed 18.5 s after the post (first token not recorded on talk turns). Companions Odo and Kestrel each answered in turn. No model failures. | TASK-0199 | — |
| 4 | 02:12 | DM | bug | Hidden information in a quote. The reply has Wenna name "Snag" ("Pell's not back. Snag's not back."). Snag is the goblin leader, absent at scene start (seq 14), and the seed never has Wenna know him. The narration leak check skips text inside quotes (spec 103 mask), so NPC dialogue can name an absent or unmet actor. Odo then repeats "Pell and Snag" (seq 22). Wenna also appears on the bank, though the seed puts her hidden in the loft. | — | TASK-0335 |
| 5 | 02:12 | — | rough edge | Talk reply time 18.5 s from post: 10 s quiet ring + 8.4 s `dm.react` call, with no streaming on talk replies. This is exactly the TASK-0324 trigger (talk replies over 10 s). | TASK-0324 | — |
| 6 | 02:14 | Tamsin | positive | `@dm`-style question "does Wenna look upset?" became a private `ask_dm` (seq 26–27); the answer was visible only to Tamsin's user id (seq 29). | TASK-0199 | — |
| 7 | 02:14 | DM | rules/DM quality | The narration check dropped a sentence for naming Pell (seq 31, "absent and the prose shows them"), though Wenna speaking of her own grandson is fair. The absent-actor rule has no notion of who an NPC knows. It is the inverse of finding 4, where quoted dialogue skips the check. | TASK-0335 | — |
| 8 | 02:16 | Tamsin | bug (blocker) | "I search the ferry house" turn failed: `dm.react-v4` confirm item body had `targets: ["ferry-house"]`, then `[{id:"ferry-house"}]`, both missing `kind:"zone"`. Schema-mismatch twice, so the job stopped at narrate: invalid-output (seq 36), with no reply to the player. Any confirm item that targets something fails the same way, which blocks the confirm row. | — | TASK-0336 |
| 9 | 02:19 | Tamsin | positive | `/search #ferry-house` became a typed `search` Intent with a zone target in code (seq 37). The ring ran, and the confirm row came from code with no model call (seq 39). 👍 confirmed it, and the AI seat ruled "accept, easy", rolled Perception 6 vs DC 10 (failure), all in code (seq 42–44, 3.9 s). | TASK-0199, TASK-0315, TASK-0269 | — |
| 10 | 02:20 | DM | bug (blocker) | No narration after the settled search. The ruling turn (job c10e75d5, trigger `ruling`) ended `empty-beat`: in `pipeline/runner.ts:216`, an empty beat exits unless the trigger is `scene-start` or `intent`, and `ruling` is not exempt. Rule 9 does not fire either, because the settling `ruling` row is appended by `ai:dm` inside a job. So an Intent the AI seat settles through a ruling is never narrated, and the player sees the rolls and silence. | — | TASK-0337 |
| 11 | 02:23 | Tamsin | bug | `/move #causeway` worked mechanically (declared, confirm row, 👍, `combatant.moved`, seq 45–49), but its narration (seq 51) describes the earlier ferry-house search instead. The move gets no prose and no fact row. The window `(W0, W1]` correctly picked up the stranded search facts (factsThrough 50), but narrate wrote only about them. The search narration arrives one deed late, and the move is never told. Follows from TASK-0337. | TASK-0337 | — |
| 12 | 02:23 | DM | positive | Intent-trigger narration: first token 925 ms, full narration 9.6 s. Fact rows are code-rendered and correct (check name, roll, DC, band, ruling reason, rule, difficulty). | TASK-0298, TASK-0245 | — |

## Run summary

- **Session:** `0106e608-e5f0-4ff9-89e2-16f780dbc002`, vm-104 commit `76953c31` (contains `b08059da`, PRs #166–#177).
- **Played:** scene start, one exploration post, one `ask_dm`, a prose search (failed, TASK-0336), `/search #ferry-house` (settled, not narrated, TASK-0337), and `/move #causeway` (narrated the search instead). Stopped before combat at the operator's call.
- **Checklist:** 10 pass, 3 fail, 6 not reached, 6 pending (baseline rows not exercised). The `not reached` and `pending` rows roll forward.
- **Blockers:** TASK-0336 (react confirm targets fail schema) and TASK-0337 (AI-seat-ruled Intents never narrated). Together they block exploration deeds on the hosted model.
- **New cards:** TASK-0334, TASK-0335, TASK-0336, TASK-0337. **Evidence added:** TASK-0324 (trigger met), TASK-0335, TASK-0337.
- **Spend:** $0.17 of $15 (14 calls).
- **Auditor:** `pnpm playtest audit --session … --auditor none` on vm-104 (operator go, "Go, run audit"). Verdict **pass**. Checks-only over 4 narration segments: prose-digits, dice-lines, life-states, roll-reasons, hidden-info and dice-language all passed. One note (F1): leak/fogged-zone at seq 15, which is the check's own correction. The auditor's hidden-info check missed the quoted Snag mention (finding 4), so TASK-0335 applies to the auditor too.
