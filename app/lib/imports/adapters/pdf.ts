import type { CorpusReadiness, ImportAdapter, ImportAdapterResult, ImportWarning, NormalizedDocument, NormalizedSection } from "./types.js";
import { normalizeLineEndings, sectionId, titleFromFilename, trimBlankLines } from "./shared.js";
import type { JsonValue } from "../../db/rows.js";

type PdfObject = {
  id: number;
  body: string;
  stream: string | null;
};

type PdfPage = {
  objectId: number;
  pageNumber: number;
  contentObjectIds: number[];
  text: string;
};

export type PdfOcrPage = {
  pageNumber: number;
  text: string;
  confidence?: number | null;
  quality?: PdfOcrQualityMetrics | null;
};

export type PdfOcrQualityMetrics = {
  characterCount: number;
  wordCount: number;
  averageWordLength: number;
  noiseRatio: number;
  repeatedLineRatio: number;
  shortLineRatio: number;
  readabilityScore: number;
  chunkabilityScore: number;
  classification: "usable" | "weak" | "noisy";
};

export type PdfOcrDocumentInput = {
  filename: string;
  sourceId?: string;
  engineName: string;
  engineVersion?: string | null;
  pages: PdfOcrPage[];
  evaluation?: JsonValue;
  parserEvidence?: CorpusReadiness["evidence"];
};

const textDecoder = new TextDecoder("latin1", { fatal: false });
const minUsableTextCharacters = 24;
const minUsableOcrCharactersPerPage = 120;
const minUsableOcrPageCoverage = 0.8;
const minUsableOcrQualityCoverage = 0.6;
const minUsableOcrChunkability = 0.5;

export const pdfImportAdapter: ImportAdapter = {
  name: "pdf",
  version: "pdf-v1",
  async import(input): Promise<ImportAdapterResult> {
    const parsed = parsePdf(input.bytes);
    const title = parsed.title ?? titleFromFilename(input.filename);
    const pagesWithText = parsed.pages.filter((page) => page.text.trim().length > 0);
    const normalizedText = trimBlankLines(pagesWithText.map((page) => `Page ${page.pageNumber}\n${page.text}`).join("\n\n"));
    const sections = createPageSections(normalizedText, pagesWithText);
    const warnings = [...parsed.warnings];
    const corpusReadiness = classifyPdfReadiness(parsed.pages, pagesWithText, normalizedText);

    if (corpusReadiness.state === "ocr_needed") {
      warnings.push({
        code: "pdf-no-extractable-text",
        message: "PDF contained no extractable text. Scanned PDFs require the PDF OCR fallback pipeline.",
      });
    } else if (corpusReadiness.state === "deferred") {
      warnings.push({ code: "pdf-corpus-readiness-deferred", message: corpusReadiness.reason, metadata: corpusReadiness.evidence });
    } else if (corpusReadiness.state === "rejected") {
      warnings.push({ code: "pdf-corpus-readiness-rejected", message: corpusReadiness.reason, metadata: corpusReadiness.evidence });
    }

    return {
      documents: [
        {
          id: "document-0001",
          title,
          authors: [],
          language: null,
          sourceFormat: "pdf",
          provenance: {
            filename: input.filename,
            sourceId: input.sourceId ?? null,
            pageCount: parsed.pages.length,
            extractedPages: pagesWithText.map((page) => page.pageNumber),
            extraction: "text-content-streams",
            corpusReadiness,
          },
          rawMetadata: {
            info: parsed.info,
            pageCount: parsed.pages.length,
            corpusReadiness,
            limitations: [
              "Text extraction supports unencrypted PDFs with uncompressed page content streams.",
        "Scanned/image-only PDFs require OCR through the PDF OCR fallback pipeline.",
              "Compressed or externally referenced content streams are skipped with warnings.",
            ],
          },
          normalizedText,
          sections,
          corpusReadiness,
        },
      ],
      warnings,
    };
  },
};

export function normalizePdfOcrDocument(input: PdfOcrDocumentInput): NormalizedDocument {
  const pagesWithText = input.pages
    .map((page) => ({ ...page, text: normalizeExtractedText(page.text).trim() }))
    .filter((page) => page.text.trim().length > 0)
    .sort((left, right) => left.pageNumber - right.pageNumber);
  const normalizedText = trimBlankLines(pagesWithText.map((page) => `Page ${page.pageNumber}\n${page.text}`).join("\n\n"));
  const corpusReadiness = classifyOcrReadiness(input.pages, pagesWithText, normalizedText);

  return {
    id: "document-ocr-0001",
    title: titleFromFilename(input.filename),
    authors: [],
    language: null,
    sourceFormat: "pdf",
    provenance: {
      filename: input.filename,
      sourceId: input.sourceId ?? null,
      pageCount: input.pages.length,
      extractedPages: pagesWithText.map((page) => page.pageNumber),
      extraction: "ocr",
      ocr: {
        engine: input.engineName,
        engineVersion: input.engineVersion ?? null,
        pages: pagesWithText.map((page) => ({ pageNumber: page.pageNumber, confidence: page.confidence ?? null, quality: page.quality ?? null })),
        evaluation: input.evaluation ?? null,
      },
      parserEvidence: input.parserEvidence ?? null,
      corpusReadiness,
    },
    rawMetadata: {
      pageCount: input.pages.length,
      corpusReadiness,
      ocr: {
        engine: input.engineName,
        engineVersion: input.engineVersion ?? null,
        pageCount: input.pages.length,
        extractedPages: pagesWithText.length,
        evaluation: input.evaluation ?? null,
      },
      limitations: [
        "OCR output is normalized as page-level PDF text and must be reviewed before becoming retrievable.",
        "OCR confidence and page mapping depend on the configured local OCR engine.",
      ],
    },
    normalizedText,
    sections: createOcrPageSections(normalizedText, pagesWithText, input.engineName),
    corpusReadiness,
  };
}

function classifyOcrReadiness(pages: PdfOcrPage[], pagesWithText: PdfOcrPage[], normalizedText: string): CorpusReadiness {
  const averageConfidence = average(pagesWithText.map((page) => page.confidence).filter((confidence): confidence is number => typeof confidence === "number"));
  const usableQualityPages = pagesWithText.filter((page) => page.quality?.classification === "usable").length;
  const averageNoiseRatio = average(pagesWithText.map((page) => page.quality?.noiseRatio).filter((value): value is number => typeof value === "number"));
  const averageReadabilityScore = average(pagesWithText.map((page) => page.quality?.readabilityScore).filter((value): value is number => typeof value === "number"));
  const averageChunkabilityScore = average(pagesWithText.map((page) => page.quality?.chunkabilityScore).filter((value): value is number => typeof value === "number"));
  const pageCoverage = pages.length > 0 ? pagesWithText.length / pages.length : 0;
  const usableQualityCoverage = pagesWithText.length > 0 ? usableQualityPages / pagesWithText.length : 0;
  const charactersPerPage = pages.length > 0 ? normalizedText.trim().length / pages.length : 0;
  const evidence = {
    pageCount: pages.length,
    extractedPages: pagesWithText.map((page) => page.pageNumber),
    normalizedTextCharacters: normalizedText.trim().length,
    charactersPerPage,
    pageCoverage,
    averageConfidence,
    quality: {
      usablePages: usableQualityPages,
      usableQualityCoverage,
      averageNoiseRatio,
      averageReadabilityScore,
      averageChunkabilityScore,
    },
  };

  if (pages.length === 0 || pagesWithText.length === 0) {
    return {
      state: "rejected",
      reason: "OCR did not produce page-level text that can support search, chunking, and review.",
      reviewRecommendation: "reject",
      evidence,
    };
  }

  if (normalizedText.trim().length < minUsableTextCharacters || charactersPerPage < minUsableOcrCharactersPerPage) {
    return {
      state: "deferred",
      reason: "OCR produced too little text per page to trust for corpus search and chunking without another pass.",
      reviewRecommendation: "defer",
      evidence,
    };
  }

  if (pageCoverage < minUsableOcrPageCoverage) {
    return {
      state: "deferred",
      reason: "OCR recovered too few pages. Defer until missing pages are recovered or manually rejected.",
      reviewRecommendation: "defer",
      evidence,
    };
  }

  if (averageConfidence !== null && averageConfidence < 0.45) {
    return {
      state: "deferred",
      reason: "OCR confidence is too low to trust for corpus search and chunking without another pass.",
      reviewRecommendation: "defer",
      evidence,
    };
  }

  if (pagesWithText.some((page) => page.quality?.classification === "noisy")) {
    return {
      state: "deferred",
      reason: "OCR quality gates found noisy text that needs review or another OCR pass before corpus approval.",
      reviewRecommendation: "defer",
      evidence,
    };
  }

  if (usableQualityCoverage < minUsableOcrQualityCoverage || (averageChunkabilityScore !== null && averageChunkabilityScore < minUsableOcrChunkability)) {
    return {
      state: "deferred",
      reason: "OCR quality gates did not find enough chunkable, usable pages for corpus approval.",
      reviewRecommendation: "defer",
      evidence,
    };
  }

  return {
    state: "usable",
    reason: "OCR produced page-level text that is fit for normalization, chunking, and human review.",
    reviewRecommendation: "approve",
    evidence,
  };
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function classifyPdfReadiness(pages: PdfPage[], pagesWithText: PdfPage[], normalizedText: string): CorpusReadiness {
  const evidence = {
    pageCount: pages.length,
    extractedPages: pagesWithText.map((page) => page.pageNumber),
    normalizedTextCharacters: normalizedText.trim().length,
  };

  if (pages.length === 0) {
    return {
      state: "rejected",
      reason: "PDF parser found no page objects, so the import cannot produce corpus-ready content with the supported path.",
      reviewRecommendation: "reject",
      evidence,
    };
  }

  if (pagesWithText.length === 0) {
    return {
      state: "ocr_needed",
      reason: "PDF has no extractable text. Keep it out of the corpus until a separate OCR path produces reviewable text.",
      reviewRecommendation: "defer",
      evidence,
    };
  }

  if (normalizedText.trim().length < minUsableTextCharacters) {
    return {
      state: "deferred",
      reason: "PDF text extraction produced too little text to trust for search and chunking without another pass.",
      reviewRecommendation: "defer",
      evidence,
    };
  }

  if (pagesWithText.length < pages.length) {
    return {
      state: "deferred",
      reason: "PDF text extraction only covered some pages. Defer until missing pages are recovered or manually rejected.",
      reviewRecommendation: "defer",
      evidence,
    };
  }

  return {
    state: "usable",
    reason: "PDF text extraction produced page-level text that is fit for normalization, chunking, and human review.",
    reviewRecommendation: "approve",
    evidence,
  };
}

function parsePdf(bytes: Uint8Array): { title: string | null; info: Record<string, string>; pages: PdfPage[]; warnings: ImportWarning[] } {
  const pdf = textDecoder.decode(bytes);

  if (!pdf.startsWith("%PDF-")) {
    throw new Error("Invalid PDF: missing %PDF header.");
  }

  if (/\/Encrypt\b/.test(pdf)) {
    throw new Error("Encrypted PDF/DRM content is not supported.");
  }

  const objects = parseObjects(pdf);
  const objectById = new Map(objects.map((object) => [object.id, object]));
  const warnings: ImportWarning[] = [];
  const pages = objects
    .filter((object) => /\/Type\s*\/Page\b/.test(object.body) && !/\/Type\s*\/Pages\b/.test(object.body))
    .sort((left, right) => left.id - right.id)
    .map((pageObject, index) => extractPage(pageObject, index + 1, objectById, warnings));
  const info = extractInfo(objects);

  return { title: info.Title ?? null, info, pages, warnings };
}

function parseObjects(pdf: string): PdfObject[] {
  const objects: PdfObject[] = [];
  const objectPattern = /(\d+)\s+\d+\s+obj\b([\s\S]*?)\bendobj/g;
  let match = objectPattern.exec(pdf);

  while (match !== null) {
    const body = match[2];
    const streamMatch = /stream\r?\n?([\s\S]*?)\r?\n?endstream/.exec(body);
    objects.push({ id: Number(match[1]), body, stream: streamMatch?.[1] ?? null });
    match = objectPattern.exec(pdf);
  }

  return objects;
}

function extractInfo(objects: PdfObject[]): Record<string, string> {
  const info: Record<string, string> = {};
  const infoObject = objects.find((object) => /\/(Title|Author|Subject|Creator|Producer)\s*\(/.test(object.body));

  if (!infoObject) {
    return info;
  }

  for (const key of ["Title", "Author", "Subject", "Creator", "Producer"]) {
    const value = extractPdfStringAfterName(infoObject.body, key);
    if (value) {
      info[key] = value;
    }
  }

  return info;
}

function extractPage(pageObject: PdfObject, pageNumber: number, objectById: Map<number, PdfObject>, warnings: ImportWarning[]): PdfPage {
  const contentObjectIds = extractContentObjectIds(pageObject.body);
  const textParts: string[] = [];

  for (const objectId of contentObjectIds) {
    const contentObject = objectById.get(objectId);

    if (!contentObject?.stream) {
      warnings.push({ code: "pdf-missing-content-stream", message: `Page ${pageNumber} references missing content stream ${objectId}.` });
      continue;
    }

    if (/\/Filter\b/.test(contentObject.body)) {
      warnings.push({
        code: "pdf-compressed-content-skipped",
        message: `Page ${pageNumber} content stream ${objectId} uses a PDF filter and was skipped.`,
        metadata: { pageNumber, objectId },
      });
      continue;
    }

    const pageText = extractTextFromContentStream(contentObject.stream);
    if (pageText.length > 0) {
      textParts.push(pageText);
    }
  }

  return { objectId: pageObject.id, pageNumber, contentObjectIds, text: trimBlankLines(textParts.join("\n")) };
}

function extractContentObjectIds(pageBody: string): number[] {
  const contentsMatch = /\/Contents\s*(\[[^\]]+\]|\d+\s+\d+\s+R)/.exec(pageBody);
  if (!contentsMatch) {
    return [];
  }

  return Array.from(contentsMatch[1].matchAll(/(\d+)\s+\d+\s+R/g), (match) => Number(match[1]));
}

function extractTextFromContentStream(stream: string): string {
  const textParts: string[] = [];
  const textBlockPattern = /BT([\s\S]*?)ET/g;
  let blockMatch = textBlockPattern.exec(stream);

  while (blockMatch !== null) {
    const block = blockMatch[1];
    const tokenPattern = /\((?:\\.|[^\\)])*\)\s*Tj|\[(.*?)\]\s*TJ|'\s*\((?:\\.|[^\\)])*\)|"\s+[^\n\r]*?\((?:\\.|[^\\)])*\)/g;
    let tokenMatch = tokenPattern.exec(block);

    while (tokenMatch !== null) {
      const token = tokenMatch[0];
      const strings = Array.from(token.matchAll(/\((?:\\.|[^\\)])*\)/g), (match) => decodePdfString(match[0]));
      if (strings.length > 0) {
        textParts.push(strings.join(""));
      }
      tokenMatch = tokenPattern.exec(block);
    }
    blockMatch = textBlockPattern.exec(stream);
  }

  return normalizeExtractedText(textParts.join("\n"));
}

function decodePdfString(value: string): string {
  const inner = value.slice(1, -1);
  return inner.replace(/\\([nrtbf()\\]|\r?\n|\d{1,3})/g, (_match, escapedValue: string) => {
    if (/^\d{1,3}$/.test(escapedValue)) {
      return String.fromCharCode(Number.parseInt(escapedValue, 8));
    }

    return {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      "(": "(",
      ")": ")",
      "\\": "\\",
    }[escapedValue] ?? "";
  });
}

function extractPdfStringAfterName(body: string, name: string): string | null {
  const nameIndex = body.indexOf(`/${name}`);
  if (nameIndex < 0) {
    return null;
  }

  const stringStart = body.indexOf("(", nameIndex);
  if (stringStart < 0) {
    return null;
  }

  let escaped = false;
  for (let index = stringStart + 1; index < body.length; index += 1) {
    const character = body[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === ")") {
      return decodePdfString(body.slice(stringStart, index + 1));
    }
  }

  return null;
}

function normalizeExtractedText(text: string): string {
  return trimBlankLines(normalizeLineEndings(text).replace(/[\t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n"));
}

function createPageSections(normalizedText: string, pages: PdfPage[]): NormalizedSection[] {
  const sections: NormalizedSection[] = [];
  let searchOffset = 0;

  for (const page of pages) {
    const pageText = `Page ${page.pageNumber}\n${page.text}`;
    const startOffset = normalizedText.indexOf(pageText, searchOffset);
    const safeStartOffset = startOffset >= 0 ? startOffset : searchOffset;
    const endOffset = safeStartOffset + pageText.length;
    searchOffset = endOffset;
    sections.push({
      id: sectionId("pdf-page", sections.length),
      ordinal: sections.length,
      parentSectionId: null,
      heading: `Page ${page.pageNumber}`,
      headingPath: [`Page ${page.pageNumber}`],
      startOffset: safeStartOffset,
      endOffset,
      text: pageText,
      metadata: {
        source: "pdf-page",
        pageNumber: page.pageNumber,
        pageObjectId: page.objectId,
        contentObjectIds: page.contentObjectIds,
      },
    });
  }

  return sections;
}

function createOcrPageSections(normalizedText: string, pages: PdfOcrPage[], engineName: string): NormalizedSection[] {
  const sections: NormalizedSection[] = [];
  let searchOffset = 0;

  for (const page of pages) {
    const pageText = `Page ${page.pageNumber}\n${page.text}`;
    const startOffset = normalizedText.indexOf(pageText, searchOffset);
    const safeStartOffset = startOffset >= 0 ? startOffset : searchOffset;
    const endOffset = safeStartOffset + pageText.length;
    searchOffset = endOffset;
    sections.push({
      id: sectionId("pdf-ocr-page", sections.length),
      ordinal: sections.length,
      parentSectionId: null,
      heading: `Page ${page.pageNumber}`,
      headingPath: [`Page ${page.pageNumber}`],
      startOffset: safeStartOffset,
      endOffset,
      text: pageText,
      metadata: {
        source: "pdf-ocr-page",
        pageNumber: page.pageNumber,
        ocrEngine: engineName,
        confidence: page.confidence ?? null,
        quality: page.quality ?? null,
      },
    });
  }

  return sections;
}
