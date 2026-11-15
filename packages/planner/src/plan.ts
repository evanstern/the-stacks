// FR-001: plan(state, space, intent). Dispatch on kind; unserved kinds refuse KIND_UNSERVED.

import { actionsLeft } from "@the-stacks/dnd5e-engine";
import type { Intent, IntentKind } from "@the-stacks/intent";
import type { SpaceView } from "@the-stacks/space";
import { checkKind, contest, hide, search } from "./checks.js";
import { attack, cast, grapple, help, shove } from "./combat.js";
import {
  addCombatant,
  applyCondition,
  applyDamage,
  applyHeal,
  endCombat,
  moveToken,
  startCombat,
} from "./dm.js";
import { actionCostOf, activeSpender } from "./economy.js";
import { PLAN_KINDS } from "./kinds.js";
import {
  dash,
  disengage,
  dodge,
  dropProne,
  endTurn,
  move,
  stand,
} from "./movement.js";
import { type Ctx, type Handler, reasonOf, refuse } from "./refs.js";
import { restLong, restShort, rollFree } from "./resources.js";
import { askOutcome, ruling, setDc } from "./rulings.js";
import type { PlanResult, PlanState } from "./types.js";

/** Served kinds, filled in by the handler modules. A served kind with no handler refuses. */
const HANDLERS: Partial<Record<IntentKind, Handler>> = {
  check: checkKind,
  save: checkKind,
  contest,
  search,
  hide,
  attempt: askOutcome,
  use_object: askOutcome,
  ruling,
  set_dc: setDc,
  attack,
  cast,
  help,
  grapple,
  shove,
  move,
  dash,
  disengage,
  dodge,
  stand,
  drop_prone: dropProne,
  end_turn: endTurn,
  rest_short: restShort,
  rest_long: restLong,
  roll_free: rollFree,
  apply_damage: applyDamage,
  apply_heal: applyHeal,
  apply_condition: applyCondition,
  start_combat: startCombat,
  end_combat: endCombat,
  add_combatant: addCombatant,
  move_token: moveToken,
};

/** Plan one Intent in a context; a ruling calls this again with `answer` set. */
export function planCtx(c: Ctx): PlanResult {
  const row = PLAN_KINDS[c.intent.kind];
  const handler =
    row.class === "unserved" || row.class === "not-planned"
      ? undefined
      : HANDLERS[c.intent.kind];
  if (!handler) {
    return refuse(
      "KIND_UNSERVED",
      `the planner does not serve "${c.intent.kind}"`,
      { kind: c.intent.kind, owner: row.owner ?? "TASK-0267" },
    );
  }
  const cost = actionCostOf(c.intent);
  const spender = cost ? activeSpender(c) : null;
  if (cost && spender) {
    const left = actionsLeft(c.state.engine, spender);
    if (left && !(cost === "action" ? left.action : left.bonusAction)) {
      return refuse(
        cost === "action" ? "NO_ACTION_LEFT" : "NO_BONUS_ACTION_LEFT",
        cost === "action"
          ? "no Action left this turn"
          : "no Bonus Action left this turn",
        { combatantId: spender, cost },
      );
    }
  }
  const result = handler(c);
  if (!cost || !spender || result.kind !== "commands") return result;
  return {
    ...result,
    commands: [
      ...result.commands,
      {
        command: {
          type: "action.spend",
          combatantId: spender,
          cost,
          reason: c.reason,
        },
      },
    ],
  };
}

export function plan(
  state: PlanState,
  space: SpaceView,
  intent: Intent,
): PlanResult {
  return planCtx({
    state,
    space,
    intent,
    reason: reasonOf(intent),
    askId: intent.id,
    replan: planCtx,
  });
}
