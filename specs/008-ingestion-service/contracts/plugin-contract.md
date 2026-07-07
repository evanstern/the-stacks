# Contract: Ingestion Plugin (v1.0.0)

Replaces the `0.0.0-placeholder` seam in `@stacks/ingestion-contract` (FR-013). A plugin
is a pure transform: bytes in, `NormalizedDocument` out. What plugins **never** do —
touch the database, embed, index, call model providers — is enforced structurally:
`@stacks/ingestion-plugins` may import only this contract package plus its parsing
libraries (`scripts/check-boundaries.mjs`, research R13).

## Interface

```ts
export const INGESTION_CONTRACT_VERSION = "1.0.0";

interface IngestionPlugin {
  /** Stable unique name, e.g. "ddb-saved-html", "markdown", "generic-html". */
  readonly name: string;
  /** Plugin semver — stamped on every source it produces (FR-016). */
  readonly version: string;
  /** Media types this plugin will even look at (pre-filter for detect). */
  readonly accepts: readonly string[];   // e.g. ["text/html"]
  /** Optional soft guidance to the pipeline-owned chunker (FR-019). */
  readonly chunkingHints?: ChunkingHints;

  /** Cheap, side-effect-free recognition. MUST NOT throw on garbage input. */
  detect(input: DetectInput): DetectResult;

  /** Full extraction + transformation to the normalized document. */
  transform(input: TransformInput): Promise<NormalizedDocument>;
}

interface DetectInput {
  mediaType: string;                 // sniffed at intake, not client-declared
  filename: string;                  // display hint only — never identity
  head: Uint8Array;                  // first 64 KiB — enough to recognize, cheap to read
}

interface DetectResult {
  confidence: number;                // 0 = not mine … 1 = certainly mine
}

interface TransformInput {
  mediaType: string;
  filename: string;
  bytes: Uint8Array;                 // the full archived source
}

interface ChunkingHints {
  /** Section-index groups that read best kept in one chunk (soft constraint). */
  keepTogether?: number[][];
  /** Section indexes that are natural chunk-start boundaries (soft constraint). */
  preferBreakBefore?: number[];
}
```

## Failure vocabulary

`transform` reports failure by throwing `PluginError` (defined in the contract package,
NOT `@stacks/core` — plugins don't import core):

```ts
type PluginFailureCategory =
  | "unrecognized"     // detect was wrong / content isn't what it claimed to be
  | "malformed"        // recognized format, broken content (truncated, invalid markup)
  | "unsupported_variant"; // recognized family, variant we deliberately don't handle

class PluginError extends Error {
  readonly category: PluginFailureCategory;
}
```

The pipeline core maps categories onto the system's `DomainError` classes at the seam
(`unrecognized`/`malformed`/`unsupported_variant` → `unsupported_type` with the category
in event detail); anything else a plugin throws is `internal_fault` — a plugin bug.

## Registry & detection dispatch (pipeline-owned, FR-011/FR-012)

- Plugins register in-tree in a static ordered list (`@stacks/ingestion` `registry.ts`).
- Dispatch: filter by `accepts` on sniffed media type → call every candidate's
  `detect` → highest confidence wins; **ties break by registry order** (deterministic,
  spec edge case), and registry order places specific plugins before fallbacks.
- Fallback floor: `generic-html` and `markdown` return small non-zero confidence
  (0.1) for their media types so they catch what nothing specific claims; a source
  with all-zero confidence fails detection honestly (`unsupported_type`).
- The winning `(name, version, confidence)` is recorded on the source (FR-011) and in
  the `detect` stage event.

## Conformance suite (FR-015, SC-007/SC-010)

Exported as `@stacks/ingestion-contract/conformance`: a vitest suite factory any plugin
package invokes with a plugin instance + fixtures:

```ts
describeConformance({
  plugin,
  fixtures: {
    positive: [...],   // inputs it MUST claim (confidence >= 0.5) and transform validly
    negative: [...],   // inputs it MUST NOT claim (confidence < 0.5)
    malformed: [...],  // inputs where transform MUST throw PluginError, never crash
  },
});
```

What it asserts, for every plugin identically:

1. `name`/`version` are stable, non-empty; `version` parses as semver.
2. `detect` never throws, returns confidence in [0,1], and is pure (same input → same
   result; no I/O — verified by running under a no-network/no-fs guard).
3. `transform(positive)` output passes every NormalizedDocument invariant
   (contracts/normalized-document.md #1–7), including sanitization validation.
4. `transform` is deterministic: byte-identical input → deep-equal output (this is what
   makes re-ingestion and deterministic IDs meaningful, R9).
5. `transform(malformed)` throws `PluginError` with a declared category.
6. Fixtures contain no proprietary content — enforced socially by review plus a
   guard that fixtures live under the package's `fixtures/` dir (Principle I).

Shipped plugins (`ddb-saved-html`, `markdown`, `generic-html`) and the synthetic
demonstration plugin all run this suite in `pnpm verify` (SC-010); a future
archived-webpage/EPUB plugin imports and passes it unchanged (FR-028).
