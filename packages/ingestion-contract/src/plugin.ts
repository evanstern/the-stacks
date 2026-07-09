/**
 * The ingestion plugin contract v1 (008 FR-013, contracts/plugin-contract.md)
 * — v2's `etl.contracts.v1` idea re-expressed in TypeScript, graduated from
 * the walking skeleton's placeholder. A plugin is a PURE TRANSFORM: bytes in,
 * NormalizedDocument out. What plugins never do — touch the database, embed,
 * index, call model providers — is not a convention here; it is enforced
 * structurally (this package is their only internal import; boundary rule 4).
 * That separation is what makes "write a new ingester" a small task (SC-007).
 */
import type { NormalizedDocument } from "./document";

// Bumped from "0.0.0-placeholder" when 008 landed the real schema. Consumers
// (and future out-of-tree plugins) assert the revision they compiled against.
export const INGESTION_CONTRACT_VERSION = "1.0.0";

/** First 64 KiB of the source — enough to recognize, cheap to read. */
export const DETECT_HEAD_BYTES = 64 * 1024;

export interface DetectInput {
  /** Sniffed at intake from magic bytes — never the client's declaration. */
  mediaType: string;
  /** Display hint only. NEVER identity: dedupe is by content hash (FR-003). */
  filename: string;
  head: Uint8Array;
}

export interface DetectResult {
  /** 0 = not mine … 1 = certainly mine. Registry order breaks ties. */
  confidence: number;
}

export interface TransformInput {
  mediaType: string;
  filename: string;
  /** The full archived source bytes. */
  bytes: Uint8Array;
}

/** Soft guidance to the PIPELINE-OWNED chunker (FR-019). Hints, never a
 * chunker: doc 05 forbids plugins owning chunking policy. */
export interface ChunkingHints {
  /** Section-index groups that read best kept in one chunk. */
  keepTogether?: number[][];
  /** Section indexes that are natural chunk-start boundaries. */
  preferBreakBefore?: number[];
}

export interface IngestionPlugin {
  /** Stable unique name, e.g. "ddb-saved-html". Stamped on every source it
   * produces together with version (FR-016) — the re-ingestion index. */
  readonly name: string;
  /** Plugin semver. Bumping it is what makes "which sources did the old
   * version produce?" answerable (US5). */
  readonly version: string;
  /** Media types this plugin will even look at (registry pre-filter). */
  readonly accepts: readonly string[];
  readonly chunkingHints?: ChunkingHints;

  /** Cheap, side-effect-free recognition. MUST NOT throw on garbage input —
   * garbage is exactly what detection exists to classify. */
  detect(input: DetectInput): DetectResult;

  /** Full extraction + transformation. Throws PluginError (with a declared
   * category) on content it cannot handle; anything else is a plugin bug. */
  transform(input: TransformInput): Promise<NormalizedDocument>;
}
