import { createHash } from "node:crypto";

import type { Database } from "~/lib/db/connection";
import { closeDatabase, openDatabase } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import { createCorpusRepository, type Chunk, type DocumentRecord, type Source } from "~/lib/corpus/repository";
import { createConversationRepository, type Citation, type Conversation, type Message, type RetrievalRun } from "~/lib/conversations/repository";
import { retrieveLexicalChunks, type RetrievalResult } from "~/lib/retrieval/lexical";

export const insufficientEvidenceAnswer = "The corpus does not contain enough evidence to answer that question.";
const groundedAnswerModel = "ikis-grounded-extractive-v1";
const groundedPromptVersion = "grounded-answer-v1";

export type SourcePreview = {
  citationId: string;
  retrievalRunId: string;
  ordinal: number;
  chunkId: string;
  documentId: string;
  sourceId: string;
  documentTitle: string;
  sourceLabel: string;
  headingPath: string[];
  quote: string;
  score: number | null;
  previewUrl: string;
};

export type GroundedConversationTurn = {
  conversation: Conversation;
  userMessage: Message;
  assistantMessage: Message;
  retrievalRun: RetrievalRun;
  citations: Citation[];
  sourcePreviews: SourcePreview[];
  noEvidence: boolean;
};

export type ConversationTranscript = {
  conversation: Conversation | null;
  messages: Message[];
  latestRun: RetrievalRun | null;
  citations: Citation[];
  sourcePreviews: SourcePreview[];
};

type CitationRecord = {
  result: RetrievalResult;
  quote: string;
  ordinal: number;
};

type PersistedCitationRecord = CitationRecord & {
  citation: Citation;
};

function hashContext(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sentenceCandidates(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );
}

function overlapScore(sentence: string, queryTokens: Set<string>): number {
  const sentenceTokens = tokenSet(sentence);
  let score = 0;

  for (const token of queryTokens) {
    if (sentenceTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

function trimQuote(text: string, maxLength = 280): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function quoteForResult(result: RetrievalResult, query: string): string {
  const queryTokens = tokenSet(query);
  const candidates = sentenceCandidates(result.chunk.text);
  let best = candidates[0] ?? result.chunk.text;
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = overlapScore(candidate, queryTokens);

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return trimQuote(best);
}

function buildCitedAnswer(query: string, records: CitationRecord[]): string {
  const evidenceLines = records.map((record) => {
    const citationMark = `[${record.ordinal + 1}]`;
    return `${citationMark} ${record.quote}`;
  });

  return [`Based on approved corpus evidence for “${query}”:`, ...evidenceLines].join("\n");
}

function sourcePreviewUrl(conversationId: string, citation: Citation): string {
  return `/chat/${encodeURIComponent(conversationId)}/sources/${encodeURIComponent(citation.id)}`;
}

function toSourcePreview(input: {
  conversationId: string;
  citation: Citation;
  result: { chunk: Chunk; document: DocumentRecord; source: Source };
}): SourcePreview {
  return {
    citationId: input.citation.id,
    retrievalRunId: input.citation.retrievalRunId,
    ordinal: input.citation.ordinal,
    chunkId: input.result.chunk.id,
    documentId: input.result.document.id,
    sourceId: input.result.source.id,
    documentTitle: input.result.document.title,
    sourceLabel: input.result.source.originalFilename,
    headingPath: input.result.chunk.headingPath,
    quote: input.citation.quote ?? trimQuote(input.result.chunk.text),
    score: input.citation.metadata && typeof input.citation.metadata === "object" && !Array.isArray(input.citation.metadata) && "score" in input.citation.metadata
      ? Number(input.citation.metadata.score)
      : null,
    previewUrl: sourcePreviewUrl(input.conversationId, input.citation),
  };
}

function loadPreviewForCitation(db: Database, conversationId: string, citation: Citation): SourcePreview | null {
  if (!citation.chunkId || !citation.documentId || !citation.sourceId) {
    return null;
  }

  const corpusRepo = createCorpusRepository(db);
  const chunk = corpusRepo.getChunk(citation.chunkId);
  const document = corpusRepo.getDocument(citation.documentId);
  const source = corpusRepo.getSource(citation.sourceId);

  if (!chunk || !document || !source) {
    return null;
  }

  return toSourcePreview({ conversationId, citation, result: { chunk, document, source } });
}

export function answerGroundedQuestion(
  db: Database,
  input: { corpusId: string; question: string; conversationId?: string | null },
): GroundedConversationTurn {
  const question = input.question.trim();

  if (!question) {
    throw new Error("Question is required.");
  }

  const conversationRepo = createConversationRepository(db);
  const conversation = input.conversationId
    ? conversationRepo.getConversation(input.conversationId) ?? conversationRepo.createConversation({ corpusId: input.corpusId, title: question.slice(0, 80) })
    : conversationRepo.createConversation({ corpusId: input.corpusId, title: question.slice(0, 80) });

  const userMessage = conversationRepo.addMessage({ conversationId: conversation.id, role: "user", content: question });
  const retrieval = retrieveLexicalChunks(db, { corpusId: input.corpusId, query: question });
  const citationRecords: CitationRecord[] = retrieval.results.map((result, index) => ({
    result,
    quote: quoteForResult(result, question),
    ordinal: index,
  }));
  const answer = retrieval.classification === "evidence" ? buildCitedAnswer(question, citationRecords) : insufficientEvidenceAnswer;
  const contextPayload = JSON.stringify({
    query: question,
    chunks: citationRecords.map((record) => ({
      chunkId: record.result.chunk.id,
      documentId: record.result.document.id,
      sourceId: record.result.source.id,
      score: record.result.score,
      quote: record.quote,
    })),
  });
  const assistantMessage = conversationRepo.addMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: answer,
    model: groundedAnswerModel,
    metadata: {
      noEvidence: retrieval.classification === "no_evidence",
      promptVersion: groundedPromptVersion,
      retrievalRunSourceIds: citationRecords.map((record) => record.result.source.id),
    },
  });
  const retrievalRun = conversationRepo.createRetrievalRun({
    conversationId: conversation.id,
    messageId: assistantMessage.id,
    corpusId: input.corpusId,
    query: question,
    retrievalMode: "lexical-fts-v1",
    retrievedChunks: citationRecords.map((record) => record.result.chunk.id),
    scores: citationRecords.map((record) => ({ chunkId: record.result.chunk.id, score: record.result.score, rank: record.result.rank })),
    modelInputs: {
      mode: "extractive-grounded-answer",
      answerModel: groundedAnswerModel,
      promptVersion: groundedPromptVersion,
      sourceIds: citationRecords.map((record) => record.result.source.id),
      noEvidenceReason: retrieval.noEvidenceReason,
      context: citationRecords.map((record) => ({
        chunkId: record.result.chunk.id,
        documentTitle: record.result.document.title,
        sourceId: record.result.source.id,
        sourceLabel: record.result.source.originalFilename,
        quote: record.quote,
      })),
    },
    promptContextHash: hashContext(contextPayload),
    finalAnswer: answer,
    noEvidence: retrieval.classification === "no_evidence",
  });

  const persistedCitations: PersistedCitationRecord[] = citationRecords.map((record) => ({
    ...record,
    citation: conversationRepo.createCitation({
      retrievalRunId: retrievalRun.id,
      messageId: assistantMessage.id,
      chunkId: record.result.chunk.id,
      documentId: record.result.document.id,
      sourceId: record.result.source.id,
      ordinal: record.ordinal,
      quote: record.quote,
      rationale: "Retrieved approved chunk used as answer evidence.",
      metadata: {
        score: record.result.score,
        rank: record.result.rank,
        stableChunkId: record.result.chunk.stableId,
      },
    }),
  }));

  return {
    conversation: conversationRepo.getConversation(conversation.id) ?? conversation,
    userMessage,
    assistantMessage,
    retrievalRun,
    citations: persistedCitations.map((record) => record.citation),
    sourcePreviews: persistedCitations.map((record) => toSourcePreview({
      conversationId: conversation.id,
      citation: record.citation,
      result: record.result,
    })),
    noEvidence: retrieval.classification === "no_evidence",
  };
}

export function askGroundedQuestion(input: { corpusId: string; question: string; conversationId?: string | null }): GroundedConversationTurn {
  const db = openDatabase();
  runMigrations(db);

  try {
    return answerGroundedQuestion(db, input);
  } finally {
    closeDatabase(db);
  }
}

export function getConversationTranscript(input: { conversationId?: string | null }): ConversationTranscript {
  const db = openDatabase();
  runMigrations(db);

  try {
    const conversationRepo = createConversationRepository(db);
    const conversation = input.conversationId ? conversationRepo.getConversation(input.conversationId) : null;
    const messages = conversation ? conversationRepo.listMessages(conversation.id) : [];
    const latestRun = conversation
      ? db.prepare("SELECT id FROM retrieval_runs WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1").get(conversation.id) as { id: string } | undefined
      : undefined;
    const retrievalRun = latestRun ? conversationRepo.getRetrievalRun(latestRun.id) : null;
    const citations = retrievalRun ? conversationRepo.listCitations(retrievalRun.id) : [];

    return {
      conversation,
      messages,
      latestRun: retrievalRun,
      citations,
      sourcePreviews: citations.flatMap((citation) => {
        const preview = conversation ? loadPreviewForCitation(db, conversation.id, citation) : null;
        return preview ? [preview] : [];
      }),
    };
  } finally {
    closeDatabase(db);
  }
}

export function getCitationSourcePreview(input: { conversationId: string; citationId: string }): (SourcePreview & { chunkText: string }) | null {
  const db = openDatabase();
  runMigrations(db);

  try {
    const conversationRepo = createConversationRepository(db);
    const citation = conversationRepo.getCitation(input.citationId);

    if (!citation || !citation.messageId) {
      return null;
    }

    const message = conversationRepo.getMessage(citation.messageId);

    if (!message || message.conversationId !== input.conversationId || !citation.chunkId) {
      return null;
    }

    const preview = loadPreviewForCitation(db, input.conversationId, citation);
    const chunk = createCorpusRepository(db).getChunk(citation.chunkId);

    if (!preview || !chunk) {
      return null;
    }

    return { ...preview, chunkText: chunk.text };
  } finally {
    closeDatabase(db);
  }
}
