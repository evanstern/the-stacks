import { describe, expect, it } from "vitest";
import { crossValidate, loadAiConfig } from "../src/ai/config.js";
import type { ProviderConfig, PurposeConfig } from "../src/ai/types.js";

function env(vars: Record<string, string>): NodeJS.ProcessEnv {
  return { ...vars } as NodeJS.ProcessEnv;
}

describe("loadAiConfig", () => {
  it("yields no providers or purposes when nothing is set (M0 behavior unchanged)", () => {
    const config = loadAiConfig(env({}));
    expect(config).toEqual({ providers: {}, purposes: {}, prices: {} });
  });

  it("accepts two arbitrarily named providers mapped to two purposes", () => {
    const config = loadAiConfig(
      env({
        AI_PROVIDERS: JSON.stringify({
          hosted: {
            kind: "openai-compatible",
            baseUrl: "https://a.example/v1",
            apiKeyEnv: "HOSTED_KEY",
          },
          local: { kind: "fake", baseUrl: "http://local" },
        }),
        AI_PURPOSES: JSON.stringify({
          answering: { provider: "hosted", model: "big" },
          embedding: { provider: "local", model: "small", op: "embed" },
        }),
        HOSTED_KEY: "secret",
      }),
    );
    expect(config.purposes.answering).toMatchObject({
      provider: "hosted",
      op: "chat",
    });
    expect(config.purposes.embedding).toMatchObject({
      provider: "local",
      op: "embed",
    });
  });

  it("fails naming the purpose and the missing provider (US3 AC2)", () => {
    expect(() =>
      loadAiConfig(
        env({
          AI_PURPOSES: JSON.stringify({
            answering: { provider: "ghost", model: "m" },
          }),
        }),
      ),
    ).toThrow(/answering.*ghost/s);
  });

  it("fails naming the missing key variable for a provider a purpose uses (US3 AC4)", () => {
    expect(() =>
      loadAiConfig(
        env({
          AI_PROVIDERS: JSON.stringify({
            hosted: {
              kind: "fake",
              baseUrl: "http://x",
              apiKeyEnv: "HOSTED_KEY",
            },
          }),
          AI_PURPOSES: JSON.stringify({
            answering: { provider: "hosted", model: "m" },
          }),
        }),
      ),
    ).toThrow(/HOSTED_KEY/);
  });

  it("does not fail startup over an unused provider's missing key (US3 AC4)", () => {
    const config = loadAiConfig(
      env({
        AI_PROVIDERS: JSON.stringify({
          unused: { kind: "fake", baseUrl: "http://x", apiKeyEnv: "UNSET_KEY" },
        }),
      }),
    );
    expect(config.providers.unused).toBeDefined();
  });

  it("fails naming the variable when AI_PROVIDERS is not valid JSON", () => {
    expect(() => loadAiConfig(env({ AI_PROVIDERS: "{not json" }))).toThrow(
      /AI_PROVIDERS/,
    );
  });

  it("fails naming the variable when AI_PURPOSES fails schema validation", () => {
    expect(() =>
      loadAiConfig(env({ AI_PURPOSES: JSON.stringify({ answering: {} }) })),
    ).toThrow(/AI_PURPOSES/);
  });
});

describe("crossValidate — op unsupported by provider kind (US3 AC3, FR-006b)", () => {
  // No shipped kind lacks an op yet (FR-006a: both openai-compatible and fake
  // serve chat and embed) — this exercises the forward-compatible guard
  // directly against a hypothetical chat-only kind, the way a real future
  // adapter (e.g. an embeddings-less native kind) would trip it.
  it("throws naming both the purpose's op and the provider's kind", () => {
    const providers: Record<string, ProviderConfig> = {
      chatOnly: {
        kind: "chat-only-kind" as ProviderConfig["kind"],
        baseUrl: "http://x",
      },
    };
    const purposes: Record<string, PurposeConfig> = {
      embedding: { provider: "chatOnly", model: "m", op: "embed" },
    };

    expect(() => crossValidate(providers, purposes, env({}))).toThrow(
      /embedding.*embed.*chatOnly.*chat-only-kind/s,
    );
  });
});
