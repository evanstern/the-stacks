import type { JsonValue } from "~/lib/db/rows";
import type { GroundedEvidenceRecord } from "~/lib/retrieval/context";

export const insufficientEvidenceAnswer = "The corpus does not contain enough evidence to answer that question.";
export const groundedAnswerPromptVersion = "grounded-answer-v2";

export type GroundedAnswerResult = {
  answer: string;
  citedOrdinals: number[];
  model: string;
  promptVersion: string;
  rawText?: string;
  metadata?: JsonValue;
};

export type GroundedAnswerProviderInput = {
  question: string;
  evidence: GroundedEvidenceRecord[];
};

export type GroundedAnswerProvider = (input: GroundedAnswerProviderInput) => Promise<GroundedAnswerResult>;

export type GroundedAnswerValidation = {
  accepted: boolean;
  noEvidence: boolean;
  answer: string;
  citedOrdinals: number[];
  reason: string | null;
};

export type GroundedAnswerConfig = {
  providerKey?: string;
  providerUrl?: string;
  model?: string;
  timeoutMs?: number;
};

const defaultOpenAiModel = "gpt-4o-mini";

function configuredValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function configuredTimeoutMs(): number {
  const parsed = Number(process.env.IKIS_GROUNDED_ANSWER_TIMEOUT_MS ?? 15_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000;
}

function configuredModel(): string {
  return configuredValue(process.env.IKIS_GROUNDED_ANSWER_MODEL) ?? configuredValue(process.env.OPENAI_MODEL) ?? defaultOpenAiModel;
}

export function getGroundedAnswerConfig(): Required<Pick<GroundedAnswerConfig, "model" | "timeoutMs">> &
  Pick<GroundedAnswerConfig, "providerKey" | "providerUrl"> {
  return {
    providerKey: configuredValue(process.env.IKIS_GROUNDED_ANSWER_PROVIDER_KEY) ?? configuredValue(process.env.OPENAI_API_KEY),
    providerUrl: configuredValue(process.env.IKIS_GROUNDED_ANSWER_PROVIDER_URL) ?? "https://api.openai.com/v1/chat/completions",
    model: configuredModel(),
    timeoutMs: configuredTimeoutMs(),
  };
}

export function extractCitationOrdinals(text: string): number[] {
  const ordinals = new Set<number>();
  const matches = text.matchAll(/\[(\d+)\]/g);

  for (const match of matches) {
    const ordinal = Number(match[1]);
    if (Number.isInteger(ordinal) && ordinal > 0) {
      ordinals.add(ordinal);
    }
  }

  return [...ordinals].sort((left, right) => left - right);
}

export function validateGroundedAnswer(input: {
  result: GroundedAnswerResult;
  evidence: GroundedEvidenceRecord[];
}): GroundedAnswerValidation {
  const answer = input.result.answer.trim();

  if (answer === insufficientEvidenceAnswer) {
    return { accepted: true, noEvidence: true, answer, citedOrdinals: [], reason: null };
  }

  if (input.evidence.length === 0) {
    return {
      accepted: false,
      noEvidence: true,
      answer: insufficientEvidenceAnswer,
      citedOrdinals: [],
      reason: "retrieval_returned_no_evidence",
    };
  }

  const suppliedOrdinals = new Set(input.evidence.map((record) => record.ordinal));
  const citedOrdinals = extractCitationOrdinals(answer);

  if (citedOrdinals.length === 0) {
    return {
      accepted: false,
      noEvidence: true,
      answer: insufficientEvidenceAnswer,
      citedOrdinals: [],
      reason: "answer_missing_citations",
    };
  }

  const unknownOrdinal = citedOrdinals.find((ordinal) => !suppliedOrdinals.has(ordinal));
  if (unknownOrdinal !== undefined) {
    return {
      accepted: false,
      noEvidence: true,
      answer: insufficientEvidenceAnswer,
      citedOrdinals: [],
      reason: `answer_cited_unknown_ordinal_${unknownOrdinal}`,
    };
  }

  return { accepted: true, noEvidence: false, answer, citedOrdinals, reason: null };
}

function buildEvidencePrompt(input: GroundedAnswerProviderInput): string {
  const evidenceBlock = input.evidence.map((record) => [
    `[${record.ordinal}] ${record.documentTitle}`,
    `Source: ${record.sourceLabel}`,
    record.headingPath.length > 0 ? `Headings: ${record.headingPath.join(" > ")}` : "Headings: none",
    `Text: ${record.text}`,
  ].join("\n")).join("\n\n");

  return [
    `Prompt version: ${groundedAnswerPromptVersion}`,
    "Answer the user's question only from the supplied evidence records.",
    `If the evidence is insufficient, return exactly: ${insufficientEvidenceAnswer}`,
    "Cite every factual claim with bracketed evidence numbers like [1].",
    "Do not cite evidence numbers that were not supplied.",
    "Prefer concise RPG-reference prose with short paragraphs or bullets when useful.",
    `Question: ${input.question}`,
    `Evidence:\n${evidenceBlock}`,
  ].join("\n\n");
}

function parseOpenAiAnswer(payload: Record<string, unknown>): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const content = message?.content;

  if (typeof content === "string") {
    return content;
  }

  throw new Error("Grounded answer provider returned no message content.");
}

export function createOpenAiGroundedAnswerProvider(config: GroundedAnswerConfig = getGroundedAnswerConfig()): GroundedAnswerProvider {
  const resolvedConfig = {
    providerKey: config.providerKey,
    providerUrl: config.providerUrl ?? "https://api.openai.com/v1/chat/completions",
    model: config.model ?? configuredModel(),
    timeoutMs: config.timeoutMs ?? configuredTimeoutMs(),
  };

  return async (input): Promise<GroundedAnswerResult> => {
    if (!resolvedConfig.providerKey) {
      return {
        answer: insufficientEvidenceAnswer,
        citedOrdinals: [],
        model: resolvedConfig.model,
        promptVersion: groundedAnswerPromptVersion,
        metadata: { provider: "openai", skipped: "missing_provider_key" },
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), resolvedConfig.timeoutMs);

    try {
      const response = await fetch(resolvedConfig.providerUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${resolvedConfig.providerKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: resolvedConfig.model,
          messages: [
            { role: "system", content: "You are Ikis, a grounded corpus answerer. You answer only from supplied evidence." },
            { role: "user", content: buildEvidencePrompt(input) },
          ],
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Grounded answer provider returned ${response.status}.`);
      }

      const payload = await response.json() as Record<string, unknown>;
      const answer = parseOpenAiAnswer(payload).trim();
      const usage = payload.usage as JsonValue | undefined;

      return {
        answer,
        citedOrdinals: extractCitationOrdinals(answer),
        model: resolvedConfig.model,
        promptVersion: groundedAnswerPromptVersion,
        rawText: answer,
        metadata: {
          provider: "openai",
          usage: usage ?? null,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Grounded answer provider timed out after ${resolvedConfig.timeoutMs}ms.`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function createExtractiveGroundedAnswerProvider(): GroundedAnswerProvider {
  return async (input) => {
    if (input.evidence.length === 0) {
      return {
        answer: insufficientEvidenceAnswer,
        citedOrdinals: [],
        model: "ikis-grounded-fake-v1",
        promptVersion: groundedAnswerPromptVersion,
      };
    }

    const lines = input.evidence.slice(0, 3).map((record) => `${record.text} [${record.ordinal}]`);

    return {
      answer: lines.join("\n"),
      citedOrdinals: input.evidence.slice(0, 3).map((record) => record.ordinal),
      model: "ikis-grounded-fake-v1",
      promptVersion: groundedAnswerPromptVersion,
      metadata: { provider: "extractive-test-fallback" },
    };
  };
}

export function createConfiguredGroundedAnswerProvider(): GroundedAnswerProvider {
  if (configuredValue(process.env.IKIS_GROUNDED_ANSWER_PROVIDER) === "fake") {
    return createExtractiveGroundedAnswerProvider();
  }

  return createOpenAiGroundedAnswerProvider();
}
