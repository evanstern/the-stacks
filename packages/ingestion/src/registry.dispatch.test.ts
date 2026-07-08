/**
 * T047: dispatch across the FULL shipped lineup (US4 AC-2/3) — proves the
 * fallback floor actually resolves ties the way contracts/plugin-contract.md
 * promises, using the real plugins (not registry.test.ts's synthetic
 * stand-ins). plain-article.html is ddb's own negative fixture: ddb sees an
 * <article> but no DDB identity signal, so it honestly returns 0 — that's
 * what lets generic-html's 0.1 floor win instead of losing a tie it was
 * never in.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createShippedRegistry } from "./shipped";

const FIXTURES = join(__dirname, "..", "..", "ingestion-plugins", "fixtures");
const fixture = (rel: string) => new Uint8Array(readFileSync(join(FIXTURES, rel)));

describe("shipped registry dispatch (US4 AC-2/3)", () => {
  it("routes non-DDB HTML to generic-html, with ddb recorded at ~0 confidence", () => {
    const registry = createShippedRegistry();
    const decision = registry.detect({
      mediaType: "text/html",
      filename: "plain-article.html",
      head: fixture("html/plain-article.html").slice(0, 65536),
    });

    expect(decision?.plugin.name).toBe("generic-html");
    expect(decision?.candidates["ddb-saved-html"]).toBe(0);
    expect(decision?.candidates["generic-html"]).toBe(0.1);
  });

  it("still routes real DDB pages to ddb-saved-html, not the generic fallback", () => {
    const registry = createShippedRegistry();
    const decision = registry.detect({
      mediaType: "text/html",
      filename: "goblin-page.html",
      head: fixture("ddb/goblin-page.html").slice(0, 65536),
    });

    expect(decision?.plugin.name).toBe("ddb-saved-html");
    expect(decision!.confidence).toBeGreaterThan(0.1);
  });

  it("routes markdown and plain text to the markdown plugin", () => {
    const registry = createShippedRegistry();
    const md = registry.detect({
      mediaType: "text/markdown",
      filename: "notes.md",
      head: fixture("markdown/notes.md").slice(0, 65536),
    });
    const txt = registry.detect({
      mediaType: "text/plain",
      filename: "plain.txt",
      head: fixture("markdown/plain.txt").slice(0, 65536),
    });

    expect(md?.plugin.name).toBe("markdown");
    expect(txt?.plugin.name).toBe("markdown");
  });
});
