/**
 * T050 (US5, SC-007): the demo-format plugin — a synthetic third format
 * proving the extensibility promise. It passes the SAME conformance suite as
 * every shipped plugin, and — the actual proof — is deliberately test-only:
 * it is never registered in packages/ingestion/src/shipped.ts. Adding a
 * plugin for `application/x-stacks-demo` requires zero changes to
 * packages/ingestion/src (pipeline core), which is exactly what a reviewer
 * diffing this commit can confirm (SC-007's reviewability claim).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describeConformance } from "@stacks/ingestion-contract/conformance";
import { describe, expect, it } from "vitest";

import { demoFormatPlugin } from "./index";

const FIXTURES = join(__dirname, "..", "..", "fixtures", "demo");
const fixture = (rel: string) => new Uint8Array(readFileSync(join(FIXTURES, rel)));

const SAMPLE = fixture("sample.demo");
const MALFORMED = fixture("malformed.demo");

describeConformance({
  plugin: demoFormatPlugin,
  fixtures: {
    positive: [
      { name: "well-formed demo document", mediaType: "application/x-stacks-demo", filename: "sample.demo", bytes: SAMPLE },
    ],
    negative: [
      { name: "an HTML file (wrong media type)", mediaType: "text/html", filename: "x.html", bytes: SAMPLE },
    ],
    malformed: [
      { name: "no @@ section markers", mediaType: "application/x-stacks-demo", filename: "malformed.demo", bytes: MALFORMED },
    ],
  },
});

describe("demo-format specifics (SC-007)", () => {
  it("splits on @@ markers into ordered sections", async () => {
    const doc = await demoFormatPlugin.transform({
      mediaType: "application/x-stacks-demo",
      filename: "sample.demo",
      bytes: SAMPLE,
    });
    expect(doc.sections.map((s) => s.heading)).toEqual(["Gadget Overview", "Specifications", "Known Issues"]);
    expect(doc.sections.every((s, i) => s.index === i)).toBe(true);
  });

  it("is registered only for its own synthetic media type", () => {
    expect(demoFormatPlugin.accepts).toEqual(["application/x-stacks-demo"]);
  });
});
