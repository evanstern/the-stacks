import {
  type EngineEvent,
  evolve,
  execute,
  type Rng,
} from "@the-stacks/dnd5e-engine";
import type { SessionProjections } from "../projections/types.js";
import { actorOf, type Proposer } from "./proposals.js";
import {
  mechanicsRows,
  type PlanIds,
  type PlannedRow,
  type PlanResult,
} from "./rows.js";
import { activeActorFor, canAct, nextSettleStep } from "./turn.js";

/** The `floor` presence marker row: who was present when the AI DM passed an absent human. */
function floorMarker(present: readonly string[]): PlannedRow {
  return {
    actor: "system",
    type: "presence.recorded",
    visibility: "public",
    payload: { present: [...new Set(present)].sort(), purpose: "floor" },
  };
}

/**
 * The shared `end` body of a floor request and an `end_turn` Intent (specs/049-turn-floor R3 to
 * R5; spec 102 FR-020): `turn.advance`, the settling rule on an evolving engine state, then
 * the `table-mode.changed` row naming the next holder. The caller runs its own checks first.
 */
export function endTurnRows(
  p: SessionProjections,
  proposer: Proposer,
  reason: string,
  rng: Rng,
  ids: PlanIds,
  proposalId: string | null,
  /** The present set for an AI DM pass; `undefined` writes no marker. */
  marker: readonly string[] | undefined,
): PlanResult {
  const actor = actorOf(proposer);
  let state = p.engine;
  const events: EngineEvent[] = [];
  const step = (command: unknown): PlanResult | null => {
    const result = execute(state, command, rng);
    if (!result.ok) {
      const { code, message, details } = result.refusal;
      return {
        ok: false,
        refusal: {
          source: "engine",
          code,
          message,
          ...(details ? { details } : {}),
        },
      };
    }
    for (const event of result.events) state = evolve(state, event);
    events.push(...result.events);
    return null;
  };
  const activeOf = (): string =>
    state.encounter?.order[state.encounter.turnIndex]?.combatantId ?? "";

  const advanced = step({ type: "turn.advance", reason });
  if (advanced) return advanced;
  const lap = state.encounter?.order.length ?? 0;
  for (let n = 0; n < lap; n++) {
    const next = nextSettleStep(state);
    if (!next) break;
    if (next.type === "death-save.roll") {
      const rolled = step({
        type: "death-save.roll",
        targetId: next.targetId,
        mode: "normal",
        reason: "Death saving throw at the start of the turn",
      });
      if (rolled) return rolled;
      if (canAct(state, next.targetId)) break;
    }
    const passed = step({
      type: "turn.advance",
      reason: "The turn passes a downed combatant",
    });
    if (passed) return passed;
  }

  const rows: PlannedRow[] = [
    ...(marker !== undefined ? [floorMarker(marker)] : []),
    ...mechanicsRows({
      actor,
      batchId: ids.batchId,
      events,
      actionId: null,
      proposalId,
      visibility: "public",
    }),
    {
      actor,
      type: "table-mode.changed",
      visibility: "public",
      payload: {
        reason,
        before: p.tableMode,
        after: { mode: "turn", ...activeActorFor(p, activeOf()) },
      },
    },
  ];
  return { ok: true, rows, batchId: ids.batchId };
}
