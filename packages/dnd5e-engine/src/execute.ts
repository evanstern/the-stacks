import {
  handleCombatantAdd,
  handleCombatantRemove,
} from "./commands/combatants.js";
import {
  handleDamageApply,
  handleHealingApply,
  handleTempHpGrant,
} from "./commands/hit-points.js";
import { handleDeathSaveRoll, handleStabilize } from "./commands/life.js";
import { handleRoll } from "./commands/roll.js";
import type { Handler } from "./handler.js";
import type { Rng } from "./rng.js";
import { type EngineCommand, EngineCommandSchema } from "./schema/commands.js";
import { type EngineResult, refuse } from "./schema/refusals.js";
import { type EngineState, EngineStateSchema } from "./schema/state.js";

type HandlerMap = {
  [K in EngineCommand["type"]]?: Handler<K>;
};

// Later phases register their handlers here, one line each.
const handlers: HandlerMap = {
  roll: handleRoll,
  "combatant.add": handleCombatantAdd,
  "combatant.remove": handleCombatantRemove,
  "damage.apply": handleDamageApply,
  "healing.apply": handleHealingApply,
  "temp-hp.grant": handleTempHpGrant,
  "death-save.roll": handleDeathSaveRoll,
  stabilize: handleStabilize,
};

function issuesOf(error: {
  issues: readonly { path: PropertyKey[]; message: string }[];
}) {
  return error.issues.slice(0, 10).map((i) => ({
    path: i.path.map(String).join("."),
    message: i.message,
  }));
}

export function execute(
  state: EngineState,
  command: unknown,
  rng: Rng,
): EngineResult {
  const parsedState = EngineStateSchema.safeParse(state);
  if (!parsedState.success) {
    return refuse("INVALID_STATE", "state fails EngineStateSchema", {
      issues: issuesOf(parsedState.error),
    });
  }
  const parsedCommand = EngineCommandSchema.safeParse(command);
  if (!parsedCommand.success) {
    return refuse("INVALID_COMMAND", "command fails EngineCommandSchema", {
      issues: issuesOf(parsedCommand.error),
    });
  }
  const cmd = parsedCommand.data;
  const handler = handlers[cmd.type] as
    | ((s: EngineState, c: EngineCommand, r: Rng) => EngineResult)
    | undefined;
  if (!handler) {
    throw new Error(`no handler registered for command "${cmd.type}"`);
  }
  return handler(parsedState.data, cmd, rng);
}
