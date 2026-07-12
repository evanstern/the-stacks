/**
 * ddb-saved-html — the flagship ingester (008 US1, FR-028), carrying v2's
 * most valuable domain code forward as DATA-DRIVEN RULES. Every selector,
 * marker, and allowlist below is the deliberate port documented in
 * specs/008-ingestion-service/ddb-rules.md (§ references throughout); diff
 * that file against v2's ddb_import.py to review the port.
 *
 * Like every plugin: pure transform. Bytes in, NormalizedDocument out.
 * No DB, no network, no fs (FR-014; boundary rule 4 enforces the imports).
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

// ---------------------------------------------------------------------------
// Ported rule tables (ddb-rules.md §1–§4) — data, not logic, on purpose.
// ---------------------------------------------------------------------------

const DDB_HOST_MARKERS = ["dndbeyond.com", "www.dndbeyond.com"];

// §1: browsers stamp this comment on "Save Page As"; checked in the first 20k.
const SAVED_FROM_PATTERN =
  /saved\s+from(?:\s+url=\(\d+\))?\s*(https?:\/\/(?:www\.)?dndbeyond\.com\/\S+)/i;

const IDENTITY_SELECTORS = [
  "link[rel='canonical']",
  "meta[property='og:url']",
  "meta[name='twitter:url']",
];

// §2: priority order matters — first match with non-empty text wins.
const ARTICLE_SELECTORS = [
  "div.p-article-content.u-typography-format",
  "div#p-article-content.u-typography-format",
  "article",
  "main article",
  "main .ddb-statblock",
  "main .mon-stat-block",
  "main .compendium-content",
  "main .more-info-content",
  "main .primary-content",
  "main",
];

// §3: decomposed before sanitizing (removing beats escaping for chrome).
const BOILERPLATE_SELECTOR = [
  "script",
  "style",
  "template",
  "iframe",
  "object",
  "embed",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "button",
  "svg",
  "[role='navigation']",
  "[aria-hidden='true']",
  ".site-bar",
  ".site-footer",
  ".site-header",
  ".ddb-campaigns-character-card-footer",
].join(", ");

// §4: v2's bleach allowlist, plus v3's own anchor stamp attribute.
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
    "*": ["id", "class", "title", "data-content-chunk-id", "data-citation-id", "data-stacks-anchor"],
    a: ["href", "id", "class", "title"],
  },
  allowedSchemes: ["http", "https"],
};

// §7: v3's kind classification — NEW over v2, built from v2's selectors.
const STAT_BLOCK_SELECTOR = ".mon-stat-block, .ddb-statblock";
const SPELL_LABELS = ["Casting Time", "Range", "Components", "Duration", "Level"];

// §5: generic <title> suffixes that are never the book title.
const GENERIC_TITLE_SUFFIXES = new Set([
  "ddb",
  "d&d beyond",
  "dungeons & dragons beyond",
  "dungeons and dragons beyond",
  "dungeons & dragons",
  "dungeons and dragons",
  "sources",
]);

// ---------------------------------------------------------------------------
// Detection (§1)
// ---------------------------------------------------------------------------

const decoder = new TextDecoder("utf-8", { fatal: false });

function decode(bytes: Uint8Array): string {
  // v2 decoded utf-8-sig; TextDecoder handles the BOM the same way.
  return decoder.decode(bytes);
}

function savedFromUrl(text: string): string | null {
  const match = SAVED_FROM_PATTERN.exec(text.slice(0, 20_000));
  return match ? match[1]!.replace(/["'<>]+$/, "") : null;
}

function identityUrl($: CheerioAPI): string | null {
  for (const selector of IDENTITY_SELECTORS) {
    const tag = $(selector).first();
    if (tag.length === 0) continue;
    const value = (tag.attr("href") ?? tag.attr("content") ?? "").trim();
    if (!DDB_HOST_MARKERS.some((marker) => value.toLowerCase().includes(marker))) continue;
    try {
      const path = new URL(value).pathname.toLowerCase();
      if (path && path !== "/" && !path.startsWith("/forums")) return value;
    } catch {
      continue;
    }
  }
  return null;
}

function selectArticle($: CheerioAPI): Cheerio<AnyNode> | null {
  for (const selector of ARTICLE_SELECTORS) {
    const article = $(selector).first();
    if (article.length > 0 && normalizeText(article.text())) return article;
  }
  return null;
}

function detectSignals(html: string): { article: boolean; url: string | null; chunkMarkers: boolean } {
  const $ = cheerio.load(html);
  const article = selectArticle($);
  return {
    article: article !== null,
    url: identityUrl($) ?? savedFromUrl(html),
    chunkMarkers:
      article !== null &&
      article.find("[data-content-chunk-id], [data-content-chunk]").length > 0,
  };
}

// ---------------------------------------------------------------------------
// Transform (§2–§7)
// ---------------------------------------------------------------------------

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function slug(text: string): string {
  return normalizeText(text).toLowerCase().replace(/[^0-9a-z]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}

/** §6: DOM id if fresh, else a slugged, deduplicated heading id. */
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

/** §5: og:site_name → ddb:book-title metas → split <title> heuristic. */
function bookTitle($: CheerioAPI): string | null {
  for (const selector of ["meta[property='og:site_name']", "meta[name='ddb:book-title']", "meta[name='book-title']"]) {
    const content = $(selector).attr("content");
    if (content && normalizeText(content)) return normalizeText(content);
  }
  const title = normalizeText($("title").first().text());
  const parts = title.split(/\s+[-—|]\s+/).map((part) => part.trim()).filter(Boolean);
  for (const part of parts.slice(1)) {
    if (!GENERIC_TITLE_SUFFIXES.has(part.toLowerCase())) return part;
  }
  return null;
}

function documentTitle($: CheerioAPI, article: Cheerio<AnyNode>): string {
  const h1 = normalizeText(article.find("h1").first().text());
  if (h1) return h1;
  const og = $("meta[property='og:title']").attr("content");
  if (og && normalizeText(og)) return normalizeText(og);
  return normalizeText($("title").first().text()) || "Untitled DDB page";
}

/** §7: classification order stat_block → table → spell_entry → prose. */
function classify(fragmentHtml: string, sectionText: string): SectionKind {
  const $ = cheerio.load(fragmentHtml);
  if ($(STAT_BLOCK_SELECTOR).length > 0) return "stat_block";

  const tableText = normalizeText($("table").text());
  if (tableText && tableText.length >= sectionText.length / 2) return "table";

  const labelHits = SPELL_LABELS.filter((label) => fragmentHtml.includes(label)).length;
  if (labelHits >= 3) return "spell_entry";

  return "prose";
}

export const ddbSavedHtmlPlugin: IngestionPlugin = {
  name: "ddb-saved-html",
  version: "1.0.0",
  accepts: ["text/html"],

  detect(input: DetectInput): DetectResult {
    try {
      const signals = detectSignals(decode(input.head));
      // §1 confidence mapping: URL identity beats marker-only identity.
      // URL identity must NOT require the article in the prefix: real saved
      // pages inline every stylesheet/script into <head>, pushing <body>
      // past DETECT_HEAD_BYTES (observed at byte ~135k of a 733k page,
      // TASK-10) — while the saved-from stamp and canonical/og:url metas
      // always sit in the first few KiB. transform() re-checks the article
      // on the FULL bytes and throws `unrecognized` if a page that claims
      // to be DDB has no article-like body.
      if (signals.url) return { confidence: 0.95 };
      if (signals.article && signals.chunkMarkers) return { confidence: 0.85 };
      return { confidence: 0 };
    } catch {
      return { confidence: 0 }; // detect never throws (conformance assertion 2)
    }
  },

  transform(input: TransformInput): Promise<NormalizedDocument> {
    const html = decode(input.bytes);
    const signals = detectSignals(html);
    if (!signals.article) {
      throw new PluginError("unrecognized", "HTML does not contain a DDB article-like body.");
    }
    if (!signals.url && !signals.chunkMarkers) {
      throw new PluginError("unrecognized", "HTML does not look like a saved D&D Beyond page.");
    }

    const $ = cheerio.load(html);
    const article = selectArticle($)!;

    // §3: remove boilerplate INSIDE the article before anything is serialized.
    article.find(BOILERPLATE_SELECTOR).remove();

    const book = bookTitle($);
    const title = documentTitle($, article);
    const pathRoot = book ? [book] : [];

    // §6: walk headings in document order with a level stack.
    const headings = article.find("h1, h2, h3, h4, h5, h6").toArray();
    const taken = new Set<string>();
    const stack: Array<{ level: number; text: string }> = [];
    const sections: Section[] = [];
    const artifacts: NormalizedDocument["artifacts"] = [];
    const warnings: string[] = [];

    for (const element of headings) {
      const level = headingLevel(element.tagName);
      if (level === null) continue;
      const headingEl = $(element);
      const text = normalizeText(headingEl.text());
      if (!text) continue;

      while (stack.length > 0 && stack[stack.length - 1]!.level >= level) stack.pop();
      const id = headingId(text, headingEl.attr("id"), taken);

      // Body = following siblings until the next heading of ANY level (§6).
      const bodyNodes: AnyNode[] = [];
      let sibling = element.nextSibling;
      while (sibling) {
        if (sibling.type === "tag" && headingLevel((sibling as { tagName?: string }).tagName) !== null) break;
        bodyNodes.push(sibling);
        sibling = sibling.nextSibling;
      }
      const bodyText = normalizeText(
        bodyNodes.map((node) => $(node).text()).join(" "),
      );
      if (!bodyText) {
        stack.push({ level, text });
        continue; // §6: no body, no section — but the heading still nests
      }

      // Fragment = heading + body, anchor-stamped, then sanitized (§4).
      headingEl.attr("data-stacks-anchor", id);
      const fragmentHtml = sanitizeHtml(
        $.html(headingEl) + bodyNodes.map((node) => $.html(node)).join(""),
        SANITIZE_OPTIONS,
      ).trim();

      const path = [...pathRoot, ...stack.map((item) => item.text), text];
      stack.push({ level, text });

      const artifact = { id, kind: "html" as const, content: fragmentHtml, title: text };
      artifacts.push(artifact);
      sections.push({
        index: sections.length,
        path,
        kind: classify(fragmentHtml, bodyText),
        heading: text,
        content: bodyText,
        anchor: {
          artifactId: id,
          elementId: id,
          charStart: 0,
          charEnd: artifactTextContent(artifact).length,
        },
      });
    }

    if (sections.length === 0) {
      // v2's rule survives (§8): a claimed DDB page with nothing extractable
      // is malformed, not "empty" — the operator should see a failure.
      throw new PluginError("malformed", "DDB saved HTML did not contain extractable article text.");
    }

    // The full sanitized article, for the future archive viewer (R2).
    artifacts.unshift({
      id: "full",
      kind: "html",
      content: sanitizeHtml($.html(article), SANITIZE_OPTIONS).trim(),
      title,
    });

    return Promise.resolve({
      contractVersion: NORMALIZED_DOCUMENT_VERSION,
      title,
      sections,
      artifacts,
      warnings,
    });
  },
};
