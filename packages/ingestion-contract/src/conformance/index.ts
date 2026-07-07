/**
 * The plugin CONFORMANCE SUITE (008 FR-015, contracts/plugin-contract.md) —
 * the mechanism behind two promises: SC-007 ("a new ingester is plugin code +
 * fixtures + registration, zero pipeline-core change") and FR-028's deferred
 * ingesters (archived-webpage/EPUB later import THIS suite unchanged).
 *
 * Every shipped plugin invokes `describeConformance()` in its own test file;
 * `pnpm verify` therefore holds all plugins to identical obligations (SC-010).
 * It lives in the contract package — not the plugins package — so a future
 * out-of-tree plugin can run it without forking anything.
 *
 * Imports `vitest` at module top level: this file is only ever loaded inside
 * a vitest run (a *.test.ts importing it), so the dev-dependency is always
 * present where it executes.
 */
import { describe, expect, it } from "vitest";

import { validateNormalizedDocument } from "../document";
import { PLUGIN_FAILURE_CATEGORIES, PluginError } from "../errors";
import type { IngestionPlugin, TransformInput } from "../plugin";
import { DETECT_HEAD_BYTES } from "../plugin";

export interface ConformanceFixture {
  /** Test-name label, e.g. "goblin stat-block page". */
  name: string;
  mediaType: string;
  filename: string;
  bytes: Uint8Array;
  /**
   * Positive fixtures only: minimum detect confidence. Defaults to 0.5 (the
   * contract's MUST-claim bar). Fallback plugins whose honest confidence on a
   * catch-all fixture is the 0.1 floor set this explicitly — an EXPLICIT
   * deviation, visible in the plugin's own test file, not a silent loophole.
   */
  minConfidence?: number;
}

export interface ConformanceInput {
  plugin: IngestionPlugin;
  fixtures: {
    /** Inputs the plugin MUST claim and transform validly. At least one. */
    positive: ConformanceFixture[];
    /** Inputs the plugin MUST NOT claim (confidence < 0.5). */
    negative: ConformanceFixture[];
    /** Inputs where transform MUST throw PluginError — never crash. At least one. */
    malformed: ConformanceFixture[];
  };
}

function toDetectInput(fixture: ConformanceFixture) {
  return {
    mediaType: fixture.mediaType,
    filename: fixture.filename,
    head: fixture.bytes.slice(0, DETECT_HEAD_BYTES),
  };
}

function toTransformInput(fixture: ConformanceFixture): TransformInput {
  return { mediaType: fixture.mediaType, filename: fixture.filename, bytes: fixture.bytes };
}

/**
 * Runs a plugin under a network guard: detect/transform are pure transforms
 * (FR-014); a plugin fetching anything mid-transform would smuggle in exactly
 * the hidden dependency the seam forbids. (Filesystem access is kept out by
 * review + the boundary rules; a runtime fs guard would require module
 * mocking that costs more than it catches.)
 */
async function withNetworkGuard<T>(fn: () => T | Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("conformance: plugins must not perform network I/O (FR-014)");
  }) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
}

const SEMVER = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

/** Garbage inputs every plugin's detect() must survive without throwing. */
const GARBAGE_HEADS: ReadonlyArray<{ name: string; head: Uint8Array }> = [
  { name: "empty", head: new Uint8Array(0) },
  { name: "binary noise", head: new Uint8Array([0x00, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47, 0x1a]) },
  { name: "lone angle brackets", head: new TextEncoder().encode("<<<>>><<") },
];

export function describeConformance({ plugin, fixtures }: ConformanceInput): void {
  describe(`plugin conformance: ${plugin.name}@${plugin.version}`, () => {
    it("declares a stable identity (assertion 1)", () => {
      expect(plugin.name.trim().length).toBeGreaterThan(0);
      expect(plugin.version).toMatch(SEMVER);
      expect(plugin.accepts.length).toBeGreaterThan(0);
      expect(fixtures.positive.length).toBeGreaterThan(0);
      expect(fixtures.malformed.length).toBeGreaterThan(0);
    });

    it("detect never throws on garbage and stays in [0,1] (assertion 2)", async () => {
      await withNetworkGuard(() => {
        for (const garbage of GARBAGE_HEADS) {
          for (const mediaType of plugin.accepts) {
            const result = plugin.detect({ mediaType, filename: "garbage.bin", head: garbage.head });
            expect(result.confidence, `garbage: ${garbage.name}`).toBeGreaterThanOrEqual(0);
            expect(result.confidence, `garbage: ${garbage.name}`).toBeLessThanOrEqual(1);
          }
        }
      });
    });

    it("detect is deterministic — same input, same confidence (assertion 2)", async () => {
      await withNetworkGuard(() => {
        for (const fixture of [...fixtures.positive, ...fixtures.negative]) {
          const a = plugin.detect(toDetectInput(fixture));
          const b = plugin.detect(toDetectInput(fixture));
          expect(a.confidence, fixture.name).toBe(b.confidence);
        }
      });
    });

    for (const fixture of fixtures.positive) {
      const bar = fixture.minConfidence ?? 0.5;
      it(`claims and validly transforms: ${fixture.name} (assertions 2–3)`, async () => {
        await withNetworkGuard(async () => {
          expect(plugin.detect(toDetectInput(fixture)).confidence).toBeGreaterThanOrEqual(bar);
          const doc = await plugin.transform(toTransformInput(fixture));
          // The document invariants (contracts/normalized-document.md 1–7) —
          // reported all at once so a failing plugin author sees the full list.
          expect(validateNormalizedDocument(doc)).toEqual([]);
        });
      });

      it(`transform is deterministic: ${fixture.name} (assertion 4)`, async () => {
        // Byte-identical input => deep-equal output. This is what makes
        // deterministic chunk ids (R9) and re-ingestion (FR-023) meaningful.
        await withNetworkGuard(async () => {
          const a = await plugin.transform(toTransformInput(fixture));
          const b = await plugin.transform(toTransformInput(fixture));
          expect(a).toEqual(b);
        });
      });
    }

    for (const fixture of fixtures.negative) {
      it(`does not claim: ${fixture.name} (assertion 2)`, async () => {
        await withNetworkGuard(() => {
          expect(plugin.detect(toDetectInput(fixture)).confidence).toBeLessThan(0.5);
        });
      });
    }

    for (const fixture of fixtures.malformed) {
      it(`throws PluginError on malformed input: ${fixture.name} (assertion 5)`, async () => {
        await withNetworkGuard(async () => {
          // Promise.resolve().then(...) normalizes SYNCHRONOUS throws into
          // rejections — the contract lets transform() throw either way, and
          // the pipeline's stage driver does the same normalization.
          const attempt = Promise.resolve().then(() => plugin.transform(toTransformInput(fixture)));
          await expect(attempt).rejects.toBeInstanceOf(PluginError);
          const error: unknown = await attempt.then(
            () => undefined,
            (e: unknown) => e,
          );
          expect(PLUGIN_FAILURE_CATEGORIES).toContain((error as PluginError).category);
        });
      });
    }
  });
}
