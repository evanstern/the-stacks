import type { JsonValue } from "~/lib/db/rows";
import type { GroundedAnswerProvider, GroundedAnswerResult, GroundedAnswerValidation } from "~/lib/conversations/grounded-answer.server";
import type { GroundedConversationTurn } from "~/lib/conversations/grounded.server";
import type { Message, WorkflowRun } from "~/lib/conversations/repository";
import type { GroundedEvidenceRecord, GroundedRetrievalContext } from "~/lib/retrieval/context";

export const chatAgentGraphVersion = "chat-agent-local-v1";

export type ChatAgentIntent = "corpus_lookup" | "rules_reference" | "comparison" | "prep" | "clarification_needed" | "unknown";

export type ChatAgentStatus = "running" | "waiting_for_user" | "completed" | "failed";

export type ChatAgentNodeName =
  | "receive_user_message"
  | "retrieve_evidence"
  | "synthesize_answer"
  | "validate_answer"
  | "persist_completed_turn";

export type ChatAgentMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ChatAgentRetrievalAttempt = {
  query: string;
  trace: JsonValue;
  evidenceOrdinals: number[];
  evidenceChunkIds: string[];
  noEvidenceReason?: string | null;
};

export type ChatAgentValidationSummary = Pick<GroundedAnswerValidation, "accepted" | "noEvidence" | "reason" | "citedOrdinals">;

export type ChatAgentError = {
  node: ChatAgentNodeName;
  message: string;
};

export type ChatAgentNodeStep = {
  id: string;
  node: ChatAgentNodeName;
  status: "succeeded" | "failed";
  summary: JsonValue;
  startedAt: string;
  finishedAt: string;
};

export type ChatAgentState = {
  sessionId: string;
  conversationId: string;
  corpusId: string;
  userMessageId: string;
  question: string;
  messages: ChatAgentMessage[];
  intent: ChatAgentIntent | null;
  retrievalAttempts: ChatAgentRetrievalAttempt[];
  selectedEvidence: GroundedEvidenceRecord[];
  answerDraft: string | null;
  validation: ChatAgentValidationSummary | null;
  status: ChatAgentStatus;
  loopCount: number;
  errors: ChatAgentError[];
  steps: ChatAgentNodeStep[];
};

export type ChatAgentTurnInput = {
  corpusId: string;
  question: string;
  conversationId?: string | null;
  answerProvider?: GroundedAnswerProvider;
};

export type ChatAgentDirectTurnContext = {
  conversationId: string;
  userMessage: Message;
  retrievalContext: GroundedRetrievalContext;
  answerResult: GroundedAnswerResult;
  validation: GroundedAnswerValidation;
};

export type ChatAgentTurnResult = {
  turn: GroundedConversationTurn;
  state: ChatAgentState;
  workflowRun: WorkflowRun;
};
