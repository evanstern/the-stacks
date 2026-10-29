# M3 sweep — Lane-0 decisions brief (2026-10-26, m3-sweep session)

Status: awaiting operator ruling. After the ruling, the runbook `docs/design/m3-table-sweep-runbook.md` records both as gate lines.

## Decision 1 — TASK-0055 (Grit save; fight budgeting + downed-target table)

Evidence (`docs/design/m2-demo.md` "Fight statistics"; `m2-demo/demo-session/report.md`):
- Demo fight: 5 rounds, 26 turns, 9 attack rolls, 5 hits, 15 damage each side. No hero reached 0 HP. 0 death saves. Ended by flight.
- Run 5: 1 round, 0 player attacks, ended by bargain.
- Defect in the evidence: the harness reports "Reduced to zero: none", but the transcript shows `goblin-3 takes 7 (7→0 HP)`. The stat undercounts NPC drops. Card it (new card, m-3).

Reading: fights were not too lethal (no downs), not too long (5 rounds), and ended by morale/flight, not attrition. Neither parked rule had anything to act on. Sample size is one real fight.

Options:
- **A (recommended):** Reject both now, by one decision record (D15) citing the evidence. Name TASK-0122 (research branch 5, running combat) as the single re-entry path for any combat-pacing rule; add its trigger to that card's notes. TASK-0055 closes by its own small docs PR. Card the harness stat bug.
- B: Defer — re-evaluate after the M3 demo produces three-human fight data. Revisit card with that trigger.
- C: Fold TASK-0055 into TASK-0122 (one research-led evaluation); drop 0055 by decision record.

## Decision 2 — debug-view cards vs multiplayer cards

Facts: `docs/design/debug-view.md` says "M3 — first in line". Debug view polls HTTP (D3) and does not touch the socket; multiplayer cards (0049–0052) touch the gate, ws registry and play route. TASK-0114 (companion stall, high) and TASK-0132 (progress indicator) overlap the same operator pain.

Options:
- **A (recommended):** Debug view first, in parallel with multiplayer contract work. Lane 1: TASK-0116 (server) ‖ TASK-0114 ‖ TASK-0051 decision record (presence frames, contract only). Lane 2: TASK-0117 + TASK-0118 + TASK-0132 (web, play route) ‖ TASK-0051 implementation. Lanes 3+: 0049, 0050, 0052, then 0053 demo last. Why: multi-human playtests are harder to diagnose than solo ones; the M2 demo needed SQL to diagnose stalls.
- B: Multiplayer first; debug view as a tail lane.
- C: Fully interleaved by file footprint, no priority between the two.

## Scope notes (no ruling needed unless you object)
- The m-3 board also holds TASK-0119–0123 and TASK-0127–0130 (from the DM-practice research, PR #53). They join the sweep.
- TASK-0129 is a design round (`pdlc:design-rounds`), not sweepable; it runs alongside with you. TASK-0131 waits on its decision record.
