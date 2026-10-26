import { expect } from "vitest";
import {
  type Combatant,
  type EngineEvent,
  type EngineResult,
  type EngineState,
  emptyState,
  type RefusalCode,
  type Rng,
  replay,
} from "../src/index.js";

export function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: "pc-ana",
    name: "Ana",
    hp: { current: 12, max: 12, temp: 0 },
    zeroHpRule: "death-saves",
    lifeState: "conscious",
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    conditionSeq: 0,
    hitDice: [],
    spellSlots: { standard: {}, pact: null },
    initiativeBonus: 0,
    conModifier: 0,
    ac: 15,
    defenses: { resistances: [], vulnerabilities: [], immunities: [] },
    ...overrides,
  };
}

export function stateWith(...combatants: Combatant[]): EngineState {
  const state = emptyState();
  for (const c of combatants) state.combatants[c.id] = c;
  return state;
}

export function expectOk(result: EngineResult): EngineEvent[] {
  if (!result.ok) {
    throw new Error(
      `expected ok, got refusal ${result.refusal.code}: ${result.refusal.message}`,
    );
  }
  expect(result.events.length).toBeGreaterThan(0);
  return result.events;
}

export function expectRefusal(result: EngineResult, code: RefusalCode): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.refusal.code).toBe(code);
  expect("events" in result).toBe(false);
}

export interface CountingRng extends Rng {
  draws(): number;
}

export function countingRng(inner: Rng): CountingRng {
  let n = 0;
  return {
    rollDie(sides: number): number {
      n += 1;
      return inner.rollDie(sides);
    },
    draws: () => n,
  };
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export function applyResult(
  state: EngineState,
  result: EngineResult,
): EngineState {
  return replay(expectOk(result), state);
}
