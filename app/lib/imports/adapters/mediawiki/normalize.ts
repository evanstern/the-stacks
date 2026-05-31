export function normalizeMediaWikiTitle(title: string): string {
  return title.trim().replace(/[_\s]+/g, " ").toLowerCase();
}

export function titleLookupCandidates(title: string): string[] {
  const trimmed = title.trim();
  const spaced = trimmed.replace(/_/g, " ");
  const underscored = trimmed.replace(/\s+/g, "_");
  return Array.from(new Set([trimmed, spaced, underscored, normalizeMediaWikiTitle(title)]));
}
