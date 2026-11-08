// Contract §8: parse(text, ctx). Total over every string: it returns a refusal and never throws.
// Pure: no model call, no I/O. Names resolve only through ctx.resolve (rule 10).
import {
  BODY_KINDS,
  type Intent,
  type IntentKind,
  IntentSchema,
  KIND_RULES,
  PREDECLARABLE_KINDS,
  READYABLE_KINDS,
} from "../kinds.js";
import type { ActorRef, Channel, Commit, Source, TargetRef } from "../refs.js";
import { type IntentRefusalCode, schemaRefusalCode } from "../refusals.js";
import { AbilitySchema, DifficultySchema, SkillSchema } from "../scalars.js";
import {
  Cur,
  firstChunk,
  isQuoted,
  isTargetTok,
  parseTarget,
  Refuse,
  type Resolver,
  readToken,
  refuse,
  scan,
  type Tok,
  unq,
} from "./tokens.js";

export type ParseContext = {
  id: string;
  actor: ActorRef;
  source: Source;
  commit: Commit;
  resolve?: Resolver;
};
export type ParseRefusal = {
  code: IntentRefusalCode;
  message: string;
  details?: Record<string, unknown>;
};
export type ParseResult =
  | { ok: true; intent: Intent }
  | { ok: false; refusal: ParseRefusal };

// biome-ignore lint/suspicious/noExplicitAny: params differ per kind; IntentSchema validates them
type P = Record<string, any>;
type Body = {
  kind: string;
  targets: TargetRef[];
  params: P;
  text?: string;
  channel?: Channel;
};
type Ctx = ParseContext;

const lc = (s: string) => s.toLowerCase();
const clean = (o: P): P =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// --- Argument bag: positionals, +flags and key=value pairs -------------------

class Args {
  pos: Tok[] = [];
  flags = new Set<string>();
  kvs = new Map<string, string>();
  kvRaw = new Map<string, string>();
  constructor(toks: Tok[]) {
    for (const t of toks) {
      const kv = !isQuoted(t) && /^([A-Za-z][A-Za-z-]*)=/s.exec(t.raw);
      if (!isQuoted(t) && /^\+./.test(t.raw))
        this.flags.add(lc(t.raw.slice(1)));
      else if (kv) {
        const key = lc(kv[1] as string);
        if (this.kvs.has(key))
          refuse("PARSE_UNEXPECTED_TOKEN", `duplicate ${key}=`);
        this.kvRaw.set(key, t.raw.slice(kv[0].length));
        this.kvs.set(key, unq(t.raw.slice(kv[0].length)));
      } else this.pos.push(t);
    }
  }
  flag(n: string): boolean {
    return this.flags.delete(n);
  }
  kv(k: string): string | undefined {
    const v = this.kvs.get(k);
    this.kvs.delete(k);
    return v;
  }
  mode(): "advantage" | "disadvantage" | undefined {
    const a = this.flag("adv");
    const d = this.flag("dis");
    if (a && d) refuse("PARSE_BAD_VALUE", "+adv and +dis together");
    return a ? "advantage" : d ? "disadvantage" : undefined;
  }
  dc(): P {
    const dc = this.kv("dc");
    const diff = this.kv("diff");
    return {
      dc: dc === undefined ? undefined : int(dc, "dc"),
      difficulty:
        diff === undefined ? undefined : oneOf(DifficultySchema, diff),
    };
  }
  next(what: string): Tok {
    return (
      this.pos.shift() ?? refuse("PARSE_MISSING_ARGUMENT", `missing ${what}`)
    );
  }
  peekWord(): string | undefined {
    const t = this.pos[0];
    return t && !isQuoted(t) ? lc(t.val) : undefined;
  }
  word(what: string): string {
    return this.next(what).val;
  }
  /** Leading positionals up to (not including) the first unquoted `stops` word. */
  until(stops: readonly string[]): Tok[] {
    const i = this.pos.findIndex(
      (t) => !isQuoted(t) && stops.includes(lc(t.val)),
    );
    return this.pos.splice(0, i < 0 ? this.pos.length : i);
  }
  done(): void {
    const extra = [
      ...this.pos.map((t) => t.raw),
      ...[...this.flags].map((f) => `+${f}`),
      ...[...this.kvs.keys()].map((k) => `${k}=`),
    ];
    if (extra.length > 0)
      refuse("PARSE_UNEXPECTED_TOKEN", `unexpected: ${extra[0]}`);
  }
}

function int(s: string, what: string): number {
  if (!/^\d+$/.test(s)) refuse("PARSE_BAD_VALUE", `bad ${what}: ${s}`);
  return Number(s);
}
function oneOf<T extends string>(
  schema: { safeParse(v: unknown): { success: boolean; data?: unknown } },
  v: string,
): T {
  const r = schema.safeParse(lc(v));
  if (!r.success) refuse("PARSE_BAD_VALUE", `bad value: ${v}`);
  return r.data as T;
}

const targetsOf = (toks: Tok[], ctx: Ctx) =>
  toks.map((t) => parseTarget(t, ctx.resolve));
/** One target from a token; a missing token is a refusal. */
const one = (t: Tok | undefined, ctx: Ctx) =>
  parseTarget(
    t ?? refuse("PARSE_MISSING_ARGUMENT", "missing target"),
    ctx.resolve,
  );

/** `<skill|ability>` plus the optional `ability=` key (contract §8.2 check, contest). */
function skillOrAbility(a: Args, what: string): P {
  const w = lc(a.word(what));
  const extra = a.kv("ability");
  const ab = extra === undefined ? undefined : oneOf(AbilitySchema, extra);
  if (SkillSchema.safeParse(w).success) return { skill: w, ability: ab };
  if (AbilitySchema.safeParse(w).success) {
    if (ab !== undefined) refuse("PARSE_BAD_VALUE", "two abilities");
    return { ability: w };
  }
  return refuse("PARSE_BAD_VALUE", `not a skill or ability: ${w}`);
}

// --- Verb table ------------------------------------------------------------

type R = { rest: string; ctx: Ctx };
type Handler = (r: R) => Body;

/** Head tokens plus trailing text for a mechanical kind. */
function mech(rest: string): { a: Args; text?: string } {
  const sc = scan(rest);
  return { a: new Args(sc.toks), text: sc.text };
}
const mk = (
  kind: string,
  targets: TargetRef[],
  params: P,
  text?: string,
): Body => clean({ kind, targets, params: clean(params), text }) as Body;
const bodyText = (rest: string): string =>
  rest === "" ? refuse("PARSE_MISSING_ARGUMENT", "missing text") : rest;
/** A verb with no arguments. */
const bare =
  (kind: string, params: P = {}): Handler =>
  ({ rest }) => {
    const { a, text } = mech(rest);
    a.done();
    return mk(kind, [], params, text);
  };
/** A verb whose arguments are a target list. */
const withTargets =
  (kind: string, params: (a: Args) => P = () => ({})): Handler =>
  ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const p = params(a);
    const t = targetsOf(a.pos.splice(0), ctx);
    a.done();
    return mk(kind, t, p, text);
  };

function npcSay(rest: string, ctx: Ctx): Body {
  const c = firstChunk(rest);
  let text = rest;
  const targets: TargetRef[] = [];
  if (c.startsWith("@")) {
    const [t, end] = readToken(rest, 0);
    targets.push(parseTarget(t, ctx.resolve));
    text = rest.slice(end).trim();
  }
  if (firstChunk(text) === "--") text = text.slice(2).trim();
  return mk("npc_say", targets, {}, bodyText(text));
}

const recipient = (raw: string, ctx: Ctx) => {
  if (lc(raw) === "@dm") return { kind: "dm" } as const;
  const [t] = readToken(raw, 0);
  const r = parseTarget(t, ctx.resolve);
  if (r.kind !== "actor") refuse("PARSE_BAD_TARGET", `not a recipient: ${raw}`);
  return { kind: "pc", id: r.id } as const;
};

const VERBS: Record<string, Handler> = {
  say: ({ rest }) => mk("say", [], {}, bodyText(rest)),
  to: ({ rest, ctx }) => {
    const [t, end] = readToken(rest, 0);
    if (t.raw === "") return refuse("PARSE_MISSING_ARGUMENT", "missing target");
    return mk(
      "say_to",
      [parseTarget(t, ctx.resolve)],
      {},
      bodyText(rest.slice(end).trim()),
    );
  },
  me: ({ rest }) => mk("emote", [], {}, bodyText(rest)),
  ask: ({ rest }) => mk("ask_dm", [], {}, bodyText(rest)),
  ooc: ({ rest }) => mk("ooc", [], {}, bodyText(rest)),
  p: ({ rest }) => mk("party", [], {}, bodyText(rest)),
  w: ({ rest, ctx }) => {
    const c = firstChunk(rest);
    if (c === "") return refuse("PARSE_MISSING_ARGUMENT", "missing recipients");
    const to = c.split(",").map((x) => recipient(x, ctx));
    const body = mk("whisper", [], {}, bodyText(rest.slice(c.length).trim()));
    body.channel = { kind: "whisper", to };
    return body;
  },
  do: ({ rest, ctx }) => {
    const cur = new Cur(rest);
    const params: P = {};
    const targets: TargetRef[] = [];
    // Chunk-peek only: the text after the targets is never tokenised.
    for (;;) {
      const save = cur.pos;
      const c = firstChunk(cur.rest());
      if (c === "") break;
      if (
        lc(c) === "+party" &&
        targets.length === 0 &&
        params.scope === undefined
      ) {
        cur.next();
        params.scope = "party";
      } else if (/^[@&$#]/.test(c) || /^(sq|pt):.*,/i.test(c)) {
        const t = cur.next() as Tok;
        if (!isTargetTok(t)) {
          cur.pos = save;
          break;
        }
        targets.push(parseTarget(t, ctx.resolve));
      } else break;
    }
    let text = cur.rest();
    if (firstChunk(text) === "--") text = text.slice(2).trim();
    return mk("attempt", targets, params, bodyText(text));
  },
  check: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const sa = skillOrAbility(a, "skill or ability");
    const t = a.pos.length > 0 ? [one(a.pos.shift(), ctx)] : [];
    return finish(
      a,
      mk("check", t, { ...sa, mode: a.mode(), ...a.dc() }, text),
    );
  },
  save: ({ rest }) => {
    const { a, text } = mech(rest);
    const ability = oneOf(AbilitySchema, a.word("ability"));
    return finish(
      a,
      mk("save", [], { ability, mode: a.mode(), ...a.dc() }, text),
    );
  },
  contest: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const sa = skillOrAbility(a, "skill or ability");
    const t = one(a.pos.shift(), ctx);
    let opposed: string | undefined;
    if (a.peekWord() === "vs") {
      a.pos.shift();
      const o = lc(a.word("opposed"));
      if (
        !SkillSchema.safeParse(o).success &&
        !AbilitySchema.safeParse(o).success
      )
        refuse("PARSE_BAD_VALUE", `not a skill or ability: ${o}`);
      opposed = o;
    }
    return finish(
      a,
      mk("contest", [t], { ...sa, opposed, mode: a.mode() }, text),
    );
  },
  attack: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const mode = a.mode();
    let target: Tok | undefined;
    let weapon: string;
    if (a.pos[1] && !isQuoted(a.pos[1]) && lc(a.pos[1].val) === "with") {
      target = a.pos.shift();
      a.pos.shift();
      weapon = a.word("weapon");
    } else {
      // alias: /attack <weapon> <target>
      weapon = a.word("weapon");
      target = a.pos.shift();
    }
    return finish(a, mk("attack", [one(target, ctx)], { weapon, mode }, text));
  },
  cast: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const spell = a.word("spell");
    const slot = a.kv("slot");
    const mode = a.mode();
    const t = targetsOf(a.pos.splice(0), ctx);
    return finish(
      a,
      mk(
        "cast",
        t,
        {
          spell,
          slot: slot === undefined ? undefined : int(slot, "slot"),
          mode,
        },
        text,
      ),
    );
  },
  dash: bare("dash"),
  dodge: bare("dodge"),
  disengage: bare("disengage"),
  hide: bare("hide"),
  delay: bare("delay"),
  stand: bare("stand"),
  prone: bare("drop_prone"),
  end: bare("end_turn"),
  "end-turn": bare("end_turn"),
  recap: bare("recap"),
  "drop-concentration": bare("concentration_drop"),
  help: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    if (a.peekWord() === "attack") {
      a.pos.shift();
      return finish(
        a,
        mk(
          "help",
          [one(a.pos.shift(), ctx)],
          { assist: { kind: "attack" } },
          text,
        ),
      );
    }
    const t = one(a.pos.shift(), ctx);
    const skill = oneOf(SkillSchema, a.word("skill"));
    return finish(
      a,
      mk("help", [t], { assist: { kind: "check", skill } }, text),
    );
  },
  ready: ({ rest, ctx }) => nestedHolder("ready", rest, ctx, READYABLE_KINDS),
  next: ({ rest, ctx }) =>
    nestedHolder("predeclare", rest, ctx, PREDECLARABLE_KINDS),
  predeclare: ({ rest, ctx }) =>
    nestedHolder("predeclare", rest, ctx, PREDECLARABLE_KINDS),
  search: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const last = a.pos[a.pos.length - 1];
    const skill =
      last && !isQuoted(last) && /^(investigation|perception)$/i.test(last.raw)
        ? lc((a.pos.pop() as Tok).val)
        : undefined;
    const t = targetsOf(a.pos.splice(0), ctx);
    return finish(a, mk("search", t, { skill }, text));
  },
  utilize: withTargets("use_object"),
  "use-object": withTargets("use_object"),
  grapple: withTargets("grapple"),
  shove: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const t = one(a.pos.shift(), ctx);
    const effect = oneOf(
      {
        safeParse: (v: unknown) => ({
          success: v === "prone" || v === "push",
          data: v,
        }),
      },
      a.word("effect"),
    );
    return finish(a, mk("shove", [t], { effect }, text));
  },
  move: withTargets("move"),
  react: ({ rest }) => {
    const { a, text } = mech(rest);
    const promptId = a.word("promptId");
    const choice = a.word("choice");
    return finish(a, mk("react", [], { promptId, choice }, text));
  },
  use: withTargets("use_item"),
  give: withTargets("give"),
  equip: withTargets("equip", (a) => ({
    off: a.flag("off") ? true : undefined,
  })),
  drop: withTargets("drop"),
  rest: ({ rest }) => {
    const { a, text } = mech(rest);
    const w = a.peekWord();
    if (w === "long") {
      a.pos.shift();
      return finish(a, mk("rest_long", [], {}, text));
    }
    if (w !== "short") return refuse("PARSE_BAD_VALUE", "rest short|long");
    a.pos.shift();
    const spend = a.kv("spend");
    const list =
      spend === undefined
        ? undefined
        : spend.split(",").map((x) => {
            const m = /^(\d+)d(\d+)$/i.exec(x);
            if (!m) return refuse("PARSE_BAD_VALUE", `bad spend: ${x}`);
            return { count: Number(m[1]), die: Number(m[2]) };
          });
    return finish(a, mk("rest_short", [], { spend: list }, text));
  },
  roll: ({ rest }) => {
    const { a, text } = mech(rest);
    return finish(a, mk("roll", [], { requestId: a.word("requestId") }, text));
  },
  r: (r) => rollFree(r, false),
  gr: (r) => rollFree(r, true),
  level: ({ rest }) => {
    const { a, text } = mech(rest);
    const choiceId = a.word("choiceId");
    return finish(
      a,
      mk("level_choice", [], { choiceId, option: a.word("option") }, text),
    );
  },
  desc: ({ rest }) => mk("narrate", [], {}, bodyText(rest)),
  npc: ({ rest, ctx }) => npcSay(rest, ctx),
  request: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const t = targetsOf(
      a.until(["check", "save", "death-save", "initiative"]),
      ctx,
    );
    const w = lc(a.word("roll"));
    let roll: P;
    if (w === "check")
      roll = { kind: "check", ...skillOrAbility(a, "skill or ability") };
    else if (w === "save")
      roll = { kind: "save", ability: oneOf(AbilitySchema, a.word("ability")) };
    else roll = { kind: w };
    const params = {
      roll: clean(roll),
      mode: a.mode(),
      ...a.dc(),
      secret: a.flag("secret") ? true : undefined,
    };
    return finish(a, mk("request_roll", t, params, text));
  },
  dc: ({ rest }) => {
    const { a, text } = mech(rest);
    const f = a.word("id");
    const v = a.next("dc or tier");
    const p =
      !isQuoted(v) && /^\d+$/.test(v.val)
        ? { dc: Number(v.val) }
        : { difficulty: oneOf(DifficultySchema, v.val) };
    return finish(a, mk("set_dc", [], { for: f, ...p }, text));
  },
  damage: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const crit = a.flag("crit");
    const tail = a.pos.splice(-2);
    if (tail.length < 2)
      return refuse("PARSE_MISSING_ARGUMENT", "missing amount or type");
    const [amt, type] = tail as [Tok, Tok];
    const t = targetsOf(a.pos.splice(0), ctx);
    return finish(
      a,
      mk(
        "apply_damage",
        t,
        {
          amount: amountOf(amt),
          damageType: lc(type.val),
          critical: crit ? true : undefined,
        },
        text,
      ),
    );
  },
  heal: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const temp = a.flag("temp");
    const amt =
      a.pos.pop() ?? refuse("PARSE_MISSING_ARGUMENT", "missing amount");
    const t = targetsOf(a.pos.splice(0), ctx);
    return finish(
      a,
      mk(
        "apply_heal",
        t,
        { amount: amountOf(amt), temp: temp ? true : undefined },
        text,
      ),
    );
  },
  condition: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const until = a.kv("until");
    const tail = a.pos.splice(-2);
    if (tail.length < 2)
      return refuse("PARSE_MISSING_ARGUMENT", "missing op or condition");
    const [op, cond] = tail as [Tok, Tok];
    const t = targetsOf(a.pos.splice(0), ctx);
    let u: P | undefined;
    if (until !== undefined) {
      const m = /^r(\d+)\.(.+)\.(start|end)$/i.exec(until);
      if (!m) return refuse("PARSE_BAD_VALUE", `bad until: ${until}`);
      u = {
        round: Number(m[1]),
        actor: m[2],
        boundary: lc(m[3] as string) === "start" ? "turn-start" : "turn-end",
      };
    }
    return finish(
      a,
      mk(
        "apply_condition",
        t,
        { op: lc(op.val), condition: lc(cond.val), until: u },
        text,
      ),
    );
  },
  combat: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const w = lc(a.word("start|end"));
    if (w === "end") return finish(a, mk("end_combat", [], {}, text));
    if (w !== "start") return refuse("PARSE_BAD_VALUE", "combat start|end");
    return finish(
      a,
      mk("start_combat", targetsOf(a.pos.splice(0), ctx), {}, text),
    );
  },
  add: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const from = a.word("from");
    let count: number | undefined;
    const zs: Tok[] = [];
    for (const t of a.pos.splice(0)) {
      if (!isQuoted(t) && /^x\d+$/i.test(t.raw))
        count = int(t.raw.slice(1), "count");
      else zs.push(t);
    }
    return finish(
      a,
      mk("add_combatant", targetsOf(zs, ctx), { from, count }, text),
    );
  },
  place: withTargets("move_token"),
  reveal: ({ rest, ctx }) => {
    const { a, text } = mech(rest);
    const toRaw = a.kvRaw.get("to");
    const to = a.kv("to") ?? refuse("PARSE_MISSING_ARGUMENT", "missing to=");
    const block = a.kv("block");
    const field = a.kv("field");
    const t = targetsOf(a.pos.splice(0), ctx);
    const list = /^party$/i.test(toRaw ?? "")
      ? "party"
      : (toRaw ?? to).split(",").map((x) => unq(x));
    return finish(a, mk("reveal", t, { to: list, block, field }, text));
  },
  rule: ({ rest, ctx }) => rule(rest, ctx),
  pause: ({ rest }) => {
    const { a, text } = mech(rest);
    const w = a.peekWord();
    if (w === "off" || w === "on") a.pos.shift();
    return finish(a, mk("pause", [], { state: w }, text));
  },
  resume: bare("pause", { state: "off" }),
  bookmark: ({ rest }) => mk("bookmark", [], {}, bodyText(rest)),
  retry: ({ rest }) => {
    const { a, text } = mech(rest);
    const id = a.pos.length > 0 ? a.word("narrationId") : undefined;
    return finish(a, mk("retry_narration", [], { narrationId: id }, text));
  },
};

function finish(a: Args, b: Body): Body {
  a.done();
  return b;
}

function amountOf(t: Tok): P {
  return !isQuoted(t) && /^\d+$/.test(t.raw)
    ? { kind: "fixed", value: Number(t.raw) }
    : { kind: "roll", expression: t.val };
}

function rollFree({ rest }: R, dm: boolean): Body {
  const { a, text } = mech(rest);
  const expression = a.word("dice");
  const envText = a.kv("text");
  const reasonKey = a.kv("reason");
  const body = mk(
    "roll_free",
    [],
    { expression, reason: text ?? reasonKey },
    envText,
  );
  if (dm) body.channel = { kind: "dm" };
  return finish(a, body);
}

/** `/ready "<trigger>" <body>` and `/next <body>`: the trailing ` -- text` belongs to the holder. */
function nestedHolder(
  kind: "ready" | "predeclare",
  rest: string,
  ctx: Ctx,
  allowed: readonly string[],
): Body {
  const sc = scan(rest);
  const cur = new Cur(sc.head);
  const params: P = {};
  if (kind === "ready") {
    const t = cur.next() ?? refuse("PARSE_MISSING_ARGUMENT", "missing trigger");
    params.trigger = t.val;
  }
  const inner = cur.rest();
  if (inner === "") refuse("PARSE_MISSING_ARGUMENT", "missing nested action");
  const then = parseBody(inner, ctx, allowed);
  const { text: _t, channel: _c, ...bare } = then;
  params.then = bare;
  return mk(kind, [], params, sc.text);
}

/** `/rule <req> accept|reject [dc=|diff=] [text=] [-- reason]` and `/rule <req> amend ... <body>`. */
function rule(rest: string, ctx: Ctx): Body {
  const probe = new Cur(rest);
  probe.next();
  const second = probe.next();
  if (second && !isQuoted(second) && lc(second.val) === "amend") {
    const cur = new Cur(rest);
    const requestId = (cur.next() as Tok).val;
    cur.next();
    const kvs: Tok[] = [];
    for (;;) {
      const save = cur.pos;
      const c = firstChunk(cur.rest());
      if (!/^(dc|diff|text|reason)=/i.test(c)) break;
      const t = cur.next() as Tok;
      kvs.push(t);
      if (cur.pos === save) break;
    }
    const a = new Args(kvs);
    const envText = a.kv("text");
    const reason = a.kv("reason");
    const dcs = a.dc();
    a.done();
    const inner = cur.rest();
    if (inner === "")
      refuse("PARSE_MISSING_ARGUMENT", "missing amended action");
    const amend = parseBody(inner, ctx, BODY_KINDS);
    return mk(
      "ruling",
      [],
      { requestId, decision: "amend", ...dcs, amend: clean(amend), reason },
      envText,
    );
  }
  const sc = scan(rest);
  const a = new Args(sc.toks);
  const requestId = a.word("requestId");
  const decision = lc(a.word("decision"));
  if (decision !== "accept" && decision !== "reject")
    refuse("PARSE_BAD_VALUE", "rule accept|reject|amend");
  const envText = a.kv("text");
  const reasonKey = a.kv("reason");
  const dcs = a.dc();
  return finish(
    a,
    mk(
      "ruling",
      [],
      { requestId, decision, ...dcs, reason: sc.text ?? reasonKey },
      envText,
    ),
  );
}

// --- Body and top level -----------------------------------------------------

/** Parse one body: a `/verb` form, or one of the plain-text forms. `allowed` limits the kind. */
function parseBody(
  s: string,
  ctx: Ctx,
  allowed: readonly string[] | null,
): Body {
  const b = bodyOf(s.trim(), ctx);
  if (allowed && !allowed.includes(b.kind))
    refuse("INTENT_SCHEMA", `kind ${b.kind} is not allowed here`);
  return b;
}

function bodyOf(s: string, ctx: Ctx): Body {
  if (s === "") return refuse("PARSE_MISSING_ARGUMENT", "empty input");
  if (s.startsWith("/")) {
    const c = firstChunk(s);
    const verb = lc(c.slice(1));
    const h = Object.hasOwn(VERBS, verb) ? VERBS[verb] : undefined;
    if (!h) return refuse("PARSE_UNKNOWN_VERB", `unknown verb: ${c}`);
    const b = h({ rest: s.slice(c.length).trim(), ctx });
    if (b.targets.length < KIND_RULES[b.kind as IntentKind].targets.min)
      refuse("PARSE_MISSING_ARGUMENT", `${c} needs a target`);
    return b;
  }
  if (s.startsWith("((")) {
    if (s.length < 4 || !s.endsWith("))"))
      return refuse("PARSE_UNCLOSED", "unclosed ((");
    return mk("ooc", [], {}, bodyText(s.slice(2, -2).trim()));
  }
  if (s.startsWith("*")) {
    if (s.length < 3 || !s.endsWith("*"))
      return refuse("PARSE_UNCLOSED", "unclosed *");
    return mk("emote", [], {}, bodyText(s.slice(1, -1).trim()));
  }
  if (s.startsWith('"')) {
    if (s.length < 2 || !s.endsWith('"') || s.endsWith('\\"'))
      return refuse("PARSE_UNCLOSED", "unclosed quote");
    return mk("say", [], {}, bodyText(s.slice(1, -1).trim()));
  }
  if (s.startsWith("@")) {
    const [t, end] = readToken(s, 0);
    const rest = bodyText(s.slice(end).trim());
    if (!isQuoted(t) && lc(t.raw) === "@dm") return mk("ask_dm", [], {}, rest);
    return mk("say_to", [parseTarget(t, ctx.resolve)], {}, rest);
  }
  if (/^[&$#]/.test(s))
    return refuse("PARSE_UNEXPECTED_TOKEN", "a target sigil starts no kind");
  return mk("say", [], {}, s);
}

function parseInner(input: string, ctx: Ctx): Intent {
  const s = input.trim();
  let actor: ActorRef = ctx.actor;
  let body: Body;
  if (/^\/as(\s|$)/i.test(s)) {
    if (ctx.actor.kind === "pc" || ctx.actor.kind === "companion")
      refuse("PARSE_UNEXPECTED_TOKEN", "/as needs a DM seat");
    const rest = s.slice(3).trim();
    const [t, end] = readToken(rest, 0);
    if (t.raw === "") return refuse("PARSE_MISSING_ARGUMENT", "missing npc");
    const n = parseTarget(t, ctx.resolve);
    if (n.kind !== "actor") refuse("PARSE_BAD_TARGET", "/as needs an actor");
    actor = { kind: "npc", id: n.id };
    const after = rest.slice(end).trim();
    body = after.startsWith("/")
      ? parseBody(after, ctx, null)
      : npcSay(after, ctx);
  } else body = parseBody(s, ctx, null);
  const raw = clean({
    id: ctx.id,
    kind: body.kind,
    actor,
    channel: body.channel,
    targets: body.targets,
    params: body.params,
    text: body.text,
    source: ctx.source,
    commit: ctx.commit,
  });
  const r = IntentSchema.safeParse(raw);
  if (r.success) return r.data;
  const issues = r.error.issues as {
    code: string;
    params?: Record<string, unknown>;
  }[];
  return refuse(
    schemaRefusalCode(issues),
    "does not satisfy the intent schema",
    { issues },
  );
}

/** Contract §8: text to Intent. Never throws. */
export function parse(text: string, ctx: ParseContext): ParseResult {
  try {
    return { ok: true, intent: parseInner(text, ctx) };
  } catch (e) {
    if (e instanceof Refuse)
      return {
        ok: false,
        refusal: {
          code: e.code,
          message: e.message,
          ...(e.details ? { details: e.details } : {}),
        },
      };
    // ponytail: an unforeseen throw becomes a refusal, so totality holds; the property test hunts these.
    return {
      ok: false,
      refusal: { code: "INTENT_SCHEMA", message: `internal: ${String(e)}` },
    };
  }
}
