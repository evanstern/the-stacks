import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SRD_ATTRIBUTION } from "../src/attribution.js";
import { SrdKind } from "../src/schema/index.js";

// The test's oracle: a deliberate second copy, so an edit to the constant also fails.
const GOLDEN =
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

const filePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "ATTRIBUTION.md",
);

function readAttribution(): string {
  return readFileSync(filePath, "utf8");
}

describe("SRD attribution", () => {
  it("ships ATTRIBUTION.md", () => {
    expect(() => readAttribution()).not.toThrow();
  });

  it("ATTRIBUTION.md contains the exact statement", () => {
    expect(readAttribution()).toContain(SRD_ATTRIBUTION);
  });

  it("the constant equals the golden string, code point for code point", () => {
    expect([...SRD_ATTRIBUTION].map((c) => c.codePointAt(0))).toEqual(
      [...GOLDEN].map((c) => c.codePointAt(0)),
    );
  });

  it("uses U+201C and U+201D around SRD 5.2.1", () => {
    expect(SRD_ATTRIBUTION).toContain("“SRD 5.2.1”");
  });

  it("mentions Wizards nowhere outside the statement", () => {
    const rest = readAttribution().replace(GOLDEN, "");
    expect(rest).not.toMatch(/wizards/i);
  });

  it("names every record kind", () => {
    const text = readAttribution().toLowerCase();
    const words: Record<string, string> = {
      monster: "monsters",
      spell: "spells",
      class: "classes",
      equipment: "equipment",
      condition: "conditions",
      rule: "rules",
    };
    for (const kind of SrdKind.options) {
      expect(
        words[kind],
        `no attribution word mapped for ${kind}`,
      ).toBeDefined();
      expect(text, kind).toContain(words[kind] as string);
    }
  });
});
