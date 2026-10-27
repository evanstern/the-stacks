import { DamageTypeSchema } from "@the-stacks/dnd5e-engine";
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
  '{"step":"check","reason":str,"combatantId":id|null,"kind":"ability-check"|"saving-throw","ability":"str"|"dex"|"con"|"int"|"wis"|"cha","skill":skill key|null,"expression":"1d20+5","mode":"normal"|"advantage"|"disadvantage","dc":int,"autoFail":{"reason":str}|null,"onSuccess":[effect],"onFailure":[effect]}',
  '{"step":"attack","reason":str,"attackerId":id|null,"targetId":id,"expression":"1d20+5","mode":roll mode,"targetAc":int|null,"onHit":[effect]}',
  '{"step":"effect","reason":str,"effects":[effect]}',
  '{"step":"roll","reason":str,"expression":"1d6","mode":roll mode}',
  "An effect is one of:",
  '{"effect":"damage","targetId":id,"components":[{"amount":Amount,"damageType":damage type}],"defenses":{"resistances":[],"vulnerabilities":[],"immunities":[]}|null}',
  '{"effect":"heal","targetId":id,"amount":Amount}',
  '{"effect":"condition","op":"apply"|"remove","targetId":id,"condition":condition key,"source":str}',
  '{"effect":"presence","targetId":id,"reason":presence reason}',
  'Amount is {"kind":"roll","expression":"1d8+3"} or {"kind":"fixed","value":int}; use fixed only where the SRD names a fixed value.',
  "The expression carries the modifier you choose (ability modifier, proficiency, bonus dice). Never state a total, an applied amount or whether anything succeeds: the engine rolls and decides every number.",
  `Conditions (the only allowed values of "condition"): ${CONDITION_KEYS.join(", ")}`,
  `Presence reasons (the only allowed values of "reason" in a presence effect): ${PresenceReasonSchema.options.join(", ")}`,
  "A presence effect states that an actor arrived, left, fled, was removed, surrendered or conceded. Put another actor's presence change in onSuccess, onFailure or onHit of a roll against that actor. The acting actor's own presence change may stand in an effect step.",
  `Skills (the only allowed values of "skill", or null): ${SKILL_KEYS.join(", ")}`,
  `Damage types (the only allowed values of "damageType"): ${DamageTypeSchema.options.join(", ")}`,
  "A condition effect may use only a listed condition. A narrative outcome such as spotting, learning or noticing something is narration, not an effect: leave onSuccess empty.",
].join("\n");
