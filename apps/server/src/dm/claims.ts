/**
 * The output claim gate (specs/051-output-claim-gate/contracts/claim-gate.md,
 * decision-0025 section 3.4). A pure, lexical checker: it tests a text against
 * an actor snapshot and the S0-to-S1 diff. It calls no model and reads no log.
 * Imports snapshot types only (the narrate import boundary holds).
 */
import {
  ACT_VERB_PARTICLES,
  ACT_VERBS,
  ATTRIBUTION_GAP,
  BODY_PARTS,
  COUNT_PATTERNS,
  DEATH_ATTRIBUTION,
  DEATH_RECORDED,
  DEATH_WORDS,
  DOWN_ATTRIBUTION,
  INVOLUNTARY_VERBS,
  NEGATIONS,
  NUMBER_WORDS,
  OBJECT_CUES,
  PASSIVE_AUX,
  PASSIVE_ONLY,
  SPEECH_VERBS,
  TURN_ORDER_PHRASE,
  UNCONSCIOUS_RECORDED,
  UNCONSCIOUS_WORDS,
  verbForms,
} from "./audit-words.js";
import type {
  ActorSnapshot,
  SnapshotActor,
  SnapshotDiff,
} from "./snapshot/types.js";

/** The state a claim is checked against. `diff` is null with no prior state. */
export interface ClaimState {
  snapshot: ActorSnapshot;
  diff: SnapshotDiff | null;
}

export type ClaimKind =
  | "act"
  | "speech"
  | "death"
  | "down"
  | "omission"
  | "count";

export interface ClaimIssue {
  claim: ClaimKind;
  /** The referenced actors; empty for an unattributed claim. */
  actorIds: string[];
  /** The matched text, at most 60 characters. */
  matched: string;
  /** One sentence naming the actor, its state and the matched text. */
  detail: string;
}

export interface ClaimResult {
  pass: boolean;
  issues: ClaimIssue[];
}

// ---------------------------------------------------------------------------
// Lexicon lookups, built once.

type VerbClass = "act" | "speech" | "involuntary";

const VERB_CLASS = new Map<string, { cls: VerbClass; lemma: string }>();
for (const [list, cls] of [
  [ACT_VERBS, "act"],
  [SPEECH_VERBS, "speech"],
  [INVOLUNTARY_VERBS, "involuntary"],
] as const) {
  for (const lemma of list)
    for (const f of verbForms(lemma)) VERB_CLASS.set(f, { cls, lemma });
}

const escapeRe = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const NEGATION_RE = new RegExp(
  `(?<![\\p{L}])(?:${NEGATIONS.map(escapeRe).join("|")})(?![\\p{L}])`,
  "iu",
);

const DETERMINERS = new Set(["the", "a", "an", "his", "her", "their", "its"]);
const POSSESSIVE_PRONOUNS = new Set(["her", "his", "their", "its"]);
const NOUN_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "with",
  "by",
  "in",
  "on",
  "at",
  "to",
  "and",
  "for",
  "from",
  "brother",
  "sister",
  "father",
  "mother",
  "sir",
  "dame",
  "lord",
  "lady",
  "master",
  "mistress",
]);

// ---------------------------------------------------------------------------
// Text helpers.

interface Token {
  w: string;
  start: number;
  end: number;
}

function tokenize(text: string, from: number, to: number): Token[] {
  const out: Token[] = [];
  const re = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
  const slice = text.slice(from, to);
  for (let m = re.exec(slice); m; m = re.exec(slice)) {
    out.push({
      w: m[0].toLowerCase(),
      start: from + m.index,
      end: from + m.index + m[0].length,
    });
  }
  return out;
}

interface Span {
  start: number;
  end: number;
}

/** Sentence-level clauses: split at . ! ? ; : an em dash and a newline. */
function clausesOf(text: string): Span[] {
  const out: Span[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (/[.!?;:\n—]/.test(text[i] as string)) {
      if (i > start) out.push({ start, end: i });
      start = i + 1;
    }
  }
  if (text.length > start) out.push({ start, end: text.length });
  return out;
}

/** The text with each quote's interior blanked. Offsets stay the same. */
function maskQuotes(text: string): string {
  return text.replace(/(["“])([^"“”]*)(["”])/g, (_m, a, body, b) => {
    return `${a}${" ".repeat((body as string).length)}${b}`;
  });
}

function truncate(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= 60 ? flat : flat.slice(0, 60);
}

// ---------------------------------------------------------------------------
// Actors, references and group nouns.

interface Occurrence {
  start: number;
  end: number;
  ids: string[];
  unique: boolean;
  possessive: boolean;
}

const isDown = (a: SnapshotActor): boolean =>
  a.lifeState === "dead" ||
  a.lifeState === "unconscious" ||
  a.lifeState === "stable";

const isStanding = (a: SnapshotActor): boolean =>
  a.lifeState !== "dead" && a.presence !== "absent";

class Context {
  readonly actors: SnapshotActor[];
  private readonly byId = new Map<string, SnapshotActor>();
  private readonly terms = new Map<string, Set<string>>();
  private readonly aliasRe: RegExp | null;
  private readonly nouns = new Map<string, Set<string>>();
  readonly changed = new Set<string>();

  constructor(
    readonly snapshot: ActorSnapshot,
    readonly diff: SnapshotDiff | null,
  ) {
    this.actors = snapshot.actors;
    for (const a of this.actors) {
      this.byId.set(a.id, a);
      for (const alias of a.aliases) {
        const key = alias.trim().toLowerCase();
        if (!key) continue;
        const set = this.terms.get(key) ?? new Set<string>();
        set.add(a.id);
        this.terms.set(key, set);
      }
    }
    const alts = [...this.terms.keys()]
      .sort((x, y) => y.length - x.length)
      .map(escapeRe);
    this.aliasRe = alts.length
      ? new RegExp(
          `(?<![\\p{L}\\p{N}_])(${alts.join("|")})(['’]s)?(?![\\p{L}\\p{N}_])`,
          "giu",
        )
      : null;

    const holders = new Map<string, Set<string>>();
    for (const a of this.actors) {
      for (const alias of a.aliases) {
        for (const m of alias.toLowerCase().matchAll(/\p{L}+/gu)) {
          const w = m[0];
          if (w.length < 3 || NOUN_STOPWORDS.has(w)) continue;
          const set = holders.get(w) ?? new Set<string>();
          set.add(a.id);
          holders.set(w, set);
        }
      }
    }
    for (const [w, ids] of holders) if (ids.size >= 2) this.nouns.set(w, ids);

    for (const c of diff?.actors ?? []) {
      if (c.kind === "life-state" || c.kind === "presence")
        this.changed.add(c.actorId);
    }
  }

  actor(id: string): SnapshotActor | undefined {
    return this.byId.get(id);
  }

  /** The longest alias that is not the actor id. */
  displayName(a: SnapshotActor): string {
    const names = a.aliases.filter((x) => x.toLowerCase() !== a.id);
    names.sort((x, y) => y.length - x.length);
    return names[0] ?? a.name;
  }

  occurrences(text: string): Occurrence[] {
    const re = this.aliasRe;
    if (!re) return [];
    const out: Occurrence[] = [];
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const ids = [...(this.terms.get((m[1] as string).toLowerCase()) ?? [])];
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        ids,
        unique: ids.length === 1,
        possessive: Boolean(m[2]),
      });
    }
    return out;
  }

  /** The actors a word names as a group noun, singular or plural. */
  nounActors(word: string): string[] | null {
    const w = word.toLowerCase().replace(/['’]s$/, "");
    const hit =
      this.nouns.get(w) ??
      (w.endsWith("s") ? this.nouns.get(w.slice(0, -1)) : undefined);
    return hit ? [...hit] : null;
  }

  /** The state that bars an actor from acting or speaking, or null. */
  barredState(a: SnapshotActor): string | null {
    if (a.lifeState === "dead") return "dead";
    if (a.lifeState === "unconscious") return "unconscious";
    if (a.lifeState === "stable") return "stable";
    if (a.presence === "absent") return "absent";
    return null;
  }
}

interface Found {
  pos: number;
  issue: ClaimIssue;
}

// ---------------------------------------------------------------------------
// Rules 2 and 3: acts and speech.

function classifyVerb(
  tokens: Token[],
  i: number,
): { cls: VerbClass; end: number } | null {
  const t = tokens[i];
  if (!t) return null;
  const v = VERB_CLASS.get(t.w);
  if (!v) return null;
  if (v.cls === "act") {
    const particles = ACT_VERB_PARTICLES[v.lemma];
    if (particles) {
      let j = i + 1;
      while (tokens[j]?.w.endsWith("ly")) j++;
      const next = tokens[j]?.w;
      if (!next || !particles.includes(next)) return null;
    }
  }
  return { cls: v.cls, end: t.end };
}

function isSubject(
  o: Occurrence,
  clauseTokens: Token[],
  clauseStart: number,
): boolean {
  if (o.possessive) {
    const after = clauseTokens.filter((t) => t.start >= o.end).slice(0, 2);
    if (!after.some((t) => BODY_PARTS.has(t.w))) return false;
  }
  const before = clauseTokens.filter(
    (t) => t.end <= o.start && t.start >= clauseStart,
  );
  let prev = before[before.length - 1];
  if (prev && DETERMINERS.has(prev.w)) prev = before[before.length - 2];
  if (!prev) return true;
  if (OBJECT_CUES.has(prev.w)) return false;
  const v = VERB_CLASS.get(prev.w);
  if (v && v.cls !== "involuntary") return false;
  return true;
}

function actIssues(ctx: Context, text: string, narr: string): Found[] {
  const found: Found[] = [];
  const occs = ctx.occurrences(narr);
  for (const c of clausesOf(narr)) {
    const tokens = tokenize(narr, c.start, c.end);
    for (const o of occs) {
      if (o.start < c.start || o.start >= c.end || !o.unique) continue;
      const actor = ctx.actor(o.ids[0] as string);
      if (!actor) continue;
      const state = ctx.barredState(actor);
      if (!state) continue;
      // FR-004a: the turn narrates this actor's transition.
      if (ctx.changed.has(actor.id)) continue;
      // FR-004a: turn-order phrase.
      if (TURN_ORDER_PHRASE.test(narr.slice(o.end, c.end))) continue;
      if (!isSubject(o, tokens, c.start)) continue;

      const comma = narr.indexOf(",", o.end);
      const segEnd = comma === -1 || comma > c.end ? c.end : comma;
      const window = tokens
        .filter((t) => t.start >= o.end && t.start < segEnd)
        .slice(0, 4);
      let hit: { cls: VerbClass; end: number } | null = null;
      for (const t of window) {
        if (occs.some((x) => x !== o && t.start >= x.start && t.start < x.end))
          break;
        const idx = tokens.indexOf(t);
        const v = classifyVerb(tokens, idx);
        if (!v) continue;
        const between = narr.slice(o.end, t.start).replace(/’/g, "'");
        if (NEGATION_RE.test(between)) break;
        if (v.cls === "involuntary") break;
        hit = v;
        break;
      }
      if (!hit) hit = carryOver(ctx, narr, tokens, o, occs, c);
      if (!hit) continue;
      const matched = truncate(text.slice(o.start, hit.end));
      const speaking = hit.cls === "speech";
      found.push({
        pos: o.start,
        issue: {
          claim: speaking ? "speech" : "act",
          actorIds: [actor.id],
          matched,
          detail: `${ctx.displayName(actor)} is ${state} and is shown ${speaking ? "speaking" : "acting"} ("${matched}").`,
        },
      });
    }
  }
  return found;
}

/** "Tamsin's hand twitches, her fingers curling around": the pronoun and body part carry the actor. */
function carryOver(
  _ctx: Context,
  narr: string,
  tokens: Token[],
  o: Occurrence,
  occs: Occurrence[],
  c: Span,
): { cls: VerbClass; end: number } | null {
  const after = tokens.filter((t) => t.start >= o.end);
  for (let k = 0; k < after.length; k++) {
    const p = after[k] as Token;
    if (!POSSESSIVE_PRONOUNS.has(p.w)) continue;
    if (occs.some((x) => x !== o && x.start >= o.end && x.start < p.start))
      return null;
    const b1 = after[k + 1];
    const b2 = after[k + 2];
    const bodyAt =
      b1 && BODY_PARTS.has(b1.w)
        ? k + 1
        : b2 && BODY_PARTS.has(b2.w)
          ? k + 2
          : -1;
    if (bodyAt === -1) continue;
    let vi = bodyAt + 1;
    while (
      after[vi]?.w.endsWith("ly") &&
      !VERB_CLASS.has((after[vi] as Token).w)
    )
      vi++;
    const globalIdx = tokens.indexOf(after[vi] as Token);
    const v = after[vi] ? classifyVerb(tokens, globalIdx) : null;
    if (!v || v.cls === "involuntary") continue;
    const between = narr
      .slice((after[bodyAt] as Token).end, (after[vi] as Token).start)
      .replace(/’/g, "'");
    if (NEGATION_RE.test(between)) continue;
    if ((after[vi] as Token).start >= c.end) continue;
    return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rules 4 and 5: death and down attribution.

function attributionIssues(ctx: Context, text: string): Found[] {
  const found: Found[] = [];
  const occs = ctx.occurrences(text);
  const attributedSpans: Span[] = [];
  const hasState = (pred: (a: SnapshotActor) => boolean) =>
    ctx.actors.some(pred);

  for (const c of clausesOf(text)) {
    const inClause = occs.filter((o) => o.start >= c.start && o.end <= c.end);
    for (const [broad, kind] of [
      [DEATH_ATTRIBUTION, "death"],
      [DOWN_ATTRIBUTION, "down"],
    ] as const) {
      const re = new RegExp(broad.source, broad.flags);
      const slice = text.slice(c.start, c.end);
      for (let m = re.exec(slice); m; m = re.exec(slice)) {
        const ms = c.start + m.index;
        const me = ms + m[0].length;
        const target = findTarget(ctx, text, inClause, ms, me, m[0]);
        if (!target) continue;
        attributedSpans.push({ start: ms, end: me });
        const actor = ctx.actor(target.ids[0] as string);
        if (!actor) continue;
        const ok =
          kind === "death"
            ? actor.lifeState === "dead"
            : actor.lifeState === "unconscious" ||
              actor.lifeState === "stable" ||
              actor.lifeState === "dead";
        if (ok) continue;
        const from = Math.min(target.start, ms);
        const matched = truncate(text.slice(from, Math.max(target.end, me)));
        const held = actor.lifeState ?? "conscious";
        found.push({
          pos: from,
          issue: {
            claim: kind,
            actorIds: [actor.id],
            matched,
            detail: `${ctx.displayName(actor)} is ${held} in the snapshot, and the text says ${kind === "death" ? "dead" : "down"} ("${matched}").`,
          },
        });
      }
    }
  }

  // Rule 5: an unattributed strong word needs an actor in that state (FR-013).
  const overlaps = (s: number, e: number) =>
    attributedSpans.some((a) => s < a.end && e > a.start);
  for (const [lex, kind] of [
    [DEATH_WORDS, "death"],
    [UNCONSCIOUS_WORDS, "down"],
  ] as const) {
    const re = new RegExp(lex.source, "gi");
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (overlaps(m.index, m.index + m[0].length)) continue;
      const held =
        kind === "death"
          ? hasState((a) => a.lifeState === "dead")
          : hasState(
              (a) => a.lifeState === "unconscious" || a.lifeState === "stable",
            );
      if (held) continue;
      const matched = truncate(m[0]);
      found.push({
        pos: m.index,
        issue: {
          claim: kind,
          actorIds: [],
          matched,
          detail: `The text says ${kind === "death" ? "a character is dead" : "a character is unconscious"} ("${matched}"), and no actor in the snapshot holds that state.`,
        },
      });
    }
  }
  return found;
}

function findTarget(
  ctx: Context,
  text: string,
  inClause: Occurrence[],
  ms: number,
  me: number,
  word: string,
): Occurrence | null {
  // A unique term before the word, joined only by copulas and adverbs.
  const before = inClause.filter((o) => o.end <= ms);
  const prev = before[before.length - 1];
  if (prev?.unique && !prev.possessive) {
    const gap = text.slice(prev.end, ms);
    const words = tokenize(gap, 0, gap.length).map((t) => t.w);
    const clean =
      !gap.includes(",") &&
      words.length <= 3 &&
      words.every((w) => ATTRIBUTION_GAP.has(w) || w.endsWith("ly"));
    const passiveOk =
      !PASSIVE_ONLY.test(word) || words.some((w) => PASSIVE_AUX.has(w));
    if (clean && passiveOk && ctx.actor(prev.ids[0] as string)) return prev;
  }
  // A unique term right after the word: "dead Snag".
  const next = inClause.find((o) => o.start >= me);
  if (
    next?.unique &&
    !next.possessive &&
    /^\s*$/.test(text.slice(me, next.start))
  )
    return next;
  return null;
}

// ---------------------------------------------------------------------------
// Rule 6: omission.

function omissionIssues(ctx: Context, text: string): Found[] {
  const found: Found[] = [];
  if (!ctx.diff) return found;
  const occs = ctx.occurrences(text);
  for (const ch of ctx.diff.actors) {
    if (ch.kind !== "life-state") continue;
    if (
      ch.after !== "dead" &&
      ch.after !== "unconscious" &&
      ch.after !== "stable"
    )
      continue;
    const actor = ctx.actor(ch.actorId);
    if (!actor) continue;
    const recorded =
      ch.after === "dead" ? DEATH_RECORDED : UNCONSCIOUS_RECORDED;
    const named = clausesOf(text).some((c) => {
      const slice = text.slice(c.start, c.end);
      if (!recorded.test(slice)) return false;
      if (
        occs.some(
          (o) =>
            o.start >= c.start && o.end <= c.end && o.ids.includes(actor.id),
        )
      )
        return true;
      return tokenize(text, c.start, c.end).some((t) =>
        ctx.nounActors(t.w)?.includes(actor.id),
      );
    });
    if (named) continue;
    const name = ctx.displayName(actor);
    found.push({
      pos: text.length,
      issue: {
        claim: "omission",
        actorIds: [actor.id],
        matched: truncate(name),
        detail: `${name} ${ch.after === "dead" ? "died" : `dropped to ${ch.after}`} this turn, and no sentence names it with a ${ch.after === "dead" ? "death" : "drop"} word.`,
      },
    });
  }
  return found;
}

// ---------------------------------------------------------------------------
// Rule 7: counts.

function countIssues(ctx: Context, text: string): Found[] {
  const found: Found[] = [];
  const party = ctx.actors.filter((a) => a.kind === "party");
  const world = ctx.actors.filter((a) => a.kind !== "party");
  const downCount = (xs: SnapshotActor[]) => xs.filter(isDown).length;
  const pick = (ids: string[]) => ctx.actors.filter((a) => ids.includes(a.id));
  const push = (
    pos: number,
    m: string,
    ids: string[],
    detail: string,
  ): void => {
    const matched = truncate(m);
    found.push({
      pos,
      issue: {
        claim: "count",
        actorIds: ids,
        matched,
        detail: `${detail} ("${matched}").`,
      },
    });
  };

  for (const c of clausesOf(text)) {
    const slice = text.slice(c.start, c.end);
    const scan = (src: string) => new RegExp(src, "giu");

    const nd = scan(COUNT_PATTERNS.numberDown);
    for (let m = nd.exec(slice); m; m = nd.exec(slice)) {
      // "Goblin three is dead": a number word right after a name or group
      // noun belongs to that actor's name, not to a count (OQ-5).
      const before = /([\p{L}'’-]+)\s+$/u.exec(slice.slice(0, m.index));
      if (before && ctx.nounActors(before[1] as string)) continue;
      const n = NUMBER_WORDS[(m[1] as string).toLowerCase()] as number;
      const middle = tokenize(m[2] as string, 0, (m[2] as string).length);
      let ids: string[] | null = null;
      for (const t of middle) {
        ids = ctx.nounActors(t.w);
        if (ids) break;
      }
      const pos = c.start + m.index;
      if (ids) {
        const have = downCount(pick(ids));
        if (have !== n)
          push(
            pos,
            m[0],
            ids,
            `The text counts ${n} down among those actors, and the snapshot holds ${have}`,
          );
      } else {
        const a = downCount(world);
        const b = downCount(party);
        if (a !== n && b !== n)
          push(
            pos,
            m[0],
            [],
            `The text counts ${n} down, and the snapshot holds ${a} on the monster and NPC side and ${b} in the party`,
          );
      }
    }

    const nl = scan(COUNT_PATTERNS.noneLeft);
    for (let m = nl.exec(slice); m; m = nl.exec(slice)) {
      const ids = ctx.nounActors(m[2] as string);
      if (!ids) continue;
      const left = pick(ids).filter(isStanding).length;
      if (left > 0)
        push(
          c.start + m.index,
          m[0],
          ids,
          `The text says none are left, and the snapshot holds ${left} standing`,
        );
    }

    const lo = scan(COUNT_PATTERNS.lastOnly);
    for (let m = lo.exec(slice); m; m = lo.exec(slice)) {
      const viaAdjective = m[2] ? ctx.nounActors(m[2]) : null;
      const ids = viaAdjective ?? ctx.nounActors(m[3] as string);
      if (!ids) continue;
      const shown = viaAdjective
        ? m[0].slice(0, m[0].indexOf(m[2] as string) + (m[2] as string).length)
        : m[0].slice(
            0,
            m[0].lastIndexOf(m[3] as string) + (m[3] as string).length,
          );
      const left = pick(ids).filter(isStanding).length;
      if (left !== 1)
        push(
          c.start + m.index,
          shown,
          ids,
          `The text says one is left, and the snapshot holds ${left} standing`,
        );
    }

    const ad = scan(COUNT_PATTERNS.allDown);
    for (let m = ad.exec(slice); m; m = ad.exec(slice)) {
      const ids = ctx.nounActors(m[1] as string);
      if (!ids) continue;
      const actors = pick(ids);
      const up = actors.filter((a) => !isDown(a)).length;
      if (up > 0)
        push(
          c.start + m.index,
          m[0],
          ids,
          `The text says all are down, and the snapshot holds ${up} not down`,
        );
    }
  }
  return found;
}

// ---------------------------------------------------------------------------

export function checkClaims(state: ClaimState, text: string): ClaimResult {
  const ctx = new Context(state.snapshot, state.diff);
  const narr = maskQuotes(text);
  const found = [
    ...actIssues(ctx, text, narr),
    ...attributionIssues(ctx, text),
    ...omissionIssues(ctx, text),
    ...countIssues(ctx, text),
  ].sort((a, b) => a.pos - b.pos);
  const issues: ClaimIssue[] = [];
  const seen = new Set<string>();
  for (const f of found) {
    const key = `${f.issue.claim}|${f.issue.actorIds.join(",")}|${f.issue.matched}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(f.issue);
  }
  return { pass: issues.length === 0, issues };
}
