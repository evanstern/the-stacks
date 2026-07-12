/**
 * Sidecar rerank client (spec 010 US5, contracts/reranker.md). Thin and
 * strict: one POST per rerank, the configured model asserted on every call,
 * and the shared error taxonomy translated VERBATIM — the sidecar's
 * envelope codes are DomainError classes, so nothing is invented at this
 * seam. Failure never degrades: the engine decides nothing here (FR-021's
 * no-silent-fallback lives in search.ts; this client just refuses honestly).
 */
import { DomainError, type ErrorClass } from "@stacks/core";

export interface RerankPassageInput {
  id: string;
  text: string;
}

/** The engine-facing seam: search.ts depends on this, tests stub it. */
export interface RerankScorer {
  rerank(query: string, passages: RerankPassageInput[]): Promise<Map<string, number>>;
}

export interface RerankClientOptions {
  endpoint: string;
  modelId: string;
  timeoutMs: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const ENVELOPE_CLASSES: ReadonlySet<string> = new Set([
  "unknown_thing",
  "unsupported_type",
  "invalid_input",
  "dependency_down",
  "internal_fault",
]);

export function createRerankClient(options: RerankClientOptions): RerankScorer {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${options.endpoint.replace(/\/$/, "")}/v1/rerank`;

  return {
    async rerank(query, passages) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: options.modelId,
            query,
            passages,
          }),
          signal: AbortSignal.timeout(options.timeoutMs),
        });
      } catch (cause) {
        throw new DomainError({
          class: "dependency_down",
          seam: "rerank",
          message: "Reranker sidecar unreachable.",
          cause,
        });
      }

      if (!response.ok) {
        let code = "dependency_down";
        let message = `Rerank failed with HTTP ${response.status}.`;
        try {
          const envelope = (await response.json()) as { error?: { code?: string; message?: string } };
          if (envelope.error?.code && ENVELOPE_CLASSES.has(envelope.error.code)) {
            code = envelope.error.code;
          }
          if (envelope.error?.message) message = envelope.error.message;
        } catch {
          // keep the HTTP-status message
        }
        throw new DomainError({ class: code as ErrorClass, seam: "rerank", message });
      }

      const body = (await response.json()) as { scores?: Array<{ id: string; score: number }> };
      const scores = new Map((body.scores ?? []).map((entry) => [entry.id, entry.score]));
      // The contract promises every input id exactly once; a sidecar that
      // broke that would silently corrupt rankings — refuse loudly instead.
      const missing = passages.filter((p) => !scores.has(p.id));
      if (missing.length > 0) {
        throw new DomainError({
          class: "internal_fault",
          seam: "rerank",
          message: `Rerank response missed ${missing.length} passage id(s) — contract violation.`,
        });
      }
      return scores;
    },
  };
}
