/**
 * Self-test for the conformance suite (T008): a minimal in-file reference
 * plugin for a synthetic "TITLE / blank line / body" text format runs the
 * full suite. If the suite's own assertions are wrong, THIS file breaks —
 * before any real plugin inherits the mistake.
 */
import type {
  DetectInput,
  DetectResult,
  IngestionPlugin,
  NormalizedDocument,
  TransformInput,
} from "../index";
import { NORMALIZED_DOCUMENT_VERSION, PluginError } from "../index";
import { describeConformance } from "./index";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

// The simplest thing that can honor every contract obligation: first line is
// the title, rest is one prose section, artifact is escaped text in a <div>.
const referencePlugin: IngestionPlugin = {
  name: "reference-text",
  version: "1.0.0",
  accepts: ["text/plain"],

  detect(input: DetectInput): DetectResult {
    const text = decoder.decode(input.head);
    // "recognizes" the format: a first line in ALL CAPS followed by a blank line.
    return { confidence: /^[A-Z ]+\n\n/.test(text) ? 0.9 : 0 };
  },

  transform(input: TransformInput): Promise<NormalizedDocument> {
    const text = decoder.decode(input.bytes);
    const match = /^([A-Z ]+)\n\n([\s\S]+)$/.exec(text);
    if (!match) {
      throw new PluginError("malformed", "expected TITLE, blank line, body");
    }
    const [, title, body] = match;
    const escaped = body!.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return Promise.resolve({
      contractVersion: NORMALIZED_DOCUMENT_VERSION,
      title: title!.trim(),
      sections: [
        {
          index: 0,
          path: [title!.trim()],
          kind: "prose",
          content: body!.trim(),
          anchor: { artifactId: "a1", elementId: "s0", charStart: 0, charEnd: escaped.replace(/<[^>]*>/g, "").length },
        },
      ],
      artifacts: [{ id: "a1", kind: "html", content: `<div data-stacks-anchor="s0">${escaped}</div>` }],
      warnings: [],
    });
  },
};

describeConformance({
  plugin: referencePlugin,
  fixtures: {
    positive: [
      {
        name: "well-formed reference document",
        mediaType: "text/plain",
        filename: "sample.txt",
        bytes: encoder.encode("SAMPLE DOCUMENT\n\nA body of plain prose."),
      },
    ],
    negative: [
      {
        name: "lowercase first line is not the format",
        mediaType: "text/plain",
        filename: "not-it.txt",
        bytes: encoder.encode("just some notes\n\nnothing to see"),
      },
    ],
    malformed: [
      {
        name: "missing blank-line separator",
        mediaType: "text/plain",
        filename: "broken.txt",
        bytes: encoder.encode("BROKEN DOCUMENT no separator"),
      },
    ],
  },
});
