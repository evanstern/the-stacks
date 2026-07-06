/**
 * @stacks/db — the persistence seam: drizzle schemas, the pooled client,
 * boot-time migrations, and the two data disciplines of the skeleton (the
 * Postgres-backed queue, D12, and the append-only event trail, Principle IV).
 * Consumed by apps/api and apps/worker only; apps/web is forbidden from
 * importing this package (FR-019, enforced by scripts/check-boundaries.mjs).
 */
export * from "./schema/jobs";
export * from "./schema/skeleton-checks";
export * from "./schema/skeleton-vectors";
export * from "./client";
export * from "./migrate";
export * from "./queue";
export * from "./events";

