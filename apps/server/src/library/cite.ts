/**
 * Citation marker parsing and quote verification (specs/018-rules-answerer,
 * contracts/answer.md, research R1). Pure: no I/O, no gateway, no database.
 */

export interface QuoteMatch {
  start: number; // offset into passageText, inclusive
  end: number; // offset into passageText, exclusive
}

/** A normalized character's span in the original string it was built from. */
type Span = [start: number, end: number];

const CURLY_QUOTES: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "‟": '"',
  "–": "-", // en dash
  "—": "-", // em dash
};

/**
 * Collapses whitespace runs to one space, maps curly quotes to straight ones
 * and en/em dashes to `-`, and trims — each output character keeping the
 * span of original characters it came from, so a match can be sliced back to
 * the original string's own offsets (research R1 step 3).
 */
function normalizeWithMap(s: string): { normalized: string; spans: Span[] } {
  let out = "";
  const spans: Span[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      out += " ";
      spans.push([i, j]);
      i = j;
      continue;
    }
    out += CURLY_QUOTES[ch] ?? ch;
    spans.push([i, i + 1]);
    i++;
  }
  let start = 0;
  let end = out.length;
  while (start < end && out[start] === " ") start++;
  while (end > start && out[end - 1] === " ") end--;
  return { normalized: out.slice(start, end), spans: spans.slice(start, end) };
}

/**
 * Verifies a model-claimed quote against the stored passage text (research
 * R1 step 3). Exact match wins first; otherwise a whitespace/typography
 * repair is attempted. Rejects a too-short quote (under 12 characters or
 * under 3 words) unless it is the whole passage, and rejects no-match. Case
 * sensitive; first occurrence wins.
 */
export function locateQuote(
  passageText: string,
  quote: string,
): QuoteMatch | null {
  const normQuote = normalizeWithMap(quote);
  const normPassage = normalizeWithMap(passageText);
  const isWholePassage = normQuote.normalized === normPassage.normalized;
  const wordCount = normQuote.normalized.split(" ").filter(Boolean).length;
  if (!isWholePassage && (normQuote.normalized.length < 12 || wordCount < 3)) {
    return null;
  }

  const exactIdx = passageText.indexOf(quote);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + quote.length };
  }

  if (normQuote.normalized.length === 0) return null;
  const idx = normPassage.normalized.indexOf(normQuote.normalized);
  if (idx === -1) return null;
  const startSpan = normPassage.spans[idx];
  const endSpan = normPassage.spans[idx + normQuote.normalized.length - 1];
  return { start: startSpan[0], end: endSpan[1] };
}

export type CiteToken =
  | { type: "text"; text: string }
  | { type: "cite"; p: string; quote: string } // raw, unverified
  | { type: "malformed" } // unterminated or oversized marker
  | { type: "refuse" }; // <refuse/> seen

const MAX_MARKER_LENGTH = 1000;
const CITE_OPEN = "<cite";
const REFUSE_OPEN = "<refuse";
const CITE_CLOSE = "</cite>";
const OPEN_TAG_RE = /^<cite\s+p="([^"]*)"\s*>$/;
const REFUSE_TAG_RE = /^<refuse\s*\/>$/;

/** Longest suffix of `str` that is also a proper prefix of `marker`. */
function suffixPrefixOverlap(str: string, marker: string): number {
  const maxLen = Math.min(str.length, marker.length - 1);
  for (let len = maxLen; len > 0; len--) {
    if (str.endsWith(marker.slice(0, len))) return len;
  }
  return 0;
}

/**
 * Incremental parser (research R1 step 2): splits streamed model text into
 * plain text and `<cite p="N">…</cite>` / `<refuse/>` markers, holding back
 * any trailing fragment that could still become one, so a marker split
 * across any number of `push()` calls parses the same as unsplit.
 */
export function createCiteParser(): {
  push(text: string): CiteToken[];
  end(): CiteToken[];
} {
  let buffer = "";
  let mode: "text" | "openTag" | "refuseTag" | "citeContent" = "text";
  let citeP = "";
  let openTagLen = 0;
  let contentAccum = "";

  function resetToText(): void {
    buffer = "";
    contentAccum = "";
    openTagLen = 0;
    mode = "text";
  }

  function extract(): CiteToken[] {
    const tokens: CiteToken[] = [];
    for (;;) {
      if (mode === "text") {
        const lt = buffer.indexOf("<");
        if (lt === -1) {
          if (buffer) tokens.push({ type: "text", text: buffer });
          buffer = "";
          return tokens;
        }
        if (lt > 0) {
          tokens.push({ type: "text", text: buffer.slice(0, lt) });
          buffer = buffer.slice(lt);
        }
        if (CITE_OPEN.startsWith(buffer) && buffer.length < CITE_OPEN.length) {
          return tokens; // could still become <cite>
        }
        if (
          REFUSE_OPEN.startsWith(buffer) &&
          buffer.length < REFUSE_OPEN.length
        ) {
          return tokens; // could still become <refuse/>
        }
        if (buffer.startsWith(CITE_OPEN)) {
          mode = "openTag";
          continue;
        }
        if (buffer.startsWith(REFUSE_OPEN)) {
          mode = "refuseTag";
          continue;
        }
        // A lone `<` that cannot start a marker is plain text.
        tokens.push({ type: "text", text: "<" });
        buffer = buffer.slice(1);
        continue;
      }

      if (mode === "openTag") {
        const gt = buffer.indexOf(">");
        if (gt === -1) {
          if (buffer.length > MAX_MARKER_LENGTH) {
            tokens.push({ type: "malformed" });
            resetToText();
            continue;
          }
          return tokens;
        }
        const openTag = buffer.slice(0, gt + 1);
        buffer = buffer.slice(gt + 1);
        const m = OPEN_TAG_RE.exec(openTag);
        if (!m) {
          tokens.push({ type: "malformed" });
          resetToText();
          continue;
        }
        citeP = m[1];
        openTagLen = openTag.length;
        contentAccum = "";
        mode = "citeContent";
        continue;
      }

      if (mode === "refuseTag") {
        const gt = buffer.indexOf(">");
        if (gt === -1) {
          if (buffer.length > MAX_MARKER_LENGTH) {
            tokens.push({ type: "malformed" });
            resetToText();
            continue;
          }
          return tokens;
        }
        const tag = buffer.slice(0, gt + 1);
        buffer = buffer.slice(gt + 1);
        tokens.push(
          REFUSE_TAG_RE.test(tag) ? { type: "refuse" } : { type: "malformed" },
        );
        mode = "text";
        continue;
      }

      // mode === "citeContent"
      const closeIdx = buffer.indexOf(CITE_CLOSE);
      if (closeIdx === -1) {
        const totalLen = openTagLen + contentAccum.length + buffer.length;
        if (totalLen > MAX_MARKER_LENGTH) {
          tokens.push({ type: "malformed" });
          resetToText();
          continue;
        }
        const holdBack = suffixPrefixOverlap(buffer, CITE_CLOSE);
        contentAccum += buffer.slice(0, buffer.length - holdBack);
        buffer = buffer.slice(buffer.length - holdBack);
        return tokens;
      }
      contentAccum += buffer.slice(0, closeIdx);
      buffer = buffer.slice(closeIdx + CITE_CLOSE.length);
      tokens.push({ type: "cite", p: citeP, quote: contentAccum });
      contentAccum = "";
      openTagLen = 0;
      mode = "text";
    }
  }

  return {
    push(text: string): CiteToken[] {
      buffer += text;
      return extract();
    },
    end(): CiteToken[] {
      const tokens: CiteToken[] = [];
      if (mode === "text") {
        if (buffer) tokens.push({ type: "text", text: buffer });
      } else {
        // An open <cite>/<refuse> marker that never closed.
        tokens.push({ type: "malformed" });
      }
      resetToText();
      return tokens;
    },
  };
}
