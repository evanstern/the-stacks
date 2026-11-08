// Contract §8.1: tokens, quoting and target sigils. Pure string code: no I/O, no clock.
import type { TargetRef } from "../refs.js";
import type { IntentRefusalCode } from "../refusals.js";
import { IdSchema } from "../scalars.js";

export class Refuse extends Error {
  code: IntentRefusalCode;
  details?: Record<string, unknown>;
  constructor(
    code: IntentRefusalCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
export function refuse(
  code: IntentRefusalCode,
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new Refuse(code, message, details);
}

/** One token: `raw` as typed, `val` with quotes removed and `\"` `\\` unescaped. */
export type Tok = { raw: string; val: string };

export const isWs = (c: string) => /\s/.test(c);

/** Quote a value. `"` and `\` escape with `\`; whitespace inside stays verbatim. */
export const q = (s: string) =>
  `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
/** A word that needs no quotes (contract §8.3 rule 7). */
export const word = (s: string) =>
  /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(s) ? s : q(s);
/** A dice expression. All-digit and unsafe strings are quoted, so `7` stays a roll, not a number. */
export const diceTok = (s: string) =>
  /^[0-9A-Za-z(][0-9A-Za-z+\-*/().]*$/.test(s) && !/^\d+$/.test(s) ? s : q(s);
export const firstChunk = (s: string) => /^\S*/.exec(s)?.[0] ?? "";

export const isQuoted = (t: Tok) => t.raw.startsWith('"');

export function readToken(s: string, start: number): [Tok, number] {
  let i = start;
  let val = "";
  while (i < s.length && !isWs(s.charAt(i))) {
    if (s.charAt(i) === '"') {
      i++;
      let closed = false;
      while (i < s.length) {
        const c = s.charAt(i);
        const n = s.charAt(i + 1);
        if (c === "\\" && (n === '"' || n === "\\")) {
          val += n;
          i += 2;
        } else if (c === '"') {
          closed = true;
          i++;
          break;
        } else {
          val += c;
          i++;
        }
      }
      if (!closed) refuse("PARSE_UNCLOSED", "unclosed quote");
    } else {
      val += s.charAt(i);
      i++;
    }
  }
  return [{ raw: s.slice(start, i), val }, i];
}

/** Unquote a `key=value` value part. */
export function unq(raw: string): string {
  const [t, end] = readToken(raw, 0);
  if (end !== raw.length) refuse("PARSE_BAD_VALUE", `bad value: ${raw}`);
  return t.val;
}

/** Tokens up to a bare ` -- `; the rest of the line is `text`, verbatim. */
export function scan(s: string): { toks: Tok[]; text?: string; head: string } {
  const toks: Tok[] = [];
  let i = 0;
  for (;;) {
    while (i < s.length && isWs(s.charAt(i))) i++;
    if (i >= s.length) return { toks, head: s };
    const start = i;
    const [t, end] = readToken(s, i);
    if (t.raw === "--") {
      const text = s.slice(end).trim();
      if (text === "") refuse("PARSE_MISSING_ARGUMENT", "empty text after --");
      return { toks, text, head: s.slice(0, start) };
    }
    toks.push(t);
    i = end;
  }
}

/** A cursor for grammars that hand the rest of the line to a nested parse. */
export class Cur {
  pos = 0;
  s: string;
  constructor(s: string) {
    this.s = s;
  }
  next(): Tok | null {
    while (this.pos < this.s.length && isWs(this.s.charAt(this.pos)))
      this.pos++;
    if (this.pos >= this.s.length) return null;
    const [t, end] = readToken(this.s, this.pos);
    this.pos = end;
    return t;
  }
  rest(): string {
    return this.s.slice(this.pos).trim();
  }
}

// --- Targets (contract §5, §8.1) --------------------------------------------

const SIGIL: Record<string, "actor" | "entity" | "item" | "zone"> = {
  "@": "actor",
  "&": "entity",
  $: "item",
  "#": "zone",
};
const SIGIL_OF = { actor: "@", entity: "&", item: "$", zone: "#" } as const;
const NUM = String.raw`\d+(?:\.\d+)?(?:e[+-]?\d+)?`;
const SQ = /^sq:(\d+),(\d+)$/i;
const PT = new RegExp(`^pt:(${NUM}),(${NUM})$`, "i");

/** A token the list readers take as a target. A bare name is not one. */
export const isTargetTok = (t: Tok) =>
  !isQuoted(t) && (t.raw.charAt(0) in SIGIL || /^(sq|pt):.*,/i.test(t.raw));

export function fmtTarget(t: TargetRef): string {
  switch (t.kind) {
    case "square":
      return `sq:${t.x},${t.y}`;
    case "point":
      return `pt:${t.x},${t.y}`;
    default:
      return `${SIGIL_OF[t.kind]}${t.id}`;
  }
}

export type Resolver = (name: string) => TargetRef | null;

/** A sigil token, a coordinate token, or a bare name (resolved only through `resolve`). */
export function parseTarget(t: Tok, resolve?: Resolver): TargetRef {
  const named = (name: string): TargetRef => {
    const r = resolve?.(name) ?? null;
    if (!r) refuse("PARSE_BAD_TARGET", `unknown target: ${name}`);
    return r;
  };
  const kind = isQuoted(t) ? undefined : SIGIL[t.raw.charAt(0)];
  if (kind) {
    const id = t.val.slice(1);
    return IdSchema.safeParse(id).success ? { kind, id } : named(id);
  }
  if (!isQuoted(t)) {
    const sq = SQ.exec(t.raw);
    if (sq) return { kind: "square", x: Number(sq[1]), y: Number(sq[2]) };
    const pt = PT.exec(t.raw);
    if (pt) return { kind: "point", x: Number(pt[1]), y: Number(pt[2]) };
    if (/^(sq|pt):/i.test(t.raw))
      refuse("PARSE_BAD_TARGET", `bad coordinate: ${t.raw}`);
  }
  return named(t.val);
}
