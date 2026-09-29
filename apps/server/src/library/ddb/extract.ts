import type { DefaultTreeAdapterTypes as T5 } from "parse5";
import type { Block } from "./index.js";
import { STAT_BLOCK_ABILITY_SCORES, STAT_BLOCK_PARTS } from "./selectors.js";

/**
 * Structured extraction for the two whole-unit block kinds (US2,
 * specs/012-ddb-parser/research.md R3). `walk.ts` calls these instead of
 * recursing into a `<table>` or a stat-block container, so neither is ever
 * also emitted as prose.
 */

type TableData = NonNullable<Block["table"]>;
type StatBlockData = NonNullable<Block["statBlock"]>;

function isElement(node: T5.Node): node is T5.Element {
  return "tagName" in node;
}

function hasChildren(node: T5.Node): node is T5.ParentNode {
  return "childNodes" in node;
}

function attr(el: T5.Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

function hasClass(el: T5.Element, cls: string): boolean {
  return (attr(el, "class") ?? "").split(/\s+/).includes(cls);
}

/** Strips the leading `.` off a class-selector constant from selectors.ts. */
const cls = (selector: string) => selector.slice(1);

function textOf(node: T5.Node): string {
  if (node.nodeName === "#text") return (node as T5.TextNode).value;
  if (!hasChildren(node)) return "";
  return node.childNodes.map(textOf).join("");
}

/** Flattened, whitespace-collapsed text of an element (mirrors walk.ts's blockText). */
function cellText(node: T5.Node): string {
  return textOf(node).replace(/\s+/g, " ").trim();
}

function findAll(
  node: T5.Node,
  predicate: (el: T5.Element) => boolean,
): T5.Element[] {
  const out: T5.Element[] = [];
  const visit = (n: T5.Node) => {
    if (isElement(n) && predicate(n)) out.push(n);
    if (hasChildren(n)) for (const child of n.childNodes) visit(child);
  };
  visit(node);
  return out;
}

function findFirst(
  node: T5.Node,
  predicate: (el: T5.Element) => boolean,
): T5.Element | undefined {
  return findAll(node, predicate)[0];
}

function directCells(tr: T5.Element): T5.Element[] {
  return tr.childNodes
    .filter(isElement)
    .filter((c) => c.tagName === "td" || c.tagName === "th");
}

function rowCells(tr: T5.Element): string[] {
  return directCells(tr).map(cellText);
}

/**
 * Caption (the heading inside `<caption>`, if any), header row, and data
 * rows in order. A merged (`colspan`) cell contributes exactly one entry —
 * its own text — rather than being duplicated across columns, so no cell's
 * text is lost or invented (spec edge case, FR-006).
 */
export function extractTable(tableEl: T5.Element): TableData {
  const captionEl = findFirst(tableEl, (el) => el.tagName === "caption");
  const captionHeading =
    captionEl && findFirst(captionEl, (el) => /^h[1-6]$/.test(el.tagName));
  const caption = captionEl
    ? cellText(captionHeading ?? captionEl) || undefined
    : undefined;

  const theadEl = findFirst(tableEl, (el) => el.tagName === "thead");
  const headerRows = theadEl
    ? findAll(theadEl, (el) => el.tagName === "tr")
    : [];
  const allRows = findAll(tableEl, (el) => el.tagName === "tr");
  let dataRows = allRows.filter((tr) => !headerRows.includes(tr));

  let header: string[] = [];
  if (headerRows.length > 0) {
    header = rowCells(headerRows[0]);
  } else if (
    dataRows.length > 0 &&
    directCells(dataRows[0]).every((c) => c.tagName === "th")
  ) {
    // A header row with no <thead> wrapper (all-<th> first row).
    header = rowCells(dataRows[0]);
    dataRows = dataRows.slice(1);
  }
  // Otherwise: a header *column* (each row starts with a <th>) — there is no
  // header row, so `header` stays empty and every row keeps its <th> as its
  // first cell.

  return { caption, header, rows: dataRows.map(rowCells) };
}

/** A `<strong>Label</strong> value` line; `null` when there is no `<strong>`. */
function parseDataLine(
  el: T5.Element,
): { label: string; value: string } | null {
  const strong = findFirst(el, (e) => e.tagName === "strong");
  if (!strong) return null;
  const label = cellText(strong);
  if (!label) return null;
  const full = cellText(el);
  const value = full.startsWith(label) ? full.slice(label.length).trim() : full;
  return { label, value };
}

/**
 * Creature name and its labelled fields (armor class, hit points, etc., then
 * the six ability scores). Metadata, subsection headings ("Actions"), and
 * trait/action bodies carry no label/value shape (CR-004: values stay
 * strings) — `walk.ts` keeps them in the block's flattened `text` instead.
 */
export function extractStatBlock(container: T5.Element): StatBlockData {
  const titleEl = findFirst(container, (el) =>
    hasClass(el, cls(STAT_BLOCK_PARTS.title)),
  );
  const name = titleEl ? cellText(titleEl) : "";

  const dataEls = findAll(
    container,
    (el) =>
      hasClass(el, cls(STAT_BLOCK_PARTS.data)) ||
      hasClass(el, cls(STAT_BLOCK_PARTS.dataLast)),
  );
  const fields = dataEls
    .map(parseDataLine)
    .filter((f): f is { label: string; value: string } => f !== null);

  const abilityStats = findAll(container, (el) =>
    hasClass(el, cls(STAT_BLOCK_ABILITY_SCORES.stat)),
  );
  for (const stat of abilityStats) {
    const headingEl = findFirst(stat, (el) =>
      hasClass(el, cls(STAT_BLOCK_ABILITY_SCORES.heading)),
    );
    const dataEl = findFirst(stat, (el) =>
      hasClass(el, cls(STAT_BLOCK_ABILITY_SCORES.data)),
    );
    if (headingEl && dataEl) {
      fields.push({ label: cellText(headingEl), value: cellText(dataEl) });
    }
  }

  return { name, fields };
}
