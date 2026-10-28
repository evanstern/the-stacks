import type { InterpretReading } from "../../src/dm/nodes/schemas.js";
import { loadLog, M2_LOG, snapshotAt } from "./claim-fixtures.js";
import { reading } from "./world.js";

/**
 * Evidence fixtures for the plan gate reason check (spec 058). The recorded
 * M2 seq 221 reason is read from the log, never hand-typed.
 */

/** S0 for the M2 seq 221 step: the state at seq 220. */
export const M2_SEQ221_S0 = snapshotAt(M2_LOG, 220);

/** The `dice.rolled` row's reason with the ` [<jobId>#<n>]` marker removed. */
export const M2_SEQ221_REASON: string = (() => {
  const row = loadLog(M2_LOG).find(
    (e) => e.seq === 221 && e.type === "dice.rolled",
  );
  if (!row) throw new Error("no dice.rolled row at seq 221");
  const event = (row.payload as { event: { reason: string } }).event;
  return event.reason.replace(/ \[[^\]]+#\d+\]$/, "");
})();

/** The recorded reason without the clause that contradicts state. */
export const M2_SEQ221_CONTROL: string = M2_SEQ221_REASON.replace(
  ", shouting that two kin have fallen",
  "",
);

/** The goblin-2 NPC reading of M2 seq 221 carrying `reason`. */
export function m2Seq221Reading(reason: string): InterpretReading {
  return reading(
    null,
    [
      {
        step: "attack",
        reason,
        attackerId: "goblin-2",
        targetId: "tamsin",
        expression: "1d20+4",
        mode: "normal",
        targetAc: null,
        onHit: [
          {
            effect: "damage",
            targetId: "tamsin",
            components: [
              {
                amount: { kind: "roll", expression: "1d6+2" },
                damageType: "slashing",
              },
            ],
            defenses: null,
          },
        ],
      },
    ],
    { intent: "attack" },
  ) as unknown as InterpretReading;
}
