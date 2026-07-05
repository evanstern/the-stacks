import { DomainError } from "@stacks/core";

export interface EmbedInput {
  endpoint: string;
  model: string;
  inputs: string[];
  timeoutMs: number;
}

export interface EmbedResult {
  model: string;
  dimensions: number;
  embeddings: number[][];
  duration_ms: number;
}

/**
 * Connection-refused, timeout, and 503 all mean the sidecar dependency is
 * down (contracts/ml-sidecar.md); any other non-2xx is our own
 * misconfiguration, not a down dependency.
 */
export async function embed(input: EmbedInput): Promise<EmbedResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${input.endpoint}/v1/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: input.model, inputs: input.inputs }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new DomainError({
      class: "dependency_down",
      seam: "inference",
      message: "Unable to reach the inference sidecar.",
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 503) {
    throw new DomainError({
      class: "dependency_down",
      seam: "inference",
      message: "Inference sidecar is not ready.",
    });
  }

  if (!response.ok) {
    throw new DomainError({
      class: "internal_fault",
      seam: "inference",
      message: `Inference sidecar returned ${response.status}.`,
    });
  }

  return (await response.json()) as EmbedResult;
}
