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
  /** Next fallback entry to try (cycles). */
  fallbackIndex: number;
  /** Text of the last fallback move sent; never repeated back to back. */
  lastFallbackText: string | null;
  /** Consecutive fallback moves whose turns changed no state. */
  stallStreak: number;
}

export type DriverMove = ScenarioMove & {
  actionId: string;
  /** True when the move came from `moves.fallback`. */
  fallback?: true;
  /** Index into `moves.fallback` the move used; the caller sets the cursor to the next one. */
  fallbackIndex?: number;
};

/** Consecutive no-change fallback moves after which the seat gives up. */
export const STALL_LIMIT = 3;

/** The `stallReason` recorded when the seat gives up. */
export const STALL_REASON_SEAT_EXHAUSTED = "seat-exhausted";

/** The `stallReason` recorded when the seat's character is down and the fight is over. */
export const STALL_REASON_SEAT_DOWNED = "seat-downed";

/**
 * True when the seat's character is at 0 HP or not conscious. A seat whose
 * party member has no combatant (no encounter yet) is not downed
 * (specs/046-downed-hero-gate plan D6).
 */
export function seatDowned(p: SessionProjections, scenario: Scenario): boolean {
  const member = p.party?.find(
    (m) => m.characterId === scenario.seat.characterId,
  );
  const c = member?.combatant;
  if (!c) return false;
  return c.hp.current === 0 || c.lifeState !== "conscious";
}

export function initialDriverState(): DriverState {
  return {
    freeIndex: 0,
    moves: 0,
    combatMoves: 0,
    started: false,
    fallbackIndex: 0,
    lastFallbackText: null,
    stallStreak: 0,
  };
}

/**
 * Whether a move's turn changed state. The signal is the ledger: every
 * `change` row is a state change (engine state-change events such as hp,
 * tracker, encounter and condition changes, plus session-native scene, party
 * and table-mode changes). Rolls and outcomes are markers and do not count.
 * A table-mode row counts only when the mode itself changed (free <-> turn),
 * not when only the active actor moved; seat and gate-policy rows are config,
 * not scene state.
 */
export function turnChangedState(
  ledger: SessionProjections["ledger"],
  afterSeq: number,
): boolean {
  return ledger.some((row) => {
    if (row.kind !== "change" || row.seq <= afterSeq) return false;
    if (row.type === "dm.seat.changed" || row.type === "gate.policy.changed")
      return false;
    if (row.type === "table-mode.changed") {
      const b = row.before as { mode?: string } | null;
      const a = row.after as { mode?: string } | null;
      return b?.mode !== a?.mode;
    }
    return true;
  });
}

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
  // 2b. The seat has stalled: repeated fallback moves changed nothing.
  if (state.stallStreak >= STALL_LIMIT) return "done";
  // 3. A human-seat action is still in flight.
  const inFlight = p.actions.some(
    (a) =>
      a.characterId === scenario.seat.characterId && a.status !== "resolved",
  );
  if (inFlight) return "wait";

  // 3b. The seat's character is down: never declare for it. Settling plays
  // its death saves; in free mode no move is left to make.
  if (seatDowned(p, scenario)) {
    return p.tableMode.mode === "turn" ? "wait" : "done";
  }

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
  if (free) {
    return {
      text: free.text,
      actionId: free.actionId ?? generated,
      // OQ-4 ruling (a), 2026-11-14: `intent` passes through so slash deeds run as direct Intents.
      ...(free.intent ? { intent: true as const } : {}),
      ...(free.confirm ? { confirm: true as const } : {}),
    };
  }
  const list = scenario.moves.fallback;
  let i = state.fallbackIndex % list.length;
  if (list.length > 1 && list[i].text === state.lastFallbackText)
    i = (i + 1) % list.length;
  return {
    text: list[i].text,
    actionId: generated,
    fallback: true,
    fallbackIndex: i,
  };
}
