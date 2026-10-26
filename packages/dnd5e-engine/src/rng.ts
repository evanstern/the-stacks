export interface Rng {
  /** Returns an integer face in 1..sides inclusive. sides is an integer in 1..1000. */
  rollDie(sides: number): number;
}

export interface ScriptedRng extends Rng {
  /** Faces not yet consumed. */
  remaining(): number;
  /** Number of rollDie calls so far. */
  calls(): number;
}

/** Thrown when a scripted RNG runs out of faces or lists a face out of range. */
export class ScriptedDiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScriptedDiceError";
  }
}

/** Thrown when an RNG breaks its contract (a face outside 1..sides, a bad seed). */
export class RngContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RngContractError";
  }
}

const TWO_POW_32 = 4294967296;
const MAX_SIDES = 1000;

/** mulberry32 over a 32-bit integer seed, with rejection sampling (research R2). */
export function seededRng(seed: number): Rng {
  if (!Number.isInteger(seed) || seed < 0 || seed >= TWO_POW_32) {
    throw new RngContractError(
      `seed must be an integer in 0..2^32-1, got ${seed}`,
    );
  }
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    rollDie(sides: number): number {
      if (!Number.isInteger(sides) || sides < 1 || sides > MAX_SIDES) {
        throw new RngContractError(`invalid die size ${sides}`);
      }
      // Reject the biased tail so every face is equally likely.
      const limit = TWO_POW_32 - (TWO_POW_32 % sides);
      let r = next();
      while (r >= limit) r = next();
      return (r % sides) + 1;
    },
  };
}

export function scriptedRng(faces: readonly number[]): ScriptedRng {
  let index = 0;
  return {
    rollDie(sides: number): number {
      if (index >= faces.length) {
        throw new ScriptedDiceError(
          `scripted dice exhausted after ${faces.length} faces (asked for d${sides})`,
        );
      }
      const face = faces[index] as number;
      if (!Number.isInteger(face) || face < 1 || face > sides) {
        throw new ScriptedDiceError(
          `scripted face ${face} at position ${index} is outside 1..${sides}`,
        );
      }
      index += 1;
      return face;
    },
    remaining: () => faces.length - index,
    calls: () => index,
  };
}
