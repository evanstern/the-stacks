/**
 * Deterministic fixture embeddings (research R8) — the reason the per-PR
 * eval slice needs no model and no network. sha256(text) seeds a xorshift
 * stream expanded into a unit-normalized vector: stable across machines and
 * releases, geometrically meaningless on purpose. The CI floor guards the
 * ranking/fusion/metric MATH; semantic quality is the model-backed slices'
 * job.
 *
 * Fixture rows are stamped provider="fixture" — the engine's stamp check
 * (research R4) therefore makes it STRUCTURALLY impossible for a fixture
 * index to serve real queries or vice versa.
 */
import { createHash } from "node:crypto";

export const FIXTURE_EMBEDDING_STAMP = {
  provider: "fixture",
  model: "deterministic-v1",
  dimensions: 32,
} as const;

export function deterministicEmbedding(
  text: string,
  dimensions: number = FIXTURE_EMBEDDING_STAMP.dimensions,
): number[] {
  const seedBytes = createHash("sha256").update(text, "utf8").digest();
  // xorshift32 seeded from the hash's first 4 bytes; each draw mixes in the
  // next hash byte so the whole digest participates.
  let state = seedBytes.readUInt32BE(0) || 0x9e3779b9;
  const raw: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const mix = seedBytes[i % seedBytes.length]!;
    raw.push(((state + mix) % 2000) / 1000 - 1); // [-1, 1)
  }
  const norm = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0)) || 1;
  return raw.map((v) => v / norm);
}
