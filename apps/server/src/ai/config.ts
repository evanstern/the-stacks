import { z } from "zod";
import type { Price, ProviderConfig, PurposeConfig } from "./types.js";

const ProviderConfigSchema = z.object({
  kind: z.enum(["openai-compatible", "fake"]),
  baseUrl: z.string().min(1),
  apiKeyEnv: z.string().min(1).optional(),
});

const PurposeConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  op: z.enum(["chat", "embed"]).default("chat"),
  maxTokens: z.number().int().positive().optional(),
  batchSize: z.number().int().positive().optional(),
  structured: z.enum(["tool", "json-schema"]).optional(),
});

const PriceSchema = z.object({
  inputPerMTok: z.number().min(0),
  outputPerMTok: z.number().min(0),
});

const ProvidersSchema = z.record(z.string(), ProviderConfigSchema);
const PurposesSchema = z.record(z.string(), PurposeConfigSchema);
const PricesSchema = z.record(z.string(), PriceSchema);

/**
 * Ops each adapter kind serves (FR-006a: both shipped kinds serve both).
 * Kept as a lookup — not inlined into the validation below — so a future
 * kind that serves only one op (e.g. a chat-only native adapter) plugs in
 * without touching the cross-validation logic (FR-006b).
 */
const OPS_BY_KIND: Record<
  ProviderConfig["kind"],
  ReadonlySet<"chat" | "embed">
> = {
  "openai-compatible": new Set(["chat", "embed"]),
  fake: new Set(["chat", "embed"]),
};

export interface AiConfig {
  providers: Record<string, ProviderConfig>;
  purposes: Record<string, PurposeConfig>;
  prices: Record<string, Price>;
}

function parseJsonEnv<T>(
  env: NodeJS.ProcessEnv,
  name: string,
  schema: z.ZodType<T>,
): T | undefined {
  const raw = env[name];
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`${name} is invalid: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Startup validation (FR-006b, FR-010): every purpose names a declared
 * provider whose kind supports the purpose's operation, and every provider
 * actually used by a purpose has its declared key variable set. An unused
 * provider is never checked (US3 AC4).
 */
export function crossValidate(
  providers: Record<string, ProviderConfig>,
  purposes: Record<string, PurposeConfig>,
  env: NodeJS.ProcessEnv,
): void {
  const usedProviders = new Set<string>();

  for (const [purposeName, purpose] of Object.entries(purposes)) {
    const provider = providers[purpose.provider];
    if (!provider) {
      throw new Error(
        `AI_PURPOSES."${purposeName}" names undeclared provider "${purpose.provider}"`,
      );
    }
    const supportedOps =
      OPS_BY_KIND[provider.kind] ?? new Set<"chat" | "embed">();
    if (!supportedOps.has(purpose.op)) {
      throw new Error(
        `AI_PURPOSES."${purposeName}" needs op "${purpose.op}" but provider "${purpose.provider}" (kind "${provider.kind}") does not support it`,
      );
    }
    if (purpose.structured && purpose.op === "embed") {
      throw new Error(
        `AI_PURPOSES."${purposeName}" sets "structured" on an embed purpose; structured output applies to chat only`,
      );
    }
    usedProviders.add(purpose.provider);
  }

  for (const providerName of usedProviders) {
    const provider = providers[providerName];
    if (provider?.apiKeyEnv && !env[provider.apiKeyEnv]) {
      throw new Error(
        `AI_PROVIDERS."${providerName}" requires environment variable "${provider.apiKeyEnv}" to be set`,
      );
    }
  }
}

/**
 * Reads and cross-validates the AI gateway's configuration (research R5).
 * Unset `AI_PURPOSES` yields no purposes — the gateway simply has nothing to
 * route, matching pre-gateway (M0) behavior.
 */
export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const providers = parseJsonEnv(env, "AI_PROVIDERS", ProvidersSchema) ?? {};
  const purposes = parseJsonEnv(env, "AI_PURPOSES", PurposesSchema) ?? {};
  const prices = parseJsonEnv(env, "AI_PRICES", PricesSchema) ?? {};

  crossValidate(providers, purposes, env);

  return { providers, purposes, prices };
}
