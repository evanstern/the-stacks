import { type Rng, seededRng } from "@the-stacks/dnd5e-engine";

export interface ScenarioRng extends Rng {
  /** Total dice drawn so far (scripted plus seeded). */
  drawn(): number;
  /** Scripted faces consumed so far. */
  scriptedUsed(): number;
}

/**
 * Serves `faces` in order, then continues with `seededRng(seed)`. A null seed
 * after the faces run out uses seed 0 (deterministic, never `Math.random`).
 */
export function scenarioRng(
  faces: readonly number[],
  seed: number | null,
): ScenarioRng {
  const tail = seededRng(seed ?? 0);
  let used = 0;
  let drawnCount = 0;
  return {
    rollDie(sides: number): number {
      drawnCount += 1;
      if (used < faces.length) {
        const face = faces[used] as number;
        if (!Number.isInteger(face) || face < 1 || face > sides) {
          throw new Error(
            `scripted face ${face} at position ${used} is outside 1..${sides}`,
          );
        }
        used += 1;
        return face;
      }
      return tail.rollDie(sides);
    },
    drawn: () => drawnCount,
    scriptedUsed: () => used,
  };
}
