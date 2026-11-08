// One or more valid fixtures per kind, plus invalid inputs per refusal code (contract §11).
// Inputs are written without defaults; VALID holds the schema-parsed result.
import {
  INTENT_KINDS,
  type Intent,
  type IntentKind,
  IntentSchema,
} from "../kinds.js";
import type { IntentRefusalCode } from "../refusals.js";

const pc = { kind: "pc", id: "thorin" } as const;
const comp = { kind: "companion", id: "mira" } as const;
const npc = { kind: "npc", id: "goblin-2" } as const;
const dm = { kind: "dm" } as const;
const aiDm = { kind: "ai:dm" } as const;
const a = (id: string) => ({ kind: "actor", id }) as const;
const e = (id: string) => ({ kind: "entity", id }) as const;
const it = (id: string) => ({ kind: "item", id }) as const;
const z = (id: string) => ({ kind: "zone", id }) as const;
const sq = (x: number, y: number) => ({ kind: "square", x, y }) as const;

type Base = Record<string, unknown>;
/** Envelope input for a kind; fields override the defaults. */
function env(kind: string, over: Base = {}): Base {
  return {
    id: `i-${kind}`,
    kind,
    actor: pc,
    source: "composer",
    commit: "confirmed",
    ...over,
  };
}

const INPUTS: Record<IntentKind, Base[]> = {
  say: [
    env("say", { text: "Hello there." }),
    env("say", { id: "i-say-2", text: "/not a command" }),
  ],
  say_to: [
    env("say_to", { targets: [a("innkeeper")], text: "A room, please." }),
  ],
  emote: [env("emote", { text: "bows low." })],
  ask_dm: [env("ask_dm", { text: "Can I see the door from here?" })],
  ooc: [env("ooc", { text: "brb 2 min" })],
  party: [env("party", { actor: comp, text: "Left corridor is clear." })],
  whisper: [
    env("whisper", {
      channel: {
        kind: "whisper",
        to: [{ kind: "pc", id: "mira-pc" }, { kind: "dm" }],
      },
      text: "Do not trust him.",
    }),
  ],
  attempt: [
    env("attempt", { text: "I climb the rope.", commit: "declared" }),
    env("attempt", {
      id: "i-attempt-2",
      params: { scope: "party" },
      targets: [e("gate")],
      text: "We lift the gate together.",
    }),
  ],
  check: [
    env("check", { params: { skill: "stealth", dc: 15 } }),
    env("check", {
      id: "i-check-2",
      params: { ability: "str", difficulty: "hard", mode: "advantage" },
      targets: [e("door")],
    }),
  ],
  save: [
    env("save", { params: { ability: "dex", dc: 14 } }),
    env("save", {
      id: "i-save-2",
      params: { ability: "wis", difficulty: "easy" },
    }),
  ],
  contest: [
    env("contest", {
      params: { skill: "athletics", opposed: "acrobatics" },
      targets: [a("goblin-1")],
    }),
  ],
  attack: [
    env("attack", {
      params: { weapon: "Light Crossbow" },
      targets: [a("goblin-1")],
    }),
    env("attack", {
      id: "i-attack-2",
      params: { weapon: "unarmed", mode: "disadvantage" },
      targets: [e("dummy")],
      text: "I punch it",
    }),
  ],
  cast: [
    env("cast", {
      params: { spell: "magic-missile", slot: 2 },
      targets: [a("goblin-1"), a("goblin-2")],
    }),
    env("cast", {
      id: "i-cast-2",
      params: { spell: "fireball" },
      targets: [{ kind: "point", x: 62.5, y: 35 }],
    }),
  ],
  dash: [env("dash")],
  dodge: [env("dodge")],
  disengage: [env("disengage")],
  help: [
    env("help", {
      params: { assist: { kind: "check", skill: "arcana" } },
      targets: [a("mira-pc")],
    }),
    env("help", {
      id: "i-help-2",
      params: { assist: { kind: "attack" } },
      targets: [a("goblin-1")],
    }),
  ],
  hide: [env("hide")],
  ready: [
    env("ready", {
      params: {
        trigger: "the goblin steps out",
        then: {
          kind: "attack",
          targets: [a("goblin-1")],
          params: { weapon: "Shortbow" },
        },
      },
    }),
  ],
  search: [
    env("search"),
    env("search", {
      id: "i-search-2",
      params: { skill: "investigation" },
      targets: [z("study")],
    }),
  ],
  use_object: [env("use_object", { targets: [e("lever")], text: "pull it" })],
  grapple: [env("grapple", { targets: [a("goblin-1")] })],
  shove: [
    env("shove", {
      params: { effect: "prone" },
      targets: [a("goblin-1")],
      text: "off the ledge",
    }),
  ],
  move: [
    env("move", { targets: [z("ledge")] }),
    env("move", { id: "i-move-2", targets: [sq(12, 7), sq(12, 8)] }),
  ],
  stand: [env("stand")],
  drop_prone: [env("drop_prone")],
  react: [env("react", { params: { promptId: "prompt-1", choice: "attack" } })],
  end_turn: [env("end_turn")],
  predeclare: [
    env("predeclare", {
      actor: comp,
      params: {
        then: {
          kind: "attack",
          targets: [a("goblin-1")],
          params: { weapon: "unarmed" },
        },
      },
    }),
  ],
  delay: [env("delay")],
  use_item: [
    env("use_item", { targets: [it("potion-of-healing")] }),
    env("use_item", {
      id: "i-use_item-2",
      targets: [it("potion-of-healing"), a("mira-pc")],
    }),
  ],
  give: [env("give", { targets: [it("rope"), a("mira-pc")] })],
  equip: [env("equip", { targets: [it("shield")], params: { off: true } })],
  drop: [env("drop", { targets: [it("torch")] })],
  rest_short: [
    env("rest_short"),
    env("rest_short", {
      id: "i-rest_short-2",
      params: { spend: [{ die: 8, count: 2 }] },
    }),
  ],
  rest_long: [env("rest_long")],
  concentration_drop: [env("concentration_drop")],
  roll: [env("roll", { params: { requestId: "req-1" } })],
  roll_free: [
    env("roll_free", { params: { expression: "2d6+3", reason: "for fun" } }),
    env("roll_free", {
      id: "i-roll_free-2",
      channel: { kind: "dm" },
      params: { expression: "1d20" },
    }),
  ],
  level_choice: [
    env("level_choice", {
      params: { choiceId: "lvl-3-subclass", option: "evoker" },
    }),
  ],
  narrate: [
    env("narrate", { actor: aiDm, text: "Rain hammers the shutters." }),
  ],
  npc_say: [
    env("npc_say", { actor: npc, text: "Who goes there?" }),
    env("npc_say", {
      id: "i-npc_say-2",
      actor: npc,
      targets: [a("thorin")],
      text: "Halt.",
    }),
  ],
  request_roll: [
    env("request_roll", {
      actor: dm,
      targets: [a("thorin")],
      params: { roll: { kind: "check", skill: "perception" }, dc: 13 },
    }),
    env("request_roll", {
      id: "i-request_roll-2",
      actor: aiDm,
      targets: [a("thorin")],
      params: {
        roll: { kind: "save", ability: "dex" },
        difficulty: "medium",
        secret: true,
      },
    }),
  ],
  set_dc: [
    env("set_dc", { actor: dm, params: { for: "req-1", dc: 12 } }),
    env("set_dc", {
      id: "i-set_dc-2",
      actor: aiDm,
      params: { for: "req-1", difficulty: "hard" },
    }),
  ],
  apply_damage: [
    env("apply_damage", {
      actor: dm,
      targets: [a("goblin-1")],
      params: { amount: { kind: "fixed", value: 7 }, damageType: "fire" },
    }),
    env("apply_damage", {
      id: "i-apply_damage-2",
      actor: aiDm,
      targets: [a("goblin-1")],
      params: {
        amount: { kind: "roll", expression: "1d6+2" },
        damageType: "slashing",
        critical: true,
      },
    }),
  ],
  apply_heal: [
    env("apply_heal", {
      actor: dm,
      targets: [a("thorin")],
      params: { amount: { kind: "fixed", value: 5 }, temp: true },
    }),
  ],
  apply_condition: [
    env("apply_condition", {
      actor: dm,
      targets: [a("goblin-1")],
      params: { op: "add", condition: "prone" },
    }),
    env("apply_condition", {
      id: "i-apply_condition-2",
      actor: dm,
      targets: [a("goblin-1")],
      params: {
        op: "add",
        condition: "stunned",
        until: { round: 3, actor: "thorin", boundary: "turn-end" },
      },
    }),
  ],
  start_combat: [
    env("start_combat", { actor: dm }),
    env("start_combat", {
      id: "i-start_combat-2",
      actor: dm,
      targets: [a("thorin"), a("goblin-1")],
    }),
  ],
  end_combat: [env("end_combat", { actor: dm })],
  add_combatant: [
    env("add_combatant", {
      actor: dm,
      params: { from: "srd:goblin", count: 3 },
      targets: [z("hall")],
    }),
  ],
  move_token: [
    env("move_token", { actor: dm, targets: [a("goblin-1"), z("ledge")] }),
    env("move_token", {
      id: "i-move_token-2",
      actor: dm,
      targets: [a("goblin-1"), sq(3, 4), sq(3, 5)],
    }),
  ],
  reveal: [
    env("reveal", {
      actor: dm,
      targets: [e("lever")],
      params: { to: "party" },
    }),
    env("reveal", {
      id: "i-reveal-2",
      actor: dm,
      targets: [z("vault")],
      params: { to: ["thorin", "mira-pc"], block: "b1", field: "dc" },
    }),
  ],
  ruling: [
    env("ruling", {
      actor: dm,
      params: {
        requestId: "req-1",
        decision: "accept",
        dc: 14,
        reason: "fair",
      },
    }),
    env("ruling", {
      id: "i-ruling-2",
      actor: dm,
      params: {
        requestId: "req-1",
        decision: "amend",
        amend: {
          kind: "check",
          targets: [],
          params: { skill: "athletics", difficulty: "hard" },
        },
      },
    }),
  ],
  pause: [
    env("pause", { actor: dm }),
    env("pause", { id: "i-pause-2", actor: dm, params: { state: "off" } }),
  ],
  bookmark: [env("bookmark", { text: "Vault door opens" })],
  recap: [env("recap")],
  retry_narration: [
    env("retry_narration"),
    env("retry_narration", { id: "i-retry-2", params: { narrationId: "n-9" } }),
  ],
};

export const VALID = Object.fromEntries(
  INTENT_KINDS.map((k) => [k, INPUTS[k].map((i) => IntentSchema.parse(i))]),
) as Record<IntentKind, Intent[]>;

export type InvalidFixture = {
  code: IntentRefusalCode;
  name: string;
  input: unknown;
};

/** Schema refusal codes. Parse refusal inputs join this list in Phase 3 (T011). */
export const INVALID: InvalidFixture[] = [
  { code: "INTENT_SCHEMA", name: "unknown kind", input: env("teleport") },
  {
    code: "INTENT_SCHEMA",
    name: "unknown key",
    input: { ...env("dash"), bogus: 1 },
  },
  {
    code: "INTENT_SCHEMA",
    name: "bad id",
    input: { ...env("dash"), id: "Bad Id" },
  },
  { code: "INTENT_SCHEMA", name: "speech without text", input: env("say") },
  {
    code: "INTENT_SCHEMA",
    name: "check without skill or ability",
    input: env("check", { params: {} }),
  },
  {
    code: "INTENT_SCHEMA",
    name: "check with dc and difficulty",
    input: env("check", {
      params: { skill: "stealth", dc: 10, difficulty: "easy" },
    }),
  },
  {
    code: "INTENT_SCHEMA",
    name: "dc out of range",
    input: env("save", { params: { ability: "dex", dc: 41 } }),
  },
  {
    code: "INTENT_SCHEMA",
    name: "attack with no target",
    input: env("attack", { params: { weapon: "unarmed" } }),
  },
  {
    code: "INTENT_SCHEMA",
    name: "too many targets",
    input: env("attempt", {
      text: "x",
      targets: [a("a"), a("b"), a("c"), a("d"), a("e")],
    }),
  },
  {
    code: "INTENT_SCHEMA",
    name: "wrong target kind",
    input: env("grapple", { targets: [e("rock")] }),
  },
  {
    code: "INTENT_SCHEMA",
    name: "nested ready",
    input: env("ready", {
      params: {
        trigger: "t",
        then: { kind: "ready", targets: [], params: {} },
      },
    }),
  },
  {
    code: "INTENT_SCHEMA",
    name: "nested predeclare",
    input: env("predeclare", {
      params: { then: { kind: "predeclare", targets: [], params: {} } },
    }),
  },
  {
    code: "INTENT_SCHEMA",
    name: "amend without amend body",
    input: env("ruling", {
      actor: dm,
      params: { requestId: "r", decision: "amend" },
    }),
  },
  {
    code: "INTENT_SCHEMA",
    name: "npc_say by non-npc",
    input: env("npc_say", { actor: dm, text: "hi" }),
  },
  {
    code: "INTENT_SCHEMA",
    name: "whisper without recipients",
    input: env("whisper", { text: "psst" }),
  },
  {
    code: "INTENT_CHANNEL_MISMATCH",
    name: "say on party channel",
    input: env("say", { text: "hi", channel: { kind: "party" } }),
  },
  {
    code: "INTENT_CHANNEL_MISMATCH",
    name: "check carries a channel",
    input: env("check", {
      params: { skill: "stealth" },
      channel: { kind: "scene" },
    }),
  },
  {
    code: "MODEL_NUMBER",
    name: "ai:dm set_dc with dc",
    input: env("set_dc", { actor: aiDm, params: { for: "r", dc: 15 } }),
  },
  {
    code: "MODEL_NUMBER",
    name: "ai:dm ruling with dc",
    input: env("ruling", {
      actor: aiDm,
      params: { requestId: "r", decision: "accept", dc: 15 },
    }),
  },
  {
    code: "MODEL_NUMBER",
    name: "ai:dm fixed damage",
    input: env("apply_damage", {
      actor: aiDm,
      targets: [a("g")],
      params: { amount: { kind: "fixed", value: 4 }, damageType: "fire" },
    }),
  },
  {
    code: "MODEL_NUMBER",
    name: "ai:dm fixed heal",
    input: env("apply_heal", {
      actor: aiDm,
      targets: [a("g")],
      params: { amount: { kind: "fixed", value: 4 } },
    }),
  },
  {
    code: "MODEL_NUMBER",
    name: "ai:dm request_roll with dc",
    input: env("request_roll", {
      actor: aiDm,
      targets: [a("g")],
      params: { roll: { kind: "initiative" }, dc: 12 },
    }),
  },
];
