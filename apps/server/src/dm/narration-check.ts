/**
 * The narration check (spec 103 plan D1, constitution VII). Pure and lexical: it tests the
 * describe and ask slots for a leak (hidden information) and a contradiction (a digit, dice
 * language with no roll, a wrong life state). It calls no model. A leak drops the sentence;
 * a contradiction ships with a correction. Neither blocks play.
 */
import type { NarrationSlots } from "./fact-sheet.js";
import {
  ATTRIBUTION_GAP,
  DEATH_WORDS,
  DICE_LANGUAGE,
  NEGATIONS,
  PASSIVE_AUX,
  UNCONSCIOUS_WORDS,
} from "./narration-words.js";
import { aliasOccurrences, namedActorIds } from "./snapshot/aliases.js";
import type { ActorSnapshot } from "./snapshot/types.js";

export interface CheckInput {
  /** Describe and ask are checked; restate is code-validated. */
  slots: NarrationSlots;
  /** The fact row texts plus the State line. */
  rows: readonly string[];
  hasRoll: boolean;
  /** The S1 snapshot. */
  snapshot: ActorSnapshot;
  /** `dmOnlySeedText(seed)`, lower-cased. */
  dmOnlyText: readonly string[];
  /** `FactRoll.unmetSuccess` of this beat. */
  unmetSuccess: readonly string[];
  /** Actor ids whose presence changed to `absent` in this beat's own rows; the S1 snapshot already shows them absent. */
  departedIds: readonly string[];
}

export interface CheckIssue {
  check: "leak" | "contradiction";
  kind:
    | "absent-actor"
    | "fogged-zone"
    | "dm-only-text"
    | "unmet-success"
    | "digit"
    | "dice-language"
    | "life-state";
  actorIds: string[];
  /** At most 60 characters. */
  matched: string;
  /** The sentence the hit sits in. */
  sentence: string;
  detail: string;
}

const escapeRe = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const NEGATION_RE = new RegExp(
  `(?<![\\p{L}])(?:${NEGATIONS.map(escapeRe).join("|")})(?![\\p{L}])`,
  "iu",
);
const NO_SIGN_RE = /\b(?:no sign of|nothing of|no trace of)\b/i;

/** The text with each quote's interior blanked. Offsets stay the same. */
function maskQuotes(text: string): string {
  return text.replace(
    /(["“])([^"“”]*)(["”])/g,
    (_m, a, body, b) => `${a}${" ".repeat((body as string).length)}${b}`,
  );
}

const truncate = (s: string): string => {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= 60 ? flat : flat.slice(0, 60);
};

/** Sentences as `[original, masked]` pairs; a quote never splits a sentence. */
function sentencesOf(text: string): { raw: string; masked: string }[] {
  const masked = maskQuotes(text);
  const out: { raw: string; masked: string }[] = [];
  for (const m of masked.matchAll(/[^.!?\n]+(?:[.!?]+["'”’)]*|$)/g)) {
    const raw = text.slice(m.index, (m.index ?? 0) + m[0].length).trim();
    if (raw) out.push({ raw, masked: m[0].trim() });
  }
  return out;
}

const lifeOf = (snapshot: ActorSnapshot, id: string) =>
  snapshot.actors.find((a) => a.id === id);

/** Life-state hits: a death or down word whose subject (the unique alias just before it) is not in that state. */
function lifeStateHits(
  snapshot: ActorSnapshot,
  masked: string,
): { id: string; matched: string; word: string }[] {
  const occs = aliasOccurrences(snapshot, masked).filter((o) => o.unique);
  const hits: { id: string; matched: string; word: string }[] = [];
  for (const [re, down] of [
    [DEATH_WORDS, false],
    [UNCONSCIOUS_WORDS, true],
  ] as const) {
    const g = new RegExp(re.source, "gi");
    for (const m of masked.matchAll(g)) {
      const at = m.index ?? 0;
      const subject = occs.filter((o) => o.end <= at).at(-1);
      if (!subject) continue;
      const between = masked.slice(subject.end, at);
      if (/[,;:—]/.test(between) || NEGATION_RE.test(between)) continue;
      const gap = between.split(/\s+/).filter(Boolean);
      if (
        gap.length > 3 ||
        gap.some((w) => !ATTRIBUTION_GAP.has(w.toLowerCase()))
      )
        continue;
      // "killed" and "slain" attribute only after a passive auxiliary: "Kestrel killed the goblin" is no death.
      if (
        /^(?:killed|slain|knocked out)$/i.test(m[0]) &&
        !gap.some((w) => PASSIVE_AUX.has(w.toLowerCase()))
      )
        continue;
      const actor = lifeOf(snapshot, subject.ids[0] as string);
      const state = actor?.lifeState;
      const ok = down
        ? state === "unconscious" || state === "stable" || state === "dead"
        : state === "dead";
      if (!actor || ok) continue;
      hits.push({
        id: actor.id,
        matched: truncate(masked.slice(subject.start, at + m[0].length)),
        word: m[0],
      });
    }
  }
  return hits;
}

/** Leak and contradiction hits on the describe and ask slots, in sentence order. */
export function checkNarration(input: CheckInput): CheckIssue[] {
  const { snapshot } = input;
  const unmetIds = new Set(
    input.unmetSuccess.flatMap((t) => namedActorIds(snapshot, t)),
  );
  const departed = new Set(input.departedIds);
  const fogged = (snapshot.stage.zones ?? []).filter((z) => !z.revealed);
  const issues: CheckIssue[] = [];
  for (const text of [input.slots.describe, input.slots.ask]) {
    for (const { raw, masked } of sentencesOf(text)) {
      const push = (
        check: CheckIssue["check"],
        kind: CheckIssue["kind"],
        actorIds: string[],
        matched: string,
        detail: string,
      ): void => {
        issues.push({
          check,
          kind,
          actorIds,
          matched: truncate(matched),
          sentence: raw,
          detail,
        });
      };
      // Leaks.
      const lower = raw.toLowerCase();
      for (const s of input.dmOnlyText) {
        if (s && lower.includes(s))
          push(
            "leak",
            "dm-only-text",
            [],
            s,
            "The text states something outside the player view.",
          );
      }
      for (const o of aliasOccurrences(snapshot, masked)) {
        const actor = o.unique ? lifeOf(snapshot, o.ids[0] as string) : null;
        if (actor?.presence !== "absent" || departed.has(actor.id)) continue;
        const before = masked.slice(0, o.start).replace(/’/g, "'");
        if (NEGATION_RE.test(before) || NO_SIGN_RE.test(before)) continue;
        if (masked.trimEnd().endsWith("?")) continue;
        push(
          "leak",
          unmetIds.has(actor.id) ? "unmet-success" : "absent-actor",
          [actor.id],
          masked.slice(o.start, o.end),
          `${actor.name} is absent and the prose shows them.`,
        );
        break;
      }
      for (const z of fogged) {
        if (
          new RegExp(
            `(?<![\\p{L}\\p{N}_])${escapeRe(z.name)}(?![\\p{L}\\p{N}_])`,
            "iu",
          ).test(masked)
        )
          push(
            "leak",
            "fogged-zone",
            [],
            z.name,
            `The zone ${z.name} is not revealed to the players.`,
          );
      }
      // Contradictions.
      const digit = /[0-9]/.exec(raw);
      if (digit)
        push(
          "contradiction",
          "digit",
          [],
          raw,
          "Narration states no numbers; the fact rows carry them.",
        );
      const dice = !input.hasRoll ? DICE_LANGUAGE.exec(masked) : null;
      if (dice)
        push(
          "contradiction",
          "dice-language",
          [],
          dice[0],
          "The text names dice and no roll was made.",
        );
      for (const h of lifeStateHits(snapshot, masked)) {
        const name = lifeOf(snapshot, h.id)?.name ?? h.id;
        const row = input.rows.find((r) => r.includes(name));
        push(
          "contradiction",
          "life-state",
          [h.id],
          h.matched,
          row ??
            `${name} is not ${/dies|died|dead|killed|slain/i.test(h.word) ? "dead" : "down"}.`,
        );
      }
    }
  }
  return issues;
}

/** Removes each listed sentence from `text`; sentences compare trimmed. */
export function dropSentences(
  text: string,
  sentences: readonly string[],
): string {
  const drop = new Set(sentences.map((s) => s.trim()));
  return sentencesOf(text)
    .filter((s) => !drop.has(s.raw))
    .map((s) => s.raw)
    .join(" ");
}
