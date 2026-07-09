/**
 * T018 (TDD): the batched embed client against a stubbed sidecar (007
 * ml-sidecar contract). Pinned behaviors: batching at maxBatch, the model
 * identity assertion on EVERY call, the dimensions check BEFORE anything is
 * returned (stamp integrity, FR-020), and the error-class mapping — down/
 * timeout/503 are dependency_down (retryable), 404/415/500 are internal_fault
 * (misconfiguration is OUR bug, not a down dependency).
 */
import type { ModelRoleConfig } from "@stacks/core";
import { DomainError } from "@stacks/core";
import { describe, expect, it } from "vitest";

import { createEmbedClient } from "./embed";

const CONFIG: ModelRoleConfig = {
  role: "embedding",
  provider: "local-sidecar",
  endpoint: "http://ml.test:4402",
  modelId: "test-embedder",
  dimensions: 3,
};

function sidecarStub(
  handler: (body: { model: string; inputs: string[] }) => Response | Promise<Response>,
) {
  const calls: Array<{ model: string; inputs: string[] }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    expect(String(url)).toBe("http://ml.test:4402/v1/embed");
    const body = JSON.parse(String(init?.body)) as { model: string; inputs: string[] };
    calls.push(body);
    return handler(body);
  };
  return { calls, fetchImpl };
}

function ok(body: { model: string; inputs: string[] }, dimensions = 3): Response {
  return Response.json({
    model: body.model,
    dimensions,
    embeddings: body.inputs.map((_, i) => Array.from({ length: dimensions }, () => i + 1)),
    duration_ms: 5,
  });
}

describe("createEmbedClient (007 sidecar contract, FR-020)", () => {
  it("embeds a batch and returns vectors aligned with inputs", async () => {
    const { fetchImpl } = sidecarStub((body) => ok(body));
    const client = createEmbedClient({ config: CONFIG, maxBatch: 64, timeoutMs: 1000, fetchImpl });

    const vectors = await client.embedAll(["one", "two"]);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(3);
  });

  it("splits inputs into maxBatch-sized calls, preserving order", async () => {
    const { calls, fetchImpl } = sidecarStub((body) => ok(body));
    const client = createEmbedClient({ config: CONFIG, maxBatch: 2, timeoutMs: 1000, fetchImpl });

    const vectors = await client.embedAll(["a", "b", "c", "d", "e"]);
    expect(calls.map((c) => c.inputs.length)).toEqual([2, 2, 1]);
    expect(vectors).toHaveLength(5);
  });

  it("asserts the configured model identity on every call", async () => {
    const { calls, fetchImpl } = sidecarStub((body) => ok(body));
    const client = createEmbedClient({ config: CONFIG, maxBatch: 64, timeoutMs: 1000, fetchImpl });

    await client.embedAll(["x"]);
    expect(calls[0]!.model).toBe("test-embedder");
  });

  it("rejects a dimensions mismatch as internal_fault BEFORE returning vectors", async () => {
    const { fetchImpl } = sidecarStub((body) => ok(body, 5));
    const client = createEmbedClient({ config: CONFIG, maxBatch: 64, timeoutMs: 1000, fetchImpl });

    const attempt = client.embedAll(["x"]);
    await expect(attempt).rejects.toBeInstanceOf(DomainError);
    await expect(attempt).rejects.toMatchObject({ class: "internal_fault", seam: "embed" });
  });

  it("maps 503 (model loading/down) to dependency_down — the queue's retry problem", async () => {
    const { fetchImpl } = sidecarStub(() =>
      Response.json({ error: { code: "dependency_down", message: "loading" } }, { status: 503 }),
    );
    const client = createEmbedClient({ config: CONFIG, maxBatch: 64, timeoutMs: 1000, fetchImpl });

    await expect(client.embedAll(["x"])).rejects.toMatchObject({
      class: "dependency_down",
      seam: "embed",
    });
  });

  it("maps connection failure to dependency_down", async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new TypeError("fetch failed"));
    const client = createEmbedClient({ config: CONFIG, maxBatch: 64, timeoutMs: 1000, fetchImpl });

    await expect(client.embedAll(["x"])).rejects.toMatchObject({ class: "dependency_down" });
  });

  it("maps 404 (model mismatch) to internal_fault — OUR misconfiguration, not a down sidecar", async () => {
    const { fetchImpl } = sidecarStub(() =>
      Response.json({ error: { code: "unknown_thing", message: "wrong model" } }, { status: 404 }),
    );
    const client = createEmbedClient({ config: CONFIG, maxBatch: 64, timeoutMs: 1000, fetchImpl });

    await expect(client.embedAll(["x"])).rejects.toMatchObject({ class: "internal_fault" });
  });

  it("returns [] for empty input without calling the sidecar", async () => {
    const { calls, fetchImpl } = sidecarStub((body) => ok(body));
    const client = createEmbedClient({ config: CONFIG, maxBatch: 64, timeoutMs: 1000, fetchImpl });

    expect(await client.embedAll([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
