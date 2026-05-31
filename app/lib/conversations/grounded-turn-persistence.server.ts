import { createHash } from "node:crypto";

import { createCorpusRepository, type Chunk, type DocumentRecord, type Source } from "~/lib/corpus/repository";
import type { Database } from "~/lib/db/connection";
import { createConversationRepository, type Citation, type Conversation, type Message, type RetrievalRun } from "~/lib/conversations/repository";
import type { GroundedAnswerResult, GroundedAnswerValidation } from "~/lib/conversations/grounded-answer.server";
import type { GroundedEvidenceRecord, GroundedRetrievalContext } from "~/lib/retrieval/context";

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

type CitationRecord = {
  evidence: GroundedEvidenceRecord;
  quote: string;
  citationOrdinal: number;
};

type PersistedCitationRecord = CitationRecord & {
  citation: Citation;
};

function hashContext(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function trimGroundedQuote(text: string, maxLength = 280): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
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
    quote: input.citation.quote ?? trimGroundedQuote(input.result.chunk.text),
    score: input.citation.metadata && typeof input.citation.metadata === "object" && !Array.isArray(input.citation.metadata) && "score" in input.citation.metadata
      ? Number(input.citation.metadata.score)
      : null,
    previewUrl: sourcePreviewUrl(input.conversationId, input.citation),
  };
}

export function loadPreviewForCitation(db: Database, conversationId: string, citation: Citation): SourcePreview | null {
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

export function persistGroundedConversationTurn(input: {
  db: Database;
  corpusId: string;
  question: string;
  conversation: Conversation;
  userMessage: Message;
  retrievalContext: GroundedRetrievalContext;
  answerResult: GroundedAnswerResult;
  validation: GroundedAnswerValidation;
}): GroundedConversationTurn {
  const conversationRepo = createConversationRepository(input.db);
  const citedOrdinalSet = new Set(input.validation.citedOrdinals);
  const citationRecords: CitationRecord[] = input.retrievalContext.evidence
    .filter((record) => citedOrdinalSet.has(record.ordinal))
    .map((evidence) => ({
      evidence,
      quote: trimGroundedQuote(evidence.text),
      citationOrdinal: evidence.ordinal - 1,
    }));
  const providerMetadata = input.answerResult.metadata ?? null;
  const contextPayload = JSON.stringify({
    query: input.question,
    promptVersion: input.answerResult.promptVersion,
    evidence: input.retrievalContext.evidence,
  });
  const assistantMessage = conversationRepo.addMessage({
    conversationId: input.conversation.id,
    role: "assistant",
    content: input.validation.answer,
    model: input.answerResult.model,
    metadata: {
      noEvidence: input.validation.noEvidence,
      promptVersion: input.answerResult.promptVersion,
      citedOrdinals: input.validation.citedOrdinals,
      validation: {
        accepted: input.validation.accepted,
        reason: input.validation.reason,
      },
      retrievalRunSourceIds: citationRecords.map((record) => record.evidence.sourceId),
    },
  });
  const retrievalRun = conversationRepo.createRetrievalRun({
    conversationId: input.conversation.id,
    messageId: assistantMessage.id,
    corpusId: input.corpusId,
    query: input.question,
    retrievalMode: input.retrievalContext.trace.retrievalMode,
    retrievedChunks: input.retrievalContext.evidence.map((record) => record.chunkId),
    scores: input.retrievalContext.evidence.map((record) => ({ chunkId: record.chunkId, score: record.score, rank: record.rank, contextOrdinal: record.ordinal })),
    modelInputs: {
      mode: "llm-grounded-answer",
      answerModel: input.answerResult.model,
      promptVersion: input.answerResult.promptVersion,
      sourceIds: citationRecords.map((record) => record.evidence.sourceId),
      citedOrdinals: input.validation.citedOrdinals,
      noEvidenceReason: input.retrievalContext.noEvidenceReason,
      retrievalTrace: input.retrievalContext.trace,
      validation: {
        accepted: input.validation.accepted,
        reason: input.validation.reason,
      },
      provider: providerMetadata,
      context: input.retrievalContext.evidence,
    },
    promptContextHash: hashContext(contextPayload),
    finalAnswer: input.validation.answer,
    noEvidence: input.validation.noEvidence,
  });
  const persistedCitations: PersistedCitationRecord[] = citationRecords.map((record) => ({
    ...record,
    citation: conversationRepo.createCitation({
      retrievalRunId: retrievalRun.id,
      messageId: assistantMessage.id,
      chunkId: record.evidence.chunkId,
      documentId: record.evidence.documentId,
      sourceId: record.evidence.sourceId,
      ordinal: record.citationOrdinal,
      quote: record.quote,
      rationale: "Grounded answer cited this evidence record.",
      metadata: {
        score: record.evidence.score,
        rank: record.evidence.rank,
        contextOrdinal: record.evidence.ordinal,
      },
    }),
  }));

  return {
    conversation: conversationRepo.getConversation(input.conversation.id) ?? input.conversation,
    userMessage: input.userMessage,
    assistantMessage,
    retrievalRun,
    citations: persistedCitations.map((record) => record.citation),
    sourcePreviews: persistedCitations.flatMap((record) => {
      const preview = loadPreviewForCitation(input.db, input.conversation.id, record.citation);
      return preview ? [preview] : [];
    }),
    noEvidence: input.validation.noEvidence,
  };
}
