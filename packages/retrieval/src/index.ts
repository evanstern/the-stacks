/**
 * @stacks/retrieval — the query-side engine (spec 010): hybrid search over
 * 008's chunks (FTS + vector under the reader predicate), fusion, optional
 * sidecar reranking, append-only run receipts, and the evaluation harness
 * that justifies every tuning choice (D11). Mirrors @stacks/ingestion's
 * station: owns everything DB/queue/model-facing on the READ side; pure
 * cores (config, fusion, metrics) stay dependency-free; HTTP mapping stays
 * in apps/api (DomainErrors cross this boundary untranslated).
 */
export * from "./config";
export * from "./fusion";
