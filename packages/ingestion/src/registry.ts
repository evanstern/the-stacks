/**
 * Plugin registry + detection dispatch (008 FR-011/FR-012) — detection is the
 * PLUGINS' job (each declares what it recognizes, with confidence); PICKING
 * the owner is the pipeline's job, and it happens here.
 *
 * Dispatch rules, all deterministic:
 *   - only plugins whose `accepts` lists the sniffed media type are consulted;
 *   - highest confidence wins; ties break by REGISTRATION ORDER, which is why
 *     the shipped list registers specific plugins (ddb) before fallbacks
 *     (generic-html, markdown);
 *   - a plugin whose detect() throws scores 0 — detect is contractually
 *     never-throwing (conformance assertion 2), so a throw is a plugin bug,
 *     but one plugin's bug must not take down detection for a source another
 *     plugin can own;
 *   - every consulted candidate's confidence is returned for the detect
 *     event's `candidates` map (contracts/events.md) — the operator can see
 *     WHY a plugin won, not just that it did;
 *   - all-zero (or nobody accepts) → null → the driver fails the source with
 *     an honest unsupported_type (FR-012).
 */
import type { DetectInput, IngestionPlugin } from "@stacks/ingestion-contract";

export interface DetectDecision {
  plugin: IngestionPlugin;
  confidence: number;
  /** name -> confidence for every plugin consulted (accepts-filtered). */
  candidates: Record<string, number>;
}

export interface PluginRegistry {
  detect(input: DetectInput): DetectDecision | null;
  byName(name: string): IngestionPlugin | undefined;
  readonly plugins: readonly IngestionPlugin[];
}

export function createRegistry(plugins: readonly IngestionPlugin[]): PluginRegistry {
  const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]));

  return {
    plugins,
    byName: (name) => byName.get(name),
    detect(input) {
      const candidates: Record<string, number> = {};
      let winner: IngestionPlugin | null = null;
      let winning = 0;

      for (const plugin of plugins) {
        if (!plugin.accepts.includes(input.mediaType)) continue;
        let confidence = 0;
        try {
          confidence = plugin.detect(input).confidence;
        } catch {
          confidence = 0; // plugin bug — scored as "not mine", surfaced by conformance
        }
        candidates[plugin.name] = confidence;
        // Strictly-greater keeps the first-registered winner on ties.
        if (confidence > winning) {
          winner = plugin;
          winning = confidence;
        }
      }

      if (!winner || winning <= 0) return null;
      return { plugin: winner, confidence: winning, candidates };
    },
  };
}
