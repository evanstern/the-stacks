import { createHash } from "node:crypto";

import type { DocumentRecord, DocumentSection } from "~/lib/corpus/repository";

export type ChunkDraft = {
  corpusId: string;
  documentId: string;
  sectionId: string | null;
  ordinal: number;
  stableId: string;
  startOffset: number;
  endOffset: number;
  headingPath: string[];
  text: string;
  contentHash: string;
  metadata: {
    chunker: "lexical-window-v1";
    source: "section" | "document";
    documentTitle: string;
  };
};

type ChunkSource = {
  sectionId: string | null;
  startOffset: number;
  endOffset: number;
  headingPath: string[];
  text: string;
  source: "section" | "document";
};

const maxChunkCharacters = 900;
const minTrailingCharacters = 160;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableDocumentKey(document: DocumentRecord): string {
  const provenance = document.provenance;

  if (provenance && typeof provenance === "object" && !Array.isArray(provenance)) {
    const filename = provenance.filename;
    const sourcePageId = provenance.sourcePageId;

    if (typeof sourcePageId === "string" && sourcePageId.length > 0) {
      return sourcePageId;
    }

    if (typeof filename === "string" && filename.length > 0) {
      return filename;
    }
  }

  return document.title;
}

function normalizeStablePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document";
}

function splitSource(source: ChunkSource): Array<{ startOffset: number; endOffset: number; text: string }> {
  const trimmedText = source.text.trim();

  if (trimmedText.length === 0) {
    return [];
  }

  const textStart = source.text.indexOf(trimmedText);
  const baseOffset = source.startOffset + Math.max(textStart, 0);

  if (trimmedText.length <= maxChunkCharacters) {
    return [{ startOffset: baseOffset, endOffset: baseOffset + trimmedText.length, text: trimmedText }];
  }

  const chunks: Array<{ startOffset: number; endOffset: number; text: string }> = [];
  let localStart = 0;

  while (localStart < trimmedText.length) {
    let localEnd = Math.min(localStart + maxChunkCharacters, trimmedText.length);

    if (localEnd < trimmedText.length) {
      const paragraphBreak = trimmedText.lastIndexOf("\n\n", localEnd);
      const sentenceBreak = trimmedText.lastIndexOf(". ", localEnd);
      const candidateEnd = Math.max(paragraphBreak, sentenceBreak >= 0 ? sentenceBreak + 1 : -1);

      if (candidateEnd > localStart + minTrailingCharacters) {
        localEnd = candidateEnd;
      }
    }

    const chunkText = trimmedText.slice(localStart, localEnd).trim();
    const leadingTrim = trimmedText.slice(localStart, localEnd).indexOf(chunkText);
    const chunkStart = baseOffset + localStart + Math.max(leadingTrim, 0);

    if (chunkText.length > 0) {
      chunks.push({ startOffset: chunkStart, endOffset: chunkStart + chunkText.length, text: chunkText });
    }

    localStart = localEnd;
  }

  return chunks;
}

function chunkSources(document: DocumentRecord, sections: DocumentSection[]): ChunkSource[] {
  if (sections.length === 0) {
    return [
      {
        sectionId: null,
        startOffset: 0,
        endOffset: document.normalizedText.length,
        headingPath: [],
        text: document.normalizedText,
        source: "document",
      },
    ];
  }

  return sections.map((section) => ({
    sectionId: section.id,
    startOffset: section.startOffset,
    endOffset: section.endOffset,
    headingPath: section.headingPath,
    text: section.text,
    source: "section",
  }));
}

export function buildChunkDrafts(document: DocumentRecord, sections: DocumentSection[]): ChunkDraft[] {
  const documentKey = normalizeStablePart(stableDocumentKey(document));
  const drafts: ChunkDraft[] = [];

  for (const source of chunkSources(document, sections)) {
    for (const part of splitSource(source)) {
      const ordinal = drafts.length;
      const contentHash = sha256(`${documentKey}\n${part.startOffset}\n${part.endOffset}\n${part.text}`);

      drafts.push({
        corpusId: document.corpusId,
        documentId: document.id,
        sectionId: source.sectionId,
        ordinal,
        stableId: `${documentKey}:${ordinal.toString().padStart(4, "0")}:${contentHash.slice(0, 12)}`,
        startOffset: part.startOffset,
        endOffset: part.endOffset,
        headingPath: source.headingPath,
        text: part.text,
        contentHash,
        metadata: {
          chunker: "lexical-window-v1",
          source: source.source,
          documentTitle: document.title,
        },
      });
    }
  }

  return drafts;
}
