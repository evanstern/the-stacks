/**
 * T044 (TDD): the generic-html fallback plugin (US4, FR-028) — the shared
 * conformance suite plus the fallback-confidence assertion that matters most:
 * generic-html must NEVER outbid ddb-saved-html on DDB fixtures. It floors at
 * 0.1 for ANY html with extractable body text, DDB or not — it does not try
 * to recognize DDB signals (that is ddb-saved-html's job); the registry's
 * highest-confidence rule is what lets ddb win when it claims a page.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DETECT_HEAD_BYTES } from "@stacks/ingestion-contract";
import { describeConformance } from "@stacks/ingestion-contract/conformance";
import { describe, expect, it } from "vitest";

import { genericHtmlPlugin } from "./index";

const FIXTURES = join(__dirname, "..", "..", "fixtures");
const fixture = (rel: string) => new Uint8Array(readFileSync(join(FIXTURES, rel)));

const PLAIN_ARTICLE = fixture("html/plain-article.html");
const GOBLIN = fixture("ddb/goblin-page.html");
const TRUNCATED = fixture("rejects/truncated.html");
const NON_HTML = fixture("markdown/notes.md");

/**
 * Same real-page geometry the ddb plugin's tests pin (TASK-10): a big saved
 * page's inlined <head> pushes <body> past DETECT_HEAD_BYTES, so a
 * body-text-based detect sees nothing extractable in the prefix and the file
 * falls through EVERY plugin ("No registered ingester recognizes …").
 * The fallback must still claim well-formed HTML it can only prove is HTML.
 */
const LARGE_PREAMBLE = (() => {
  const html = new TextDecoder().decode(PLAIN_ARTICLE);
  const filler = `<style>/* ${"padding ".repeat(2 * DETECT_HEAD_BYTES / 8)} */</style>`;
  return new TextEncoder().encode(html.replace("</head>", `${filler}</head>`));
})();

describeConformance({
  plugin: genericHtmlPlugin,
  fixtures: {
    positive: [
      { name: "plain non-DDB article", mediaType: "text/html", filename: "plain-article.html", bytes: PLAIN_ARTICLE, minConfidence: 0.1 },
      { name: "real-geometry article (body past DETECT_HEAD_BYTES)", mediaType: "text/html", filename: "big-article.html", bytes: LARGE_PREAMBLE, minConfidence: 0.1 },
    ],
    negative: [
      { name: "a markdown file (wrong media type)", mediaType: "text/markdown", filename: "notes.md", bytes: NON_HTML },
    ],
    malformed: [
      { name: "truncated/unparseable HTML", mediaType: "text/html", filename: "truncated.html", bytes: TRUNCATED },
    ],
  },
});

describe("generic-html specifics (US4 AC-2/3)", () => {
  it("floors at 0.1 on its own accepted type — never above the DDB plugin's floor (US4 AC-3)", () => {
    const result = genericHtmlPlugin.detect({
      mediaType: "text/html",
      filename: "plain-article.html",
      head: PLAIN_ARTICLE.slice(0, 65536),
    });
    expect(result.confidence).toBe(0.1);
  });

  it("does NOT claim DDB fixtures above its own 0.1 floor, even though it structurally could parse them (US4 AC-2/3)", () => {
    const result = genericHtmlPlugin.detect({
      mediaType: "text/html",
      filename: "goblin-page.html",
      head: GOBLIN.slice(0, 65536),
    });
    expect(result.confidence).toBe(0.1);
  });

  it("extracts heading structure into section paths for non-DDB HTML", async () => {
    const doc = await genericHtmlPlugin.transform({
      mediaType: "text/html",
      filename: "plain-article.html",
      bytes: PLAIN_ARTICLE,
    });
    const spanTheory = doc.sections.find((s) => s.heading === "Span Theory");
    expect(spanTheory?.path).toEqual(["Notes on Imaginary Bridges", "Span Theory"]);
  });
});
