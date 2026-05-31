import type { JsonValue } from "~/lib/db/rows";
import type { ReviewSuggestion } from "~/lib/review/repository";

export const reviewSuggestionPromptVersion = "review-import-v1";

export type ReviewSuggestionInput = {
  title: string;
  targetType: string;
  summary: string | null;
  normalizedText: string;
  metadata: JsonValue;
};

export type ReviewSuggestionDraft = Pick<ReviewSuggestion, "suggestionState" | "rationale" | "model" | "promptVersion" | "confidence"> & {
  metadata: JsonValue;
};

export type ReviewSuggestionServiceConfig = {
  providerKey?: string;
  providerUrl?: string;
  model?: string;
  timeoutMs?: number;
};

export class ReviewSuggestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewSuggestionError";
  }
}

function configuredProviderKey(): string | undefined {
  return process.env.IKIS_REVIEW_LLM_PROVIDER_KEY ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
}

function configuredModel(): string {
  return process.env.IKIS_REVIEW_LLM_MODEL ?? "ikis-review-suggester";
}

function configuredTimeoutMs(): number {
  const parsed = Number(process.env.IKIS_REVIEW_LLM_TIMEOUT_MS ?? 5000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

export function getReviewSuggestionConfig(): Required<Pick<ReviewSuggestionServiceConfig, "model" | "timeoutMs">> &
  Pick<ReviewSuggestionServiceConfig, "providerKey" | "providerUrl"> {
  return {
    providerKey: configuredProviderKey(),
    providerUrl: process.env.IKIS_REVIEW_LLM_PROVIDER_URL,
    model: configuredModel(),
    timeoutMs: configuredTimeoutMs(),
  };
}

function parseSuggestionState(value: unknown): ReviewSuggestion["suggestionState"] {
  if (value === "suggested_approve" || value === "suggested_reject" || value === "suggested_defer") {
    return value;
  }

  return "suggested_defer";
}

function parseConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

function buildReviewPrompt(input: ReviewSuggestionInput): string {
  const excerpt = input.normalizedText.slice(0, 2400);

  return [
    `Prompt version: ${reviewSuggestionPromptVersion}`,
    "You suggest whether an imported corpus document should be approved, rejected, or deferred for a human final reviewer.",
    "Never make the final decision. Return only JSON with suggestionState, rationale, and confidence.",
    `Target: ${input.targetType}`,
    `Title: ${input.title}`,
    `Summary: ${input.summary ?? "No summary supplied."}`,
    `Excerpt:\n${excerpt}`,
  ].join("\n\n");
}

async function requestProviderSuggestion(input: ReviewSuggestionInput, config: Required<Pick<ReviewSuggestionServiceConfig, "model" | "timeoutMs">> &
  Pick<ReviewSuggestionServiceConfig, "providerKey" | "providerUrl">): Promise<ReviewSuggestionDraft> {
  if (!config.providerKey) {
    throw new ReviewSuggestionError("Review LLM provider key is not configured.");
  }

  if (!config.providerUrl) {
    throw new ReviewSuggestionError("Review LLM provider URL is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.providerUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.providerKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: config.model, prompt: buildReviewPrompt(input), promptVersion: reviewSuggestionPromptVersion }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ReviewSuggestionError(`Review LLM provider returned ${response.status}.`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const suggestionState = parseSuggestionState(payload.suggestionState);
    const rationale = typeof payload.rationale === "string" && payload.rationale.trim() ? payload.rationale.trim() : "Provider returned no rationale.";

    return {
      suggestionState,
      rationale,
      model: config.model,
      promptVersion: reviewSuggestionPromptVersion,
      confidence: parseConfidence(payload.confidence),
      metadata: { providerUrl: config.providerUrl, promptVersion: reviewSuggestionPromptVersion },
    };
  } catch (error) {
    if (error instanceof ReviewSuggestionError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ReviewSuggestionError(`Review LLM suggestion timed out after ${config.timeoutMs}ms.`);
    }

    throw new ReviewSuggestionError(error instanceof Error ? error.message : "Review LLM suggestion failed.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function suggestReviewDecision(
  input: ReviewSuggestionInput,
  config: ReviewSuggestionServiceConfig = getReviewSuggestionConfig(),
): Promise<ReviewSuggestionDraft> {
  const resolvedConfig = {
    providerKey: config.providerKey,
    providerUrl: config.providerUrl,
    model: config.model ?? configuredModel(),
    timeoutMs: config.timeoutMs ?? configuredTimeoutMs(),
  };

  return requestProviderSuggestion(input, resolvedConfig);
}
