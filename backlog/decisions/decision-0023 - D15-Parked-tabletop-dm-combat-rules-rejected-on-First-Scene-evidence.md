---
id: decision-0023
title: D15 Parked tabletop-dm combat rules rejected on First Scene evidence
date: '2026-10-27 03:31'
status: accepted
---
## Context

Decision-0021 adopted ideas from tabletop-dm and parked two combat rules: the Grit save house
rule, and fight budgeting with downed-target tables. The operator was unsure of both.
Decision-0020 required a revisit card with a concrete trigger. That card is TASK-0055. Its
trigger is TASK-0048: the First Scene playtests show whether fights run too lethal, too long
or too flat.

Evidence: `docs/design/m2-demo.md` ("Fight statistics") and
`docs/design/m2-demo/demo-session/report.md`.

- Demo fight: 5 rounds. 12 player turns and 14 NPC turns.
- Attack rolls: 4 by players, 5 by NPCs. Hits: 2 and 3.
- Damage: 15 dealt and 15 taken by each side.
- No hero reached 0 HP. 0 death-save rolls. The fight ended by flight.
- Run 5: 1 round. It ended by bargain.

Evidence defect: the report says "Reduced to zero: none". The transcript records goblin-3 going
from 7 to 0 HP. TASK-0134 fixes the statistic. Sample size: one real fight.

## Decision

1. Reject the Grit save house rule.
2. Reject fight budgeting and the downed-target table.

Neither rule had anything to act on. No hero went down, and no death save was rolled. The
evidence shows no lethality, length or flatness problem that either rule would fix.

TASK-0122 (research branch 5, running combat) is the single re-entry path for these rules
and for any combat-pacing rule. It evaluates them against the TASK-0048 and TASK-0053 fight
statistics, after TASK-0134 corrects the statistics.

Operator ruling 2026-10-26, option A: "1. A".

## Consequences

- TASK-0055 acceptance criterion #4 (cards for adopted rules) is met vacuously. No rule is
  adopted, so no card is owed.
- TASK-0122 carries the re-entry trigger. No separate revisit card is needed.
- Decision-0021's parked list is closed.
- A future combat-pacing rule needs fresh fight evidence and enters through TASK-0122.
