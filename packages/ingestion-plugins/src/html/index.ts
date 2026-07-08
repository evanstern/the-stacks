/**
 * generic-html — the text/html fallback (008 US4, FR-028). Catches HTML that
 * ddb-saved-html does not claim: a generic heading/section walk with no DDB
 * signal-hunting, floored at the same 0.1 fallback confidence
 * (contracts/plugin-contract.md) as the markdown plugin. It never tries to
 * outrank ddb-saved-html — it doesn't even look for DDB's signals — so on a
 * real DDB page the registry's highest-confidence rule always prefers ddb's
 * 0.85+ over this floor (US4 AC-2/3).
 */
import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import sanitizeHtml from "sanitize-html";

import type {
  DetectInput,
  DetectResult,
  IngestionPlugin,
  NormalizedDocument,
  Section,
  SectionKind,
  TransformInput,
} from "@stacks/ingestion-contract";
import { NORMALIZED_DOCUMENT_VERSION, PluginError, artifactTextContent } from "@stacks/ingestion-contract";

const FALLBACK_CONFIDENCE = 0.1;
const ACCEPTS = ["text/html"];

const BOILERPLATE_SELECTOR = ["script", "style", "template", "nav", "header", "footer", "aside"].join(", ");

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "article", "section", "div", "span",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "ul", "ol", "li", "blockquote",
    "strong", "em", "b", "i", "u", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td",
    "a", "br",
  ],
  allowedAttributes: {
    "*": ["id", "class", "title", "data-stacks-anchor"],
    a: ["href", "id", "class", "title"],
  },
  allowedSchemes: ["http", "https"],
};

const decoder = new TextDecoder("utf-8", { fatal: false });
const decode = (bytes: Uint8Array): string => decoder.decode(bytes);
const normalizeText = (text: string): string => text.replace(/\s+/g, " ").trim();

function slug(text: string): string {
  return normalizeText(text).toLowerCase().replace(/[^0-9a-z]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}

function headingId(text: string, domId: string | undefined, taken: Set<string>): string {
  const candidate = (domId ?? "").trim();
  if (candidate && !taken.has(slug(candidate))) {
    taken.add(slug(candidate));
    return candidate;
  }
  const base = slug(candidate || text);
  let id = base;
  let suffix = 1;
  while (taken.has(slug(id))) {
    suffix += 1;
    id = `${base}-${suffix}`;
  }
  taken.add(slug(id));
  return id;
}

function headingLevel(name: string | undefined): number | null {
  if (!name) return null;
  const match = /^h([1-6])$/i.exec(name);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

function documentRoot($: CheerioAPI): Cheerio<AnyNode> | null {
  for (const selector of ["article", "main", "body"]) {
    const root = $(selector).first();
    if (root.length > 0 && normalizeText(root.text())) return root;
  }
  return null;
}

/** No DDB-specific classification here — just a structural density check,
 * same shape as ddb's but without stat-block/spell-entry recognition (this
 * plugin has no reason to know those selectors; unclassified is the honest
 * default the contract asks for). */
function classify(fragmentHtml: string, sectionText: string): SectionKind {
  const $ = cheerio.load(fragmentHtml);
  const tableText = normalizeText($("table").text());
  if (tableText && tableText.length >= sectionText.length / 2) return "table";
  return "prose";
}

function documentTitle($: CheerioAPI, root: Cheerio<AnyNode>): string {
  const h1 = normalizeText(root.find("h1").first().text());
  if (h1) return h1;
  const og = $("meta[property='og:title']").attr("content");
  if (og && normalizeText(og)) return normalizeText(og);
  return normalizeText($("title").first().text()) || "Untitled document";
}

export const genericHtmlPlugin: IngestionPlugin = {
  name: "generic-html",
  version: "1.0.0",
  accepts: ACCEPTS,

  detect(input: DetectInput): DetectResult {
    if (!ACCEPTS.includes(input.mediaType)) return { confidence: 0 };
    try {
      const $ = cheerio.load(decoder.decode(input.head));
      return documentRoot($) ? { confidence: FALLBACK_CONFIDENCE } : { confidence: 0 };
    } catch {
      return { confidence: 0 };
    }
  },

  transform(input: TransformInput): Promise<NormalizedDocument> {
    const html = decode(input.bytes);
    const $ = cheerio.load(html);
    const root = documentRoot($);
    if (!root) {
      throw new PluginError("malformed", "HTML has no extractable article/main/body content.");
    }

    root.find(BOILERPLATE_SELECTOR).remove();
    const title = documentTitle($, root);

    const headings = root.find("h1, h2, h3, h4, h5, h6").toArray();
    const taken = new Set<string>();
    const stack: Array<{ level: number; text: string }> = [];
    const sections: Section[] = [];
    const artifacts: NormalizedDocument["artifacts"] = [];

    for (const element of headings) {
      const level = headingLevel(element.tagName);
      if (level === null) continue;
      const headingEl = $(element);
      const text = normalizeText(headingEl.text());
      if (!text) continue;

      while (stack.length > 0 && stack[stack.length - 1]!.level >= level) stack.pop();
      const id = headingId(text, headingEl.attr("id"), taken);

      const bodyNodes: AnyNode[] = [];
      let sibling = element.nextSibling;
      while (sibling) {
        if (sibling.type === "tag" && headingLevel((sibling as { tagName?: string }).tagName) !== null) break;
        bodyNodes.push(sibling);
        sibling = sibling.nextSibling;
      }
      const bodyText = normalizeText(bodyNodes.map((node) => $(node).text()).join(" "));
      const path = [...stack.map((item) => item.text), text];
      stack.push({ level, text });
      if (!bodyText) continue;

      headingEl.attr("data-stacks-anchor", id);
      const fragmentHtml = sanitizeHtml(
        $.html(headingEl) + bodyNodes.map((node) => $.html(node)).join(""),
        SANITIZE_OPTIONS,
      ).trim();

      const artifact = { id, kind: "html" as const, content: fragmentHtml };
      artifacts.push(artifact);
      sections.push({
        index: sections.length,
        path,
        kind: classify(fragmentHtml, bodyText),
        heading: text,
        content: bodyText,
        anchor: { artifactId: id, elementId: id, charStart: 0, charEnd: artifactTextContent(artifact).length },
      });
    }

    if (sections.length === 0) {
      throw new PluginError("malformed", "HTML root had no heading-delimited extractable text.");
    }

    return Promise.resolve({
      contractVersion: NORMALIZED_DOCUMENT_VERSION,
      title,
      sections,
      artifacts,
      warnings: [],
    });
  },
};
