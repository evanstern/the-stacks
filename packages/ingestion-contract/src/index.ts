/**
 * @stacks/ingestion-contract — the seam between the pipeline core
 * (@stacks/ingestion) and the ingesters (@stacks/ingestion-plugins). Owns the
 * three things both sides must agree on and nothing else:
 *   - the NormalizedDocument shape + validator (the pivotal contract, FR-018),
 *   - the IngestionPlugin interface + failure vocabulary (FR-013),
 *   - the conformance suite every plugin must pass (FR-015), exported from
 *     "./conformance" so a future out-of-tree plugin can import and run it
 *     unchanged.
 * This package imports NO internal package — it is what plugins are allowed
 * to depend on, so it must sit below everything (boundary rule 4).
 *
 * History: was a placeholder ("0.0.0-placeholder", identify/parse) from the
 * 007 walking skeleton; 008 graduated it to the real schema, exactly as the
 * placeholder's own comment promised.
 */
export * from "./document";
export * from "./errors";
export * from "./plugin";
