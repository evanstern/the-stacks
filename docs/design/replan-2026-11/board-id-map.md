# Board id map

Applied by the replan-2026-11 board rework (CP-3 mechanics). Source: [board-rework-map.md](board-rework-map.md).

## Epics

| Epic | Task |
|---|---|
| EP-1 | TASK-0258 |
| EP-2 | TASK-0259 |
| EP-3 | TASK-0260 |
| EP-4 | TASK-0261 |
| EP-5 | TASK-0262 |
| EP-6 | TASK-0263 |
| EP-7 | TASK-0264 |
| EP-8 | TASK-0265 |

## New cards

| N | Task |
|---|---|
| N-01 | TASK-0266 |
| N-02 | TASK-0267 |
| N-03 | TASK-0268 |
| N-04 | TASK-0269 |
| N-05 | TASK-0270 |
| N-06 | TASK-0271 |
| N-07 | TASK-0272 |
| N-08 | TASK-0273 |
| N-09 | TASK-0274 |
| N-10 | TASK-0275 |
| N-11 | TASK-0276 |
| N-12 | TASK-0277 |
| N-13 | TASK-0278 |
| N-14 | TASK-0279 |
| N-15 | TASK-0280 |
| N-16 | TASK-0281 |
| N-17 | TASK-0282 |
| N-18 | TASK-0283 |
| N-19 | TASK-0284 |
| N-20 | TASK-0285 |
| N-21 | TASK-0286 |
| N-22 | TASK-0287 |
| N-23 | TASK-0288 |
| N-24 | TASK-0289 |
| N-25 | TASK-0290 |
| N-26 | TASK-0291 |
| N-27 | TASK-0292 |
| N-28 | TASK-0293 |
| N-29 | TASK-0294 |
| N-30 | TASK-0295 |
| N-31 | TASK-0296 |
| N-32 | TASK-0297 |

## Actions applied

| Action | Count |
|---|---|
| close-stale | 2 |
| defer | 14 |
| keep | 48 |
| rewrite | 20 |
| close-superseded | 19 |
| re-home | 3 |
| merge | 29 |
| **Total** | 135 |

## Notes and deviations

- Milestones: r-1..r-8 and `later` are CLI ids m-10..m-18 (R1 Fast Table = m-10 ... R8 Release 1.0 = m-17, Later = m-18). Old m-1, m-3..m-9 were archived with the CLI.
- The CLI `-p` flag creates dotted subtask ids, which conflict with one-task-one-PR. The first batch (TASK-0258.xx) was archived; N-cards were recreated as top-level cards. Parent epic is recorded by label `ep-N` and a description line, not by parent field.
- Archived stray first-batch subtasks: 32 (TASK-0258.01 .. TASK-0265.01); they are not in the map.
- Merge, close and defer notes name real TASK ids. Defer and rewrite cards are labelled; rewrite cards keep the prior description below the new header, and acceptance criteria were not rewritten (P-16 defers R3-R8 criteria to milestone planning; R1/R2 rewrite cards need AC authoring at planning).
- TASK-0186 and TASK-0203 statuses are unchanged (In Progress). TASK-0203 is merged into N-08 and archived per the map. Nothing set to Done.
- Dependencies from CP-n are recorded in the description, not as task deps.
