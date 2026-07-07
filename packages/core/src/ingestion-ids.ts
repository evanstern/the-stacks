/**
 * Deterministic ingestion identities (008 research R9, FR-008/FR-021) — the
 * same doctrine as deriveVectorId (skeleton-check.ts): identity derived from
 * content + position + provenance, so any replay is a no-op at the write site
 * (ON CONFLICT DO NOTHING) instead of a duplicate row.
 *
 * The design separates the two "run it again" semantics the spec
 * distinguishes:
 *   - RETRY of the same job reuses the same target generation → same ids →
 *     idempotent (SC-004).
 *   - RE-INGEST is a new job at generation N+1 → new ids → build aside, flip
 *     sources.current_generation, sweep the old rows (FR-023, R8).
 * Plugin identity is in the material so a plugin-version change can never
 * silently collide with the old version's rows (FR-016).
 *
 * The material formats below are DATA CONTRACTS — altering one orphans every
 * existing row id, exactly like deriveVectorId's warning says.
 */
import { createHash } from "node:crypto";

function sha256(material: string): string {
  return createHash("sha256").update(material).digest("hex");
}

/** sha256 of raw archive bytes — the content address that IS the archive PK
 * and the source fingerprint (FR-003 dedupe is a primary-key lookup). */
export function deriveArchiveFingerprint(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface DeriveSectionIdInput {
  sourceFingerprint: string;
  pluginName: string;
  pluginVersion: string;
  generation: number;
  sectionIndex: number;
}

export function deriveSectionId(input: DeriveSectionIdInput): string {
  const material = `${input.sourceFingerprint}:${input.pluginName}@${input.pluginVersion}:${input.generation}:${input.sectionIndex}`;
  return sha256(material);
}

export interface DeriveChunkIdInput {
  corpusId: string;
  sourceFingerprint: string;
  pluginName: string;
  pluginVersion: string;
  generation: number;
  chunkIndex: number;
  /** Chunk content is hashed (not embedded raw) so the material stays
   * fixed-size and unambiguous regardless of content bytes. */
  content: string;
}

export function deriveChunkId(input: DeriveChunkIdInput): string {
  const material = `${input.corpusId}:${input.sourceFingerprint}:${input.pluginName}@${input.pluginVersion}:${input.generation}:${input.chunkIndex}:${sha256(input.content)}`;
  return sha256(material);
}
