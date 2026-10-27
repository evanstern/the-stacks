import type { z } from "zod";
import { CharacterClass } from "./class.js";
import type { SrdKind } from "./common.js";
import { Condition } from "./condition.js";
import { Equipment } from "./equipment.js";
import { Monster } from "./monster.js";
import { Rule } from "./rule.js";
import { Spell } from "./spell.js";

export * from "./class.js";
export * from "./common.js";
export * from "./condition.js";
export * from "./equipment.js";
export * from "./monster.js";
export * from "./rule.js";
export * from "./spell.js";

export const RecordSchemas = {
  monster: Monster,
  spell: Spell,
  class: CharacterClass,
  equipment: Equipment,
  condition: Condition,
  rule: Rule,
} as const;

export type SrdRecord<K extends SrdKind> = z.infer<(typeof RecordSchemas)[K]>;
