import type { DefaultTreeAdapterTypes as T5 } from "parse5";
import { parse } from "parse5";
import type { Block } from "./index.js";
import {
  CHROME_CLASS_PREFIXES,
  CHROME_HASHED_CLASS_PATTERN,
  CHROME_TAGS,
  CONTENT_ROOT,
  CONTENT_ROOT_CHROME_SELECTORS,
  HEADING_ANCHOR_CLASS,
} from "./selectors.js";

/**
 * Single-pass parse5 tree walk: locates the content root, strips chrome,
 * and emits heading/prose/list blocks while building the normalized text
 * and each block's `[start, end)` UTF-16 anchor in the same pass
 * (specs/012-ddb-parser/research.md R4). Table and stat-block wholeness
 * (US2) and sidebar marking are Phase 4 — this walk treats their contents
 * as prose/lists nested under the current heading path.
 */

const HEADING_RANK: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

function isElement(node: T5.Node): node is T5.Element {
  return "tagName" in node;
}

function hasChildren(node: T5.Node): node is T5.ParentNode {
  return "childNodes" in node;
}

function attr(el: T5.Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

function classList(el: T5.Element): string[] {
  return (attr(el, "class") ?? "").split(/\s+/).filter(Boolean);
}

function hasClass(el: T5.Element, cls: string): boolean {
  return classList(el).includes(cls);
}

/** Matches the handful of selector shapes used in selectors.ts: `tag`, `.class`, `tag.class`, `#id`. */
function matchesSelector(el: T5.Element, selector: string): boolean {
  const idMatch = /^#(.+)$/.exec(selector);
  if (idMatch) return attr(el, "id") === idMatch[1];
  const tagClassMatch = /^([a-zA-Z0-9]*)\.(.+)$/.exec(selector);
  if (tagClassMatch) {
    const [, tag, cls] = tagClassMatch;
    if (tag && el.tagName !== tag) return false;
    return hasClass(el, cls);
  }
  return el.tagName === selector;
}

function isChrome(el: T5.Element): boolean {
  if (CHROME_TAGS.includes(el.tagName.toLowerCase())) return true;
  if (CONTENT_ROOT_CHROME_SELECTORS.some((s) => matchesSelector(el, s))) {
    return true;
  }
  return classList(el).some(
    (c) =>
      CHROME_CLASS_PREFIXES.some((p) => c.startsWith(p)) ||
      CHROME_HASHED_CLASS_PATTERN.test(c),
  );
}

function findFirst(
  node: T5.Node,
  predicate: (el: T5.Element) => boolean,
): T5.Element | undefined {
  if (isElement(node) && predicate(node)) return node;
  if (!hasChildren(node)) return undefined;
  for (const child of node.childNodes) {
    const found = findFirst(child, predicate);
    if (found) return found;
  }
  return undefined;
}

function textContent(node: T5.Node): string {
  if (node.nodeName === "#text") return (node as T5.TextNode).value;
  if (isElement(node) && isChrome(node)) return "";
  if (!hasChildren(node)) return "";
  return node.childNodes.map(textContent).join("");
}

/** A block's text: full descendant text, whitespace collapsed to single spaces (research R4). */
function blockText(node: T5.Node): string {
  return textContent(node).replace(/\s+/g, " ").trim();
}

interface WalkState {
  text: string;
  blocks: Block[];
}

function appendBlock(
  state: WalkState,
  kind: Block["kind"],
  path: string[],
  text: string,
  book: string,
): void {
  if (!text) return;
  if (state.text.length > 0) state.text += "\n\n";
  const start = state.text.length;
  state.text += text;
  const end = state.text.length;
  state.blocks.push({ kind, path, text, anchor: { book, path, start, end } });
}

function walkContent(root: T5.Element, book: string, state: WalkState): void {
  const stack: { level: number; title: string }[] = [];
  const currentPath = () => [book, ...stack.map((s) => s.title)];

  function visit(node: T5.Node): void {
    if (!isElement(node) || isChrome(node)) return;
    const tag = node.tagName.toLowerCase();
    const rank = HEADING_RANK[tag];

    // DDB marks every real section heading with `heading-anchor`; the
    // content root's own top h1 (the chapter title) carries no class at
    // all and is a heading by tag alone (research R3).
    if (
      rank !== undefined &&
      (tag === "h1" || hasClass(node, HEADING_ANCHOR_CLASS))
    ) {
      const title = blockText(node);
      while (
        stack.length > 0 &&
        (stack.at(-1) as { level: number }).level >= rank
      ) {
        stack.pop();
      }
      stack.push({ level: rank, title });
      appendBlock(state, "heading", currentPath(), title, book);
      return;
    }
    if (tag === "p") {
      appendBlock(state, "prose", currentPath(), blockText(node), book);
      return;
    }
    if (tag === "ul" || tag === "ol") {
      // ponytail: list items flatten into one text run (no structured
      // `items` field in the data model — FR-003 only asks for text).
      // Add per-item structure if a consumer needs it later.
      appendBlock(state, "list", currentPath(), blockText(node), book);
      return;
    }
    // Generic container (div, article, aside, section, …): recurse so its
    // block-level children (e.g. a sidebar's <p>s) still get emitted,
    // attached to the section they appear in.
    for (const child of node.childNodes) visit(child);
  }

  for (const child of root.childNodes) visit(child);
}

/**
 * Walks every page's content root and appends to one running text/blocks
 * pair, so the whole book gets one continuous normalized text (research
 * R4). Each page's heading stack starts fresh at `[book]` — a new saved
 * page begins its own top-level chapter, not a nested continuation of the
 * previous page's last heading.
 */
export function walkPages(
  book: string,
  pages: string[],
): { text: string; blocks: Block[] } {
  const state: WalkState = { text: "", blocks: [] };
  for (const page of pages) {
    const document = parse(page);
    const root =
      findFirst(document, (el) => matchesSelector(el, CONTENT_ROOT)) ??
      findFirst(document, (el) => el.tagName === "body");
    if (!root) continue;
    walkContent(root, book, state);
  }
  return state;
}
