import type { Database } from "~/lib/db/connection";
import { closeDatabase, openDatabase } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import { createCorpusRepository } from "~/lib/corpus/repository";
import { createConversationRepository, type Citation, type Conversation, type Message, type RetrievalRun } from "~/lib/conversations/repository";
import {
  createConfiguredGroundedAnswerProvider,
  insufficientEvidenceAnswer,
  type GroundedAnswerProvider,
  type GroundedAnswerResult,
  type GroundedAnswerValidation,
  validateGroundedAnswer,
} from "~/lib/conversations/grounded-answer.server";
import { runLocalChatAgentTurn } from "~/lib/conversations/agent/local-runner.server";
import { buildGroundedRetrievalContext } from "~/lib/retrieval/context";
import {
  loadPreviewForCitation,
  persistGroundedConversationTurn,
  type GroundedConversationTurn,
  type SourcePreview,
} from "~/lib/conversations/grounded-turn-persistence.server";

export { insufficientEvidenceAnswer } from "~/lib/conversations/grounded-answer.server";

export type { GroundedConversationTurn, SourcePreview } from "~/lib/conversations/grounded-turn-persistence.server";

export type ConversationTranscript = {
  conversation: Conversation | null;
  messages: Message[];
  latestRun: RetrievalRun | null;
  citations: Citation[];
  sourcePreviews: SourcePreview[];
};

export type DirectGroundedConversationTurn = GroundedConversationTurn & {
  agentContext: {
    conversationId: string;
    userMessage: Message;
    retrievalContext: ReturnType<typeof buildGroundedRetrievalContext>;
    answerResult: GroundedAnswerResult;
    validation: GroundedAnswerValidation;
  };
};

export async function answerGroundedQuestion(
  db: Database,
  input: { corpusId: string; question: string; conversationId?: string | null; answerProvider?: GroundedAnswerProvider },
): Promise<GroundedConversationTurn> {
  if (isChatAgentEnabled()) {
    return runLocalChatAgentTurn(db, input);
  }

  return answerGroundedQuestionDirect(db, input);
}

export function isChatAgentEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.IKIS_CHAT_AGENT_ENABLED === "true";
}

export async function answerGroundedQuestionDirect(
  db: Database,
  input: { corpusId: string; question: string; conversationId?: string | null; answerProvider?: GroundedAnswerProvider },
): Promise<DirectGroundedConversationTurn> {
  const question = input.question.trim();

  if (!question) {
    throw new Error("Question is required.");
  }

  const conversationRepo = createConversationRepository(db);
  const conversation = input.conversationId
    ? conversationRepo.getConversation(input.conversationId) ?? conversationRepo.createConversation({ corpusId: input.corpusId, title: question.slice(0, 80) })
    : conversationRepo.createConversation({ corpusId: input.corpusId, title: question.slice(0, 80) });

  const userMessage = conversationRepo.addMessage({ conversationId: conversation.id, role: "user", content: question });
  const retrievalContext = buildGroundedRetrievalContext(db, { corpusId: input.corpusId, query: question });
  const answerProvider = input.answerProvider ?? createConfiguredGroundedAnswerProvider();
  const answerResult = retrievalContext.evidence.length === 0
    ? {
      answer: insufficientEvidenceAnswer,
      citedOrdinals: [],
      model: "ikis-grounded-no-evidence-v1",
      promptVersion: "grounded-answer-v2",
      metadata: { skipped: "retrieval_returned_no_evidence" },
    }
    : await answerProvider({ question, evidence: retrievalContext.evidence });
  const validation = validateGroundedAnswer({ result: answerResult, evidence: retrievalContext.evidence });
  const persistedTurn = persistGroundedConversationTurn({
    db,
    corpusId: input.corpusId,
    question,
    conversation,
    userMessage,
    retrievalContext,
    answerResult,
    validation,
  });

  return {
    ...persistedTurn,
    agentContext: {
      conversationId: conversation.id,
      userMessage,
      retrievalContext,
      answerResult,
      validation,
    },
  };
}

export async function askGroundedQuestion(input: { corpusId: string; question: string; conversationId?: string | null }): Promise<GroundedConversationTurn> {
  const db = openDatabase();
  runMigrations(db);

  try {
    return await answerGroundedQuestion(db, input);
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
