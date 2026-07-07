import { describe, expect, it } from "vitest";

import {
  INGESTION_CONTRACT_VERSION,
  NORMALIZED_DOCUMENT_VERSION,
  type IngestionPlugin,
} from "../src/index";

// 008 graduated the 007 placeholder ("0.0.0-placeholder", identify/parse) to
// the real contract. These pins exist so a version bump is always a DELIBERATE
// edit here too — the constants are data contracts (sources record them).
describe("ingestion contract v1", () => {
  it("exposes the graduated contract version", () => {
    expect(INGESTION_CONTRACT_VERSION).toBe("1.0.0");
  });

  it("exposes the normalized-document version", () => {
    expect(NORMALIZED_DOCUMENT_VERSION).toBe("1.0.0");
  });

  it("shapes a plugin with detect/transform (type-level check)", () => {
    const plugin: IngestionPlugin = {
      name: "noop",
      version: "1.0.0",
      accepts: ["text/plain"],
      detect: () => ({ confidence: 0 }),
      transform: () =>
        Promise.resolve({
          contractVersion: NORMALIZED_DOCUMENT_VERSION,
          title: "empty",
          sections: [],
          artifacts: [],
          warnings: [],
        }),
    };

    expect(plugin.detect({ mediaType: "text/plain", filename: "x", head: new Uint8Array() }).confidence).toBe(0);
  });
});
