import { describe, expect, it } from "vitest";

import { docxImportAdapter } from "../../app/lib/imports/adapters/index.js";
import { DocxImportError } from "../../app/lib/imports/adapters/docx.js";
import { createStoredZip, createSyntheticDocx } from "./docx-fixture.js";

describe("DOCX import adapter", () => {
  it("extracts WordprocessingML paragraphs into reviewable sections with provenance", async () => {
    const result = await docxImportAdapter.import({ filename: "sample-sourcebook.docx", bytes: createSyntheticDocx(), sourceId: "source_docx" });

    expect(result.warnings).toEqual([]);
    expect(result.documents).toHaveLength(1);

    const [document] = result.documents;
    expect(document).toMatchObject({
      id: "document-0001",
      title: "Synthetic DOCX Fixture",
      authors: ["Fixture Author"],
      language: "en",
      sourceFormat: "docx",
      provenance: {
        filename: "sample-sourcebook.docx",
        sourceId: "source_docx",
        documentPath: "word/document.xml",
        paragraphCount: 4,
        extraction: "wordprocessingml-text",
      },
      rawMetadata: {
        coreProperties: {
          title: "Synthetic DOCX Fixture",
          creator: "Fixture Author",
          language: "en",
          subject: "Parser smoke test",
          description: "Deterministic DOCX fixture for importer tests.",
        },
        documentPath: "word/document.xml",
      },
    });
    expect(document.rawMetadata).toMatchObject({ limitations: expect.arrayContaining([expect.stringContaining("Legacy .doc files")]) });
    expect(document.normalizedText).toContain("Synthetic DOCX Fixture");
    expect(document.normalizedText).toContain("This DOCX content is synthetic and safe for parser smoke tests.");
    expect(document.normalizedText).toContain("Second paragraph has an ampersand & entity and a tab.");
    expect(document.sections.map((section) => section.id)).toEqual(["docx-paragraph-0001", "docx-paragraph-0002", "docx-paragraph-0003", "docx-paragraph-0004"]);
    expect(document.sections[0]).toMatchObject({
      ordinal: 0,
      heading: "Synthetic DOCX Fixture",
      headingPath: ["Synthetic DOCX Fixture"],
      metadata: { source: "docx-paragraph", paragraphOrdinal: 0, style: "Heading1", headingLevel: 1 },
    });
    expect(document.sections[1]).toMatchObject({
      ordinal: 1,
      heading: null,
      headingPath: ["Synthetic DOCX Fixture"],
      metadata: { source: "docx-paragraph", paragraphOrdinal: 1, style: null, headingLevel: null },
    });
    expect(document.sections[2]).toMatchObject({
      ordinal: 2,
      heading: "Reviewable Section",
      headingPath: ["Synthetic DOCX Fixture", "Reviewable Section"],
      metadata: { source: "docx-paragraph", paragraphOrdinal: 2, style: "Heading2", headingLevel: 2 },
    });
  });

  it("rejects non-DOCX ZIP packages clearly", async () => {
    const zip = createStoredZip([{ name: "word/legacy-document.xml", text: "not a DOCX main document" }]);

    await expect(docxImportAdapter.import({ filename: "legacy.docx", bytes: zip })).rejects.toThrow(/Invalid DOCX/i);
  });

  it("reports malformed DOCX ZIP packages without leaking EPUB parser wording", async () => {
    await expect(docxImportAdapter.import({ filename: "broken.docx", bytes: new Uint8Array([1, 2, 3]) })).rejects.toThrow(DocxImportError);
    await expect(docxImportAdapter.import({ filename: "broken.docx", bytes: new Uint8Array([1, 2, 3]) })).rejects.toThrow(/Invalid DOCX ZIP package/i);
    await expect(docxImportAdapter.import({ filename: "broken.docx", bytes: new Uint8Array([1, 2, 3]) })).rejects.not.toThrow(/EPUB/i);
  });

  it("reports DOCX files with no extractable paragraph text", async () => {
    const emptyDocx = createStoredZip([
      { name: "[Content_Types].xml", text: "<Types/>" },
      { name: "word/document.xml", text: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>' },
    ]);

    const result = await docxImportAdapter.import({ filename: "empty.docx", bytes: emptyDocx });

    expect(result.documents[0].normalizedText).toBe("");
    expect(result.documents[0].sections).toEqual([]);
    expect(result.warnings).toEqual([{ code: "docx-no-extractable-text", message: "DOCX contained no extractable text in word/document.xml." }]);
  });
});
