// Spec 097 "Served kinds": how the planner treats each of the 57 Intent kinds.
import type { IntentKind } from "@the-stacks/intent";

export type PlanKindClass = "served" | "ruling" | "unserved" | "not-planned";

const served: IntentKind[] = [
  "check",
  "save",
  "contest",
  "search",
  "hide",
  "attack",
  "cast",
  "help",
  "grapple",
  "shove",
  "move",
  "dash",
  "disengage",
  "stand",
  "drop_prone",
  "end_turn",
  "rest_short",
  "rest_long",
  "roll_free",
  "apply_damage",
  "apply_heal",
  "apply_condition",
  "start_combat",
  "end_combat",
  "add_combatant",
  "move_token",
  "ruling",
  "set_dc",
];
const ruling: IntentKind[] = ["attempt", "use_object"];
// kind -> the card (or question id) that serves it.
const unserved: Partial<Record<IntentKind, string>> = {
  dodge: "TASK-0304",
  ready: "TASK-0276",
  react: "TASK-0276",
  roll: "TASK-0276",
  request_roll: "TASK-0276",
  delay: "Q5",
  use_item: "N-17",
  give: "N-17",
  equip: "N-17",
  drop: "N-17",
  concentration_drop: "TASK-0227",
  level_choice: "N-18",
};
const notPlanned: IntentKind[] = [
  "say",
  "say_to",
  "emote",
  "ask_dm",
  "ooc",
  "party",
  "whisper",
  "narrate",
  "npc_say",
  "reveal",
  "pause",
  "bookmark",
  "recap",
  "retry_narration",
  "predeclare",
];

export const PLAN_KINDS: Record<
  IntentKind,
  { class: PlanKindClass; owner?: string }
> = Object.fromEntries([
  ...served.map((k) => [k, { class: "served" }] as const),
  ...ruling.map((k) => [k, { class: "ruling" }] as const),
  ...Object.entries(unserved).map(
    ([k, owner]) => [k, { class: "unserved", owner }] as const,
  ),
  ...notPlanned.map(
    (k) => [k, { class: "not-planned", owner: "gate" }] as const,
  ),
]) as Record<IntentKind, { class: PlanKindClass; owner?: string }>;
