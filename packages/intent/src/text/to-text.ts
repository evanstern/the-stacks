// Contract §8.2, §8.3: the canonical text of an Intent. Total over every schema-valid Intent.
// ponytail: the contract's grammar table has gaps (explicit speech verbs, `text=`/`reason=` keys,
// the "dm" id collision). Each gap is closed with the smallest token and listed in the README
// "Text form notes" for the next contract amendment.
import type { Intent } from "../kinds.js";
import type { Channel, TargetRef } from "../refs.js";
import { diceTok, firstChunk, fmtTarget, q, word } from "./tokens.js";

// biome-ignore lint/suspicious/noExplicitAny: params differ per kind; the schema already validated them
type P = Record<string, any>;
export type Body = {
  kind: string;
  targets: TargetRef[];
  params: P;
  text?: string;
  channel?: Channel;
};

const join = (...p: (string | false | undefined | null)[]) =>
  p.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
const tg = (b: Body) => b.targets.map(fmtTarget);
const dcOf = (p: P) =>
  p.dc !== undefined
    ? `dc=${p.dc}`
    : p.difficulty !== undefined
      ? `diff=${p.difficulty}`
      : "";
const modeOf = (p: P) =>
  p.mode === "advantage" ? "+adv" : p.mode === "disadvantage" ? "+dis" : "";
const both = (p: P) =>
  p.skill !== undefined && p.ability !== undefined && `ability=${p.ability}`;
const trimSafe = (s: string) => s === s.trim();
/** The id `dm` would read as the DM seat in `@dm`; a quoted id is always a literal id. */
const atId = (id: string) => (id === "dm" ? '@"dm"' : `@${id}`);
const amount = (a: P) =>
  a.kind === "fixed" ? String(a.value) : diceTok(a.expression);
const rollAsk = (r: P) =>
  r.kind === "check"
    ? join("check", r.skill ?? r.ability, both(r))
    : r.kind === "save"
      ? `save ${r.ability}`
      : r.kind;

/** `explicit` forces a `/verb` form for the kinds that have a plain form. */
export function render(b: Body, explicit: boolean): string {
  const p = b.params;
  const t = b.text ?? "";
  const s = (...rest: (string | false | undefined)[]) =>
    b.text !== undefined ? `${join(...rest)} -- ${b.text}` : join(...rest);
  switch (b.kind) {
    case "say":
      return explicit || /^[/@&$#(*"]/.test(t) ? `/say ${t}` : t;
    case "say_to": {
      const id = (b.targets[0] as { id: string }).id;
      return explicit ? `/to ${atId(id)} ${t}` : `${atId(id)} ${t}`;
    }
    case "emote":
      return `/me ${t}`;
    case "ask_dm":
      return explicit ? `/ask ${t}` : `@dm ${t}`;
    case "ooc":
      return explicit ? `/ooc ${t}` : `((${t}))`;
    case "party":
      return `/p ${t}`;
    case "whisper": {
      const to = (b.channel as Extract<Channel, { kind: "whisper" }>).to;
      return `/w ${to.map((x) => (x.kind === "dm" ? "@dm" : atId(x.id))).join(",")} ${t}`;
    }
    case "attempt": {
      const fc = firstChunk(t).toLowerCase();
      const unsafe =
        fc === "+party" || fc === "--" || /^([@&$#]|(sq|pt):)/.test(fc);
      return join(
        "/do",
        p.scope === "party" && "+party",
        ...tg(b),
        unsafe && "--",
        t,
      );
    }
    case "check":
      return s(
        "/check",
        p.skill ?? p.ability,
        ...tg(b),
        dcOf(p),
        modeOf(p),
        both(p),
      );
    case "save":
      return s("/save", p.ability, dcOf(p), modeOf(p));
    case "contest":
      return s(
        "/contest",
        p.skill ?? p.ability,
        ...tg(b),
        p.opposed !== undefined && `vs ${p.opposed}`,
        modeOf(p),
        both(p),
      );
    case "attack":
      return s("/attack", ...tg(b), "with", word(p.weapon), modeOf(p));
    case "cast":
      return s(
        "/cast",
        p.spell,
        ...tg(b),
        p.slot !== undefined && `slot=${p.slot}`,
        modeOf(p),
      );
    case "dash":
    case "dodge":
    case "disengage":
    case "hide":
    case "delay":
    case "stand":
    case "recap":
      return s(`/${b.kind}`);
    case "rest_long":
      return s("/rest long");
    case "end_combat":
      return s("/combat end");
    case "help":
      return p.assist.kind === "attack"
        ? s("/help attack", ...tg(b))
        : s("/help", ...tg(b), p.assist.skill);
    case "ready":
      return s("/ready", q(p.trigger), render(p.then, false));
    case "predeclare":
      return s("/next", render(p.then, false));
    case "search":
      return s(
        "/search",
        ...tg(b),
        p.skill === "investigation" && "investigation",
      );
    case "use_object":
      return s("/utilize", ...tg(b));
    case "grapple":
      return s("/grapple", ...tg(b));
    case "shove":
      return s("/shove", ...tg(b), p.effect);
    case "move":
      return s("/move", ...tg(b));
    case "drop_prone":
      return s("/prone");
    case "react":
      return s("/react", p.promptId, p.choice);
    case "end_turn":
      return s("/end");
    case "use_item":
      return s("/use", ...tg(b));
    case "give":
      return s("/give", ...tg(b));
    case "equip":
      return s("/equip", ...tg(b), p.off === true && "+off");
    case "drop":
      return s("/drop", ...tg(b));
    case "rest_short":
      return s(
        "/rest short",
        (p.spend?.length ?? 0) > 0 &&
          `spend=${(p.spend as P[]).map((x) => `${x.count}d${x.die}`).join(",")}`,
      );
    case "concentration_drop":
      return s("/drop-concentration");
    case "roll":
      return s("/roll", p.requestId);
    case "roll_free":
      return reasoned(
        b,
        join(
          b.channel?.kind === "dm" ? "/gr" : "/r",
          diceTok(p.expression),
          b.text !== undefined && `text=${q(b.text)}`,
        ),
      );
    case "level_choice":
      return s("/level", p.choiceId, p.option);
    case "narrate":
      return `/desc ${t}`;
    case "npc_say": {
      const addr = b.targets[0] ? fmtTarget(b.targets[0]) : undefined;
      const esc = firstChunk(t) === "--" || (!addr && /^[/@]/.test(t));
      return join("/npc", addr, esc && "--", t);
    }
    case "request_roll":
      return s(
        "/request",
        ...tg(b),
        rollAsk(p.roll),
        dcOf(p),
        modeOf(p),
        p.secret === true && "+secret",
      );
    case "set_dc":
      return s("/dc", p.for, p.dc !== undefined ? String(p.dc) : p.difficulty);
    case "apply_damage":
      return s(
        "/damage",
        ...tg(b),
        amount(p.amount),
        p.damageType,
        p.critical === true && "+crit",
      );
    case "apply_heal":
      return s("/heal", ...tg(b), amount(p.amount), p.temp === true && "+temp");
    case "apply_condition":
      return s(
        "/condition",
        ...tg(b),
        p.op,
        p.condition,
        p.until !== undefined &&
          `until=r${p.until.round}.${p.until.actor}.${p.until.boundary === "turn-start" ? "start" : "end"}`,
      );
    case "start_combat":
      return s("/combat start", ...tg(b));
    case "add_combatant":
      return s("/add", p.from, p.count !== 1 && `x${p.count}`, ...tg(b));
    case "move_token":
      return s("/place", ...tg(b));
    case "reveal":
      return s(
        "/reveal",
        ...tg(b),
        `to=${
          p.to === "party"
            ? "party"
            : (p.to as string[])
                .map((x) => (x === "party" ? '"party"' : x))
                .join(",")
        }`,
        p.block !== undefined && `block=${p.block}`,
        p.field !== undefined && `field=${p.field}`,
      );
    case "ruling": {
      const head = join(
        "/rule",
        p.requestId,
        p.decision,
        dcOf(p),
        b.text !== undefined && `text=${q(b.text)}`,
      );
      return p.decision === "amend"
        ? join(
            head,
            p.reason !== undefined && `reason=${q(p.reason)}`,
            render(p.amend, true),
          )
        : reasoned(b, head);
    }
    case "pause":
      return s(p.state === "off" ? "/pause off" : "/pause");
    case "bookmark":
      return `/bookmark ${t}`;
    case "retry_narration":
      return s("/retry", p.narrationId);
    default:
      // ponytail: unreachable for schema-valid input; a total function never throws.
      return `/${b.kind}`;
  }
}

/** `-- <reason>` carries `params.reason` (contract §8.2); an untrimmed reason uses `reason=`. */
function reasoned(b: Body, head: string): string {
  const r = b.params.reason as string | undefined;
  if (r === undefined) return head;
  return trimSafe(r) ? `${head} -- ${r}` : `${head} reason=${q(r)}`;
}

/** Contract §8: one canonical text per Intent. */
export function toText(intent: Intent): string {
  const b = intent as unknown as Body & {
    actor: { kind: string; id?: string };
  };
  if (b.actor.kind !== "npc") return render(b, false);
  const id = b.actor.id as string;
  if (b.kind !== "npc_say") return `/as @${id} ${render(b, true)}`;
  // `/as @<npc> [@<to>] <text>` (contract §8.2)
  const addr = b.targets[0] ? fmtTarget(b.targets[0]) : undefined;
  const t = b.text ?? "";
  const esc = firstChunk(t) === "--" || (!addr && /^[/@]/.test(t));
  return join(`/as @${id}`, addr, esc && "--", t);
}
