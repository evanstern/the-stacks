import type { JsonValue } from "../../db/rows.js";

export type ImportWarning = {
  code: string;
  message: string;
  metadata?: JsonValue;
};

export type NormalizedSection = {
  id: string;
  ordinal: number;
  parentSectionId: string | null;
  heading: string | null;
  headingPath: string[];
  startOffset: number;
  endOffset: number;
  text: string;
  metadata: JsonValue;
};

export type CorpusReadinessState = "usable" | "ocr_needed" | "deferred" | "rejected";

export type CorpusReadiness = {
  state: CorpusReadinessState;
  reason: string;
  reviewRecommendation: "approve" | "defer" | "reject";
  evidence?: JsonValue;
};

export type NormalizedDocument = {
  id: string;
  title: string;
  authors: string[];
  language: string | null;
  sourceFormat: string;
  provenance: JsonValue;
  rawMetadata: JsonValue;
  normalizedText: string;
  sections: NormalizedSection[];
  corpusReadiness?: CorpusReadiness;
};

export type ImportAdapterInput = {
  filename: string;
  bytes: Uint8Array;
  sourceId?: string;
};

export type ImportAdapterResult = {
  documents: NormalizedDocument[];
  warnings: ImportWarning[];
};

export type ImportAdapter = {
  name: string;
  version: string;
  import(input: ImportAdapterInput): Promise<ImportAdapterResult>;
};
