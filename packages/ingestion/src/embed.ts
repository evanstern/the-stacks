/**
 * Batched embedding client for the ML sidecar (008 FR-020; consumes the 007
 * contract specs/007-v3-skeleton/contracts/ml-sidecar.md). The model identity
 * comes from the env-first `embedding` role (D14) — resolved by the CALLER at
 * boot and injected here, so this module never reads process.env and tests
 * never have to fake it.
 *
 * Error doctrine (mirrors the 007 worker consumer rules):
 *   - connection refused / timeout / 503  -> dependency_down (seam: embed) —
 *     the sidecar is down or loading; queue retry + backoff is the recovery;
 *   - 404 / 415 / 500                      -> internal_fault — a model-identity
 *     or batching misconfiguration is OUR bug; retrying won't fix a deploy;
 *   - response.dimensions != configured    -> internal_fault BEFORE anything is
 *     returned — stamp integrity (FR-020): a wrong-space vector must never
 *     get near the database.
 */
import type { ModelRoleConfig } from "@stacks/core";
import { DomainError } from "@stacks/core";

export interface EmbedClientOptions {
  config: ModelRoleConfig;
  maxBatch: number;
  timeoutMs: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface EmbedClient {
  /** Embeds all texts, batching at maxBatch; result[i] belongs to texts[i]. */
  embedAll(texts: string[]): Promise<number[][]>;
  readonly config: ModelRoleConfig;
  readonly maxBatch: number;
}

interface EmbedResponse {
  model: string;
  dimensions: number;
  embeddings: number[][];
}

export function createEmbedClient(options: EmbedClientOptions): EmbedClient {
  const { config, maxBatch, timeoutMs } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${config.endpoint.replace(/\/$/, "")}/v1/embed`;

  async function embedBatch(inputs: string[]): Promise<number[][]> {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Asserting OUR configured model id on every call is the seam-level
        // guard against silent vector-space mixing (Principle VII): a sidecar
        // serving a different model answers 404, never a wrong-space vector.
        body: JSON.stringify({ model: config.modelId, inputs }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new DomainError({
        class: "dependency_down",
        seam: "embed",
        message: "Embedding sidecar is unreachable.",
        cause,
      });
    }

    if (response.status === 503) {
      throw new DomainError({
        class: "dependency_down",
        seam: "embed",
        message: "Embedding sidecar is not ready.",
      });
    }
    if (!response.ok) {
      throw new DomainError({
        class: "internal_fault",
        seam: "embed",
        message: `Embedding sidecar rejected the request (HTTP ${response.status}) — likely a model or batching misconfiguration.`,
      });
    }

    const body = (await response.json()) as EmbedResponse;
    if (body.dimensions !== config.dimensions) {
      throw new DomainError({
        class: "internal_fault",
        seam: "embed",
        message: `Embedding dimensions mismatch: sidecar returned ${body.dimensions}, configured ${config.dimensions} (FR-020 stamp integrity).`,
      });
    }
    return body.embeddings;
  }

  return {
    config,
    maxBatch,
    async embedAll(texts) {
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += maxBatch) {
        vectors.push(...(await embedBatch(texts.slice(i, i + maxBatch))));
      }
      return vectors;
    },
  };
}
