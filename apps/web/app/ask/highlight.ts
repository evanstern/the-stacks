import type { Span } from "./types";

/**
 * Pure highlight-slice module (plan D11, FR-033). No runtime imports —
 * import type only, erasable TypeScript only (research R8).
 *
 * Splits passage text into [before, marked, after] around
 * `quoteInPassage`, clamping out-of-range offsets so a stale offset never
 * throws. The contract guarantees
 * `text.slice(quoteInPassage.start, quoteInPassage.end) === quote`
 * (ask-sse.md), so `marked` is the citation's exact quote.
 */
export function splitPassage(
  text: string,
  quoteInPassage: Span,
): [string, string, string] {
  const start = Math.max(0, Math.min(quoteInPassage.start, text.length));
  const end = Math.max(start, Math.min(quoteInPassage.end, text.length));
  return [text.slice(0, start), text.slice(start, end), text.slice(end)];
}
