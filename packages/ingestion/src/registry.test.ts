/**
 * T017 (TDD): registry + detection dispatch (FR-011/FR-012) — highest
 * confidence wins, ties break by registration order (deterministic), the
 * decision is recorded with every candidate's confidence, and an
 * all-zero field fails detection honestly.
 */
import type { IngestionPlugin } from "@stacks/ingestion-contract";
import { NORMALIZED_DOCUMENT_VERSION } from "@stacks/ingestion-contract";
import { describe, expect, it } from "vitest";

import { createRegistry } from "./registry";

function plugin(name: string, accepts: string[], confidence: number): IngestionPlugin {
  return {
    name,
    version: "1.0.0",
    accepts,
    detect: () => ({ confidence }),
    transform: () =>
      Promise.resolve({
        contractVersion: NORMALIZED_DOCUMENT_VERSION,
        title: name,
        sections: [],
        artifacts: [],
        warnings: [],
      }),
  };
}

const INPUT = { mediaType: "text/html", filename: "x.html", head: new Uint8Array() };

describe("createRegistry / detect dispatch (FR-011)", () => {
  it("picks the highest-confidence plugin among those accepting the media type", () => {
    const registry = createRegistry([
      plugin("specific", ["text/html"], 0.9),
      plugin("fallback", ["text/html"], 0.1),
    ]);

    const decision = registry.detect(INPUT);
    expect(decision?.plugin.name).toBe("specific");
    expect(decision?.confidence).toBe(0.9);
  });

  it("breaks confidence ties by registration order — specific plugins register first", () => {
    const registry = createRegistry([
      plugin("first", ["text/html"], 0.5),
      plugin("second", ["text/html"], 0.5),
    ]);

    expect(registry.detect(INPUT)?.plugin.name).toBe("first");
  });

  it("skips plugins whose accepts list excludes the media type", () => {
    const registry = createRegistry([
      plugin("markdown-only", ["text/markdown"], 1),
      plugin("html", ["text/html"], 0.3),
    ]);

    const decision = registry.detect(INPUT);
    expect(decision?.plugin.name).toBe("html");
    // The candidates map records only plugins that were actually consulted.
    expect(decision?.candidates).toEqual({ html: 0.3 });
  });

  it("returns null when every consulted plugin says zero — honest detection failure (FR-012)", () => {
    const registry = createRegistry([plugin("html", ["text/html"], 0)]);
    expect(registry.detect(INPUT)).toBeNull();
  });

  it("returns null when nothing accepts the media type at all", () => {
    const registry = createRegistry([plugin("html", ["text/html"], 1)]);
    expect(registry.detect({ ...INPUT, mediaType: "application/pdf" })).toBeNull();
  });

  it("records every consulted candidate's confidence for the detect event (contracts/events.md)", () => {
    const registry = createRegistry([
      plugin("a", ["text/html"], 0.7),
      plugin("b", ["text/html"], 0.2),
    ]);

    expect(registry.detect(INPUT)?.candidates).toEqual({ a: 0.7, b: 0.2 });
  });

  it("a plugin whose detect throws is treated as zero, not a pipeline crash", () => {
    const bad: IngestionPlugin = {
      ...plugin("bad", ["text/html"], 0),
      detect: () => {
        throw new Error("plugin bug");
      },
    };
    const registry = createRegistry([bad, plugin("good", ["text/html"], 0.4)]);

    const decision = registry.detect(INPUT);
    expect(decision?.plugin.name).toBe("good");
    expect(decision?.candidates).toEqual({ bad: 0, good: 0.4 });
  });

  it("exposes plugins by name for the driver's transform stage", () => {
    const registry = createRegistry([plugin("a", ["text/html"], 1)]);
    expect(registry.byName("a")?.name).toBe("a");
    expect(registry.byName("ghost")).toBeUndefined();
  });
});
