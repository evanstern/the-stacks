/**
 * T036 (010 US5): the rerank client, TDD'd first. One error taxonomy: the
 * sidecar's envelope codes ARE DomainError classes, so translation is
 * verbatim — and network failure is dependency_down. The client never
 * returns a partial scoring: contracts/reranker.md guarantees every input
 * id exactly once, and the client enforces it (a sidecar that broke that
 * promise would be an internal fault, not a shrug).
 */
import { describe, expect, it } from "vitest";

import { DomainError } from "@stacks/core";

import { createRerankClient } from "./rerank-client";

const PASSAGES = [
  { id: "c1", text: "short" },
  { id: "c2", text: "longer passage" },
];

const clientWith = (fetchImpl: typeof fetch) =>
  createRerankClient({
    endpoint: "http://ml:4402",
    modelId: "rerank-model",
    timeoutMs: 5000,
    fetchImpl,
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createRerankClient", () => {
  it("maps scores by id and asserts the configured model on every call", async () => {
    let sentBody: { model?: string } = {};
    const client = clientWith(async (_url, init) => {
      sentBody = JSON.parse(String(init?.body)) as { model?: string };
      return jsonResponse({
        model: "rerank-model",
        scores: [
          { id: "c2", score: 4.2 },
          { id: "c1", score: 1.1 },
        ],
        duration_ms: 3,
      });
    });
    const scores = await client.rerank("query", PASSAGES);
    expect(sentBody.model).toBe("rerank-model");
    expect(scores.get("c1")).toBeCloseTo(1.1, 6);
    expect(scores.get("c2")).toBeCloseTo(4.2, 6);
  });

  it("translates the sidecar's envelope codes verbatim (503 → dependency_down)", async () => {
    const client = clientWith(async () =>
      jsonResponse({ error: { code: "dependency_down", message: "Reranker role is disabled." } }, 503),
    );
    await expect(client.rerank("q", PASSAGES)).rejects.toMatchObject({
      constructor: DomainError,
      class: "dependency_down",
      message: expect.stringContaining("disabled"),
    });
  });

  it("network failure is dependency_down with the rerank seam named", async () => {
    const client = clientWith(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(client.rerank("q", PASSAGES)).rejects.toMatchObject({
      class: "dependency_down",
      seam: "rerank",
    });
  });

  it("a response missing any input id is an internal fault (broken contract, not a shrug)", async () => {
    const client = clientWith(async () =>
      jsonResponse({ model: "rerank-model", scores: [{ id: "c1", score: 1 }], duration_ms: 1 }),
    );
    await expect(client.rerank("q", PASSAGES)).rejects.toMatchObject({
      class: "internal_fault",
    });
  });
});
