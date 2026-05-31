import type { GroundedAnswerProviderMessage } from "~/lib/conversations/grounded-answer.server";

const maxHistoryMessagesForRetrieval = 6;
const maxHistoryCharactersForRetrieval = 1_500;

export function buildHistoryAwareRetrievalQuery(input: { question: string; conversationHistory: GroundedAnswerProviderMessage[] }): string {
  const historyPrefix = input.conversationHistory
    .slice(0, -1)
    .slice(-maxHistoryMessagesForRetrieval)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")
    .slice(-maxHistoryCharactersForRetrieval)
    .trim();

  return historyPrefix ? `${historyPrefix}\nuser: ${input.question}` : input.question;
}
