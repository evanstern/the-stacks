import type { Database } from "~/lib/db/connection";
import { createCorpusRepository, type Chunk, type DocumentRecord, type Source } from "~/lib/corpus/repository";
import { parseJson } from "~/lib/db/rows";

export type RetrievalClassification = "evidence" | "no_evidence";

export type RetrievalResult = {
  chunk: Chunk;
  document: DocumentRecord;
  source: Source;
  score: number;
  rank: number;
};

export type LexicalRetrievalResponse = {
  query: string;
  classification: RetrievalClassification;
  results: RetrievalResult[];
  noEvidenceReason: string | null;
};

type SearchRow = {
  chunk_id: string;
  score: number;
};

type DocumentProjectionRow = {
  id: string;
  corpus_id: string;
  source_id: string;
  title: string;
  authors_json: string;
  language: string | null;
  source_format: string;
  provenance_json: string;
  status: string;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
};

const defaultLimit = 5;
const defaultMinimumScore = 0.000001;
const queryStopwords = new Set([
  "about",
  "are",
  "can",
  "does",
  "for",
  "from",
  "give",
  "how",
  "ikis",
  "into",
  "me",
  "of",
  "say",
  "says",
  "tell",
  "the",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

const queryAliases = new Map<string, string[]>([
  ["hitpoint", ["hit", "point", "points", "hp"]],
  ["hitpoints", ["hit", "point", "points", "hp"]],
]);
const hitPointQueryTokens = new Set(["hit", "hitpoint", "hitpoints", "hp", "point", "points"]);

function baseQueryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !queryStopwords.has(token));
}

export function tokenizeQuery(query: string): string[] {
  const tokens = baseQueryTokens(query);

  return Array.from(new Set(tokens.flatMap((token) => [token, ...(queryAliases.get(token) ?? [])]).filter((token) => !queryStopwords.has(token))));
}

function isHitPointQuery(tokens: string[]): boolean {
  return tokens.some((token) => hitPointQueryTokens.has(token));
}

function queryEntityTokens(query: string): string[] {
  return baseQueryTokens(query).filter((token) => !hitPointQueryTokens.has(token));
}

function textContainsEntity(text: string, entityTokens: string[]): boolean {
  const normalized = text.toLowerCase();

  return entityTokens.some((token) => normalized.includes(token) || normalized.includes(`${token}s`));
}

function textContainsHitPointStat(text: string): boolean {
  return /\b(?:hp|hit points?|hitpoint|hitpoints)\b/i.test(text);
}

function statQueryBoost(input: { query: string; chunkText: string }): number {
  const tokens = tokenizeQuery(input.query);
  const entityTokens = queryEntityTokens(input.query);

  if (!isHitPointQuery(tokens) || entityTokens.length === 0) {
    return 0;
  }

  if (textContainsEntity(input.chunkText, entityTokens) && textContainsHitPointStat(input.chunkText)) {
    return 100;
  }

  return 0;
}

function ftsQuery(query: string): string | null {
  const tokens = tokenizeQuery(query);

  if (tokens.length === 0) {
    return null;
  }

  return tokens.map((token) => `"${token.replace(/"/g, "")}"`).join(" OR ");
}

function scoreForBm25(value: number): number {
  return Math.max(0, -value);
}

function getDocumentProjection(db: Database, documentId: string): DocumentRecord | null {
  const row = db.prepare(`
    SELECT
      id,
      corpus_id,
      source_id,
      title,
      authors_json,
      language,
      source_format,
      provenance_json,
      status,
      content_hash,
      created_at,
      updated_at
    FROM documents
    WHERE id = ?
  `).get(documentId) as DocumentProjectionRow | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    corpusId: row.corpus_id,
    sourceId: row.source_id,
    title: row.title,
    authors: parseJson(row.authors_json, []),
    language: row.language,
    sourceFormat: row.source_format,
    provenance: parseJson(row.provenance_json, {}),
    rawMetadata: {},
    normalizedText: "",
    status: row.status,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function retrieveLexicalChunks(
  db: Database,
  input: { corpusId: string; query: string; limit?: number; minimumScore?: number },
): LexicalRetrievalResponse {
  const query = input.query.trim();
  const match = ftsQuery(query);

  if (!match) {
    return {
      query,
      classification: "no_evidence",
      results: [],
      noEvidenceReason: "The query does not contain searchable terms.",
    };
  }

  const limit = input.limit ?? defaultLimit;
  const candidatePoolLimit = Math.max(limit, 200);
  const rows = db.prepare(`
    SELECT chunk_id, bm25(chunk_fts) AS score
    FROM chunk_fts
    WHERE corpus_id = ? AND chunk_fts MATCH ?
    ORDER BY score
    LIMIT ?
  `).all(input.corpusId, match, candidatePoolLimit) as SearchRow[];

  const corpusRepo = createCorpusRepository(db);
  const minimumScore = input.minimumScore ?? defaultMinimumScore;
  const results: RetrievalResult[] = [];

  for (const row of rows) {
    const score = scoreForBm25(row.score);

    if (score < minimumScore) {
      continue;
    }

    const chunk = corpusRepo.getChunk(row.chunk_id);
    const document = chunk ? getDocumentProjection(db, chunk.documentId) : null;
    const source = document ? corpusRepo.getSource(document.sourceId) : null;

    if (!chunk || !document || !source) {
      continue;
    }

    results.push({ chunk, document, source, score: score + statQueryBoost({ query, chunkText: chunk.text }), rank: 0 });
  }

  results.sort((left, right) => right.score - left.score);
  const limitedResults = results.slice(0, limit).map((result, index) => ({ ...result, rank: index + 1 }));

  if (limitedResults.length === 0) {
    return {
      query,
      classification: "no_evidence",
      results: [],
      noEvidenceReason: "The corpus does not contain enough evidence for this query.",
    };
  }

  return { query, classification: "evidence", results: limitedResults, noEvidenceReason: null };
}
