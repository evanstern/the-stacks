/**
 * The worker's only client for the ML sidecar's embedding endpoint
 * (specs/007-v3-skeleton/contracts/ml-sidecar.md, POST /v1/embed). This is
 * the "inference" seam: the one place HTTP-to-sidecar failures are translated
 * into DomainErrors, so handlers upstream reason purely in error classes and
 * never see fetch/AbortController mechanics.
 *
 * Classification doctrine (see the function comment below): infrastructure
 * failures are dependency_down; a sidecar that answers but with a status we
 * didn't expect means WE misconfigured something -> internal_fault.
 */
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
  // Timeout via AbortController (ML_REQUEST_TIMEOUT_MS upstream): an abort
  // surfaces as a fetch rejection, so timeouts flow through the same
  // dependency_down branch as connection-refused — deliberately identical.
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

  // 503 is the sidecar's documented "model still loading / not ready" answer
  // (contracts/ml-sidecar.md) — reachable but not serving, still a down
  // dependency from the run's point of view, and retryable.
  if (response.status === 503) {
    throw new DomainError({
      class: "dependency_down",
      seam: "inference",
      message: "Inference sidecar is not ready.",
    });
  }

  // Any other non-2xx (400 unknown model, 404, ...) means we sent something
  // the contract doesn't allow — a misconfiguration on our side, so it must
  // NOT masquerade as a down dependency: the operator should go fix config,
  // not wait for the sidecar to "come back".
  if (!response.ok) {
    throw new DomainError({
      class: "internal_fault",
      seam: "inference",
      message: `Inference sidecar returned ${response.status}.`,
    });
  }

  return (await response.json()) as EmbedResult;
}
