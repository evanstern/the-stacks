/**
 * @stacks/ingestion-plugins — the shipped ingesters for spec 008 (FR-028):
 * ddb-saved-html (flagship), markdown, generic-html (fallbacks), plus the
 * test-only demo-format plugin that proves the extensibility promise (SC-007).
 *
 * DOCTRINE (FR-014, the seam that makes "write a new ingester" a small task):
 * everything in this package is a PURE TRANSFORM — bytes in, NormalizedDocument
 * out. Nothing here may import @stacks/db, @stacks/core, @stacks/ingestion, or
 * any HTTP/model client; the only internal dependency is the contract package.
 * scripts/check-boundaries.mjs rule 4 fails the build otherwise. Parsing libs
 * (cheerio, sanitize-html) live here and ONLY here (rule 5).
 *
 * Fixtures under fixtures/ are synthetic look-alikes exercising DDB-shaped
 * structure without any proprietary text (constitution Principle I, FR-024).
 */
export { ddbSavedHtmlPlugin } from "./ddb/index";
