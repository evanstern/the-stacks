import type { EngineState } from "@the-stacks/dnd5e-engine";
import type { SessionProjections } from "../projections/types.js";

/**
 * Turn rules shared by the floor planner and the DM runtime's resolve node (specs/049-turn-floor,
 * research R1, R2, R6). Pure: reads a projection or an engine state, nothing else.
 */

/** The floor reason the AI DM writes when it passes an absent player's turn (spec 071 D6). */
export const ABSENCE_PASS_REASON =
  "The AI DM passes the turn of an absent player.";

/** Conditions that stop a combatant acting; the engine's `INCAPACITATING` list. */
export const INCAPACITATING: readonly string[] = [
  "incapacitated",
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
];

/** One step that settles a combatant who cannot act (specs/046-downed-hero-gate). */
export type SettleStep =
  | { type: "death-save.roll"; targetId: string }
  | { type: "turn.advance" };

/** The turn the engine is on: round and active combatant. */
export interface TurnRef {
  round: number;
  combatantId: string;
}

/** True when the combatant can take its turn. An unknown combatant counts as able. */
export function canAct(engine: EngineState, id: string): boolean {
  const c = engine.combatants[id];
  if (!c) return true;
  return (
    c.lifeState === "conscious" &&
    !c.conditions.some((i) => INCAPACITATING.includes(i.condition as string))
  );
}

/**
 * What settles next when the turn sits on a combatant who cannot act: a dying combatant
 * rolls a death save; a stable, dead or otherwise unable one passes the turn; an able one
 * (or no encounter) needs nothing. The caller owns the lap bound and the rule that a
 * combatant rolls at most once per turn (a save that leaves it down is followed by an advance).
 */
export function nextSettleStep(engine: EngineState): SettleStep | null {
  const enc = engine.encounter;
  if (!enc) return null;
  const active = enc.order[enc.turnIndex]?.combatantId;
  if (active === undefined || canAct(engine, active)) return null;
  const c = engine.combatants[active];
  if (c?.lifeState === "unconscious" && c.zeroHpRule === "death-saves") {
    return { type: "death-save.roll", targetId: active };
  }
  return { type: "turn.advance" };
}

/** The table-mode actor for a combatant's turn (director.md "Active actor rule"). */
export function activeActorFor(
  p: SessionProjections,
  combatantId: string,
): { activeActor: string; activeCharacterId: string | null } {
  const member = p.party.find((m) => m.combatantId === combatantId);
  if (!member) return { activeActor: "ai:dm", activeCharacterId: null };
  return {
    activeActor:
      member.controller.kind === "player"
        ? member.controller.userId
        : member.controller.actor,
    activeCharacterId: member.characterId,
  };
}

/** True when the seated human DM holds the floor: turn mode, the DM named, no character. */
export function floorHeld(p: SessionProjections): boolean {
  const { seat } = p.gate;
  if (p.tableMode.mode !== "turn" || seat.kind !== "human") return false;
  return (
    p.tableMode.activeActor === seat.userId &&
    p.tableMode.activeCharacterId === null
  );
}

/** The engine's current turn, or null when no encounter is active. */
export function currentTurn(p: SessionProjections): TurnRef | null {
  if (!p.encounter) return null;
  return {
    round: p.encounter.round,
    combatantId: p.encounter.activeCombatantId,
  };
}
