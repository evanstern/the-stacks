// Contract §6: the 57 kinds, KIND_RULES, params schemas, IntentSchema.
// The schema checks shape only (seats, turns and reach are gate and planner checks, FR-010).
import { z } from "zod";
import {
  ActorRefSchema,
  type Channel,
  ChannelSchema,
  CommitSchema,
  SourceSchema,
  type TargetRef,
  TargetRefSchema,
} from "./refs.js";
import {
  AbilitySchema,
  AmountSchema,
  BodySchema,
  ConditionSchema,
  DamageTypeSchema,
  DcSchema,
  DiceSchema,
  DifficultySchema,
  IdSchema,
  IntentIdSchema,
  LabelSchema,
  NoteSchema,
  RollModeSchema,
  SkillSchema,
  SlugSchema,
} from "./scalars.js";

export const INTENT_KINDS = [
  // 6.1 speech
  "say",
  "say_to",
  "emote",
  // 6.2 meta
  "ask_dm",
  "ooc",
  "party",
  "whisper",
  // 6.3 deed
  "attempt",
  // 6.4 check
  "check",
  "save",
  "contest",
  // 6.5 combat action
  "attack",
  "cast",
  "dash",
  "dodge",
  "disengage",
  "help",
  "hide",
  "ready",
  "search",
  "use_object",
  "grapple",
  "shove",
  // 6.6 movement
  "move",
  "stand",
  "drop_prone",
  // 6.7 reaction
  "react",
  // 6.8 turn control
  "end_turn",
  "predeclare",
  "delay",
  // 6.9 resource
  "use_item",
  "give",
  "equip",
  "drop",
  "rest_short",
  "rest_long",
  "concentration_drop",
  // 6.10 roll answer
  "roll",
  "roll_free",
  // 6.11 advancement
  "level_choice",
  // 6.12 DM control
  "narrate",
  "npc_say",
  "request_roll",
  "set_dc",
  "apply_damage",
  "apply_heal",
  "apply_condition",
  "start_combat",
  "end_combat",
  "add_combatant",
  "move_token",
  "reveal",
  "ruling",
  "pause",
  // 6.13 session
  "bookmark",
  "recap",
  "retry_narration",
] as const;

export type IntentKind = (typeof INTENT_KINDS)[number];
export const IntentKindSchema = z.enum(INTENT_KINDS);

export type IntentGroup =
  | "speech"
  | "meta"
  | "deed"
  | "check"
  | "combat"
  | "movement"
  | "reaction"
  | "turn"
  | "resource"
  | "roll"
  | "advancement"
  | "dm"
  | "session";

export type Seat = "player" | "companion" | "dm" | "ai-dm";
export type ChannelRule =
  | "none"
  | "scene"
  | "to"
  | "dm"
  | "party"
  | "whisper"
  | "scene|dm"
  | "scene|to";
export type TargetKind = TargetRef["kind"];
export type TargetShape =
  | "list"
  | "cast"
  | "move"
  | "item-actor"
  | "actor-dest";
export type TargetRule = {
  min: number;
  max: number;
  kinds: readonly TargetKind[];
  shape: TargetShape;
};
export type Mutates =
  | "yes"
  | "no"
  | "never"
  | "via-ruling"
  | "queues"
  | "if-requested";
export type EngineStatus = "served" | "partial" | "gap" | "n/a";
export type KindRule = {
  group: IntentGroup;
  seats: readonly Seat[];
  channel: ChannelRule;
  targets: TargetRule;
  text: "required" | "optional";
  mutates: Mutates;
  resolvedBy: string;
  engine: { status: EngineStatus; ref?: string };
};

const SEAT_OF = { P: "player", C: "companion", D: "dm", A: "ai-dm" } as const;
const seats = (s: string): Seat[] =>
  [...s].map((c) => SEAT_OF[c as keyof typeof SEAT_OF]);
const tg = (
  min: number,
  max: number,
  kinds: readonly TargetKind[] = [],
  shape: TargetShape = "list",
): TargetRule => ({ min, max, kinds, shape });
const NONE = tg(0, 0);
const ALL_TARGETS: TargetKind[] = [
  "actor",
  "entity",
  "item",
  "zone",
  "square",
  "point",
];
const engine = (
  status: EngineStatus,
  ref?: string,
): { status: EngineStatus; ref?: string } =>
  ref ? { status, ref } : { status };

function rule(
  group: IntentGroup,
  seatCodes: string,
  channel: ChannelRule,
  targets: TargetRule,
  mutates: Mutates,
  resolvedBy: string,
  eng: { status: EngineStatus; ref?: string },
  text: "required" | "optional" = "optional",
): KindRule {
  return {
    group,
    seats: seats(seatCodes),
    channel,
    targets,
    text,
    mutates,
    resolvedBy,
    engine: eng,
  };
}

const NA = engine("n/a");
const act = ["actor"] as const;

/** One table for seats, channel, arity, mutates, resolved-by and engine status (FR-007). */
export const KIND_RULES: Record<IntentKind, KindRule> = {
  say: rule(
    "speech",
    "PC",
    "scene",
    NONE,
    "no",
    "DM runtime (react)",
    NA,
    "required",
  ),
  say_to: rule(
    "speech",
    "PC",
    "to",
    tg(1, 1, act),
    "no",
    "DM runtime (react)",
    NA,
    "required",
  ),
  emote: rule(
    "speech",
    "PC",
    "scene",
    NONE,
    "no",
    "DM runtime (react)",
    NA,
    "required",
  ),
  ask_dm: rule(
    "meta",
    "P",
    "dm",
    NONE,
    "never",
    "read-only answer",
    NA,
    "required",
  ),
  ooc: rule("meta", "PD", "party", NONE, "never", "none", NA, "required"),
  party: rule("meta", "PC", "party", NONE, "never", "none", NA, "required"),
  whisper: rule(
    "meta",
    "PDA",
    "whisper",
    NONE,
    "never",
    "none",
    NA,
    "required",
  ),
  attempt: rule(
    "deed",
    "PCDA",
    "scene",
    tg(0, 4, ALL_TARGETS),
    "via-ruling",
    "ruling -> planner",
    engine("n/a", "planner"),
    "required",
  ),
  check: rule(
    "check",
    "PCDA",
    "none",
    tg(0, 1, ["actor", "entity", "zone"]),
    "yes",
    "planner + engine; no DC -> needs_ruling",
    engine("served", "check.roll"),
  ),
  save: rule(
    "check",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine",
    engine("served", "check.roll"),
  ),
  contest: rule(
    "check",
    "PCDA",
    "none",
    tg(1, 1, act),
    "yes",
    "planner + engine",
    engine("partial", "unarmed-strike, influence"),
  ),
  attack: rule(
    "combat",
    "PCDA",
    "none",
    tg(1, 1, ["actor", "entity"]),
    "yes",
    "planner + engine",
    engine("served", "attack.roll"),
  ),
  cast: rule(
    "combat",
    "PCDA",
    "none",
    tg(0, 12, ["actor", "zone", "point"], "cast"),
    "yes",
    "planner + engine",
    engine("partial", "TASK-0227"),
  ),
  dash: rule(
    "combat",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine + space",
    engine("gap", "N-05/N-09"),
  ),
  dodge: rule(
    "combat",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine",
    engine("gap", "N-09"),
  ),
  disengage: rule(
    "combat",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine",
    engine("gap", "N-05"),
  ),
  help: rule(
    "combat",
    "PCDA",
    "none",
    tg(1, 1, act),
    "yes",
    "planner + engine",
    engine("served", "help.grant"),
  ),
  hide: rule(
    "combat",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine",
    engine("partial", "N-06/N-26"),
  ),
  ready: rule(
    "combat",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine",
    engine("gap", "N-11"),
  ),
  search: rule(
    "combat",
    "PCDA",
    "none",
    tg(0, 1, ["zone", "entity"]),
    "yes",
    "planner + engine",
    engine("served", "check.roll"),
  ),
  use_object: rule(
    "combat",
    "PCDA",
    "none",
    tg(1, 1, ["entity"]),
    "yes",
    "ruling -> planner",
    engine("n/a", "ruling"),
  ),
  grapple: rule(
    "combat",
    "PCDA",
    "none",
    tg(1, 1, act),
    "yes",
    "planner + engine",
    engine("served", "unarmed-strike + condition.apply"),
  ),
  shove: rule(
    "combat",
    "PCDA",
    "none",
    tg(1, 1, act),
    "yes",
    "planner + engine",
    engine("partial", "N-05"),
  ),
  move: rule(
    "movement",
    "PCDA",
    "none",
    tg(1, 60, ["zone", "square"], "move"),
    "yes",
    "planner + engine + space",
    engine("gap", "N-05"),
  ),
  stand: rule(
    "movement",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine",
    engine("partial", "N-05"),
  ),
  drop_prone: rule(
    "movement",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine",
    engine("served", "condition.apply"),
  ),
  react: rule(
    "reaction",
    "PCDA",
    "none",
    NONE,
    "yes",
    "engine",
    engine("partial", "N-11"),
  ),
  end_turn: rule(
    "turn",
    "PCDA",
    "none",
    NONE,
    "yes",
    "engine",
    engine("served", "turn.advance"),
  ),
  predeclare: rule(
    "turn",
    "PC",
    "none",
    NONE,
    "queues",
    "gate holds; engine on the actor's turn",
    engine("n/a", "N-10"),
  ),
  delay: rule(
    "turn",
    "PCDA",
    "none",
    NONE,
    "yes",
    "engine",
    engine("gap", "Q5"),
  ),
  use_item: rule(
    "resource",
    "PCDA",
    "none",
    tg(1, 2, ["item", "actor"], "item-actor"),
    "yes",
    "planner + engine",
    engine("gap", "N-17"),
  ),
  give: rule(
    "resource",
    "PCDA",
    "none",
    tg(2, 2, ["item", "actor"], "item-actor"),
    "yes",
    "planner + engine",
    engine("gap", "N-17"),
  ),
  equip: rule(
    "resource",
    "PCDA",
    "none",
    tg(1, 1, ["item"]),
    "yes",
    "planner + engine",
    engine("gap", "N-17"),
  ),
  drop: rule(
    "resource",
    "PCDA",
    "none",
    tg(1, 1, ["item"]),
    "yes",
    "planner + engine",
    engine("gap", "N-17"),
  ),
  rest_short: rule(
    "resource",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine",
    engine("served", "rest.short"),
  ),
  rest_long: rule(
    "resource",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine",
    engine("served", "rest.long"),
  ),
  concentration_drop: rule(
    "resource",
    "PCDA",
    "none",
    NONE,
    "yes",
    "planner + engine",
    engine("gap", "TASK-0227"),
  ),
  roll: rule(
    "roll",
    "PCDA",
    "none",
    NONE,
    "if-requested",
    "engine",
    engine("served", "check.roll"),
  ),
  roll_free: rule(
    "roll",
    "PCDA",
    "scene|dm",
    NONE,
    "no",
    "engine",
    engine("served", "roll"),
  ),
  level_choice: rule(
    "advancement",
    "PD",
    "none",
    NONE,
    "yes",
    "engine + codex",
    engine("gap", "N-18"),
  ),
  narrate: rule(
    "dm",
    "DA",
    "scene",
    NONE,
    "no",
    "gate (prose row)",
    NA,
    "required",
  ),
  npc_say: rule(
    "dm",
    "DA",
    "scene|to",
    tg(0, 1, act),
    "no",
    "gate (talk row)",
    NA,
    "required",
  ),
  request_roll: rule(
    "dm",
    "DA",
    "none",
    tg(1, 8, act),
    "yes",
    "gate (roll-request row) -> roll",
    engine("gap", "N-11"),
  ),
  set_dc: rule("dm", "DA", "none", NONE, "yes", "gate -> planner rerun", NA),
  apply_damage: rule(
    "dm",
    "DA",
    "none",
    tg(1, 8, act),
    "yes",
    "engine",
    engine("served", "damage.apply"),
  ),
  apply_heal: rule(
    "dm",
    "DA",
    "none",
    tg(1, 8, act),
    "yes",
    "engine",
    engine("served", "healing.apply"),
  ),
  apply_condition: rule(
    "dm",
    "DA",
    "none",
    tg(1, 8, act),
    "yes",
    "engine",
    engine("served", "condition.apply/remove"),
  ),
  start_combat: rule(
    "dm",
    "DA",
    "none",
    tg(0, 20, act),
    "yes",
    "engine",
    engine("served", "initiative.roll"),
  ),
  end_combat: rule(
    "dm",
    "DA",
    "none",
    NONE,
    "yes",
    "engine",
    engine("served", "encounter.end"),
  ),
  add_combatant: rule(
    "dm",
    "DA",
    "none",
    tg(0, 1, ["zone"]),
    "yes",
    "planner + engine",
    engine("partial", "N-02/N-05"),
  ),
  move_token: rule(
    "dm",
    "DA",
    "none",
    tg(2, 61, ["actor", "zone", "square"], "actor-dest"),
    "yes",
    "planner + engine + space",
    engine("gap", "N-05"),
  ),
  reveal: rule(
    "dm",
    "DA",
    "none",
    tg(1, 1, ["entity", "zone", "item"]),
    "yes",
    "gate (info.revealed)",
    engine("n/a", "N-23"),
  ),
  ruling: rule("dm", "DA", "none", NONE, "yes", "gate -> planner rerun", NA),
  pause: rule("dm", "DA", "none", NONE, "yes", "gate (table state)", NA),
  bookmark: rule(
    "session",
    "PD",
    "none",
    NONE,
    "no",
    "DM runtime",
    NA,
    "required",
  ),
  recap: rule("session", "PD", "none", NONE, "no", "DM runtime", NA),
  retry_narration: rule(
    "session",
    "P",
    "none",
    NONE,
    "no",
    "DM runtime (flavour only)",
    NA,
  ),
};

/** kind -> group. */
export const INTENT_GROUPS = Object.fromEntries(
  INTENT_KINDS.map((k) => [k, KIND_RULES[k].group]),
) as Record<IntentKind, IntentGroup>;

// ---------------------------------------------------------------------------
// Params schemas (contract §6)

const so = z.strictObject;
const empty = so({});
const optDcOrDiff = {
  dc: DcSchema.optional(),
  difficulty: DifficultySchema.optional(),
};
const atMostOneDc = (v: { dc?: unknown; difficulty?: unknown }) =>
  !(v.dc !== undefined && v.difficulty !== undefined);
const AtMostOne = { message: "at most one of dc, difficulty" };

export const READYABLE_KINDS = [
  "attack",
  "cast",
  "dash",
  "dodge",
  "disengage",
  "help",
  "hide",
  "search",
  "use_object",
  "grapple",
  "shove",
  "move",
] as const satisfies readonly IntentKind[];

export const PREDECLARABLE_KINDS = [
  ...INTENT_KINDS.filter((k) => {
    const g = KIND_RULES[k].group;
    return (
      g === "combat" || g === "movement" || g === "resource" || g === "check"
    );
  }),
] as readonly IntentKind[];

// ponytail: IntentBody excludes `ruling` (no recursion) and `whisper` (a body has no channel
// to carry recipients). Contract §6.12 does not say; reported to the orchestrator.
export const BODY_KINDS = INTENT_KINDS.filter(
  (k) => k !== "ruling" && k !== "whisper",
) as readonly IntentKind[];

function targetsOk(kind: IntentKind, t: readonly TargetRef[]): boolean {
  const r = KIND_RULES[kind].targets;
  const ks = (x: TargetRef) => x.kind;
  if (t.length < r.min || t.length > r.max) return false;
  const squares = (xs: readonly TargetRef[]) =>
    xs.length >= 1 && xs.length <= 60 && xs.every((x) => ks(x) === "square");
  switch (r.shape) {
    case "list":
      return t.every((x) => r.kinds.includes(ks(x)));
    case "cast":
      return (
        t.every((x) => ks(x) === "actor") ||
        (t.length === 1 &&
          (ks(t[0] as TargetRef) === "zone" ||
            ks(t[0] as TargetRef) === "point"))
      );
    case "move":
      return (t.length === 1 && ks(t[0] as TargetRef) === "zone") || squares(t);
    case "item-actor":
      return (
        ks(t[0] as TargetRef) === "item" &&
        t.slice(1).every((x) => ks(x) === "actor")
      );
    case "actor-dest": {
      const dest = t.slice(1);
      return (
        ks(t[0] as TargetRef) === "actor" &&
        ((dest.length === 1 && ks(dest[0] as TargetRef) === "zone") ||
          squares(dest))
      );
    }
  }
}

// Nested bodies: no envelope, no actor. A recursive reference is built lazily so `ready`,
// `predeclare` and `ruling` can name the body unions that contain other kinds' params.
type ParamsMap = Record<string, z.ZodType>;
function bodyOf(
  kinds: readonly IntentKind[],
  params: () => ParamsMap,
  withText: boolean,
) {
  const members = kinds.map((kind) =>
    so({
      kind: z.literal(kind),
      targets: z.array(TargetRefSchema).max(60).default([]),
      params: z.lazy(() => params()[kind] as z.ZodType).prefault({}),
      ...(withText
        ? {
            text:
              KIND_RULES[kind].text === "required"
                ? BodySchema
                : BodySchema.optional(),
          }
        : {}),
    }).superRefine((v, ctx) => {
      if (!targetsOk(kind, v.targets))
        ctx.addIssue({ code: "custom", message: `bad targets for ${kind}` });
    }),
  );
  return z.discriminatedUnion(
    "kind",
    members as unknown as [
      (typeof members)[number],
      ...(typeof members)[number][],
    ],
  );
}

const PARAMS_REF: { current: ParamsMap } = { current: {} };
const lazyParams = () => PARAMS_REF.current;

const Readyable = bodyOf(READYABLE_KINDS, lazyParams, false);
const Predeclarable = bodyOf(PREDECLARABLE_KINDS, lazyParams, false);
const IntentBody = bodyOf(BODY_KINDS, lazyParams, true);

const RollAsk = z.discriminatedUnion("kind", [
  so({
    kind: z.literal("check"),
    skill: SkillSchema.optional(),
    ability: AbilitySchema.optional(),
  }),
  so({ kind: z.literal("save"), ability: AbilitySchema }),
  so({ kind: z.literal("death-save") }),
  so({ kind: z.literal("initiative") }),
]);

export const PARAMS = {
  say: empty,
  say_to: empty,
  emote: empty,
  ask_dm: empty,
  ooc: empty,
  party: empty,
  whisper: empty,
  attempt: so({ scope: z.enum(["character", "party"]).default("character") }),
  check: so({
    skill: SkillSchema.optional(),
    ability: AbilitySchema.optional(),
    mode: RollModeSchema.default("normal"),
    ...optDcOrDiff,
  })
    .refine((v) => v.skill !== undefined || v.ability !== undefined, {
      message: "at least one of skill, ability",
    })
    .refine(atMostOneDc, AtMostOne),
  save: so({
    ability: AbilitySchema,
    mode: RollModeSchema.default("normal"),
    ...optDcOrDiff,
  }).refine(atMostOneDc, AtMostOne),
  contest: so({
    skill: SkillSchema.optional(),
    ability: AbilitySchema.optional(),
    opposed: z.union([SkillSchema, AbilitySchema]).optional(),
    mode: RollModeSchema.default("normal"),
  }).refine((v) => v.skill !== undefined || v.ability !== undefined, {
    message: "at least one of skill, ability",
  }),
  attack: so({
    weapon: z.union([z.literal("unarmed"), LabelSchema]),
    mode: RollModeSchema.default("normal"),
  }),
  cast: so({
    spell: SlugSchema,
    slot: z.number().int().min(1).max(9).optional(),
    mode: RollModeSchema.default("normal"),
  }),
  dash: empty,
  dodge: empty,
  disengage: empty,
  help: so({
    assist: z.discriminatedUnion("kind", [
      so({ kind: z.literal("check"), skill: SkillSchema }),
      so({ kind: z.literal("attack") }),
    ]),
  }),
  hide: empty,
  ready: so({ trigger: z.string().min(1).max(200), then: Readyable }),
  search: so({
    skill: z.enum(["perception", "investigation"]).default("perception"),
  }),
  use_object: empty,
  grapple: empty,
  shove: so({ effect: z.enum(["prone", "push"]) }),
  move: empty,
  stand: empty,
  drop_prone: empty,
  react: so({ promptId: IdSchema, choice: SlugSchema }),
  end_turn: empty,
  predeclare: so({ then: Predeclarable }),
  delay: empty,
  use_item: empty,
  give: empty,
  equip: so({ off: z.boolean().default(false) }),
  drop: empty,
  rest_short: so({
    spend: z
      .array(
        so({
          die: z.union([
            z.literal(6),
            z.literal(8),
            z.literal(10),
            z.literal(12),
          ]),
          count: z.number().int().min(1).max(20),
        }),
      )
      .max(4)
      .default([]),
  }),
  rest_long: empty,
  concentration_drop: empty,
  roll: so({ requestId: IdSchema }),
  roll_free: so({ expression: DiceSchema, reason: NoteSchema.optional() }),
  level_choice: so({ choiceId: IdSchema, option: SlugSchema }),
  narrate: empty,
  npc_say: empty,
  request_roll: so({
    roll: RollAsk,
    mode: RollModeSchema.default("normal"),
    ...optDcOrDiff,
    secret: z.boolean().default(false),
  }).refine(atMostOneDc, AtMostOne),
  set_dc: so({ for: IdSchema, ...optDcOrDiff }).refine(
    (v) => (v.dc !== undefined) !== (v.difficulty !== undefined),
    { message: "exactly one of dc, difficulty" },
  ),
  apply_damage: so({
    amount: AmountSchema,
    damageType: DamageTypeSchema,
    critical: z.boolean().default(false),
  }),
  apply_heal: so({ amount: AmountSchema, temp: z.boolean().default(false) }),
  apply_condition: so({
    op: z.enum(["add", "remove"]),
    condition: ConditionSchema,
    until: so({
      round: z.number().int().min(1),
      actor: IdSchema,
      boundary: z.enum(["turn-start", "turn-end"]),
    }).optional(),
  }),
  start_combat: empty,
  end_combat: empty,
  add_combatant: so({
    from: IdSchema,
    count: z.number().int().min(1).max(12).default(1),
  }),
  move_token: empty,
  reveal: so({
    to: z.union([z.literal("party"), z.array(IdSchema).min(1).max(8)]),
    block: IdSchema.optional(),
    field: SlugSchema.optional(),
  }),
  ruling: so({
    requestId: IdSchema,
    decision: z.enum(["accept", "reject", "amend"]),
    ...optDcOrDiff,
    amend: IntentBody.optional(),
    reason: NoteSchema.optional(),
  })
    .refine((v) => (v.decision === "amend") === (v.amend !== undefined), {
      message: "amend iff decision is amend",
    })
    .refine(atMostOneDc, AtMostOne),
  pause: so({ state: z.enum(["on", "off"]).default("on") }),
  bookmark: empty,
  recap: empty,
  retry_narration: so({ narrationId: IdSchema.optional() }),
} as const satisfies Record<IntentKind, z.ZodType>;
PARAMS_REF.current = PARAMS as unknown as ParamsMap;

export const paramsSchemaOf = <K extends IntentKind>(
  kind: K,
): (typeof PARAMS)[K] => PARAMS[kind];

export type ParamsInput = { [K in IntentKind]: z.input<(typeof PARAMS)[K]> };
export type ParamsOf = { [K in IntentKind]: z.output<(typeof PARAMS)[K]> };

// ---------------------------------------------------------------------------
// MODEL_NUMBER (contract §6.12, constitution VI)

function modelNumber(kind: string, p: Record<string, unknown>): boolean {
  switch (kind) {
    case "set_dc":
    case "request_roll":
      return p.dc !== undefined;
    case "ruling": {
      if (p.dc !== undefined) return true;
      const a = p.amend as
        | { kind: string; params: Record<string, unknown> }
        | undefined;
      return a ? modelNumber(a.kind, a.params) : false;
    }
    case "apply_damage":
    case "apply_heal":
      return (p.amount as { kind: string }).kind === "fixed";
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Envelope (contract §2)

type ChannelOf = Channel | undefined;
const sameChannel = (a: Channel, b: Channel) =>
  JSON.stringify(a) === JSON.stringify(b);

/** The channel a kind carries when the producer omits it, or undefined when none can be filled. */
function defaultChannel(
  rule: ChannelRule,
  targets: readonly TargetRef[],
): ChannelOf {
  switch (rule) {
    case "scene":
    case "scene|dm":
      return { kind: "scene" };
    case "dm":
      return { kind: "dm" };
    case "party":
      return { kind: "party" };
    case "to":
      return { kind: "to", id: (targets[0] as { id: string }).id };
    case "scene|to":
      return targets.length === 1
        ? { kind: "to", id: (targets[0] as { id: string }).id }
        : { kind: "scene" };
    default:
      return undefined;
  }
}

function channelOk(
  rule: ChannelRule,
  ch: Channel,
  targets: readonly TargetRef[],
): boolean {
  if (rule === "none") return false;
  if (rule === "whisper") return ch.kind === "whisper";
  if (rule === "scene|dm") return ch.kind === "scene" || ch.kind === "dm";
  const want = defaultChannel(rule, targets);
  return want !== undefined && sameChannel(want, ch);
}

function envelopeOf(kind: IntentKind) {
  const rules = KIND_RULES[kind];
  return so({
    id: IntentIdSchema,
    kind: z.literal(kind),
    actor: ActorRefSchema,
    channel:
      rules.channel === "whisper" ? ChannelSchema : ChannelSchema.optional(),
    targets: z.array(TargetRefSchema).max(61).default([]),
    params: (PARAMS[kind] as z.ZodType).prefault({}),
    text: rules.text === "required" ? BodySchema : BodySchema.optional(),
    source: SourceSchema,
    commit: CommitSchema,
  }).superRefine((v, ctx) => {
    const issue = (message: string, refusal?: string) =>
      ctx.addIssue({
        code: "custom",
        message,
        ...(refusal ? { params: { refusal } } : {}),
      });
    if (!targetsOk(kind, v.targets as TargetRef[]))
      issue(`bad targets for ${kind}`);
    if (
      v.channel !== undefined &&
      !channelOk(rules.channel, v.channel, v.targets as TargetRef[])
    )
      issue(`channel does not match kind ${kind}`, "INTENT_CHANNEL_MISMATCH");
    if (kind === "npc_say" && v.actor.kind !== "npc")
      issue("npc_say actor must be an npc");
    if (
      v.actor.kind === "ai:dm" &&
      modelNumber(kind, v.params as Record<string, unknown>)
    )
      issue(
        `ai:dm may not carry a model-chosen number on ${kind}`,
        "MODEL_NUMBER",
      );
  });
}

const members = INTENT_KINDS.map(envelopeOf);
const Core = z.discriminatedUnion(
  "kind",
  members as unknown as [
    (typeof members)[number],
    ...(typeof members)[number][],
  ],
);

type Envelope<K extends IntentKind> = {
  id: string;
  kind: K;
  actor: z.output<typeof ActorRefSchema>;
  channel?: Channel;
  targets: TargetRef[];
  params: ParamsOf[K];
  text?: string;
  source: z.output<typeof SourceSchema>;
  commit: z.output<typeof CommitSchema>;
};
export type IntentOf<K extends IntentKind> = Envelope<K>;
export type Intent = { [K in IntentKind]: Envelope<K> }[IntentKind];

/** Discriminated union on `kind`; fills the channel a kind fixes when the producer omits it. */
export const IntentSchema = Core.transform((v) => {
  if (v.channel !== undefined) return v;
  const ch = defaultChannel(
    KIND_RULES[v.kind as IntentKind].channel,
    v.targets as TargetRef[],
  );
  return ch ? { ...v, channel: ch } : v;
}) as unknown as z.ZodType<Intent, unknown>;
