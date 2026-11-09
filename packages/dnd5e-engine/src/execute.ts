import { handleAttackRoll, handleCheckRoll } from "./commands/attacks.js";
import {
  handleCombatantAdd,
  handleCombatantRemove,
} from "./commands/combatants.js";
import {
  handleConditionApply,
  handleConditionRemove,
  handleExhaustionAdjust,
} from "./commands/conditions.js";
import {
  handleEncounterEnd,
  handleInitiativeJoin,
  handleInitiativeLeave,
  handleInitiativeRoll,
  handleTurnAdvance,
} from "./commands/encounter.js";
import { handleHelpGrant } from "./commands/help.js";
import {
  handleDamageApply,
  handleHealingApply,
  handleTempHpGrant,
} from "./commands/hit-points.js";
import { handleDeathSaveRoll, handleStabilize } from "./commands/life.js";
import {
  handleCombatantPlace,
  handleMove,
  handleMovementAction,
  handleSpaceDefine,
} from "./commands/move.js";
import { handleRestLong, handleRestShort } from "./commands/rests.js";
import { handleRoll } from "./commands/roll.js";
import {
  handleSpellSlotExpend,
  handleSpellSlotRestore,
} from "./commands/spell-slots.js";
import { handleSpellCast } from "./commands/spells.js";
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
  "attack.roll": handleAttackRoll,
  "check.roll": handleCheckRoll,
  "condition.apply": handleConditionApply,
  "condition.remove": handleConditionRemove,
  "exhaustion.adjust": handleExhaustionAdjust,
  "initiative.roll": handleInitiativeRoll,
  "initiative.join": handleInitiativeJoin,
  "initiative.leave": handleInitiativeLeave,
  "turn.advance": handleTurnAdvance,
  "encounter.end": handleEncounterEnd,
  "rest.short": handleRestShort,
  "rest.long": handleRestLong,
  "help.grant": handleHelpGrant,
  "spell.cast": handleSpellCast,
  "spell-slot.expend": handleSpellSlotExpend,
  "spell-slot.restore": handleSpellSlotRestore,
  "space.define": handleSpaceDefine,
  "combatant.place": handleCombatantPlace,
  move: handleMove,
  "movement.action": handleMovementAction,
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
