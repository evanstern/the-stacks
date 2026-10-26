import { type Rng, RngContractError } from "./rng.js";
import type { DiceTermResult, EventOf } from "./schema/events.js";

export type DiceTerm =
  | {
      kind: "dice";
      sign: 1 | -1;
      count: number;
      sides: number;
      keep: { mode: "highest" | "lowest"; n: number } | null;
    }
  | { kind: "modifier"; value: number };

export type DiceParseResult =
  | { ok: true; terms: DiceTerm[] }
  | {
      ok: false;
      code: "INVALID_DICE_EXPRESSION" | "DICE_LIMIT_EXCEEDED";
      message: string;
    };

export type DiceFailure = Extract<DiceParseResult, { ok: false }>;

const MAX_COUNT = 100;
const MAX_SIDES = 1000;
const MAX_TERMS = 20;
const MAX_LENGTH = 200;
const MAX_MODIFIER = 1000;

function invalid(message: string): DiceFailure {
  return { ok: false, code: "INVALID_DICE_EXPRESSION", message };
}

function limit(message: string): DiceFailure {
  return { ok: false, code: "DICE_LIMIT_EXCEEDED", message };
}

/** Check the limits on an already-parsed term list. */
export function checkLimits(terms: readonly DiceTerm[]): DiceFailure | null {
  if (terms.length > MAX_TERMS) {
    return limit(`more than ${MAX_TERMS} terms`);
  }
  for (const t of terms) {
    if (t.kind === "modifier") {
      if (Math.abs(t.value) > MAX_MODIFIER) {
        return limit(`modifier ${t.value} beyond +/-${MAX_MODIFIER}`);
      }
      continue;
    }
    if (t.count > MAX_COUNT)
      return limit(`dice count ${t.count} above ${MAX_COUNT}`);
    if (t.sides > MAX_SIDES)
      return limit(`die size ${t.sides} above ${MAX_SIDES}`);
    if (t.keep && t.keep.n > t.count) {
      return limit(`keep ${t.keep.n} exceeds dice count ${t.count}`);
    }
  }
  return null;
}

const TERM_RE = /(\d*)d(\d+)(?:(kh|kl)(\d+))?|(\d+)/y;

export function parseDiceExpression(expression: string): DiceParseResult {
  const trimmed = expression.trim();
  if (trimmed.length > MAX_LENGTH) {
    return limit(`expression longer than ${MAX_LENGTH} characters`);
  }
  const s = trimmed.replace(/\s+/g, "").toLowerCase();
  if (s.length === 0) return invalid("empty expression");

  const terms: DiceTerm[] = [];
  let pos = 0;
  let first = true;
  while (pos < s.length) {
    let sign: 1 | -1 = 1;
    const ch = s[pos];
    if (ch === "+" || ch === "-") {
      sign = ch === "-" ? -1 : 1;
      pos += 1;
    } else if (!first) {
      return invalid(`expected + or - at position ${pos}`);
    }
    first = false;
    TERM_RE.lastIndex = pos;
    const m = TERM_RE.exec(s);
    if (!m) return invalid(`expected a term at position ${pos}`);
    pos = TERM_RE.lastIndex;
    if (m[5] !== undefined) {
      terms.push({ kind: "modifier", value: sign * Number.parseInt(m[5], 10) });
      continue;
    }
    const count = m[1] === "" ? 1 : Number.parseInt(m[1] as string, 10);
    const sides = Number.parseInt(m[2] as string, 10);
    if (count === 0) return invalid("dice count is 0");
    if (sides === 0) return invalid("die has 0 sides");
    let keep: { mode: "highest" | "lowest"; n: number } | null = null;
    if (m[3] !== undefined) {
      const n = Number.parseInt(m[4] as string, 10);
      if (n === 0) return invalid("keep count is 0");
      keep = { mode: m[3] === "kh" ? "highest" : "lowest", n };
    }
    terms.push({ kind: "dice", sign, count, sides, keep });
  }

  const failure = checkLimits(terms);
  if (failure) return failure;
  return { ok: true, terms };
}

/**
 * True when the expression holds exactly one d20 die term and that term is a plain,
 * positive `1d20` with no keep.
 */
export function hasPlainD20(terms: readonly DiceTerm[]): boolean {
  const d20s = terms.filter((t) => t.kind === "dice" && t.sides === 20);
  if (d20s.length !== 1) return false;
  const t = d20s[0] as Extract<DiceTerm, { kind: "dice" }>;
  return t.count === 1 && t.keep === null && t.sign === 1;
}

/** The terms with every dice count and keep n doubled (a critical hit). Modifiers stay. */
export function criticalTerms(terms: readonly DiceTerm[]): DiceTerm[] {
  return terms.map((t) =>
    t.kind === "dice"
      ? {
          ...t,
          count: t.count * 2,
          keep: t.keep ? { mode: t.keep.mode, n: t.keep.n * 2 } : null,
        }
      : t,
  );
}

export type RollOutcome =
  | { ok: true; terms: DiceTermResult[]; total: number; natural: number | null }
  | DiceFailure;

function draw(rng: Rng, sides: number): number {
  const face = rng.rollDie(sides);
  if (!Number.isInteger(face) || face < 1 || face > sides) {
    throw new RngContractError(`rng returned ${face} for a d${sides}`);
  }
  return face;
}

/**
 * Roll parsed terms. With `critical`, every dice term's count and keep n double (checked
 * against the limits before any draw); modifiers stay. Advantage or disadvantage needs a
 * plain d20 term and rolls it twice.
 */
export function rollParsed(
  terms: readonly DiceTerm[],
  opts: { mode: "normal" | "advantage" | "disadvantage"; critical: boolean },
  rng: Rng,
): RollOutcome {
  const effective: DiceTerm[] = opts.critical
    ? criticalTerms(terms)
    : [...terms];
  if (opts.critical) {
    const failure = checkLimits(effective);
    if (failure) return failure;
  }
  const plainD20 = hasPlainD20(effective);
  if (opts.mode !== "normal" && !plainD20) {
    throw new Error("advantage or disadvantage needs a plain d20 term");
  }

  const results: DiceTermResult[] = [];
  let total = 0;
  let natural: number | null = null;
  for (const t of effective) {
    if (t.kind === "modifier") {
      results.push({ kind: "modifier", value: t.value });
      total += t.value;
      continue;
    }
    const isAdvD20 = opts.mode !== "normal" && t.sides === 20;
    const drawCount = isAdvD20 ? 2 : t.count;
    const faces: number[] = [];
    for (let i = 0; i < drawCount; i += 1) faces.push(draw(rng, t.sides));
    const kept = faces.map(() => false);
    if (isAdvD20) {
      const pickFirst =
        opts.mode === "advantage"
          ? (faces[0] as number) >= (faces[1] as number)
          : (faces[0] as number) <= (faces[1] as number);
      kept[pickFirst ? 0 : 1] = true;
    } else if (t.keep) {
      const order = faces
        .map((face, index) => ({ face, index }))
        .sort((a, b) =>
          t.keep?.mode === "highest"
            ? b.face - a.face || a.index - b.index
            : a.face - b.face || a.index - b.index,
        );
      for (const entry of order.slice(0, t.keep.n)) kept[entry.index] = true;
    } else {
      kept.fill(true);
    }
    const sum = faces.reduce((acc, face, i) => acc + (kept[i] ? face : 0), 0);
    const subtotal = t.sign * sum;
    total += subtotal;
    if (plainD20 && t.sides === 20) {
      natural = faces[kept.indexOf(true)] as number;
    }
    results.push({
      kind: "dice",
      sign: t.sign,
      count: isAdvD20 ? 1 : t.count,
      sides: t.sides,
      keep: t.keep,
      faces,
      kept,
      subtotal,
    });
  }
  return { ok: true, terms: results, total, natural };
}

export type DicePurpose = EventOf<"dice.rolled">["purpose"];

/** Parse, roll and build the `dice.rolled` event in one step. */
export function rollExpression(
  expression: string,
  opts: {
    mode: "normal" | "advantage" | "disadvantage";
    critical: boolean;
    purpose: DicePurpose;
    combatantId: string | null;
    reason: string;
  },
  rng: Rng,
): DiceFailure | { ok: true; event: EventOf<"dice.rolled">; total: number } {
  const parsed = parseDiceExpression(expression);
  if (!parsed.ok) return parsed;
  const rolled = rollParsed(
    parsed.terms,
    { mode: opts.mode, critical: opts.critical },
    rng,
  );
  if (!rolled.ok) return rolled;
  return {
    ok: true,
    total: rolled.total,
    event: {
      type: "dice.rolled",
      v: 1,
      reason: opts.reason,
      expression: expression.trim(),
      mode: opts.mode,
      purpose: opts.purpose,
      critical: opts.critical,
      combatantId: opts.combatantId,
      terms: rolled.terms,
      total: rolled.total,
      natural: rolled.natural,
    },
  };
}
