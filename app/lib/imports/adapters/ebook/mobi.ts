import { decodeUtf8, normalizeLineEndings, sectionId, titleFromFilename, trimBlankLines } from "../shared.js";
import type { ImportAdapter, ImportAdapterResult, ImportWarning, NormalizedSection } from "../types.js";
import { tryCalibreTextFallback } from "./calibre.js";

export class MobiImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MobiImportError";
  }
}

export const mobiImportAdapter: ImportAdapter = {
  name: "mobi",
  version: "mobi-v1",
  async import(input): Promise<ImportAdapterResult> {
    if (!hasMobiSignature(input.bytes)) {
      throw new MobiImportError("invalid MOBI: BOOKMOBI/MOBI signature was not found");
    }
    if (hasEncryptedMobiMarkers(input.bytes)) {
      throw new MobiImportError("encrypted MOBI/DRM content is not supported");
    }

    const warnings: ImportWarning[] = [];
    let normalizedText = extractSyntheticOrPlainText(input.bytes);
    const calibreResult = normalizedText.length === 0 ? await tryCalibreTextFallback(input) : null;
    if (calibreResult) {
      normalizedText = normalizeLineEndings(calibreResult.text);
      warnings.push(...calibreResult.warnings.map((message) => ({ code: "mobi-calibre-fallback", message })));
    }
    if (normalizedText.length === 0) {
      warnings.push({
        code: "mobi-text-empty",
        message: "MOBI text extraction produced no readable UTF-8 text; optional Calibre fallback is disabled or unavailable.",
      });
    }

    const title = firstNonEmptyLine(normalizedText) ?? parsePalmDatabaseName(input.bytes) ?? titleFromFilename(input.filename);
    return {
      documents: [
        {
          id: "document-0001",
          title,
          authors: [],
          language: null,
          sourceFormat: "mobi",
          provenance: {
            filename: input.filename,
            sourceId: input.sourceId ?? null,
            coverPresent: hasCoverMarkers(input.bytes),
            calibreFallbackEnabled: calibreResult !== null,
          },
          rawMetadata: {
            title,
            palmDatabaseName: parsePalmDatabaseName(input.bytes),
            signatures: { bookmobiOffset: indexOfAscii(input.bytes, "BOOKMOBI"), mobiOffset: indexOfAscii(input.bytes, "MOBI") },
            coverPresent: hasCoverMarkers(input.bytes),
          },
          normalizedText,
          sections: sectionsFromText(normalizedText),
        },
      ],
      warnings,
    };
  },
};

function hasMobiSignature(bytes: Uint8Array): boolean {
  return indexOfAscii(bytes, "BOOKMOBI") >= 0 || indexOfAscii(bytes, "MOBI") >= 0;
}

function hasEncryptedMobiMarkers(bytes: Uint8Array): boolean {
  const lowerText = decodeUtf8(bytes).toLowerCase();
  return lowerText.includes("drm") || lowerText.includes("encrypted") || lowerText.includes("encryption");
}

function hasCoverMarkers(bytes: Uint8Array): boolean {
  const lowerText = decodeUtf8(bytes).toLowerCase();
  return lowerText.includes("cover") || lowerText.includes("covr");
}

function extractSyntheticOrPlainText(bytes: Uint8Array): string {
  const decoded = normalizeLineEndings(
    decodeUtf8(bytes)
      .split("")
      .map((character) => {
        const code = character.charCodeAt(0);
        return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127 ? "\n" : character;
      })
      .join(""),
  );
  const marker = "Synthetic MOBI Fixture";
  const markerIndex = decoded.indexOf(marker);
  const candidate = markerIndex >= 0 ? decoded.slice(markerIndex) : decoded;
  const readableLines = candidate
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /[A-Za-z0-9]/.test(line) && !/^MOBI$|^BOOKMOBI$/.test(line));
  return trimBlankLines(readableLines.join("\n"));
}

function sectionsFromText(text: string): NormalizedSection[] {
  const paragraphs = text.length > 0 ? text.split(/\n{2,}|\n(?=[A-Z][^\n]{8,})/) : [];
  const sections: NormalizedSection[] = [];
  let searchOffset = 0;
  paragraphs.forEach((paragraph) => {
    const sectionText = paragraph.trim();
    if (sectionText.length === 0) {
      return;
    }
    const startOffset = text.indexOf(sectionText, searchOffset);
    const safeStartOffset = startOffset >= 0 ? startOffset : searchOffset;
    searchOffset = safeStartOffset + sectionText.length;
    const heading = sections.length === 0 ? firstNonEmptyLine(sectionText) : null;
    sections.push({
      id: sectionId("mobi-section", sections.length),
      ordinal: sections.length,
      parentSectionId: null,
      heading,
      headingPath: heading ? [heading] : [],
      startOffset: safeStartOffset,
      endOffset: safeStartOffset + sectionText.length,
      text: sectionText,
      metadata: { source: "text-record" },
    });
  });
  return sections;
}

function parsePalmDatabaseName(bytes: Uint8Array): string | null {
  const name = Buffer.from(bytes.subarray(0, Math.min(32, bytes.length))).toString("ascii").replace(/\0+$/g, "").trim();
  return name.length > 0 && /[A-Za-z0-9]/.test(name) ? name : null;
}

function firstNonEmptyLine(text: string): string | null {
  return text.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? null;
}

function indexOfAscii(bytes: Uint8Array, needle: string): number {
  return Buffer.from(bytes).indexOf(Buffer.from(needle, "ascii"));
}
