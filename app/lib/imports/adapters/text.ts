import type { ImportAdapter, ImportAdapterResult, NormalizedSection } from "./types.js";
import { decodeUtf8, normalizeLineEndings, sectionId, titleFromFilename, trimBlankLines } from "./shared.js";

export const textImportAdapter: ImportAdapter = {
  name: "text",
  version: "text-v1",
  async import(input): Promise<ImportAdapterResult> {
    const normalizedText = trimBlankLines(normalizeLineEndings(decodeUtf8(input.bytes)));
    const paragraphs = normalizedText.length > 0 ? normalizedText.split(/\n{2,}/) : [];
    const title = paragraphs[0]?.split("\n")[0].trim() || titleFromFilename(input.filename);
    const sections: NormalizedSection[] = [];
    let searchOffset = 0;

    paragraphs.forEach((paragraph, ordinal) => {
      const text = paragraph.trim();
      if (text.length === 0) {
        return;
      }

      const startOffset = normalizedText.indexOf(paragraph, searchOffset);
      const safeStartOffset = startOffset >= 0 ? startOffset : searchOffset;
      const endOffset = safeStartOffset + paragraph.length;
      searchOffset = endOffset;

      sections.push({
        id: sectionId("text-section", sections.length),
        ordinal: sections.length,
        parentSectionId: null,
        heading: ordinal === 0 ? title : null,
        headingPath: ordinal === 0 ? [title] : [],
        startOffset: safeStartOffset,
        endOffset,
        text,
        metadata: { source: "paragraph" },
      });
    });

    return {
      documents: [
        {
          id: "document-0001",
          title,
          authors: [],
          language: null,
          sourceFormat: "text",
          provenance: { filename: input.filename, sourceId: input.sourceId ?? null },
          rawMetadata: {},
          normalizedText,
          sections,
        },
      ],
      warnings: [],
    };
  },
};
