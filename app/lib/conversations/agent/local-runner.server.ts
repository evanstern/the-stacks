import { createHash } from "node:crypto";

import type { Database } from "~/lib/db/connection";
import type { JsonValue } from "~/lib/db/rows";
import { createConversationRepository, type Conversation, type Message, type WorkflowRun } from "~/lib/conversations/repository";
import {
  createConfiguredGroundedAnswerProvider,
  insufficientEvidenceAnswer,
  type GroundedAnswerProvider,
  type GroundedAnswerResult,
  validateGroundedAnswer,
} from "~/lib/conversations/grounded-answer.server";
import { persistGroundedConversationTurn } from "~/lib/conversations/grounded-turn-persistence.server";
import { buildGroundedRetrievalContext, type GroundedRetrievalContext } from "~/lib/retrieval/context";
import { assertWorkflowBoundaryRefs, createDeterministicThreadId } from "~/lib/workflows/boundary";
import {
  chatAgentGraphVersion,
  type ChatAgentNodeName,
  type ChatAgentNodeStep,
  type ChatAgentState,
  type ChatAgentTurnInput,
  type ChatAgentTurnResult,
} from "~/lib/conversations/agent/types";

type StartedWorkflow = {
  run: WorkflowRun;
  threadId: string;
  sessionId: string;
};

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown chat agent error.";
}

function step(input: { node: ChatAgentNodeName; status?: ChatAgentNodeStep["status"]; summary: JsonValue }): ChatAgentNodeStep {
  const timestamp = nowIso();

  return {
    id: `${input.node}:${timestamp}`,
    node: input.node,
    status: input.status ?? "succeeded",
    summary: input.summary,
    startedAt: timestamp,
    finishedAt: timestamp,
  };
}

function workflowInputRefs(input: { corpusId: string; conversationId: string; question: string; userMessageId: string }): JsonValue {
  return {
    corpusId: input.corpusId,
    targetType: "conversation",
    targetId: input.conversationId,
    graphName: "local_chat_agent",
    graphVersion: chatAgentGraphVersion,
    questionHash: hashValue(input.question),
    questionLength: input.question.length,
    userMessageId: input.userMessageId,
  };
}

function evidenceSummary(retrievalContext: GroundedRetrievalContext): JsonValue {
  return {
    retrievalMode: retrievalContext.trace.retrievalMode,
    candidateCount: retrievalContext.trace.candidateCount,
    finalContextCount: retrievalContext.trace.finalContextCount,
    evidenceOrdinals: retrievalContext.evidence.map((record) => record.ordinal),
    evidenceRecordIds: retrievalContext.evidence.map((record) => ({
      ordinal: record.ordinal,
      chunkId: record.chunkId,
      documentId: record.documentId,
      sourceId: record.sourceId,
      recordTextHash: hashValue(record.text),
      recordTextLength: record.text.length,
    })),
    noEvidenceReason: retrievalContext.noEvidenceReason ?? null,
  };
}

function workflowOutputRefs(input: { state: ChatAgentState; turn: ChatAgentTurnResult["turn"] }): JsonValue {
  return {
    conversationId: input.turn.conversation.id,
    userMessageId: input.turn.userMessage.id,
    assistantMessageId: input.turn.assistantMessage.id,
    retrievalRunId: input.turn.retrievalRun.id,
    citationIds: input.turn.citations.map((citation) => citation.id),
    noEvidence: input.turn.noEvidence,
    status: "succeeded",
    graphName: "local_chat_agent",
    graphVersion: chatAgentGraphVersion,
    nodeSummaries: nodeSummaries(input.state.steps),
  };
}

function failedWorkflowOutputRefs(input: {
  conversationId: string;
  userMessageId: string;
  failedNode: ChatAgentNodeName;
  steps: ChatAgentNodeStep[];
}): JsonValue {
  return {
    conversationId: input.conversationId,
    userMessageId: input.userMessageId,
    status: "failed",
    failedNode: input.failedNode,
    graphName: "local_chat_agent",
    graphVersion: chatAgentGraphVersion,
    nodeSummaries: nodeSummaries(input.steps),
  };
}

function nodeSummaries(steps: ChatAgentNodeStep[]): JsonValue {
  return steps.map((agentStep) => ({
    id: agentStep.id,
    node: agentStep.node,
    status: agentStep.status,
    summary: agentStep.summary,
    startedAt: agentStep.startedAt,
    finishedAt: agentStep.finishedAt,
  }));
}

function startWorkflow(input: {
  db: Database;
  corpusId: string;
  conversation: Conversation;
  userMessage: Message;
  question: string;
}): StartedWorkflow {
  const workflowRepo = createConversationRepository(input.db);
  const workflowKind = "chat_agent_turn";
  const threadId = createDeterministicThreadId({ workflowKind, targetType: "conversation", targetId: input.conversation.id });
  const inputRefs = workflowInputRefs({
    corpusId: input.corpusId,
    conversationId: input.conversation.id,
    question: input.question,
    userMessageId: input.userMessage.id,
  });
  assertWorkflowBoundaryRefs(inputRefs);

  return {
    threadId,
    sessionId: threadId,
    run: workflowRepo.createWorkflowRun({
      corpusId: input.corpusId,
      workflowKind,
      threadId,
      status: "running",
      targetType: "conversation",
      targetId: input.conversation.id,
      inputRefs,
      startedAt: nowIso(),
    }),
  };
}

function markWorkflowFailed(input: {
  db: Database;
  workflowRun: WorkflowRun;
  conversationId: string;
  userMessageId: string;
  failedNode: ChatAgentNodeName;
  steps: ChatAgentNodeStep[];
  error: unknown;
}): void {
  const outputRefs = failedWorkflowOutputRefs({
    conversationId: input.conversationId,
    userMessageId: input.userMessageId,
    failedNode: input.failedNode,
    steps: input.steps,
  });
  assertWorkflowBoundaryRefs(outputRefs);
  createConversationRepository(input.db).updateWorkflowRun({
    id: input.workflowRun.id,
    status: "failed",
    outputRefs,
    error: errorMessage(input.error),
    finishedAt: nowIso(),
  });
}

export async function runLocalChatAgentTurn(db: Database, input: ChatAgentTurnInput): Promise<ChatAgentTurnResult["turn"]> {
  const question = input.question.trim();

  if (!question) {
    throw new Error("Question is required.");
  }

  const conversationRepo = createConversationRepository(db);
  const conversation = input.conversationId
    ? conversationRepo.getConversation(input.conversationId) ?? conversationRepo.createConversation({ corpusId: input.corpusId, title: question.slice(0, 80) })
    : conversationRepo.createConversation({ corpusId: input.corpusId, title: question.slice(0, 80) });
  const userMessage = conversationRepo.addMessage({ conversationId: conversation.id, role: "user", content: question });
  const receiveUserMessage = step({
    node: "receive_user_message",
    summary: {
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      questionHash: hashValue(question),
      questionLength: question.length,
    },
  });
  const workflow = startWorkflow({ db, corpusId: input.corpusId, conversation, userMessage, question });
  const steps: ChatAgentNodeStep[] = [receiveUserMessage];
  let retrievalContext: GroundedRetrievalContext | null = null;
  let answerResult: GroundedAnswerResult | null = null;
  let currentNode: ChatAgentNodeName = "retrieve_evidence";

  try {
    currentNode = "retrieve_evidence";
    retrievalContext = buildGroundedRetrievalContext(db, { corpusId: input.corpusId, query: question });
    steps.push(step({ node: "retrieve_evidence", summary: evidenceSummary(retrievalContext) }));

    currentNode = "synthesize_answer";
    const answerProvider: GroundedAnswerProvider = input.answerProvider ?? createConfiguredGroundedAnswerProvider();
    answerResult = retrievalContext.evidence.length === 0
      ? {
        answer: insufficientEvidenceAnswer,
        citedOrdinals: [],
        model: "ikis-grounded-no-evidence-v1",
        promptVersion: "grounded-answer-v2",
        metadata: { skipped: "retrieval_returned_no_evidence" },
      }
      : await answerProvider({ question, evidence: retrievalContext.evidence });
    steps.push(step({
      node: "synthesize_answer",
      summary: {
        model: answerResult.model,
        promptVersion: answerResult.promptVersion,
        answerHash: hashValue(answerResult.answer),
        answerLength: answerResult.answer.length,
        citedOrdinals: answerResult.citedOrdinals,
      },
    }));

    currentNode = "validate_answer";
    const validation = validateGroundedAnswer({ result: answerResult, evidence: retrievalContext.evidence });
    steps.push(step({
      node: "validate_answer",
      summary: {
        accepted: validation.accepted,
        noEvidence: validation.noEvidence,
        reason: validation.reason,
        citedOrdinals: validation.citedOrdinals,
      },
    }));

    currentNode = "persist_completed_turn";
    const turn = persistGroundedConversationTurn({
      db,
      corpusId: input.corpusId,
      question,
      conversation,
      userMessage,
      retrievalContext,
      answerResult,
      validation,
    });
    steps.push(step({
      node: "persist_completed_turn",
      summary: {
        assistantMessageId: turn.assistantMessage.id,
        retrievalRunId: turn.retrievalRun.id,
        citationIds: turn.citations.map((citation) => citation.id),
        sourcePreviewCount: turn.sourcePreviews.length,
        noEvidence: turn.noEvidence,
      },
    }));

    const state: ChatAgentState = {
      sessionId: workflow.sessionId,
      conversationId: turn.conversation.id,
      corpusId: input.corpusId,
      userMessageId: userMessage.id,
      question,
      messages: [
        { role: "user", content: question },
        { role: "assistant", content: turn.assistantMessage.content },
      ],
      intent: "corpus_lookup",
      retrievalAttempts: [{
        query: question,
        trace: retrievalContext.trace as JsonValue,
        evidenceOrdinals: retrievalContext.evidence.map((record) => record.ordinal),
        evidenceChunkIds: retrievalContext.evidence.map((record) => record.chunkId),
        noEvidenceReason: retrievalContext.noEvidenceReason ?? null,
      }],
      selectedEvidence: retrievalContext.evidence,
      answerDraft: answerResult.answer,
      validation: {
        accepted: validation.accepted,
        noEvidence: validation.noEvidence,
        reason: validation.reason,
        citedOrdinals: validation.citedOrdinals,
      },
      status: "completed",
      loopCount: 0,
      errors: [],
      steps,
    };
    const outputRefs = workflowOutputRefs({ state, turn });
    assertWorkflowBoundaryRefs(outputRefs);
    createConversationRepository(db).updateWorkflowRun({
      id: workflow.run.id,
      status: "succeeded",
      outputRefs,
      finishedAt: nowIso(),
    });

    return turn;
  } catch (error) {
    steps.push(step({
      node: currentNode,
      status: "failed",
      summary: {
        errorMessage: errorMessage(error),
        errorHash: hashValue(errorMessage(error)),
      },
    }));
    markWorkflowFailed({
      db,
      workflowRun: workflow.run,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      failedNode: currentNode,
      steps,
      error,
    });
    throw error;
  }
}
