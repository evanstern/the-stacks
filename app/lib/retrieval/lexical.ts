import type { Database } from "~/lib/db/connection";
import { createCorpusRepository, type Chunk, type DocumentRecord, type Source } from "~/lib/corpus/repository";

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

const defaultLimit = 5;
const defaultMinimumScore = 0.000001;

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
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

  const rows = db.prepare(`
    SELECT chunk_id, bm25(chunk_fts) AS score
    FROM chunk_fts
    WHERE corpus_id = ? AND chunk_fts MATCH ?
    ORDER BY score
    LIMIT ?
  `).all(input.corpusId, match, input.limit ?? defaultLimit) as SearchRow[];

  const corpusRepo = createCorpusRepository(db);
  const minimumScore = input.minimumScore ?? defaultMinimumScore;
  const results: RetrievalResult[] = [];

  for (const row of rows) {
    const score = scoreForBm25(row.score);

    if (score < minimumScore) {
      continue;
    }

    const chunk = corpusRepo.getChunk(row.chunk_id);
    const document = chunk ? corpusRepo.getDocument(chunk.documentId) : null;
    const source = document ? corpusRepo.getSource(document.sourceId) : null;

    if (!chunk || !document || !source) {
      continue;
    }

    results.push({ chunk, document, source, score, rank: results.length + 1 });
  }

  if (results.length === 0) {
    return {
      query,
      classification: "no_evidence",
      results: [],
      noEvidenceReason: "The corpus does not contain enough evidence for this query.",
    };
  }

  return { query, classification: "evidence", results, noEvidenceReason: null };
}
