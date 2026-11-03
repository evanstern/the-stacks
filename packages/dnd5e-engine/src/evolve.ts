import type { EngineEvent } from "./schema/events.js";
import {
  type Combatant,
  ENGINE_SCHEMA_VERSION,
  type EngineState,
} from "./schema/state.js";

export function emptyState(): EngineState {
  return { v: ENGINE_SCHEMA_VERSION, combatants: {}, encounter: null };
}

function update(
  state: EngineState,
  id: string,
  fn: (c: Combatant) => Combatant,
): EngineState {
  const current = state.combatants[id];
  if (!current) {
    throw new Error(`event names combatant "${id}" that is not in the state`);
  }
  return { ...state, combatants: { ...state.combatants, [id]: fn(current) } };
}

/** Apply one event by writing its `after` slice. No rules, no RNG. */
export function evolve(state: EngineState, event: EngineEvent): EngineState {
  switch (event.type) {
    case "dice.rolled":
    case "attack.resolved":
    case "check.resolved":
    case "rest.completed":
      return state;
    case "combatant.added":
      return {
        ...state,
        combatants: { ...state.combatants, [event.combatantId]: event.after },
      };
    case "combatant.removed": {
      const { [event.combatantId]: _removed, ...rest } = state.combatants;
      return { ...state, combatants: rest };
    }
    case "hp.changed":
      return update(state, event.combatantId, (c) => ({
        ...c,
        hp: { ...c.hp, current: event.after.current, temp: event.after.temp },
      }));
    case "life-state.changed":
      return update(state, event.combatantId, (c) => ({
        ...c,
        lifeState: event.after,
      }));
    case "death-saves.changed":
      return update(state, event.combatantId, (c) => ({
        ...c,
        deathSaves: { ...event.after },
      }));
    case "condition.applied":
      return update(state, event.combatantId, (c) => ({
        ...c,
        conditions: [...c.conditions, event.after],
        conditionSeq: event.conditionSeq.after,
      }));
    case "condition.changed":
      return update(state, event.combatantId, (c) => ({
        ...c,
        conditions: c.conditions.map((i) =>
          i.instanceId === event.after.instanceId ? event.after : i,
        ),
      }));
    case "condition.removed":
      return update(state, event.combatantId, (c) => ({
        ...c,
        conditions: c.conditions.filter(
          (i) => i.instanceId !== event.before.instanceId,
        ),
      }));
    case "assist.granted":
      return update(state, event.combatantId, (c) => ({
        ...c,
        assists: [...(c.assists ?? []), event.after],
      }));
    case "assist.ended":
      return update(state, event.combatantId, (c) => ({
        ...c,
        assists: (c.assists ?? []).filter(
          (a) => a.helperId !== event.before.helperId,
        ),
      }));
    case "hit-dice.changed":
      return update(state, event.combatantId, (c) => ({
        ...c,
        hitDice: c.hitDice.map((p) =>
          p.die === event.after.die
            ? { ...p, remaining: event.after.remaining }
            : p,
        ),
      }));
    case "spell-slots.changed":
      return update(state, event.combatantId, (c) => {
        const { pool, level, expended } = event.after;
        if (pool === "pact") {
          if (!c.spellSlots.pact) {
            throw new Error(`"${c.id}" has no pact pool`);
          }
          return {
            ...c,
            spellSlots: {
              ...c.spellSlots,
              pact: {
                ...c.spellSlots.pact,
                slot: { ...c.spellSlots.pact.slot, expended },
              },
            },
          };
        }
        const key = String(level) as keyof Combatant["spellSlots"]["standard"];
        const slot = c.spellSlots.standard[key];
        if (!slot) throw new Error(`"${c.id}" has no level ${level} slots`);
        return {
          ...c,
          spellSlots: {
            ...c.spellSlots,
            standard: {
              ...c.spellSlots.standard,
              [key]: { ...slot, expended },
            },
          },
        };
      });
    case "encounter.started":
    case "encounter.changed":
      return { ...state, encounter: event.after };
    case "turn.advanced":
      if (!state.encounter) {
        throw new Error("turn.advanced with no active encounter");
      }
      return {
        ...state,
        encounter: {
          ...state.encounter,
          round: event.after.round,
          turnIndex: event.after.turnIndex,
        },
      };
    case "encounter.ended":
      return { ...state, encounter: null };
    default: {
      const unreachable: never = event;
      throw new Error(`unhandled event ${JSON.stringify(unreachable)}`);
    }
  }
}

export function replay(
  events: readonly EngineEvent[],
  initial: EngineState = emptyState(),
): EngineState {
  let state = initial;
  for (const event of events) state = evolve(state, event);
  return state;
}
