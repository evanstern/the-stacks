import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { markdownImportAdapter, textImportAdapter } from "../../app/lib/imports/adapters/index.js";

const fixtureRoot = join(process.cwd(), "fixtures", "corpus");

async function fixtureBytes(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(fixtureRoot, name)));
}

describe("Markdown and text import adapters", () => {
  it("normalizes Markdown frontmatter and heading sections with stable duplicate-heading IDs", async () => {
    const result = await markdownImportAdapter.import({ filename: "sample.md", bytes: await fixtureBytes("sample.md"), sourceId: "source_fixture" });

    expect(result.warnings).toEqual([]);
    expect(result.documents).toHaveLength(1);

    const [document] = result.documents;
    expect(document).toMatchObject({
      id: "document-0001",
      title: "Synthetic Field Notes",
      authors: ["Fixture Author"],
      language: "en",
      sourceFormat: "markdown",
      provenance: { filename: "sample.md", sourceId: "source_fixture" },
      rawMetadata: {
        frontmatter: {
          title: "Synthetic Field Notes",
          author: "Fixture Author",
          language: "en",
          source: "synthetic",
          license: "CC0-1.0",
        },
      },
    });
    expect(document.normalizedText).toContain("# Synthetic Field Notes");
    expect(document.normalizedText).not.toContain("---");

    expect(document.sections.map((section) => section.id)).toEqual([
      "markdown-section-0001",
      "markdown-section-0002",
      "markdown-section-0003",
      "markdown-section-0004",
    ]);
    expect(document.sections.map((section) => section.heading)).toEqual([
      "Synthetic Field Notes",
      "First Landing",
      "Duplicate Heading",
      "Duplicate Heading",
    ]);
    expect(document.sections.map((section) => section.ordinal)).toEqual([0, 1, 2, 3]);
    expect(document.sections[2].id).not.toBe(document.sections[3].id);
    expect(document.sections[2].startOffset).toBeLessThan(document.sections[3].startOffset);
    expect(document.sections[3].text).toContain("twice so section order can be tested");
  });

  it("warns when Markdown frontmatter cannot be parsed", async () => {
    const result = await markdownImportAdapter.import({ filename: "broken.md", bytes: new TextEncoder().encode("---\ntitle: Broken\n# Body") });

    expect(result.warnings).toEqual([
      { code: "frontmatter-unclosed", message: "Markdown frontmatter opening fence was found without a closing fence." },
    ]);
    expect(result.documents[0].rawMetadata).toEqual({ frontmatter: {} });
    expect(result.documents[0].title).toBe("Body");
  });

  it("normalizes plain text into title fallback and paragraph sections", async () => {
    const result = await textImportAdapter.import({ filename: "sample.txt", bytes: await fixtureBytes("sample.txt") });

    expect(result.warnings).toEqual([]);
    expect(result.documents).toHaveLength(1);

    const [document] = result.documents;
    expect(document.title).toBe("Synthetic Plain Text Fixture");
    expect(document.sourceFormat).toBe("text");
    expect(document.rawMetadata).toEqual({});
    expect(document.sections.map((section) => section.id)).toEqual(["text-section-0001", "text-section-0002", "text-section-0003"]);
    expect(document.sections.map((section) => section.ordinal)).toEqual([0, 1, 2]);
    expect(document.sections[0]).toMatchObject({ heading: "Synthetic Plain Text Fixture", headingPath: ["Synthetic Plain Text Fixture"] });
    expect(document.sections[1]).toMatchObject({ heading: null, headingPath: [], metadata: { source: "paragraph" } });
    expect(document.sections[2].text).toContain("stable section");
  });

  it("falls back to the filename when plain text has no title line", async () => {
    const result = await textImportAdapter.import({ filename: "field-notes.txt", bytes: new TextEncoder().encode("\n\n") });

    expect(result.documents[0].title).toBe("field notes");
    expect(result.documents[0].sections).toEqual([]);
  });
});
