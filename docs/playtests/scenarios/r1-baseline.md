<!-- R1 baseline scenario (pre-R1). Rows use the checklist.mjs table format. -->
<!-- Seed: greyhollow-ford-reed-camp. One human plus AI companions. No script (paid models). -->

| id | item | source | status | note |
|----|------|--------|--------|------|
| R1B-fact-latency | For each committed player action in combat, record the time from commit to the first engine ledger row (the R1 exit 1 baseline; target p95 under 1 s). | TASK-0278 | pending | |
| R1B-first-narration | For each turn, record the time from commit to the narration post (no streaming exists yet, so this is time to full narration; R1 exit 2 baseline, target p50 first token under 10 s). | TASK-0278 | pending | |
| R1B-round-time | Play at least one full combat round with every PC, companion and monster acting. Record the round's wall time (R1 exit 3 baseline, target under 60 s). | TASK-0278 | pending | |
| R1B-fallbacks | Count audit-regenerate fallback lines in the narration (R1 exit 4 baseline, target zero). | TASK-0278 | pending | |
| R1B-schema-attempt1 | Count attempt-1 invalid-json, schema-mismatch and truncated outcomes per purpose over the run (R1 exit 5 baseline, target under 1%). | TASK-0278 | pending | |
| R1B-encounter-end | Record whether the encounter can end, and whether a fled combatant is dropped (R1 exit 6 baseline). | TASK-0278 | pending | |
