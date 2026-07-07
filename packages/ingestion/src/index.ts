/**
 * @stacks/ingestion — the pipeline CORE for spec 008 (plan.md "Project
 * Structure"): plugin registry + detection dispatch, structure-aware chunking,
 * batched embedding via the env-first `embedding` model role, idempotent
 * indexing, and the per-source stage driver that records the append-only event
 * trail.
 *
 * The constitutional boundary (FR-014, D2): THIS package owns everything that
 * touches the database, the queue, or the ML sidecar. Plugins — over in
 * @stacks/ingestion-plugins — are pure transforms (bytes in, NormalizedDocument
 * out) and are structurally unable to import this package or @stacks/db
 * (enforced by scripts/check-boundaries.mjs rule 4).
 */
export * from "./admit";
export * from "./chunking";
export * from "./embed";
export * from "./index-chunks";
export * from "./ingest-source";
export * from "./registry";
export * from "./shipped";
export * from "./sniff";
