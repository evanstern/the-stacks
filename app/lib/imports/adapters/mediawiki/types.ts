import type { JsonValue } from "../../../db/rows.js";
import type { ImportWarning, NormalizedDocument } from "../types.js";

export type MediaWikiDecisionState = "approved" | "rejected" | "deferred";

export type MediaWikiPageJson = {
  title: string;
  page_id: number | string;
  revision_id: number | string;
  timestamp: string;
  dump_date: string;
  source: string;
  source_tier: string;
  source_url: string;
  categories: string[];
  links: string[];
  text: string;
};

export type MediaWikiDecision = {
  id: string;
  state: MediaWikiDecisionState;
  title: string;
  normalizedTitle: string;
  rationale: string | null;
  targetDocumentId: string | null;
  metadata: JsonValue;
};

export type MediaWikiImportCounts = {
  approved: number;
  rejected: number;
  deferred: number;
  pages: number;
  missing: number;
};

export type MediaWikiManifestImportResult = {
  documents: NormalizedDocument[];
  decisions: MediaWikiDecision[];
  policy: JsonValue;
  counts: MediaWikiImportCounts;
  warnings: ImportWarning[];
  upserts: {
    documentKeys: string[];
    decisionKeys: string[];
  };
};

export type MediaWikiPageArtifact = {
  filename: string;
  bytes: Uint8Array;
};

export type MediaWikiManifestImportInput = {
  manifest: MediaWikiPageArtifact;
  pages: MediaWikiPageArtifact[];
  strict?: boolean;
  sourceId?: string;
};
