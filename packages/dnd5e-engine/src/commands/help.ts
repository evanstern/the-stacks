import { helperExpiry } from "../derive.js";
import type { Handler } from "../handler.js";
import type { EngineEvent } from "../schema/events.js";
import { refuse } from "../schema/refusals.js";
import type { Combatant } from "../schema/state.js";
import { actorUnable, checkNamed } from "./attacks.js";

/**
 * Spec 084 D6: the Help action (SRD 5.2.1 rules-glossary.help-action). The holder is the ally
 * (ability-check assist) or the distracted enemy (attack assist).
 */
export const handleHelpGrant: Handler<"help.grant"> = (state, command) => {
  const holderId =
    command.assist.kind === "ability-check"
      ? command.assist.allyId
      : command.assist.targetId;
  const named = checkNamed(state, [command.helperId, holderId]);
  if (named) return named;
  if (holderId === command.helperId) {
    return refuse("INVALID_COMMAND", "a combatant cannot help itself");
  }
  const unable = actorUnable(state, command.helperId, "helper");
  if (unable) return unable;
  const helper = state.combatants[command.helperId] as Combatant;
  if (command.assist.kind === "ability-check") {
    const { skill } = command.assist;
    if (!helper.stats) {
      return refuse(
        "STAT_UNDEFINED",
        `cannot check proficiency for "${helper.id}"`,
        { combatantId: helper.id, missing: "stats" },
      );
    }
    if (helper.stats.skills[skill] === undefined) {
      return refuse(
        "NOT_PROFICIENT",
        `"${helper.id}" is not proficient in ${skill}`,
        { combatantId: helper.id, skill },
      );
    }
    // ponytail: tool proficiencies are not modelled; add when sheets carry them (TASK-0058).
  }
  // ponytail: no positions; "an enemy within 5 feet of you" is not checked. Add with positions.
  const events: EngineEvent[] = [];
  for (const c of Object.values(state.combatants)) {
    const open = (c.assists ?? []).find((a) => a.helperId === helper.id);
    if (open) {
      events.push({
        type: "assist.ended",
        v: 1,
        reason: command.reason,
        combatantId: c.id,
        cause: "replaced",
        before: open,
        after: null,
      });
    }
  }
  const expiresAt = helperExpiry(state.encounter, helper.id);
  events.push({
    type: "assist.granted",
    v: 1,
    reason: command.reason,
    combatantId: holderId,
    before: null,
    after:
      command.assist.kind === "ability-check"
        ? {
            kind: "ability-check",
            helperId: helper.id,
            skill: command.assist.skill,
            expiresAt,
          }
        : { kind: "attack", helperId: helper.id, expiresAt },
  });
  return { ok: true, events };
};
