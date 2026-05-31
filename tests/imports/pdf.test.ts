import { describe, expect, it } from "vitest";

import { normalizePdfOcrDocument, pdfImportAdapter } from "../../app/lib/imports/adapters/pdf.js";
import { createSyntheticPdf } from "./pdf-fixture.js";

describe("PDF import adapter", () => {
  it("extracts uncompressed text streams into page-level sections with provenance", async () => {
    const result = await pdfImportAdapter.import({ filename: "sample-sourcebook.pdf", bytes: createSyntheticPdf(), sourceId: "source_pdf" });

    expect(result.warnings).toEqual([]);
    expect(result.documents).toHaveLength(1);

    const [document] = result.documents;
    expect(document).toMatchObject({
      id: "document-0001",
      title: "Synthetic PDF Fixture",
      authors: [],
      language: null,
      sourceFormat: "pdf",
      provenance: {
        filename: "sample-sourcebook.pdf",
        sourceId: "source_pdf",
        pageCount: 2,
        extractedPages: [1, 2],
        extraction: "text-content-streams",
        corpusReadiness: {
          state: "usable",
          reviewRecommendation: "approve",
        },
      },
      rawMetadata: {
        info: { Title: "Synthetic PDF Fixture", Producer: "Ikis synthetic fixture" },
        pageCount: 2,
        corpusReadiness: {
          state: "usable",
          reviewRecommendation: "approve",
        },
      },
    });
    expect(document.rawMetadata).toMatchObject({ limitations: expect.arrayContaining([expect.stringContaining("Scanned/image-only PDFs require OCR")]) });
    expect(document.normalizedText).toContain("Page 1\nChapter One");
    expect(document.normalizedText).toContain("Page 2\nSecond page text for review");
    expect(document.sections.map((section) => section.id)).toEqual(["pdf-page-0001", "pdf-page-0002"]);
    expect(document.sections[0]).toMatchObject({
      ordinal: 0,
      heading: "Page 1",
      headingPath: ["Page 1"],
      metadata: { source: "pdf-page", pageNumber: 1, pageObjectId: 3, contentObjectIds: [5] },
    });
    expect(document.sections[1]).toMatchObject({
      ordinal: 1,
      heading: "Page 2",
      headingPath: ["Page 2"],
      metadata: { source: "pdf-page", pageNumber: 2, pageObjectId: 4, contentObjectIds: [6] },
    });
  });

  it("reports image-only PDFs as scanned-PDF limitations for the OCR fallback", async () => {
    const result = await pdfImportAdapter.import({ filename: "scanned.pdf", bytes: createSyntheticPdf({ pageTexts: [""] }) });

    expect(result.documents[0].normalizedText).toBe("");
    expect(result.documents[0].sections).toEqual([]);
    expect(result.documents[0].corpusReadiness).toMatchObject({
      state: "ocr_needed",
      reviewRecommendation: "defer",
      evidence: { pageCount: 1, extractedPages: [], normalizedTextCharacters: 0 },
    });
    expect(result.warnings).toEqual([
      {
        code: "pdf-no-extractable-text",
        message: "PDF contained no extractable text. Scanned PDFs require the PDF OCR fallback pipeline.",
      },
    ]);
  });

  it("normalizes OCR output as page-level PDF sections with provenance", () => {
    const document = normalizePdfOcrDocument({
      filename: "scanned.pdf",
      sourceId: "source_scanned",
      engineName: "test-ocr",
      engineVersion: "1.0.0",
      pages: [
        { pageNumber: 1, text: " OCR page one text for review. ", confidence: 0.91 },
        { pageNumber: 2, text: "OCR page two text for review.", confidence: 0.88 },
      ],
    });

    expect(document).toMatchObject({
      id: "document-ocr-0001",
      title: "scanned",
      sourceFormat: "pdf",
      provenance: {
        filename: "scanned.pdf",
        sourceId: "source_scanned",
        pageCount: 2,
        extractedPages: [1, 2],
        extraction: "ocr",
        ocr: {
          engine: "test-ocr",
          engineVersion: "1.0.0",
          pages: [
            { pageNumber: 1, confidence: 0.91, quality: null },
            { pageNumber: 2, confidence: 0.88, quality: null },
          ],
        },
        corpusReadiness: { state: "usable", reviewRecommendation: "approve" },
      },
    });
    expect(document.normalizedText).toContain("Page 1\nOCR page one text for review.");
    expect(document.sections).toHaveLength(2);
    expect(document.sections[0]).toMatchObject({
      id: "pdf-ocr-page-0001",
      heading: "Page 1",
      metadata: { source: "pdf-ocr-page", pageNumber: 1, ocrEngine: "test-ocr", confidence: 0.91 },
    });
  });

  it("keeps thin OCR output deferred instead of corpus-ready", () => {
    const document = normalizePdfOcrDocument({
      filename: "thin.pdf",
      engineName: "test-ocr",
      pages: [{ pageNumber: 1, text: "tiny" }],
    });

    expect(document.corpusReadiness).toMatchObject({
      state: "deferred",
      reviewRecommendation: "defer",
      evidence: { pageCount: 1, extractedPages: [1], normalizedTextCharacters: 11 },
    });
  });

  it("defers partially extracted PDFs instead of marking them corpus-ready", async () => {
    const result = await pdfImportAdapter.import({ filename: "partial.pdf", bytes: createSyntheticPdf({ pageTexts: ["Recovered page text", ""] }) });

    expect(result.documents[0].corpusReadiness).toMatchObject({
      state: "deferred",
      reviewRecommendation: "defer",
      evidence: { pageCount: 2, extractedPages: [1] },
    });
    expect(result.documents[0].sections).toHaveLength(1);
    expect(result.warnings).toEqual([
      {
        code: "pdf-corpus-readiness-deferred",
        message: "PDF text extraction only covered some pages. Defer until missing pages are recovered or manually rejected.",
        metadata: { pageCount: 2, extractedPages: [1], normalizedTextCharacters: 26 },
      },
    ]);
  });

  it("rejects PDFs with no parseable page objects as not corpus-ready", async () => {
    const result = await pdfImportAdapter.import({ filename: "empty.pdf", bytes: createSyntheticPdf({ pageTexts: [] }) });

    expect(result.documents[0].corpusReadiness).toMatchObject({
      state: "rejected",
      reviewRecommendation: "reject",
      evidence: { pageCount: 0, extractedPages: [], normalizedTextCharacters: 0 },
    });
    expect(result.documents[0].sections).toEqual([]);
    expect(result.warnings).toEqual([
      {
        code: "pdf-corpus-readiness-rejected",
        message: "PDF parser found no page objects, so the import cannot produce corpus-ready content with the supported path.",
        metadata: { pageCount: 0, extractedPages: [], normalizedTextCharacters: 0 },
      },
    ]);
  });

  it("rejects encrypted PDFs without attempting DRM support", async () => {
    await expect(pdfImportAdapter.import({ filename: "encrypted.pdf", bytes: createSyntheticPdf({ encrypted: true }) })).rejects.toThrow(
      /Encrypted PDF\/DRM/i,
    );
  });
});
