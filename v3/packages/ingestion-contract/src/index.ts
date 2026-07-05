/**
 * Placeholder ingestion plugin contract. The full schema (parsing pipelines,
 * chunking strategy, per-source-type identify rules) is owned by the
 * ingestion spec that follows this walking skeleton (FR-015) — this package
 * exists now only so that spec can add to it without introducing a new
 * shared package or touching `@stacks/core`/`@stacks/db`.
 */
export const INGESTION_CONTRACT_VERSION = "0.0.0-placeholder" as const;

export interface IngestionPlugin {
  /** A stable, unique name for this plugin (e.g. "pdf", "markdown"). */
  readonly name: string;
  /** Returns true if this plugin can handle the given source. */
  identify(source: unknown): boolean;
  /** Parses an identified source into plain text content. */
  parse(source: unknown): Promise<string>;
}
