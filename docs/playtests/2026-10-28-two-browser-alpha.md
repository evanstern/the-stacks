# Two-browser alpha playtest — 2026-10-28

- **Environment:** hosted dev, `https://vm-104.tailb3c1b6.ts.net:8443` (deploys `main`).
- **Seed:** `greyhollow-ford-duo`. Tamsin and Kestrel are human seats; Brother Odo is an AI companion.
- **Setup:** the operator plays both seats from two Brave windows (one normal, one private).
- **Card under test:** TASK-0163, acceptance criterion #4.
- **Log home:** the shared side-session notes folder. The root guard blocks `docs/` in the root checkout, and the reboot wiped the first copy, which was in the scratchpad. This copy was rebuilt from the conversation. Move it to `docs/playtests/` on a branch later; TASK-0169 and TASK-0171 to TASK-0173 already reference that path.

Classes: bug, rough edge, missing feature, rules/DM quality, positive.

## Run 1 (lost to a system reboot; session id not recorded)

| # | Time | Seat | Class | Observation | Existing card | Card |
|---|------|------|-------|-------------|---------------|------|
| 1 | beat 1 | Tamsin (Kestrel helps) | rough edge | The roll line comes after the narration, so you can't tell whether the prose is that roll's result. | TASK-0133 (styling), TASK-0132 | TASK-0133 widened: the roll line renders before the prose |
| 2 | beat 1 | Tamsin | rules/DM quality | A success on "what made these claw marks" only described the marks in more detail and never named a creature. A success should make the attempted task happen. | Partly TASK-0127, TASK-0148/0151 | TASK-0170 (new, high, depends on TASK-0127) |
| 3 | beat 1 | Tamsin | rules/DM quality + rough edge | `1d20+3 … vs DC 12` doesn't name the check. Kestrel's Help didn't give advantage. The modifier was written by the model. | TASK-0128 (Help), TASK-0104 (modifier) | TASK-0169 (new): roll lines name the ability, skill and roll mode |
| 4 | scene start | both | missing feature / DM quality | The opening reads like the middle of a campaign. It doesn't introduce the PCs, the place, or why the party is there. | None | TASK-0171 (new, high) |
| 5 | throughout | both | missing feature | No party list, so the operator didn't know Brother Odo was AI-controlled until he spoke. Wants controller, class, level, HP, initiative and the active turn. | TASK-0164 (a maybe whose trigger fired) | TASK-0164 promoted (medium, m-3) and widened into a party slide-out |
| 6 | beat 1 | both | DM quality | Wenna (present from the first beat) appears mid-narration without ever being introduced. The operator suspected a bug. | None | Folded into TASK-0171 |
| 7 | — | — | feature idea | Each actor tracks what it knows and who it has met. Narration and outcomes read it. NPCs learn from the party too. | Part of it: TASK-0148 | TASK-0172 (ledger, high, depends on TASK-0148); TASK-0173 (NPC learning, medium, depends on TASK-0172) |
| 8 | after reboot | operator | missing feature | Couldn't find the table again after the reboot. `/play` offers only "start fresh" or "paste a link", with no list of your tables. | None found | TASK-0175 (new, medium) |

Side finding on item 3: Tamsin has INT +0 and no Investigation proficiency. Her +3 matches Survival or Perception, so the DM may have chosen Wisdom (Survival), which fits reading tracks, without saying so. That's more evidence for TASK-0169 and TASK-0104.

Note: TASK-0161 (checking roll reasons before the roll) and TASK-0168 (resuming after a human DM roll) merged during run 1 and are deployed for run 2.

## Run 2

Checklist given to the operator: A runbook path (invite, redeem, Start scene, both windows) · B group sign-off · C floor passing and absence (30 s, 120 s) · D companion react · E combat (initiative, a downed hero, ending the encounter) · F DM quality spot checks · G Debug and Retry.

| # | Time | Seat | Class | Observation | Existing card | Card |
|---|------|------|-------|-------------|---------------|------|
| 1 | beats 1–2 | both + Odo | missing feature / DM quality | In-character talk gets no reaction. Odo asked Wenna "who's missing from this house?", and Tamsin said a line in character. No NPC answered and nothing happened in the scene. Wanted: every in-character post is read for triggers (a character addressed or mentioned, something loud or overheard, others), and the DM decides the reaction. A reaction can trigger further reactions, but AI-only back-and-forth stays capped so PCs drive, and a reaction that turns into combat or fast action moves the table into turn mode. Cause: decision-0016 (D8) says talk "never triggers a DM turn". It allows a narrator chime-in when mentioned, but no code builds one. | Nearby, none covering it: TASK-0172/0173 (knowledge), TASK-0149 (attitude), TASK-0152 (NPC doctrine), TASK-0144 (companion `say` gate) | TASK-0180 (new, high, m-3; design, amends D8) |
| 2 | 00:40–00:42 | both | bug + rough edge | A DM turn took about 2 min 15 s with no sign of work, and the operator thought it had crashed. Debug showed it was a failed turn (item 3) that the reconcile turn re-ran. Players saw neither the failure nor the retry. | TASK-0132 (progress indicator; the M2 demo saw 30–60 s) | Evidence added to TASK-0132: cover running, failed and retrying |
| 3 | 00:40:09 | — (Debug) | bug | Turn bb36c8a9 failed: "model output failed its schema twice (dm.interpret)". Each reply started with `<think></think>`, and attempt 1 was nothing else (1,200 tokens, 15 s). `stripFence` in `apps/server/src/dm/pipeline/call.ts` removes only code fences. Most turns this run hit the same pattern on the director or interpret step, then succeeded on retry: 30–42 s and $0.13–0.16 per turn, against 10–21 s and $0.04–0.08 for clean turns. Suspected source: the 9router switch (`cc/` model IDs). | None (TASK-0102 is related, done) | TASK-0181 (new, high, m-3) |
| 4 | 00:50 | Tamsin (posted as Kestrel) | rules/DM quality | A compound declaration (plan: diplomacy, then force; approach: Tamsin walks openly to the goblin camp, Kestrel and Odo follow hidden; contingency: attack on her signal) resolved as one beat. The Director advanced the alarm and dusk trackers, switched to turn mode and opened the reed-camp encounter before the party arrived. Interpret assumed Tamsin had already been hailed. The stealth approach never resolved as a step that could fail. Wanted: the approach is one beat, the DM narrates the arrival, and only then does the next phase start. | Partly TASK-0085, TASK-0120 | TASK-0182 (new, high, m-3) |
| 5 | 00:50–00:53 | — (Debug) | bug | Both turns for item 4 failed at interpret, and the table stalled with "The DM runtime stopped at interpret: invalid-output." Three of four attempts returned only `<think></think>` and used exactly 1,200 output tokens each: hidden thinking appears to use up the whole output budget. | TASK-0181 | Evidence added to TASK-0181 |
| 6 | 00:50 | operator | rough edge (user error) | The operator posted Tamsin's speech from Kestrel's window, then approved it as Kestrel. The DM read it as Tamsin's anyway. Only the header's "by Kestrel" and the composer's character dropdown show who is posting. | None | Not carded: one slip, two-window solo play. Revisit if a real two-player table repeats it. |
| 7 | 00:59 | — (Debug) | bug, showstopper | The fourth turn for item 4 failed at the director step. Attempt 1 was `<think></think>` followed by valid JSON, so stripping the prefix alone would have saved it. Attempt 2 was clean JSON but left out `companionPrompts`. The operator ended the run here. | TASK-0181 | TASK-0181 labeled `blocker`; operator ruling recorded |

## Run summary

Run 2, 2026-10-29 (about 00:23–01:00 UTC), session `166b8e59-fad9-4931-82b8-8a8700ed784f`, hosted dev at `af74f7cb`. The operator ended the run on a showstopper.

- **Checklist:** A passed: invite, redeem, Start scene and both windows worked, and the scene opened in 10 s. F was spot-checked (items 1 and 4). B, C, D, E and G were not reached. D was seen in passing: Brother Odo answered after each beat. G was partly exercised: Retry ran four times with no success.
- **Blocker:** TASK-0181. DM model calls on hosted dev return a `<think></think>` prefix, which the JSON parse rejects. Most turns paid one failed attempt (30–42 s, about $0.13–0.16 per turn against 10–21 s and $0.04–0.08 clean). A long compound action then failed four turns in a row and stalled the table.
- **New cards:** TASK-0180 (design: in-character talk triggers DM reactions, amends D8), TASK-0181 (the `<think>` prefix, blocker), TASK-0182 (Director splits a compound action into sequential beats). All are high priority, in m-3.
- **Evidence added:** TASK-0132 (no progress or failure indicator; about 2 min 15 s of silence on one turn).
- **Not carded:** item 6, an operator posting slip.
- **TASK-0163 AC #4:** not met by run 2. Run 3 needs TASK-0181 deployed to vm-104 first, then the checklist from B.
