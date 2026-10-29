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

## Run summary

Not written yet.
