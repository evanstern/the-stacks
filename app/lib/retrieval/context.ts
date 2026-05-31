import type { Database } from "~/lib/db/connection";
import { retrieveLexicalChunks, type RetrievalResult } from "~/lib/retrieval/lexical";

export type GroundedEvidenceRecord = {
  ordinal: number;
  chunkId: string;
  documentId: string;
  sourceId: string;
  documentTitle: string;
  sourceLabel: string;
  headingPath: string[];
  score: number;
  rank: number;
  text: string;
};

export type GroundedRetrievalContext = {
  query: string;
  candidates: RetrievalResult[];
  evidence: GroundedEvidenceRecord[];
  noEvidenceReason: string | null;
  trace: {
    retrievalMode: "lexical-fts-context-v1";
    candidateLimit: number;
    candidateCount: number;
    finalContextCount: number;
    maxContextRecords: number;
    maxContextCharacters: number;
    strategy: string;
  };
};

export type BuildGroundedRetrievalContextInput = {
  corpusId: string;
  query: string;
  candidateLimit?: number;
  maxContextRecords?: number;
  maxContextCharacters?: number;
};

const defaultCandidateLimit = 25;
const defaultMaxContextRecords = 8;
const defaultMaxContextCharacters = 12_000;

function normalizeText(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\(data:image\/[^)]*\)/g, " ")
    .replace(/[A-Za-z0-9+/=]{120,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableEvidenceText(text: string): boolean {
  if (!text) return false;
  if (text.includes("data:image/")) return false;

  const alphaCount = (text.match(/[a-z]/gi) ?? []).length;
  return alphaCount / text.length >= 0.45;
}

function fingerprintResult(result: RetrievalResult): string {
  return [
    result.document.id,
    result.chunk.headingPath.join(" > "),
    normalizeText(result.chunk.text).slice(0, 180).toLowerCase(),
  ].join("|");
}

function toEvidenceRecord(result: RetrievalResult, ordinal: number): GroundedEvidenceRecord {
  return {
    ordinal,
    chunkId: result.chunk.id,
    documentId: result.document.id,
    sourceId: result.source.id,
    documentTitle: result.document.title,
    sourceLabel: result.source.originalFilename,
    headingPath: result.chunk.headingPath,
    score: result.score,
    rank: result.rank,
    text: normalizeText(result.chunk.text),
  };
}

function selectEvidence(input: {
  candidates: RetrievalResult[];
  maxContextRecords: number;
  maxContextCharacters: number;
}): GroundedEvidenceRecord[] {
  const selected: GroundedEvidenceRecord[] = [];
  const seenFingerprints = new Set<string>();
  let usedCharacters = 0;

  for (const candidate of input.candidates) {
    if (selected.length >= input.maxContextRecords) {
      break;
    }

    const text = normalizeText(candidate.chunk.text);
    if (!isUsableEvidenceText(text)) {
      continue;
    }

    const fingerprint = fingerprintResult(candidate);
    if (seenFingerprints.has(fingerprint)) {
      continue;
    }

    const nextCharacterCount = usedCharacters + text.length;
    if (selected.length > 0 && nextCharacterCount > input.maxContextCharacters) {
      continue;
    }

    seenFingerprints.add(fingerprint);
    selected.push(toEvidenceRecord(candidate, selected.length + 1));
    usedCharacters = nextCharacterCount;
  }

  return selected;
}

export function buildGroundedRetrievalContext(db: Database, input: BuildGroundedRetrievalContextInput): GroundedRetrievalContext {
  const candidateLimit = input.candidateLimit ?? defaultCandidateLimit;
  const maxContextRecords = input.maxContextRecords ?? defaultMaxContextRecords;
  const maxContextCharacters = input.maxContextCharacters ?? defaultMaxContextCharacters;
  const retrieval = retrieveLexicalChunks(db, {
    corpusId: input.corpusId,
    query: input.query,
    limit: candidateLimit,
  });
  const evidence = selectEvidence({
    candidates: retrieval.results,
    maxContextRecords,
    maxContextCharacters,
  });

  return {
    query: retrieval.query,
    candidates: retrieval.results,
    evidence,
    noEvidenceReason: evidence.length === 0 ? retrieval.noEvidenceReason ?? "The corpus does not contain enough evidence for this query." : null,
    trace: {
      retrievalMode: "lexical-fts-context-v1",
      candidateLimit,
      candidateCount: retrieval.results.length,
      finalContextCount: evidence.length,
      maxContextRecords,
      maxContextCharacters,
      strategy: "sqlite-fts-bm25-candidate-pool-deduped-context-v1",
    },
  };
}
