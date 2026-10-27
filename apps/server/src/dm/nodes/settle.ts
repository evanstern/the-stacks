import type { SessionProjections } from "@the-stacks/session-model";
import type { TurnContext } from "../pipeline/context.js";

/**
 * Settling (specs/046-downed-hero-gate plan D4, decision-0025 §3.2): code
 * only, no model. When the turn lands on a combatant who cannot act, the
 * engine settles it: a dying combatant rolls its death save, then the turn
 * passes. A stable combatant, or an unable monster or NPC, passes with no
 * roll. A natural 20 returns the combatant to 1 HP, conscious, and keeps the
 * turn. The loop runs at most one lap of the initiative order.
 */

/** The slice of the resolve node's `Run` that settling uses. */
export interface SettleRun {
  mech(
    key: string,
    command: Record<string, unknown>,
    reason: string,
    actionId: string | null,
  ): Promise<{ result: string }>;
}

/** Conditions that stop a combatant acting; the engine's `INCAPACITATING` list. */
const INCAPACITATING = [
  "incapacitated",
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
];

function canAct(p: SessionProjections, id: string): boolean {
  const c = p.engine.combatants[id];
  if (!c) return true;
  return (
    c.lifeState === "conscious" &&
    !c.conditions.some((i) => INCAPACITATING.includes(i.condition as string))
  );
}

/**
 * Passes every downed combatant the turn has reached. Settling writes engine
 * commands only, through resolve's own `Run`; the caller submits the
 * `table-mode` row for the actor it stops on, so `gate.submit` stays in
 * resolve (the dm/ write boundary).
 */
export async function settleTurn(
  run: SettleRun,
  ctx: TurnContext,
): Promise<void> {
  const load = () => ctx.deps.loadProjections(ctx.job.sessionId);
  let p = await load();
  const lap = p.encounter?.order.length ?? 0;
  for (let n = 0; n < lap; n++) {
    const active = p.encounter?.activeCombatantId;
    if (!active || canAct(p, active)) break;
    const c = p.engine.combatants[active];
    if (c?.lifeState === "unconscious" && c.zeroHpRule === "death-saves") {
      await run.mech(
        `settle:${n}:save`,
        { type: "death-save.roll", targetId: active, mode: "normal" },
        "Death saving throw at the start of the turn",
        null,
      );
      p = await load();
      if (canAct(p, active)) break;
    }
    const adv = await run.mech(
      `settle:${n}:advance`,
      { type: "turn.advance" },
      "The turn passes a downed combatant",
      null,
    );
    if (adv.result !== "applied") break;
    p = await load();
  }
}
