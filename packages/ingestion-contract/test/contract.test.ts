import { describe, expect, it } from "vitest";

import { INGESTION_CONTRACT_VERSION, type IngestionPlugin } from "../src/index";

describe("ingestion contract placeholder", () => {
  it("exposes a version constant", () => {
    expect(INGESTION_CONTRACT_VERSION).toBe("0.0.0-placeholder");
  });

  it("shapes a plugin with identify/parse (type-level check)", () => {
    const plugin: IngestionPlugin = {
      name: "noop",
      identify: (_source: unknown) => false,
      parse: async (_source: unknown) => "",
    };

    expect(plugin.identify({})).toBe(false);
  });
});
