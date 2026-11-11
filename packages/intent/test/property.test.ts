// Seeded property, totality and latency tests (plan "Test strategy"). The seed is logged on failure.
import { describe, expect, it } from "vitest";
import {
  INTENT_KINDS,
  type Intent,
  type IntentKind,
  IntentSchema,
  KIND_RULES,
  parse,
  toText,
} from "../src/index.js";

const SEED = Number(process.env.INTENT_SEED ?? 0x5eed1);
const PER_KIND = Number(process.env.INTENT_PER_KIND ?? 1000);

/** mulberry32: small seeded PRNG, no dependency. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type R = () => number;
const int = (r: R, lo: number, hi: number) =>
  lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: R, xs: readonly T[]): T =>
  xs[int(r, 0, xs.length - 1)] as T;
const chance = (r: R, p = 0.5) => r() < p;

const ID_CH = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_TAIL = `${ID_CH}_.:-`;
const id = (r: R) => {
  let s = pick(r, [...ID_CH]);
  for (let n = int(r, 0, 10); n > 0; n--) s += pick(r, [...ID_TAIL]);
  return chance(r, 0.05) ? pick(r, ["dm", "party", "to", "x"]) : s;
};
const slug = (r: R) =>
  Array.from({ length: int(r, 1, 3) }, () =>
    pick(r, ["a", "b2", "fire", "x9"]),
  ).join("-");
const NASTY = [..."/@&$#()*\"\\-+=,. :\t'é"];
const text = (r: R, max = 80) => {
  let s = "";
  for (let n = int(r, 1, max); n > 0; n--)
    s += chance(r, 0.4) ? pick(r, NASTY) : pick(r, [..."abc XYZ019"]);
  s = s.trim();
  return s === "" ? "x" : s;
};
const SKILLS = [
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
];
const ABIL = ["str", "dex", "con", "int", "wis", "cha"];
const DIFF = [
  "very-easy",
  "easy",
  "medium",
  "hard",
  "very-hard",
  "nearly-impossible",
];
const DMG = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
];
const COND = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
];
const MODE = ["normal", "advantage", "disadvantage"];
const dice = (r: R) =>
  pick(r, [
    "1d20",
    "2d6+3",
    "d8",
    "4d6-1",
    "1d4+1d6",
    "10",
    "(1d6)",
    "a b",
    '1"2',
    "2d6 + 3",
  ]);
const dcOrDiff = (r: R, mode: "opt" | "one" | "none" = "opt") => {
  const c = mode === "one" ? int(r, 1, 2) : mode === "none" ? 0 : int(r, 0, 2);
  return c === 1
    ? { dc: int(r, 1, 40) }
    : c === 2
      ? { difficulty: pick(r, DIFF) }
      : {};
};
const target = (r: R, kind: string) =>
  kind === "square"
    ? { kind, x: int(r, 0, 999), y: int(r, 0, 999) }
    : kind === "point"
      ? {
          kind,
          x: pick(r, [
            0,
            62.5,
            35,
            4995,
            int(r, 0, 4995),
            int(r, 0, 99999) / 20,
          ]),
          y: pick(r, [0, 1.25, 4995, int(r, 0, 4995)]),
        }
      : { kind, id: id(r) };

function targets(r: R, kind: IntentKind): unknown[] {
  const rule = KIND_RULES[kind].targets;
  const n = (lo: number, hi: number) => int(r, lo, Math.min(hi, lo + 3));
  const list = (ks: readonly string[], lo: number, hi: number) =>
    Array.from({ length: n(lo, hi) }, () => target(r, pick(r, ks)));
  switch (rule.shape) {
    case "list":
      return list(rule.kinds, rule.min, rule.max);
    case "cast":
      return chance(r, 0.3)
        ? [target(r, pick(r, ["zone", "point"]))]
        : list(["actor"], 0, 12);
    case "move":
      return chance(r, 0.5) ? [target(r, "zone")] : list(["square"], 1, 60);
    case "item-actor":
      return [
        target(r, "item"),
        ...list(["actor"], rule.min - 1, rule.max - 1),
      ];
    case "actor-dest":
      return [
        target(r, "actor"),
        ...(chance(r, 0.5) ? [target(r, "zone")] : list(["square"], 1, 60)),
      ];
  }
}

const readyKinds = [
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
] as const;
const predKinds = INTENT_KINDS.filter((k) =>
  ["combat", "movement", "resource", "check"].includes(KIND_RULES[k].group),
);

/** A nested body: no envelope. `withText` is set for IntentBody (ruling.amend). */
function body(
  r: R,
  kinds: readonly IntentKind[],
  withText: boolean,
  depth: number,
): unknown {
  const k = pick(r, kinds);
  const out: Record<string, unknown> = {
    kind: k,
    targets: targets(r, k),
    params: params(r, k, depth),
  };
  if (withText && (KIND_RULES[k].text === "required" || chance(r, 0.3)))
    out.text = text(r);
  return out;
}

function params(r: R, k: IntentKind, depth = 0): Record<string, unknown> {
  const sa = () => {
    const c = int(r, 0, 2);
    return c === 0
      ? { skill: pick(r, SKILLS) }
      : c === 1
        ? { ability: pick(r, ABIL) }
        : { skill: pick(r, SKILLS), ability: pick(r, ABIL) };
  };
  const mode = () => (chance(r) ? { mode: pick(r, MODE) } : {});
  const amount = () =>
    chance(r)
      ? { kind: "fixed", value: int(r, 0, 10000) }
      : { kind: "roll", expression: dice(r) };
  switch (k) {
    case "attempt":
      return chance(r) ? { scope: pick(r, ["character", "party"]) } : {};
    case "check":
      return { ...sa(), ...mode(), ...dcOrDiff(r) };
    case "save":
      return { ability: pick(r, ABIL), ...mode(), ...dcOrDiff(r) };
    case "contest":
      return {
        ...sa(),
        ...(chance(r) ? { opposed: pick(r, [...SKILLS, ...ABIL]) } : {}),
        ...mode(),
      };
    case "attack":
      return {
        weapon: pick(r, [
          "unarmed",
          "Light Crossbow",
          "sword",
          'a"b',
          "x\\y",
          "7",
          "-- x",
          "@g",
        ]),
        ...mode(),
      };
    case "cast":
      return {
        spell: slug(r),
        ...(chance(r) ? { slot: int(r, 1, 9) } : {}),
        ...mode(),
      };
    case "help":
      return {
        assist: chance(r)
          ? { kind: "attack" }
          : { kind: "check", skill: pick(r, SKILLS) },
      };
    case "ready":
      return {
        trigger: text(r, 40),
        then: body(r, readyKinds, false, depth + 1),
      };
    case "search":
      return chance(r)
        ? { skill: pick(r, ["perception", "investigation"]) }
        : {};
    case "shove":
      return { effect: pick(r, ["prone", "push"]) };
    case "react":
      return { promptId: id(r), choice: slug(r) };
    case "predeclare":
      return { then: body(r, predKinds, false, depth + 1) };
    case "equip":
      return chance(r) ? { off: chance(r) } : {};
    case "rest_short":
      return chance(r)
        ? {
            spend: Array.from({ length: int(r, 0, 4) }, () => ({
              die: pick(r, [6, 8, 10, 12]),
              count: int(r, 1, 20),
            })),
          }
        : {};
    case "roll":
      return { requestId: id(r) };
    case "roll_free":
      return {
        expression: dice(r),
        ...(chance(r)
          ? {
              reason: pick(r, [
                text(r, 30),
                ` ${text(r, 10)} `,
                "a  b",
                "x -- y",
              ]),
            }
          : {}),
      };
    case "level_choice":
      return { choiceId: id(r), option: slug(r) };
    case "request_roll": {
      const c = int(r, 0, 3);
      const roll =
        c === 0
          ? { kind: "check", ...sa() }
          : c === 1
            ? { kind: "save", ability: pick(r, ABIL) }
            : c === 2
              ? { kind: "death-save" }
              : { kind: "initiative" };
      return {
        roll,
        ...mode(),
        ...dcOrDiff(r),
        ...(chance(r) ? { secret: chance(r) } : {}),
      };
    }
    case "set_dc":
      return { for: id(r), ...dcOrDiff(r, "one") };
    case "apply_damage":
      return {
        amount: amount(),
        damageType: pick(r, DMG),
        ...(chance(r) ? { critical: chance(r) } : {}),
      };
    case "apply_heal":
      return { amount: amount(), ...(chance(r) ? { temp: chance(r) } : {}) };
    case "apply_condition":
      return {
        op: pick(r, ["add", "remove"]),
        condition: pick(r, COND),
        ...(chance(r)
          ? {
              until: {
                round: int(r, 1, 99),
                actor: id(r),
                boundary: pick(r, ["turn-start", "turn-end"]),
              },
            }
          : {}),
      };
    case "add_combatant":
      return { from: id(r), ...(chance(r) ? { count: int(r, 1, 12) } : {}) };
    case "reveal":
      return {
        to: chance(r)
          ? "party"
          : Array.from({ length: int(r, 1, 8) }, () => id(r)),
        ...(chance(r) ? { block: id(r) } : {}),
        ...(chance(r) ? { field: slug(r) } : {}),
      };
    case "ruling": {
      const amend = chance(r, 0.4);
      return {
        requestId: id(r),
        decision: amend ? "amend" : pick(r, ["accept", "reject"]),
        ...dcOrDiff(r),
        ...(amend
          ? {
              amend: body(
                r,
                INTENT_KINDS.filter((x) => x !== "ruling" && x !== "whisper"),
                true,
                depth + 1,
              ),
            }
          : {}),
        ...(chance(r)
          ? { reason: pick(r, [text(r, 30), ` ${text(r, 10)} `, "x -- y"]) }
          : {}),
      };
    }
    case "pause":
      return chance(r) ? { state: pick(r, ["on", "off"]) } : {};
    case "retry_narration":
      return chance(r) ? { narrationId: id(r) } : {};
    default:
      return {};
  }
}

function actorFor(r: R, k: IntentKind) {
  const seats = KIND_RULES[k].seats;
  const s = pick(r, seats);
  if (k === "npc_say") return { kind: "npc", id: id(r) };
  const opts =
    s === "player"
      ? [{ kind: "pc", id: id(r) }]
      : s === "companion"
        ? [{ kind: "companion", id: id(r) }]
        : s === "dm"
          ? [{ kind: "dm" }, { kind: "npc", id: id(r) }]
          : [{ kind: "ai:dm" }, { kind: "npc", id: id(r) }];
  return pick(r, opts);
}

function gen(r: R, k: IntentKind): unknown {
  const rule = KIND_RULES[k];
  const tg = targets(r, k);
  const o: Record<string, unknown> = {
    id: id(r),
    kind: k,
    actor: actorFor(r, k),
    targets: tg,
    params: params(r, k),
    source: pick(r, [
      "composer",
      "bar",
      "sheet",
      "map",
      "tracker",
      "console",
      "ai",
      "adapter",
    ]),
    commit: pick(r, ["declared", "confirmed"]),
  };
  if (rule.text === "required" || chance(r, 0.3))
    o.text = text(r, k === "bookmark" ? 40 : 200);
  if (k === "whisper")
    o.channel = {
      kind: "whisper",
      to: Array.from({ length: int(r, 1, 8) }, () =>
        chance(r, 0.3) ? { kind: "dm" } : { kind: "pc", id: id(r) },
      ),
    };
  if (k === "roll_free" && chance(r)) o.channel = { kind: "dm" };
  return o;
}

const ctxOf = (i: Intent) => ({
  id: i.id,
  actor: i.actor,
  source: i.source,
  commit: i.commit,
});

describe(`property (seed ${SEED}, ${PER_KIND} per kind)`, () => {
  for (const k of INTENT_KINDS)
    it(`${k}: generated Intents round-trip and canonicalise`, () => {
      const r = rng(SEED ^ (INTENT_KINDS.indexOf(k) * 0x9e3779b1));
      let n = 0;
      let discards = 0;
      for (let t = 0; n < PER_KIND && t < PER_KIND * 3; t++) {
        const raw = gen(r, k);
        const v = IntentSchema.safeParse(raw);
        if (!v.success) {
          discards++; // ai:dm model numbers and similar; the generator is allowed a few
          continue;
        }
        n++;
        const i = v.data;
        const txt = toText(i);
        const back = parse(txt, ctxOf(i));
        const info = `seed=${SEED} kind=${k} text=${JSON.stringify(txt)} input=${JSON.stringify(raw)}`;
        if (!back.ok)
          throw new Error(
            `${info} refusal=${back.refusal.code} ${back.refusal.message}`,
          );
        expect(back.intent, info).toEqual(i);
        expect(toText(back.intent), info).toBe(txt);
      }
      expect(
        n,
        `generator produced too few valid ${k} (${discards} discards)`,
      ).toBe(PER_KIND);
    });
});

describe("totality", () => {
  it("parse never throws on 10 000 random strings", () => {
    const r = rng(SEED + 1);
    const atoms = [
      "/",
      "@",
      "&",
      "$",
      "#",
      "((",
      "))",
      '"',
      "\\",
      "*",
      "--",
      " ",
      " ",
      "=",
      "+",
      ",",
      "sq:",
      "pt:",
      "1,2",
      "dc=",
      "/as ",
      "/ready ",
      "/next ",
      "/rule ",
      "amend ",
      "with ",
      "vs ",
      "x",
      "dm",
      "attack",
      "dash",
      "1d20",
      "\n",
      "\t",
      "é",
      "😀",
    ];
    for (let n = 0; n < 10000; n++) {
      let s = "";
      for (let m = int(r, 0, 30); m > 0; m--)
        s += chance(r, 0.7) ? pick(r, atoms) : pick(r, [..."abcxyz019_-.:"]);
      if (chance(r, 0.02)) s = s.repeat(40).slice(0, 4000 + int(r, 0, 10));
      for (const actor of [{ kind: "pc", id: "p" }, { kind: "dm" }] as const) {
        let res: ReturnType<typeof parse> | undefined;
        try {
          res = parse(s, {
            id: "i",
            actor,
            source: "composer",
            commit: "confirmed",
          });
        } catch (e) {
          throw new Error(
            `seed=${SEED + 1} threw on ${JSON.stringify(s)}: ${String(e)}`,
          );
        }
        expect(
          res.ok || typeof res.refusal.code === "string",
          JSON.stringify(s),
        ).toBe(true);
        // a successful parse re-parses from its own canonical text (rule 4)
        if (res.ok) {
          const t = toText(res.intent);
          const again = parse(t, ctxOf(res.intent));
          expect(
            again.ok && toText(again.intent),
            `${JSON.stringify(s)} -> ${JSON.stringify(t)}`,
          ).toBe(t);
        }
      }
    }
  });
});
