/** Leading title words dropped when deriving a given name (compared case-insensitively). */
export const TITLE_WORDS: ReadonlySet<string> = new Set([
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

/**
 * Match terms for one named thing: the full name, each id, then the given name
 * of a multi-word name (the first word after leading title words). Deduped in
 * that order, trimmed, no empties (contract §4).
 */
export function nameTerms(name: string, ids: readonly string[] = []): string[] {
  const terms = new Set<string>();
  const full = name.trim();
  if (full) terms.add(full);
  for (const raw of ids) {
    const id = raw.trim();
    if (id) terms.add(id);
  }
  const words = full.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    let i = 0;
    while (i < words.length && TITLE_WORDS.has((words[i] ?? "").toLowerCase()))
      i++;
    const given = words[i];
    if (given) terms.add(given);
  }
  return [...terms];
}

const escapeRe = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface AliasOccurrence {
  start: number;
  end: number;
  /** Every actor holding the matched alias. */
  ids: string[];
  /** Exactly one actor holds the alias. */
  unique: boolean;
  /** The match carries a possessive ('s). */
  possessive: boolean;
}

type AliasHolders = {
  actors: readonly { id: string; aliases: readonly string[] }[];
};

/** Whole-word alias matches in `text`, longest alias first at each position. */
export function aliasOccurrences(
  snapshot: AliasHolders,
  text: string,
): AliasOccurrence[] {
  const terms = new Map<string, Set<string>>();
  for (const a of snapshot.actors) {
    for (const alias of a.aliases) {
      const key = alias.trim().toLowerCase();
      if (!key) continue;
      const set = terms.get(key) ?? new Set<string>();
      set.add(a.id);
      terms.set(key, set);
    }
  }
  if (terms.size === 0) return [];
  const alts = [...terms.keys()].sort((x, y) => y.length - x.length);
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${alts.map(escapeRe).join("|")})(['\u2019]s)?(?![\\p{L}\\p{N}_])`,
    "giu",
  );
  return [...text.matchAll(re)].map((m) => {
    const ids = [...(terms.get((m[1] as string).toLowerCase()) ?? [])];
    return {
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      ids,
      unique: ids.length === 1,
      possessive: Boolean(m[2]),
    };
  });
}

/**
 * The actor ids a text names by a unique snapshot alias, in order, once each (spec 089 D1).
 * Whole-word match. An alias two actors share names no one.
 * ponytail: unique aliases only; a description with no alias ("a small figure") names no one;
 * upgrade to an interpret field (spec 089 OQ-1 b) when a playtest shows a descriptive reveal slipping through.
 */
export function namedActorIds(snapshot: AliasHolders, text: string): string[] {
  const ids: string[] = [];
  for (const o of aliasOccurrences(snapshot, text)) {
    const id = o.ids[0] as string;
    if (o.unique && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
