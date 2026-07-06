import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveModelRole } from "../src/model-roles";

const REQUIRED_VARS = [
  "EMBEDDING_PROVIDER",
  "EMBEDDING_ENDPOINT",
  "EMBEDDING_MODEL_ID",
  "EMBEDDING_DIMENSIONS",
];

const ORIGINAL: Record<string, string | undefined> = {};

describe("resolveModelRole", () => {
  beforeEach(() => {
    for (const key of REQUIRED_VARS) {
      ORIGINAL[key] = process.env[key];
    }
    process.env.EMBEDDING_PROVIDER = "local-sidecar";
    process.env.EMBEDDING_ENDPOINT = "http://ml:4402";
    process.env.EMBEDDING_MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2";
    process.env.EMBEDDING_DIMENSIONS = "384";
  });

  afterEach(() => {
    for (const key of REQUIRED_VARS) {
      if (ORIGINAL[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = ORIGINAL[key];
      }
    }
  });

  it("resolves the embedding role from env on the happy path", () => {
    const config = resolveModelRole("embedding");

    expect(config).toEqual({
      role: "embedding",
      provider: "local-sidecar",
      endpoint: "http://ml:4402",
      modelId: "sentence-transformers/all-MiniLM-L6-v2",
      dimensions: 384,
    });
  });

  it("fails fast naming the variable when a required var is missing", () => {
    delete process.env.EMBEDDING_MODEL_ID;

    expect(() => resolveModelRole("embedding")).toThrowError(/EMBEDDING_MODEL_ID/);
  });

  it("fails fast naming the variable when dimensions is malformed", () => {
    process.env.EMBEDDING_DIMENSIONS = "not-a-number";

    expect(() => resolveModelRole("embedding")).toThrowError(/EMBEDDING_DIMENSIONS/);
  });
});
