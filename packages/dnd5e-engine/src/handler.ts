import type { Rng } from "./rng.js";
import type { CommandOf, EngineCommand } from "./schema/commands.js";
import type { EngineResult } from "./schema/refusals.js";
import type { EngineState } from "./schema/state.js";

export type Handler<T extends EngineCommand["type"]> = (
  state: EngineState,
  command: CommandOf<T>,
  rng: Rng,
) => EngineResult;
