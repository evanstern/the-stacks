import { DamageTypeSchema, DIFFICULTY_DC } from "@the-stacks/dnd5e-engine";
import { PresenceReasonSchema } from "@the-stacks/session-model";
import { CONDITION_KEYS, SKILL_KEYS } from "../nodes/schemas.js";

/**
 * Kept apart from common.ts: it renders the closed rules-term lists from the
 * engine enums, and narrate's import closure must hold no engine value
 * (narrate.test.ts).
 */
/** The shared description of the step grammar (interpret and adjudicate). */
export const STEP_GRAMMAR = [
  "A step states mechanics INPUTS as data. Allowed steps:",
  '{"step":"none","reason":str}  (certain outcome; no roll)',
  '{"step":"check","reason":str,"combatantId":id|null,"kind":"ability-check"|"saving-throw","ability":"str"|"dex"|"con"|"int"|"wis"|"cha","skill":skill key|null,"difficulty":difficulty tier,"circumstance":{"mode":"advantage"|"disadvantage","reason":str}|null,"autoFail":{"reason":str}|null,"onSuccess":[effect],"onFailure":[effect],"stakes":{"success":str,"cost":str|null,"failure":str,"severe":str|null},"onCost":[effect],"onSevere":[effect],"newRisk":str|null,"reveals":clue ref|null}',
  "A check's stakes are declared before the dice. stakes.success: what happens when the attempt succeeds, written as the concrete outcome of this attempt; always written. reveals: the reference of one listed discoverable clue that a success shows, else null. stakes.cost: what happens on success at a cost, a miss by 1 or 2 (the goal is met, with a price). stakes.failure: what a plain failure costs; always written. stakes.severe: what happens on a severe failure, a miss by 5 or more. An ability check needs cost and severe; a saving throw sets them null. onCost and onSevere hold the effects of those bands. newRisk is a new danger that makes a repeat attempt a fresh roll; null otherwise.",
  '{"step":"attack","reason":str,"attackerId":id,"targetId":id,"attack":attack name,"circumstance":{"mode":"advantage"|"disadvantage","reason":str}|null,"onHit":[effect]}  (onHit holds conditions, healing or presence, never damage: the engine applies the attack\'s own damage on a hit)',
  `Difficulty tiers (the only allowed values of "difficulty"): ${Object.entries(
    DIFFICULTY_DC,
  )
    .map(([t, dc]) => `${t} (DC ${dc})`)
    .join(", ")}`,
  '{"step":"effect","reason":str,"effects":[effect]}',
  '{"step":"roll","reason":str,"expression":"1d6","mode":roll mode}',
  '{"step":"move","reason":str,"combatantId":id,"leavesReachOf":[id]}  (the mover moves; list each hostile it stands next to and moves away from without Disengage)',
  "An effect is one of:",
  '{"effect":"damage","targetId":id,"components":[{"amount":Amount,"damageType":damage type}],"defenses":{"resistances":[],"vulnerabilities":[],"immunities":[]}|null}',
  '{"effect":"heal","targetId":id,"amount":Amount}',
  '{"effect":"condition","op":"apply"|"remove","targetId":id,"condition":condition key,"source":str}',
  '{"effect":"presence","targetId":id,"reason":presence reason}',
  'Amount is {"kind":"roll","expression":"1d8+3"} or {"kind":"fixed","value":int}; use fixed only where the SRD names a fixed value.',
  "Name the ability, skill, difficulty and attack only. The engine derives every modifier, DC, AC and damage from the combatant's stats, and advantage or disadvantage from conditions. Add a circumstance only for a source no condition states. Never state a total, an applied amount or whether anything succeeds: the engine rolls and decides every number.",
  `Conditions (the only allowed values of "condition"): ${CONDITION_KEYS.join(", ")}`,
  `Presence reasons (the only allowed values of "reason" in a presence effect): ${PresenceReasonSchema.options.join(", ")}`,
  "A presence effect states that an actor arrived, left, fled, was removed, surrendered or conceded. Put another actor's presence change in onSuccess, onFailure or onHit of a roll against that actor. The acting actor's own presence change may stand in an effect step.",
  `Skills (the only allowed values of "skill", or null): ${SKILL_KEYS.join(", ")}`,
  `Damage types (the only allowed values of "damageType"): ${DamageTypeSchema.options.join(", ")}`,
  "A condition effect may use only a listed condition. A narrative outcome such as spotting, learning or noticing something is narration, not an effect: leave onSuccess empty; write what is learned in stakes.success and name the clue in reveals.",
].join("\n");
