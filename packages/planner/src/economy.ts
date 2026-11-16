// Spec 117 "Cost table" and the active-spender rule (plan D7).
import { SPELLS } from "@the-stacks/dnd5e-engine";
import type { Intent, IntentKind } from "@the-stacks/intent";
import { actorIdOf, type Ctx } from "./refs.js";

export type ActionCost = "action" | "bonus-action";

// ponytail: Utilize is an action; add a cost when a ruling plans commands for attempt or use_object.
const ACTION_KINDS = new Set<IntentKind>([
  "attack",
  "check",
  "contest",
  "dash",
  "disengage",
  "dodge",
  "grapple",
  "help",
  "hide",
  "search",
  "shove",
]);

export function actionCostOf(intent: Intent): ActionCost | null {
  if (intent.kind === "cast") {
    const spell = (intent.params as { spell?: string }).spell;
    return (spell && SPELLS[spell]?.castingTime) || "action";
  }
  return ACTION_KINDS.has(intent.kind) ? "action" : null;
}

/** The actor's combatantId when it is the active combatant of a live encounter, else null. */
export function activeSpender(c: Ctx): string | null {
  const id = actorIdOf(c.intent);
  if (id === null) return null;
  const combatantId = c.state.actors[id]?.combatantId;
  const enc = c.state.engine.encounter;
  if (!combatantId || !enc) return null;
  return enc.order[enc.turnIndex]?.combatantId === combatantId
    ? combatantId
    : null;
}
