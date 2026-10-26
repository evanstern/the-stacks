import type { SessionProjections } from "@the-stacks/session-model";
import type { Scenario, ScenarioMove } from "./scenario.js";

export interface DriverState {
  /** Next unused entry of `moves.free`. */
  freeIndex: number;
  /** Moves committed so far. */
  moves: number;
  /** Combat moves committed so far (the first uses `firstActionId`). */
  combatMoves: number;
  /** True once the scene-start turn has produced a scene. */
  started: boolean;
}

export type DriverMove = ScenarioMove & { actionId: string };

/**
 * Chooses the human seat's next move (contracts/scenario.md "Driver"). Pure.
 * The caller advances `state` after it commits the returned move.
 */
export function nextMove(
  p: SessionProjections,
  scenario: Scenario,
  state: DriverState,
): DriverMove | "wait" | "done" {
  // 1. The scene had started and is gone.
  if (state.started && p.scene === null) return "done";
  // 2. Move cap.
  if (state.moves >= scenario.limits.maxMoves) return "done";
  // 3. A human-seat action is still in flight.
  const inFlight = p.actions.some(
    (a) =>
      a.characterId === scenario.seat.characterId && a.status !== "resolved",
  );
  if (inFlight) return "wait";

  const generated = `pt-${state.moves + 1}`;
  if (p.tableMode.mode === "turn") {
    if (p.tableMode.activeCharacterId !== scenario.seat.characterId)
      return "wait";
    const id =
      state.combatMoves === 0
        ? (scenario.moves.combat.firstActionId ?? generated)
        : generated;
    return { text: scenario.moves.combat.text, actionId: id };
  }

  const free = scenario.moves.free[state.freeIndex];
  if (free) return { text: free.text, actionId: free.actionId ?? generated };
  return { text: scenario.moves.fallback.text, actionId: generated };
}
