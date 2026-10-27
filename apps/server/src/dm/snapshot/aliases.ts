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
