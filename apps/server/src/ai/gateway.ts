/**
 * The AI gateway (contracts/gateway.md). `chat()` routes a purpose to its
 * named provider, streams text, and emits exactly one usage record per call.
 * `embed()` lands in Phase 3.
 */

import { FakeProvider } from "./adapters/fake.js";
import type { AiConfig } from "./config.js";
import type {
  AdapterFactory,
  ChatEvent,
  ChatRequest,
  Provider,
  ProviderConfig,
  UsageRecord,
  UsageSink,
  UsageSummary,
} from "./types.js";
import { computeCost } from "./usage.js";

export interface Gateway {
  chat(req: ChatRequest): AsyncIterable<ChatEvent>;
}

export interface GatewayOptions {
  config: AiConfig;
  sink: UsageSink;
  fetch?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  /** Overrides/extends the default kind → adapter-factory registry (tests inject fakes here). */
  adapters?: Record<string, AdapterFactory>;
}

const DEFAULT_ADAPTERS: Record<string, AdapterFactory> = {
  fake: () => new FakeProvider(),
};

const NO_USAGE: UsageSummary = { inputTokens: 0, outputTokens: 0 };

export function createGateway(opts: GatewayOptions): Gateway {
  const { config, sink } = opts;
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetch ?? fetch;
  const adapters: Record<string, AdapterFactory> = {
    ...DEFAULT_ADAPTERS,
    ...opts.adapters,
  };
  const providers = new Map<string, Provider>();

  function resolveProvider(name: string, cfg: ProviderConfig): Provider {
    let provider = providers.get(name);
    if (!provider) {
      const factory = adapters[cfg.kind];
      if (!factory) {
        throw new Error(
          `no adapter registered for provider kind "${cfg.kind}"`,
        );
      }
      provider = factory(cfg, { fetch: fetchImpl, env });
      providers.set(name, provider);
    }
    return provider;
  }

  return {
    async *chat(req: ChatRequest): AsyncIterable<ChatEvent> {
      const startedAt = Date.now();
      const purpose = config.purposes[req.purpose];

      // Invariant 1: unknown purpose fails before any provider call, and
      // (symmetrically with US3 AC2/AC4, which fail at startup rather than
      // per call) no usage record is emitted — no provider or model exists
      // yet to attribute one to.
      if (!purpose) {
        yield {
          type: "error",
          kind: "config",
          message: `unknown purpose "${req.purpose}"`,
          usage: NO_USAGE,
        };
        return;
      }

      const providerCfg = config.providers[purpose.provider];
      const provider = resolveProvider(purpose.provider, providerCfg);
      // Startup cross-validation (config.ts) guarantees a "chat" purpose's
      // provider kind supports chat, so `.chat` is present here. Called as
      // `provider.chat(...)` (not a hoisted-out reference) so `this` inside
      // the provider's own implementation stays bound to `provider`.
      if (!provider.chat) {
        throw new Error(
          `provider "${purpose.provider}" declares no chat operation`,
        );
      }

      let usage = NO_USAGE;
      let outcome: UsageRecord["outcome"] = "ok";
      let terminated = false;

      try {
        for await (const event of provider.chat(purpose.model, req, {
          maxTokens: purpose.maxTokens,
        })) {
          if (event.type !== "text") {
            usage = event.usage;
            terminated = true;
            if (event.type === "error") {
              outcome = event.kind === "cancelled" ? "cancelled" : "error";
            }
          }
          yield event;
        }

        // The provider's iterable ended without a done/error event — the
        // only case this arises is a caller abort that stopped the fake (or
        // a real adapter) from yielding its own terminal event.
        if (!terminated) {
          outcome = req.signal?.aborted ? "cancelled" : "error";
          yield {
            type: "error",
            kind: req.signal?.aborted ? "cancelled" : "upstream",
            message: req.signal?.aborted
              ? "cancelled"
              : "provider ended without a terminal event",
            usage,
          };
        }
      } catch (err) {
        outcome = "error";
        yield {
          type: "error",
          kind: "upstream",
          message: err instanceof Error ? err.message : String(err),
          usage,
        };
      } finally {
        sink.record({
          purpose: req.purpose,
          provider: purpose.provider,
          model: purpose.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costUsd: computeCost(
            config.prices,
            purpose.provider,
            purpose.model,
            usage.inputTokens,
            usage.outputTokens,
          ),
          durationMs: Date.now() - startedAt,
          // retry.ts (Phase 4) will make this vary; fixed at 1 until the
          // gateway wraps provider calls in retry.
          attempts: 1,
          outcome,
          at: new Date().toISOString(),
        });
      }
    },
  };
}
