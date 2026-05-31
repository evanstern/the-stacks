import type { ImportAdapter, ImportAdapterInput, ImportAdapterResult, NormalizedDocument, NormalizedSection } from "../types.js";
import { decodeUtf8, normalizeLineEndings, sectionId, trimBlankLines } from "../shared.js";
import { normalizeMediaWikiTitle } from "./normalize.js";
import type { MediaWikiPageJson } from "./types.js";

const requiredPageFields = [
  "title",
  "page_id",
  "revision_id",
  "timestamp",
  "dump_date",
  "source",
  "source_tier",
  "source_url",
  "categories",
  "links",
  "text",
] as const;

function parsePageJson(input: ImportAdapterInput): MediaWikiPageJson {
  const rawText = decodeUtf8(input.bytes);

  let value: unknown;
  try {
    value = JSON.parse(rawText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Malformed MediaWiki page JSON in ${input.filename}: ${message}`);
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid MediaWiki page JSON in ${input.filename}: expected an object.`);
  }

  const record = value as Record<string, unknown>;
  const missing = requiredPageFields.filter((field) => !(field in record));
  if (missing.length > 0) {
    throw new Error(`Invalid MediaWiki page JSON in ${input.filename}: missing required fields ${missing.join(", ")}.`);
  }

  if (!Array.isArray(record.categories) || !record.categories.every((entry) => typeof entry === "string")) {
    throw new Error(`Invalid MediaWiki page JSON in ${input.filename}: categories must be an ordered string array.`);
  }

  if (!Array.isArray(record.links) || !record.links.every((entry) => typeof entry === "string")) {
    throw new Error(`Invalid MediaWiki page JSON in ${input.filename}: links must be an ordered string array.`);
  }

  for (const field of ["title", "timestamp", "dump_date", "source", "source_tier", "source_url", "text"] as const) {
    if (typeof record[field] !== "string") {
      throw new Error(`Invalid MediaWiki page JSON in ${input.filename}: ${field} must be a string.`);
    }
  }

  return record as MediaWikiPageJson;
}

function documentIdForPage(page: MediaWikiPageJson): string {
  const pageId = String(page.page_id).trim();
  if (pageId.length > 0) {
    return `mediawiki-page-${pageId}`;
  }

  return `mediawiki-page-${normalizeMediaWikiTitle(page.title).replace(/\s+/g, "-")}`;
}

export function normalizeMediaWikiPage(input: ImportAdapterInput): NormalizedDocument {
  const rawText = decodeUtf8(input.bytes);
  const page = parsePageJson(input);
  const normalizedText = trimBlankLines(normalizeLineEndings(page.text));
  const sectionText = normalizedText;
  const sections: NormalizedSection[] = sectionText.length === 0
    ? []
    : [
        {
          id: sectionId("mediawiki-section", 0),
          ordinal: 0,
          parentSectionId: null,
          heading: page.title,
          headingPath: [page.title],
          startOffset: 0,
          endOffset: sectionText.length,
          text: sectionText,
          metadata: { source: "mediawiki-page-text" },
        },
      ];

  return {
    id: documentIdForPage(page),
    title: page.title,
    authors: [],
    language: null,
    sourceFormat: "mediawiki-json",
    provenance: {
      filename: input.filename,
      sourceId: input.sourceId ?? null,
      title: page.title,
      normalizedTitle: normalizeMediaWikiTitle(page.title),
      page_id: page.page_id,
      revision_id: page.revision_id,
      timestamp: page.timestamp,
      dump_date: page.dump_date,
      source: page.source,
      source_tier: page.source_tier,
      source_url: page.source_url,
      categories: page.categories,
      links: page.links,
    },
    rawMetadata: {
      mediawiki: page,
      rawJson: rawText,
    },
    normalizedText,
    sections,
  };
}

export const mediaWikiPageImportAdapter: ImportAdapter = {
  name: "mediawiki",
  version: "mediawiki-v1",
  async import(input): Promise<ImportAdapterResult> {
    return {
      documents: [normalizeMediaWikiPage(input)],
      warnings: [],
    };
  },
};
