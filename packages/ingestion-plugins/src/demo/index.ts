/**
 * demo-format — a synthetic third format that exists ONLY to prove US5's
 * extensibility promise (SC-007): a new ingester is plugin code + fixtures +
 * registration, with zero changes to pipeline-core. This plugin is
 * deliberately test-only — it is NEVER added to
 * packages/ingestion/src/shipped.ts, so a reviewer diffing the commit that
 * introduced it sees only files under packages/ingestion-plugins/.
 *
 * The "format" itself is intentionally trivial: `@@ Heading` lines start a
 * section, everything until the next marker (or EOF) is its body. There is
 * nothing to port or research — the format exists to be recognizable, not
 * useful.
 */
import type {
  DetectInput,
  DetectResult,
  IngestionPlugin,
  NormalizedDocument,
  Section,
  TransformInput,
} from "@stacks/ingestion-contract";
import { NORMALIZED_DOCUMENT_VERSION, PluginError, artifactTextContent } from "@stacks/ingestion-contract";

const ACCEPTS = ["application/x-stacks-demo"];
const MARKER = /^@@\s+(.+)$/m;

const decoder = new TextDecoder("utf-8", { fatal: false });
const decode = (bytes: Uint8Array): string => decoder.decode(bytes);
const normalizeText = (text: string): string => text.replace(/\s+/g, " ").trim();

interface DemoSection {
  heading: string;
  bodyLines: string[];
}

function parseSections(text: string): DemoSection[] {
  const sections: DemoSection[] = [];
  let current: DemoSection | null = null;
  for (const line of text.split(/\r?\n/)) {
    const match = MARKER.exec(line);
    if (match) {
      current = { heading: normalizeText(match[1]!), bodyLines: [] };
      sections.push(current);
    } else if (current) {
      current.bodyLines.push(line);
    }
  }
  return sections;
}

export const demoFormatPlugin: IngestionPlugin = {
  name: "demo-format",
  version: "1.0.0",
  accepts: ACCEPTS,

  detect(input: DetectInput): DetectResult {
    if (!ACCEPTS.includes(input.mediaType)) return { confidence: 0 };
    const hasMarker = MARKER.test(decode(input.head));
    return { confidence: hasMarker ? 0.9 : 0 };
  },

  transform(input: TransformInput): Promise<NormalizedDocument> {
    const text = decode(input.bytes);
    const parsed = parseSections(text);
    if (parsed.length === 0) {
      throw new PluginError("malformed", "demo-format document has no @@ section markers.");
    }

    const sections: Section[] = [];
    const artifacts: NormalizedDocument["artifacts"] = [];
    for (const parsedSection of parsed) {
      const bodyText = normalizeText(parsedSection.bodyLines.join("\n"));
      if (!bodyText) continue; // heading with no body: honest omission (contract invariant 2)

      const id = `s${sections.length}`;
      artifacts.push({ id, kind: "html", content: `<p data-stacks-anchor="${id}">${bodyText}</p>` });
      sections.push({
        index: sections.length,
        path: [parsedSection.heading],
        kind: "unclassified",
        heading: parsedSection.heading,
        content: bodyText,
        anchor: { artifactId: id, elementId: id, charStart: 0, charEnd: artifactTextContent(artifacts[artifacts.length - 1]!).length },
      });
    }

    if (sections.length === 0) {
      throw new PluginError("malformed", "demo-format document had markers but no section bodies.");
    }

    return Promise.resolve({
      contractVersion: NORMALIZED_DOCUMENT_VERSION,
      title: parsed[0]!.heading,
      sections,
      artifacts,
      warnings: [],
    });
  },
};
