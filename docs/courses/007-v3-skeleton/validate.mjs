#!/usr/bin/env node
/* codebase-to-course chrome v2 — inline translation engine (comments-on-top)
 *
 * validate.mjs — translation-block validator.
 * Copy this file verbatim into the course output directory; build.sh runs it
 * before assembling index.html. It is self-contained (Node stdlib only).
 *
 * Two contracts are enforced on every .translation-block:
 *
 *  1. PAIRING — exactly one .tl note per .code-line. The inline engine pairs
 *     them positionally, so one missing note silently misaligns every note
 *     after it. A count mismatch is always an authoring bug.
 *
 *  2. BALANCE — the block's code, read as text (tags stripped, HTML entities
 *     decoded, string literals and comments removed), must have balanced
 *     ()/[]/{} brackets. A code excerpt that stops mid-structure reads as
 *     broken to anyone who knows code. Trim excerpts from WITHIN instead:
 *     replace the skipped middle with a `// …` comment code-line (with its
 *     own paired .tl note) and keep every closing bracket.
 *
 * Usage:
 *   node validate.mjs modules/*.html          check; exit 1 on violations
 *   node validate.mjs --fix modules/*.html    also auto-close fixable blocks
 *
 * --fix handles the mechanical half only: when a block's sole problem is
 * unclosed brackets, it appends an elision comment code-line plus a closer
 * code-line (and two paired .tl notes) so pairing and balance both hold.
 * Stray closers, mismatched pairs, and unterminated strings still need a
 * human/author pass — the excerpt itself is cut wrong.
 *
 * Opt-out: <div class="translation-block" data-validate="off"> skips a block.
 * Reserve it for deliberately fragmentary pseudo-code.
 */
import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The chrome generation this validator ships with. Bump ONLY when the
 *  rendering contract changes (what authored markup means on screen), and
 *  bump the stamp in every chrome file together — see docs/skill-patterns.md
 *  "Versioned course chrome". v1 is the retired side-by-side renderer, which
 *  predates stamping (no header = v1). */
export const CHROME_VERSION = 2;

const OPEN = { "(": ")", "[": "]", "{": "}" };
const CLOSE = { ")": "(", "]": "[", "}": "{" };

/* ── HTML micro-parsing (no dependencies) ─────────────────────── */

function hasClassToken(attrs, token) {
  const m = /class\s*=\s*"([^"]*)"/.exec(attrs) || /class\s*=\s*'([^']*)'/.exec(attrs);
  return !!m && m[1].split(/\s+/).includes(token);
}

function stripTags(html) {
  return html.replace(/<[^>]*>/g, "");
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function lineOf(html, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (html[i] === "\n") n++;
  return n;
}

/** All elements of `tagName` whose class list contains `classToken`,
 *  with nesting of the same tag handled. Returns
 *  { start, end, innerStart, innerEnd, inner } (end = after the close tag). */
function findElements(html, tagName, classToken) {
  const out = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
  let m, open = null, depth = 0;
  while ((m = re.exec(html))) {
    const [, slash, name, attrs] = m;
    if (name.toLowerCase() !== tagName) continue;
    const selfClosing = /\/\s*$/.test(attrs);
    if (!slash) {
      if (open === null) {
        if (hasClassToken(attrs, classToken)) {
          if (selfClosing) out.push({ start: m.index, end: re.lastIndex, innerStart: re.lastIndex, innerEnd: re.lastIndex, inner: "" });
          else { open = { start: m.index, innerStart: re.lastIndex }; depth = 1; }
        }
      } else if (!selfClosing) depth++;
    } else if (open !== null && --depth === 0) {
      out.push({ start: open.start, end: re.lastIndex, innerStart: open.innerStart, innerEnd: m.index, inner: html.slice(open.innerStart, m.index) });
      open = null;
    }
  }
  return out;
}

/** Open tags (any element) whose class list contains `classToken` — exact
 *  token match, so `tl` does not match `tl-inline`. */
function openTagsWithClass(html, classToken) {
  const out = [];
  const re = /<([a-zA-Z][\w-]*)([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) if (hasClassToken(m[2], classToken)) out.push({ start: m.index, end: re.lastIndex });
  return out;
}

/** Each .translation-block open tag, its attrs, and its chunk extent (to the
 *  next block or end of input — blocks never nest, and the tracked classes
 *  only occur inside blocks, so chunk counting is exact). */
function findBlocks(html) {
  const opens = [];
  const re = /<div([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) if (hasClassToken(m[1], "translation-block")) opens.push({ start: m.index, attrs: m[1] });
  return opens.map((o, i) => ({ ...o, end: i + 1 < opens.length ? opens[i + 1].start : html.length, n: i + 1 }));
}

/* ── bracket balance over code text ───────────────────────────── */

/** Scan decoded code text with a small language-agnostic lexer: skips
 *  '…'/"…" strings (single-line), `…` template literals (multi-line),
 *  //-line, ⧸*…*⧸-block, and whitespace-then-# line comments, then tracks
 *  bracket depth. Returns { errs, unclosed, fixable }. */
export function scanBalance(text) {
  const errs = [];
  const stack = [];
  let line = 1, state = "code", hard = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === "\n") {
      line++;
      // sq/dq strings and line comments end at the newline (a string left
      // open by a bad cut must not swallow the rest of the block)
      if (state === "sq" || state === "dq" || state === "line") state = "code";
      continue;
    }
    switch (state) {
      case "sq": if (c === "\\") i++; else if (c === "'") state = "code"; break;
      case "dq": if (c === "\\") i++; else if (c === '"') state = "code"; break;
      case "bt": if (c === "\\") i++; else if (c === "`") state = "code"; break;
      case "block": if (c === "*" && next === "/") { i++; state = "code"; } break;
      case "line": break;
      default:
        if (c === "'") state = "sq";
        else if (c === '"') state = "dq";
        else if (c === "`") state = "bt";
        else if (c === "/" && next === "/") { state = "line"; i++; }
        else if (c === "/" && next === "*") { state = "block"; i++; }
        // `#` comments only when followed by whitespace or `!` (shebang) —
        // keeps CSS hex colors, #include, #region reading as code
        else if (c === "#" && (next === undefined || next === " " || next === "\t" || next === "!")) state = "line";
        else if (OPEN[c]) stack.push({ ch: c, line });
        else if (CLOSE[c]) {
          const top = stack.pop();
          if (!top) { errs.push(`stray '${c}' on code line ${line} — nothing is open for it to close`); hard = true; }
          else if (OPEN[top.ch] !== c) { errs.push(`'${top.ch}' opened on code line ${top.line} is closed by '${c}' on line ${line}`); hard = true; }
        }
    }
  }
  if (state === "bt") { errs.push("unterminated template literal — the excerpt ends mid-string"); hard = true; }
  for (const o of stack) errs.push(`'${o.ch}' opened on code line ${o.line} is never closed`);
  return { errs, unclosed: stack.map((o) => o.ch), fixable: !hard && stack.length > 0 };
}

/* ── the check ────────────────────────────────────────────────── */

/** Validate every translation block in an HTML string (a module file or a
 *  built index.html). Returns { fails, blocks, details }; `fails` is
 *  human-readable, `details` feeds --fix. */
export function checkTranslationBlocks(html, source = "html") {
  const fails = [];
  const details = [];
  const blocks = findBlocks(html);
  for (const b of blocks) {
    const id = `${source}: translation block ${b.n} (line ${lineOf(html, b.start)})`;
    if (/data-validate\s*=\s*["']off["']/.test(b.attrs)) { details.push({ ...b, skipped: true }); continue; }
    const chunk = html.slice(b.start, b.end);
    const codeEls = findElements(chunk, "span", "code-line");
    const tls = openTagsWithClass(chunk, "tl");
    if (!codeEls.length) fails.push(`${id}: no .code-line spans found`);
    if (codeEls.length !== tls.length)
      fails.push(`${id}: ${codeEls.length} .code-line vs ${tls.length} .tl — the inline engine pairs positionally, so every note after the first gap sits on the wrong code line. Author exactly one .tl per .code-line, in order.`);
    const codeText = codeEls.map((e) => decodeEntities(stripTags(e.inner))).join("\n");
    const bal = scanBalance(codeText);
    for (const e of bal.errs) fails.push(`${id}: ${e}`);
    details.push({ ...b, codeEls, tls, bal });
  }
  return { fails, blocks: blocks.length, details };
}

/* ── --fix: mechanical auto-close ─────────────────────────────── */

const ELIDE_NOTE_1 = "The middle of this code is trimmed for the lesson — the shape above is what matters.";
const ELIDE_NOTE_2 = "…and everything that was opened gets closed.";

/** Auto-close every fixable block in an HTML string. Returns
 *  { html, fixed, unfixable } — `unfixable` lists block numbers whose
 *  problems need an author (stray/mismatched closers, unterminated strings,
 *  pairing gaps in the middle of the block). */
export function fixTranslationBlocks(html, source = "html") {
  const { details } = checkTranslationBlocks(html, source);
  let fixed = 0;
  const unfixable = [];
  // last-to-first so earlier offsets stay valid across insertions
  for (const b of [...details].reverse()) {
    if (b.skipped || !b.bal || !b.bal.errs.length) continue;
    if (!b.bal.fixable) { unfixable.push(b.n); continue; }
    const chunk = html.slice(b.start, b.end);
    const lastCode = b.codeEls[b.codeEls.length - 1];
    const linesDiv = findElements(chunk, "div", "translation-lines")[0];
    if (!lastCode || !linesDiv) { unfixable.push(b.n); continue; }
    const closers = b.bal.unclosed.slice().reverse().map((ch) => OPEN[ch]).join("");
    const codeIns =
      `\n<span class="code-line"><span class="code-comment">// … rest of this excerpt elided …</span></span>` +
      `\n<span class="code-line">${closers}</span>`;
    const noteIns =
      `  <p class="tl">${ELIDE_NOTE_1}</p>\n` +
      `      <p class="tl">${ELIDE_NOTE_2}</p>\n    `;
    const edits = [
      { at: b.start + linesDiv.innerEnd, text: noteIns },
      { at: b.start + lastCode.end, text: codeIns },
    ].sort((a, z) => z.at - a.at);
    for (const e of edits) html = html.slice(0, e.at) + e.text + html.slice(e.at);
    fixed++;
  }
  return { html, fixed, unfixable };
}

/* ── chrome version consistency ───────────────────────────────── */

const STAMP = /chrome v(\d+)/;

/** Check that a course dir's vendored chrome matches this validator's
 *  generation. Unstamped chrome is v1 (pre-inline side-by-side) — the drift
 *  the stamp exists to catch; mixed stamps mean a partial upgrade. */
export function checkChrome(courseDir) {
  const fails = [];
  for (const f of ["styles.css", "main.js"]) {
    const p = join(courseDir, f);
    if (!existsSync(p)) { fails.push(`${f}: missing from ${courseDir}`); continue; }
    const m = STAMP.exec(readFileSync(p, "utf8").slice(0, 600));
    if (!m) fails.push(`${f} has no chrome version stamp — that's v1, the retired side-by-side renderer. Upgrade: copy the plugin references/ files over this course dir and rebuild (gotchas.md "Stale Chrome").`);
    else if (+m[1] !== CHROME_VERSION) fails.push(`${f} is chrome v${m[1]} but this validator is v${CHROME_VERSION} — mixed chrome. Re-copy ALL reference files together, then rebuild.`);
  }
  return fails;
}

/* ── CLI ──────────────────────────────────────────────────────── */

function main() {
  const args = process.argv.slice(2);
  const fix = args.includes("--fix");
  const files = [];
  let chromeDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fix") continue;
    else if (args[i] === "--chrome-dir") chromeDir = args[++i];
    else files.push(args[i]);
  }
  if (!files.length && !chromeDir) {
    console.error("usage: node validate.mjs [--fix] [--chrome-dir <course-dir>] <module.html>...");
    process.exit(2);
  }
  let allFails = chromeDir ? checkChrome(chromeDir) : [];
  for (const file of files) {
    let html = readFileSync(file, "utf8");
    if (fix) {
      const r = fixTranslationBlocks(html, file);
      if (r.fixed) {
        writeFileSync(file, r.html);
        html = r.html;
        console.log(`fixed: ${file} — auto-closed ${r.fixed} block(s)`);
      }
      for (const n of r.unfixable)
        console.log(`unfixable: ${file} block ${n} — needs an author pass (see failures below)`);
    }
    allFails = allFails.concat(checkTranslationBlocks(html, file).fails);
  }
  if (allFails.length) {
    console.log(`\nTRANSLATION-BLOCK VALIDATION FAILED (${allFails.length} issue(s)):`);
    for (const f of allFails) console.log(`  - ${f}`);
    console.log(
      "\nhint: trim excerpts from WITHIN — replace a skipped middle with a `// …` comment" +
      "\ncode-line (plus its paired .tl note) and keep every closing bracket. `--fix`" +
      '\nappends the closers mechanically; data-validate="off" on a block opts it out.'
    );
    process.exit(1);
  }
  console.log(`OK: translation blocks valid across ${files.length} file(s).`);
}

// Realpath both sides: import.meta.url is symlink-resolved but argv[1] is as typed, so a
// naive comparison through a symlinked path silently skips main() — never validating.
if (process.argv[1] && existsSync(process.argv[1]) &&
    realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]))) main();
