/**
 * markdown — the text/markdown + text/plain fallback (008 US4, FR-028). No
 * specific ingester claims prose-shaped Markdown or bare text, so this plugin
 * catches both at the fallback floor (contracts/plugin-contract.md's 0.1
 * rule): confident enough to win when nothing else claims a source, never
 * confident enough to outbid a real detector.
 *
 * Structure comes from ATX headings (`#`..`######`) only — the smallest rule
 * that gives real section paths without a markdown-parsing dependency: this
 * plugin does not render markdown syntax (bold/links/etc.), it only walks
 * heading lines to build a heading trail (mirrors ddb's §6 heading-stack
 * pattern, applied to a line-based document instead of a DOM).
 */
import sanitizeHtml from "sanitize-html";

import type {
  DetectInput,
  DetectResult,
  IngestionPlugin,
  NormalizedDocument,
  Section,
  TransformInput,
} from "@stacks/ingestion-contract";
import { NORMALIZED_DOCUMENT_VERSION, PluginError, artifactTextContent } from "@stacks/ingestion-contract";

const FALLBACK_CONFIDENCE = 0.1;
const ACCEPTS = ["text/markdown", "text/plain"];

const decoder = new TextDecoder("utf-8", { fatal: false });

function decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function slug(text: string): string {
  return normalizeText(text).toLowerCase().replace(/[^0-9a-z]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}

function headingId(text: string, taken: Set<string>): string {
  const base = slug(text);
  let id = base;
  let suffix = 1;
  while (taken.has(id)) {
    suffix += 1;
    id = `${base}-${suffix}`;
  }
  taken.add(id);
  return id;
}

interface Heading {
  level: number;
  text: string;
  bodyLines: string[];
}

const ATX_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/** Splits the document into a leading (headingless) body plus ATX headings
 * with their following body lines, up to the next heading of any level. */
function splitIntoHeadings(text: string): { leading: string; headings: Heading[] } {
  const lines = text.split(/\r?\n/);
  const leadingLines: string[] = [];
  const headings: Heading[] = [];
  let current: Heading | null = null;

  for (const line of lines) {
    const match = ATX_HEADING.exec(line);
    if (match) {
      current = { level: match[1]!.length, text: normalizeText(match[2]!), bodyLines: [] };
      headings.push(current);
    } else if (current) {
      current.bodyLines.push(line);
    } else {
      leadingLines.push(line);
    }
  }

  return { leading: leadingLines.join("\n"), headings };
}

function toArtifact(id: string, content: string, title?: string) {
  const html = sanitizeHtml(
    content
      .split(/\n{2,}/)
      .map((paragraph) => `<p data-stacks-anchor="${id}">${sanitizeHtml(paragraph.trim())}</p>`)
      .join(""),
    { allowedTags: ["p"], allowedAttributes: { p: ["data-stacks-anchor"] } },
  );
  // `title` must be OMITTED, never `undefined` — JSON.stringify drops absent
  // keys but keeps `undefined`-valued ones out of the wire shape differently
  // from how they compare in-memory, which trips the JSON-round-trip purity
  // check (NormalizedDocument invariant 7).
  return title === undefined
    ? { id, kind: "html" as const, content: html }
    : { id, kind: "html" as const, content: html, title };
}

export const markdownPlugin: IngestionPlugin = {
  name: "markdown",
  version: "1.0.0",
  accepts: ACCEPTS,

  detect(input: DetectInput): DetectResult {
    if (!ACCEPTS.includes(input.mediaType)) return { confidence: 0 };
    return { confidence: FALLBACK_CONFIDENCE };
  },

  transform(input: TransformInput): Promise<NormalizedDocument> {
    const text = decode(input.bytes);
    if (!normalizeText(text)) {
      throw new PluginError("malformed", "Document is blank or whitespace-only.");
    }

    const { leading, headings } = splitIntoHeadings(text);
    const taken = new Set<string>();
    const sections: Section[] = [];
    const artifacts: NormalizedDocument["artifacts"] = [];

    const leadingText = normalizeText(leading);
    if (leadingText) {
      const id = headingId("intro", taken);
      const artifact = toArtifact(id, leadingText);
      artifacts.push(artifact);
      sections.push({
        index: sections.length,
        path: [],
        kind: "prose",
        content: leadingText,
        anchor: { artifactId: id, elementId: id, charStart: 0, charEnd: artifactTextContent(artifact).length },
      });
    }

    const stack: Array<{ level: number; text: string }> = [];
    for (const heading of headings) {
      while (stack.length > 0 && stack[stack.length - 1]!.level >= heading.level) stack.pop();
      const bodyText = normalizeText(heading.bodyLines.join("\n"));
      const path = [...stack.map((item) => item.text), heading.text];
      stack.push({ level: heading.level, text: heading.text });

      if (!bodyText) continue; // heading with no body: keep the trail, emit no section (mirrors ddb §6)

      const id = headingId(heading.text, taken);
      const artifact = toArtifact(id, bodyText, heading.text);
      artifacts.push(artifact);
      sections.push({
        index: sections.length,
        path,
        kind: "prose",
        heading: heading.text,
        content: bodyText,
        anchor: { artifactId: id, elementId: id, charStart: 0, charEnd: artifactTextContent(artifact).length },
      });
    }

    if (sections.length === 0) {
      throw new PluginError("malformed", "Document had no extractable text after heading parsing.");
    }

    const title = headings.find((h) => h.level === 1)?.text ?? (leadingText.slice(0, 80) || "Untitled document");

    return Promise.resolve({
      contractVersion: NORMALIZED_DOCUMENT_VERSION,
      title,
      sections,
      artifacts,
      warnings: [],
    });
  },
};
