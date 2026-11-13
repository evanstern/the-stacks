// WCAG AA contrast on the real Daylight tokens (plan D15, research R12,
// SC-006). Parses app.css's three token blocks with a regex; no CSS parser
// dependency needed for `--name: #hex` declarations.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../app/app.css", import.meta.url), "utf8");

function tokensIn(block) {
  const tokens = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens[m[1]] = m[2];
  }
  return tokens;
}

function extract(regex) {
  const match = css.match(regex);
  assert.ok(match, `pattern not found in app.css: ${regex}`);
  return tokensIn(match[1]);
}

const light = extract(/(?<!\[data-theme="light"\]\s*)^:root\s*\{([^}]*)\}/m);
const mediaDark = extract(
  /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/,
);
const themeDark = extract(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) {
    h = [...h].map((c) => c + c).join("");
  }
  const num = Number.parseInt(h.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function channel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

const TEXT_PAIRS = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "muted"],
  ["foreground", "sidebar"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "sidebar"],
  ["primary-foreground", "primary"],
  ["primary", "background"],
  ["primary", "card"],
  ["mark-foreground", "mark"],
  ["destructive", "destructive-surface"],
  ["ok", "ok-surface"],
  ["proc", "proc-surface"],
  ["muted-foreground", "queued-surface"],
  // Spec 091 T024: stream rows. Roll rows and room blocks use foreground and
  // muted-foreground on card/background (covered above); chips and the IC /
  // table-talk badges sit on secondary, hover and the ask-DM row on accent.
  ["foreground", "secondary"],
  ["foreground", "accent"],
  ["muted-foreground", "secondary"],
  ["muted-foreground", "accent"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
];

const NON_TEXT_PAIRS = [
  ["ring", "background"],
  ["ring", "card"],
  ["input", "background"],
  ["input", "card"],
];

for (const [name, tokens] of [
  ["light", light],
  ["dark (media query)", mediaDark],
  ["dark (data-theme)", themeDark],
]) {
  test(`${name}: text pairs meet WCAG AA (>= 4.5:1)`, () => {
    for (const [fg, bg] of TEXT_PAIRS) {
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      assert.ok(
        ratio >= 4.5,
        `${fg} (${tokens[fg]}) on ${bg} (${tokens[bg]}) in ${name}: ${ratio.toFixed(2)}:1`,
      );
    }
  });

  test(`${name}: non-text boundaries meet WCAG AA (>= 3:1)`, () => {
    for (const [fg, bg] of NON_TEXT_PAIRS) {
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      assert.ok(
        ratio >= 3,
        `${fg} (${tokens[fg]}) on ${bg} (${tokens[bg]}) in ${name}: ${ratio.toFixed(2)}:1`,
      );
    }
  });
}

test("the two dark blocks are byte-identical (SC-006)", () => {
  assert.deepEqual(mediaDark, themeDark);
});

// Spec 090 (TASK-0236): the margin, mini-strip and status strip use only
// `text-muted-foreground` on `bg-card`; that pair must stay in TEXT_PAIRS.
test("table-margin surfaces use only covered colour pairs (spec 090)", () => {
  const files = ["margin", "mini-strip", "status-strip"];
  const allowed = new Set([
    "text-muted-foreground",
    "bg-card",
    "border-border",
  ]);
  for (const f of files) {
    const src = readFileSync(
      new URL(`../app/play/components/${f}.tsx`, import.meta.url),
      "utf8",
    );
    for (const m of src.matchAll(
      /\b(?:text|bg)-(?:muted-foreground|card|foreground|background|muted|primary|destructive|ok|proc|mark)\b/g,
    )) {
      assert.ok(
        allowed.has(m[0]),
        `${f}.tsx uses uncovered colour class ${m[0]}`,
      );
    }
  }
  assert.ok(
    TEXT_PAIRS.some(([a, b]) => a === "muted-foreground" && b === "card"),
  );
});
