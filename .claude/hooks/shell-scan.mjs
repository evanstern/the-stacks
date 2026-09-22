// shell-scan.mjs — single-pass, quote-aware shell-word scanner for the
// root-guard hook (TASK-101 / spec 051, R2 + R5(b)).
//
// This REPLACES the defective two-regex parse in promptworld's
// root-guard-hook.mjs (`parseGitInvocation`): a boundary regex
// `/[;|&\n`)]/` and a tokenizer `/("[^"]*"|'[^']*'|\S+)/g`, both applied to
// the raw command string with NO regard for quote state. A `-m` message that
// contains a newline or a `)` truncated the segment mid-quote; the now
// unterminated `"` never matched `"[^"]*"`, so `\S+` shattered the message
// into bare words that were then read as pathspecs. The default-correct
// `Co-Authored-By: Claude Opus 5 (1M context) <noreply@…>` trailer carries
// BOTH hazards (a blank line and a `)`), so it reliably tripped the gate.
//
// The fix is a real single-pass scanner that tracks single-quote,
// double-quote, ANSI-C (`$'…'`), locale (`$"…"`), and backslash-escape state,
// so a separator INSIDE a quoted run is literal, never a boundary. plan.md
// rejects a lookbehind / "skip quoted runs" patch on the regexes: it passes the
// obvious tests and fails on nesting and escapes. The scanner is the design.
//
// Phase 5 (spec R2a) closed a fail-open gap: two EXECUTABLE bash forms scanned
// ok:false and so were waved through fail-open — `$'it\'s a fix'` (ANSI-C
// quoting with an escaped apostrophe) and a trailing `\` at EOF. Modeling
// `$'…'`, treating `$"…"` as a double-quoted run, and resolving a trailing
// backslash make both scan ok:true, so they are gated under policy. This
// STRICTLY TIGHTENS — it turns ok:false (allow) into ok:true (evaluate); it
// cannot make anything more permissive.
//
// Node >= 18, ESM, zero npm dependencies. Pure functions — no stdin, no fs,
// no process: unit-testable in isolation, which is the whole point of lifting
// the parse out of the hook's stdin contract.
//
// ---------------------------------------------------------------------------
// Separators. A separator is a command boundary ONLY outside quotes:
//
//   ;  |  &  <newline>  `(backtick)  )  (
//
// The first six match the boundary class the defective parser used
// (`[;|&\n`)]`). `(` is added so `$(git …)` / `(git …)` subshell invocations
// are seen at COMMAND POSITION — promptworld's own git-detection regex
// `/(?:^|[;&|`(\n])\s*git(?=\s|$)/` already includes `(`, so this preserves
// its behavior rather than widening policy. An unquoted `(` in a legitimate
// git command outside a subshell is effectively never seen (globs/paths are
// quoted), so treating it as a boundary is safe and strictly more correct for
// substitutions.
const SEPARATORS = new Set([';', '|', '&', '\n', '`', ')', '(']);

// In double quotes, a backslash escapes only these (POSIX); before anything
// else the backslash is a literal character.
const DQ_ESCAPABLE = new Set(['"', '\\', '$', '`', '\n']);

// ANSI-C quoting `$'…'` (Phase 5 / spec R2a): inside it, a backslash-escape is
// interpreted and the resolved character replaces the escape sequence. `\'` is
// the load-bearing case — a backslash-escaped apostrophe is a LITERAL `'` that
// does NOT close the run, so `$'it\'s a fix'` is the single word `it's a fix`
// (a valid, executable bash command). The named escapes below cover bash's
// common set; the two the dispatch calls out (`\n`, `\t`, `\\`) resolve to
// newline/tab/backslash. An unrecognized escape (`\x`/`\0`/`\u` numeric forms,
// or an arbitrary `\q`) resolves to the escaped character itself — a deliberate
// simplification, since the resolved value of a `$'…'` token is only ever a
// commit-message value here, never a pathspec, so exact numeric expansion is
// not load-bearing; what matters is that the run is BALANCED and scans ok:true
// so the command is gated under policy rather than waved through fail-open.
const ANSI_C_ESCAPES = {
  n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"',
  a: '\x07', b: '\b', f: '\f', v: '\v', e: '\x1b', E: '\x1b',
};

/**
 * Single-pass quote-state scanner. Splits `command` into segments — maximal
 * runs of tokens uninterrupted by an unquoted separator — with full
 * single-quote, double-quote and backslash-escape tracking.
 *
 * Token rules:
 *   - Unquoted whitespace ends the current token (but not the segment).
 *   - A quoted run accumulates into the CURRENT token: `-m "a b"` is two
 *     tokens (`-m`, `a b`), never three. `'it'\''s'` is one token (`it's`).
 *   - Separators inside any quote are literal; outside quotes they end the
 *     token AND the segment (the next token is then at command position).
 *
 * FAIL-CLOSED contract: an UNBALANCED quote (single, double, or an unterminated
 * `$'…'`/`$"…"` run) makes the command unparseable. The scanner then returns
 * `{ ok: false, reason }` and NO tokens — never a partial/shattered token list.
 * An unparseable command is not an allowed command: a caller cannot mistake
 * shredded words for pathspecs (the exact original defect), because there are no
 * words to mistake. It never throws.
 *
 * A trailing backslash at EOF is NOT a failure (Phase 5): bash accepts it and
 * drops it (`README.md\` ⇒ `README.md`), so the scanner resolves it rather than
 * reporting `dangling-escape` — the former ok:false there was a fail-open hole
 * for an executable command. `dangling-escape` now signals only non-string
 * input.
 *
 * @param {string} command
 * @returns {{ok: true, segments: Array<Array<{value: string, index: number}>>,
 *            terminators: Array<string|null>}
 *          | {ok: false, reason: 'unbalanced-single-quote'
 *                              | 'unbalanced-double-quote'
 *                              | 'dangling-escape'}}
 *   On success, `segments[i]` is that segment's tokens in order; each token
 *   carries its `value` (quotes/escapes resolved) and the `index` (char
 *   offset in `command`) where the token began — Phase 3 needs the index to
 *   resolve each invocation's effective dir (`cd`/`-C` before it).
 *   `terminators[i]` is the unquoted separator character that ENDED
 *   `segments[i]` (one of SEPARATORS), or `null` when the segment ran to the
 *   end of input with no trailing separator — spec 064 needs this to tell a
 *   piped segment (`|`) from one merely followed by `;`/`&`/newline/etc.
 */
export function scanCommand(command) {
  if (typeof command !== 'string') return { ok: false, reason: 'dangling-escape' };

  const segments = [];
  const terminators = [];
  let segment = [];

  let cur = '';
  let tokenOpen = false; // a token is being built (may be empty, e.g. "")
  let tokenIndex = -1; // char offset where the current token began

  let inSingle = false;
  let inDouble = false;
  let inAnsiC = false; // inside a `$'…'` ANSI-C-quoted run

  const openToken = (i) => {
    if (!tokenOpen) {
      tokenOpen = true;
      tokenIndex = i;
    }
  };
  const endToken = () => {
    if (tokenOpen) {
      segment.push({ value: cur, index: tokenIndex });
      cur = '';
      tokenOpen = false;
      tokenIndex = -1;
    }
  };
  const endSegment = (terminator) => {
    endToken();
    segments.push(segment);
    terminators.push(terminator ?? null);
    segment = [];
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (inSingle) {
      // Inside single quotes NOTHING is special except the closing quote —
      // backslashes and separators are all literal.
      if (ch === "'") inSingle = false;
      else cur += ch;
      continue;
    }

    if (inAnsiC) {
      // ANSI-C `$'…'`: backslash escapes are INTERPRETED. `\'` is a literal
      // apostrophe that does NOT close the run — the exact case that broke
      // fail-open. An unescaped `'` closes the run.
      if (ch === '\\') {
        const next = command[i + 1];
        if (next === undefined) continue; // unterminated — caught as unbalanced below
        cur += Object.prototype.hasOwnProperty.call(ANSI_C_ESCAPES, next)
          ? ANSI_C_ESCAPES[next]
          : next; // unrecognized escape ⇒ the escaped char literally
        i++;
      } else if (ch === "'") {
        inAnsiC = false;
      } else {
        cur += ch; // separators, spaces, newlines: all literal in ANSI-C quotes
      }
      continue;
    }

    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      } else if (ch === '\\') {
        const next = command[i + 1];
        if (next !== undefined && DQ_ESCAPABLE.has(next)) {
          cur += next;
          i++;
        } else {
          cur += ch; // literal backslash
        }
      } else {
        cur += ch; // separators, spaces, newlines: all literal in double quotes
      }
      continue;
    }

    // --- outside all quotes ---

    if (ch === '\\') {
      // Backslash escapes the next char literally (including a quote, space,
      // or separator). A trailing backslash at EOF is NOT a dangling escape:
      // bash accepts it and drops it (Phase 5 — `README.md\` ⇒ `README.md`), so
      // resolve it (keep the token open, append nothing) rather than fail open
      // an executable command.
      const next = command[i + 1];
      if (next === undefined) {
        openToken(i);
        continue;
      }
      openToken(i);
      cur += next;
      i++;
      continue;
    }

    if (ch === '$') {
      // `$'…'` (ANSI-C) and `$"…"` (locale) are quote introducers. `$"…"`
      // tokenizes exactly as a double-quoted run (locale translation is
      // identity here). A `$` before anything else (`$(`, `$VAR`, a bare `$`)
      // stays literal — this preserves `$(git …)` subshell detection, since
      // `(` is a separator seen right after.
      const next = command[i + 1];
      if (next === "'") {
        openToken(i);
        inAnsiC = true;
        i++; // consume the opening quote
        continue;
      }
      if (next === '"') {
        openToken(i);
        inDouble = true;
        i++; // consume the opening quote
        continue;
      }
      openToken(i);
      cur += ch; // literal `$`
      continue;
    }

    if (ch === "'") {
      openToken(i);
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      openToken(i);
      inDouble = true;
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\r') {
      endToken(); // whitespace ends a token, not a segment
      continue;
    }

    if (SEPARATORS.has(ch)) {
      endSegment(ch); // unquoted separator ends token AND segment
      continue;
    }

    openToken(i);
    cur += ch;
  }

  if (inSingle || inAnsiC) return { ok: false, reason: 'unbalanced-single-quote' };
  if (inDouble) return { ok: false, reason: 'unbalanced-double-quote' };

  endSegment(null); // ran to end of input: no trailing separator
  return { ok: true, segments, terminators };
}

/**
 * Command-position `git` invocations in `command`.
 *
 * A `git` token qualifies ONLY as the FIRST token of its segment — i.e. at
 * the start of the command or immediately after an unquoted separator /
 * pipeline operator (`;`, `&&`, `||`, `|`, newline, backtick, `$(` …). This
 * is what kills R5(b), the content false-positive: a `git` that lives inside
 * a quoted argument becomes part of one quoted token (never its own token),
 * and a `git` that is an option value is not first-of-segment — so prose like
 * `backlog task edit "… git commit …"` is NOT classified as a git invocation.
 *
 * Fail-closed propagates: if the command does not parse, this returns the
 * scanner's `{ ok: false, reason }` unchanged (no invocations invented from a
 * broken parse).
 *
 * @param {string} command
 * @returns {{ok: true, invocations: Array<{index: number, tokens: string[]}>}
 *          | {ok: false, reason: string}}
 *   Each invocation's `tokens` is the whole segment's token VALUES with
 *   `tokens[0] === 'git'`; `index` is the char offset of that `git` token
 *   (for effective-dir resolution in Phase 3).
 */
export function findGitInvocations(command) {
  const scan = scanCommand(command);
  if (!scan.ok) return scan;

  const invocations = [];
  for (const segment of scan.segments) {
    if (segment.length > 0 && segment[0].value === 'git') {
      invocations.push({
        index: segment[0].index,
        tokens: segment.map((t) => t.value),
      });
    }
  }
  return { ok: true, invocations };
}
