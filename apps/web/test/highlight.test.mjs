import assert from "node:assert/strict";
import { test } from "node:test";
import { splitPassage } from "../app/ask/highlight.ts";

// The contract example (ask-sse.md): the quote is exact, lifted verbatim.
// The surrounding text is reconstructed (the doc's own passage.text is
// truncated with "…") so the invariant
// `text.slice(start, end) === quote` holds for this fixture.
test("contract example: marked equals the quote exactly", () => {
  const quote =
    "you can use the Attack action to make a special melee attack, a grapple";
  const before = "Instead of one of your attacks, ";
  const after = ", provided you have a hand free.";
  const text = before + quote + after;
  const start = before.length;
  const end = start + quote.length;

  const [pre, marked, post] = splitPassage(text, { start, end });
  assert.equal(marked, quote);
  assert.equal(pre, before);
  assert.equal(post, after);
});

test("one citation per passage.kind: marked equals the quote (SC-003)", () => {
  const kinds = ["heading", "prose", "list", "table", "statBlock", "sidebar"];
  for (const kind of kinds) {
    const quote = `quoted text for ${kind}`;
    const text = `before ${kind} — ${quote} — after ${kind}`;
    const start = text.indexOf(quote);
    const end = start + quote.length;
    const [, marked] = splitPassage(text, { start, end });
    assert.equal(marked, quote, `kind ${kind}`);
  }
});

test("clamps an out-of-range end to the text length", () => {
  const text = "short passage";
  const [pre, marked, post] = splitPassage(text, { start: 6, end: 9999 });
  assert.equal(pre, "short ");
  assert.equal(marked, "passage");
  assert.equal(post, "");
});

test("clamps a negative start to zero", () => {
  const text = "short passage";
  const [pre, marked] = splitPassage(text, { start: -5, end: 5 });
  assert.equal(pre, "");
  assert.equal(marked, "short");
});
