// FR-001: plan(state, space, intent). Dispatch on kind; unserved kinds refuse KIND_UNSERVED.
import type { Intent, IntentKind } from "@the-stacks/intent";
import type { SpaceView } from "@the-stacks/space";
import { checkKind, contest, hide, search } from "./checks.js";
import { attack, cast, grapple, help, shove } from "./combat.js";
import { PLAN_KINDS } from "./kinds.js";
import { type Ctx, type Handler, reasonOf, refuse } from "./refs.js";
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
  return handler(c);
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
