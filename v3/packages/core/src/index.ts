/**
 * @stacks/core — the dependency-free heart of the v3 skeleton. Pure domain
 * types and logic shared by api, worker, and db: typed errors (FR-011),
 * env-first model roles (FR-013/D14), and skeleton-check vocabulary.
 * Rule of the seam: nothing here may import HTTP, drizzle, or app code —
 * core is what everything else depends on, never the reverse.
 */
export * from "./errors";
export * from "./model-roles";
export * from "./skeleton-check";

