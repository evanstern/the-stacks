// Dev-time helpers for the `rule` kind. Never imported by runtime code.
// Reads layout (font, position) from `pdftohtml -xml`, then rebuilds headings, paragraphs,
// lists, tables and sidebars of the SRD 5.2.1 "Playing the Game" chapter and the Rules Glossary.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slug } from "./pdf.mjs";

export const CHAPTER_FIRST = 5;
export const CHAPTER_LAST = 18;
export const GLOSSARY_FIRST = 176;
export const GLOSSARY_LAST = 191;
export const GLOSSARY_ACTIONS = ["Help", "Influence", "Search", "Study"];
const COLUMN_SPLIT = 460;
const FOOTER_TOP = 1100;

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
function decode(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&([a-z]+);/g, (m, n) => ENTITIES[n] ?? m);
}

/** pdftohtml -xml over a page range: { fonts, pages: Map<pageNo, item[]> }. */
export function readLayout(pdf, first, last) {
  const dir = mkdtempSync(join(tmpdir(), "srd-layout-"));
  try {
    execFileSync(
      "pdftohtml",
      [
        "-xml",
        "-nomerge",
        "-i",
        "-q",
        "-f",
        String(first),
        "-l",
        String(last),
        pdf,
        join(dir, "out"),
      ],
      { stdio: "ignore", maxBuffer: 256 * 1024 * 1024 },
    );
    const xml = readFileSync(join(dir, "out.xml"), "utf8");
    const fonts = new Map();
    for (const m of xml.matchAll(
      /<fontspec id="(\d+)" size="(\d+)" family="([^"]*)" color="([^"]*)"\/>/g,
    )) {
      fonts.set(m[1], {
        id: m[1],
        size: Number(m[2]),
        family: m[3].replace(/^[A-Z]+\+/, ""),
        color: m[4],
      });
    }
    const pages = new Map();
    for (const part of xml.split("<page ").slice(1)) {
      const no = Number(part.match(/^number="(\d+)"/)[1]);
      const items = [];
      for (const m of part.matchAll(
        /<text top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)" font="(\d+)">(.*?)<\/text>/g,
      )) {
        const top = Number(m[1]);
        if (top >= FOOTER_TOP) continue;
        items.push({
          top,
          left: Number(m[2]),
          width: Number(m[3]),
          font: fonts.get(m[5]),
          text: decode(m[6]),
          page: no,
          col: Number(m[2]) < COLUMN_SPLIT ? 0 : 1,
        });
      }
      pages.set(no, items);
    }
    return { fonts, pages };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const isBody = (f) => f.family === "Cambria";
const isHeadingFont = (f) =>
  f.color === "#88191f" && f.family.endsWith("SemiBold");
const headingLevel = (f) => ({ 39: 0, 27: 1, 21: 2, 18: 3 })[f.size];
const isTableTitle = (f) =>
  f.family.endsWith("SemiBold") && f.size === 16 && f.color === "#231f20";
const isTableHead = (f) =>
  f.family.endsWith("SemiBold") && f.size === 14 && f.color === "#231f20";

/** Join line fragments; fix soft hyphens at wraps. */
export function joinLines(lines) {
  let out = "";
  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    if (out === "") {
      out = line.trimStart();
      continue;
    }
    if (/[a-z]-$/.test(out) && /^[a-z]/.test(line.trimStart())) {
      out = out.slice(0, -1) + line.trimStart();
    } else {
      out += ` ${line.trimStart()}`;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Cluster a column's items into text lines by vertical position. */
function toLines(items) {
  const sorted = [...items].sort((a, b) => a.top - b.top || a.left - b.left);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (
      last &&
      Math.abs(it.top - last.top) <= 6 &&
      !(isTableTitle(it.font) || isHeadingFont(it.font))
    ) {
      last.items.push(it);
      continue;
    }
    lines.push({ top: it.top, items: [it] });
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.left - b.left);
    l.text = l.items.map((i) => i.text).join("");
    l.left = l.items[0].left;
    l.fonts = new Set(l.items.map((i) => i.font.id));
  }
  return lines;
}

function sidebarTitle(items) {
  let t = "";
  for (const it of items) {
    t += it.font.size === 17 ? it.text.toUpperCase() : it.text.toLowerCase();
  }
  return t.replace(/\s+/g, " ").trim();
}

function buildTable(titleLine, bodyLines) {
  // Header rows: leading lines made of table-head font items.
  const headLines = [];
  let i = 0;
  while (
    i < bodyLines.length &&
    bodyLines[i].items.every((x) => isTableHead(x.font))
  ) {
    headLines.push(bodyLines[i]);
    i++;
  }
  const cells = bodyLines.slice(i).flatMap((l) => l.items);
  return { titleLine, headLines, cells };
}

/**
 * Parse a layout page set into a flat node sequence in reading order:
 *   heading {level,text,page,col}, para {text}, bullet {text}, term {text}, table {...},
 *   sidebar {title, nodes}
 */
export function parseNodes(layout, first, last) {
  const nodes = [];
  for (let p = first; p <= last; p++) {
    const items = layout.pages.get(p) ?? [];
    for (const col of [0, 1]) {
      const lines = toLines(items.filter((i) => i.col === col));
      let k = 0;
      /** target list the current content flows into (main flow or a sidebar). */
      let sidebar = null;
      const push = (n) =>
        (sidebar ? sidebar.nodes : nodes).push({ ...n, page: p, col });
      while (k < lines.length) {
        const l = lines[k];
        const f0 = l.items[0].font;
        // Heading
        if (l.items.every((x) => isHeadingFont(x.font))) {
          sidebar = null;
          // merge consecutive wrapped heading lines of the same size
          let text = l.text.trim();
          let j = k + 1;
          while (
            j < lines.length &&
            lines[j].items.every(
              (x) => isHeadingFont(x.font) && x.font.size === f0.size,
            ) &&
            lines[j].top - lines[j - 1].top < f0.size * 2
          ) {
            text += ` ${lines[j].text.trim()}`;
            j++;
          }
          nodes.push({
            t: "heading",
            level: headingLevel(f0),
            text,
            page: p,
            col,
          });
          k = j;
          continue;
        }
        // Sidebar title (small-caps title: font size 17 + 12 GillSans dark)
        if (
          l.items.some((x) => x.font.size === 17 && x.font.color === "#231f20")
        ) {
          const title = sidebarTitle(l.items);
          sidebar = { t: "sidebar", title, nodes: [], page: p, col };
          nodes.push(sidebar);
          k++;
          continue;
        }
        // Table continuation (repeated header at a column top)
        if (
          k === 0 &&
          !sidebar &&
          nodes[nodes.length - 1]?.t === "table" &&
          l.items.every((x) => isTableHead(x.font))
        ) {
          const prev = nodes[nodes.length - 1];
          let j = k + 1;
          while (
            j < lines.length &&
            !lines[j].items.some(
              (x) =>
                isBody(x.font) ||
                isHeadingFont(x.font) ||
                isTableTitle(x.font) ||
                x.font.size === 17,
            )
          )
            j++;
          prev.segHeads ??= [prev.headLines[prev.headLines.length - 1].items];
          prev.segHeads.push(l.items);
          const seg = prev.segHeads.length - 1;
          prev.cells.push(
            ...lines
              .slice(k + 1, j)
              .flatMap((x) => x.items.map((i) => ({ ...i, seg }))),
          );
          k = j;
          continue;
        }
        // Table
        if (l.items.length === 1 && isTableTitle(f0)) {
          let j = k + 1;
          while (
            j < lines.length &&
            !lines[j].items.some(
              (x) =>
                isBody(x.font) ||
                isHeadingFont(x.font) ||
                isTableTitle(x.font) ||
                x.font.size === 17,
            )
          )
            j++;
          const t = buildTable(l, lines.slice(k + 1, j));
          const node = { t: "table", title: l.text.trim(), ...t, page: p, col };
          (sidebar ? sidebar.nodes : nodes).push(node);
          k = j;
          continue;
        }
        // Term list (GillSans 15, regular)
        if (
          l.items.every(
            (x) =>
              x.font.size === 15 &&
              x.font.family === "GillSans" &&
              x.font.color === "#231f20",
          )
        ) {
          for (const it of l.items) push({ t: "term", text: it.text.trim() });
          k++;
          continue;
        }
        // Everything else is text. Sidebar text ends at the first body-font line.
        if (sidebar && l.items.some((x) => isBody(x.font))) sidebar = null;
        // Formula line (GillSans 15 mixed) inside body flow
        const formula =
          l.items.length > 1 &&
          l.items.every(
            (x) =>
              x.font.family === "GillSans" ||
              x.font.family === "GillSans-SemiBold",
          ) &&
          l.items.every((x) => x.font.size === 15);
        push({ t: formula ? "formula" : "line", text: l.text, left: l.left });
        k++;
      }
    }
  }
  return nodes;
}

/** Group `line` nodes into paragraph / bullet / step nodes. Sidebars and tables never split a paragraph. */
export function groupText(nodeList) {
  const out = [];
  let cur = null;
  let pending = [];
  const flush = () => {
    if (cur)
      out.push({
        t: cur.t,
        text: joinLines(cur.lines),
        page: cur.page,
        pageEnd: cur.pageEnd,
      });
    cur = null;
    out.push(...pending);
    pending = [];
  };
  for (const n of nodeList) {
    if (n.t === "sidebar" || n.t === "table") {
      if (cur) pending.push(n);
      else out.push(n);
      continue;
    }
    if (n.t !== "line") {
      flush();
      out.push(
        n.t === "formula"
          ? {
              t: "para",
              text: n.text.replace(/\s+/g, " ").trim(),
              page: n.page,
              pageEnd: n.page,
              formula: true,
            }
          : n,
      );
      continue;
    }
    const startsNew = /^\s/.test(n.text);
    const trimmed = n.text.trimStart();
    const open =
      cur &&
      cur.t === "para" &&
      !/[.!?:”"]$/.test(cur.lines[cur.lines.length - 1].trim());
    if (/^•/.test(trimmed)) {
      flush();
      cur = {
        t: "bullet",
        lines: [trimmed.replace(/^•\s*/, "")],
        page: n.page,
        pageEnd: n.page,
        left0: n.left,
      };
    } else if (/^\d: /.test(trimmed)) {
      flush();
      cur = {
        t: "step",
        lines: [trimmed],
        page: n.page,
        pageEnd: n.page,
        left0: n.left,
      };
    } else if (
      cur &&
      !startsNew &&
      !(cur.hang && n.left <= cur.left0 + 6) && // back at the margin after a hanging-indent item
      !(
        pending.length === 0 &&
        /:$/.test(cur.lines[cur.lines.length - 1].trim())
      ) && // a colon opens a list
      (pending.length === 0 || open)
    ) {
      if (n.left > cur.left0 + 6) cur.hang = true;
      cur.lines.push(trimmed);
      cur.pageEnd = n.page;
    } else {
      flush();
      cur = {
        t: "para",
        lines: [trimmed],
        page: n.page,
        pageEnd: n.page,
        left0: n.left,
      };
    }
  }
  flush();
  return out;
}

export { slug };

/** A header item that spans two body columns cannot be split from layout alone. [left, name] per column. */
const TABLE_OVERRIDES = {
  Cover: [
    [101, "Degree"],
    [166, "Benefit to Target"],
    [285, "Offered By …"],
  ],
};

function colOfRaw(lefts, cell) {
  let c = 0;
  lefts.forEach((left, idx) => {
    if (left - 20 <= cell.left) c = idx;
  });
  return c;
}

const nameOf = (s) => s.replace(/\s+/g, " ").trim();

/** Table node -> { title, columns, rows, pageEnd }. */
export function tableBlock(node) {
  const heads = node.headLines;
  const last = heads[heads.length - 1];
  const override = TABLE_OVERRIDES[nameOf(node.title)];
  const anchors = override
    ? override.map(([left, name]) => ({ left, name }))
    : last.items.map((i) => ({ left: i.left, name: nameOf(i.text) }));
  const upper = heads.length > 1 ? heads[0].items : [];
  const columns = anchors.map((a, idx) => {
    const span =
      idx > 0
        ? [...upper].reverse().find((u) => u.left <= a.left + 4)
        : undefined;
    return span
      ? `${nameOf(span.text).replace(/\s*…\s*$/, "")} ${a.name}`
      : a.name;
  });
  const segAnchors = (node.segHeads ?? []).map((items) =>
    items.map((i) => i.left),
  );
  const colOf = (cell) => {
    const lefts = cell.seg ? segAnchors[cell.seg] : anchors.map((a) => a.left);
    let c = 0;
    lefts.forEach((left, idx) => {
      if (left - 20 <= cell.left) c = idx;
    });
    return c;
  };
  const y = (c) => c.page * 10000 + c.top;
  // A first-column cell can arrive fused with its neighbour ("Dodge Until the start ..."): split it at the first space.
  const fused = [];
  for (const c of node.cells) {
    const lefts = c.seg ? segAnchors[c.seg] : anchors.map((a) => a.left);
    if (
      lefts.length > 1 &&
      colOfRaw(lefts, c) === 0 &&
      c.width > lefts[1] - lefts[0] - 8 &&
      /\S\s+\S/.test(c.text.trim())
    ) {
      const t = c.text.trim();
      const sp = t.indexOf(" ");
      fused.push({ ...c, text: t.slice(0, sp), width: 10 });
      fused.push({
        ...c,
        text: t.slice(sp + 1),
        left: lefts[1],
        width: c.width,
      });
    } else fused.push(c);
  }
  const cells = [...fused].sort((a, b) => y(a) - y(b) || a.left - b.left);
  // repeated-header (side by side) tables: period k
  let k = columns.length;
  for (let q = 1; q <= columns.length / 2; q++) {
    if (
      columns.length % q === 0 &&
      columns.every((c, i) => c === columns[i % q])
    ) {
      k = q;
      break;
    }
  }
  const blocks = columns.length / k;
  const rowsPerBlock = [];
  for (let b = 0; b < blocks; b++) {
    const mine = cells.filter((c) => Math.floor(colOf(c) / k) === b);
    const starts = [];
    const rows = [];
    for (const c of mine) {
      const col = colOf(c) % k;
      if (col === 0) {
        const prev = rows[rows.length - 1];
        if (
          prev &&
          y(c) - starts[starts.length - 1] <= 20 &&
          prev.slice(1).every((x) => x.length === 0)
        ) {
          prev[0].push(c.text);
          continue;
        }
        starts.push(y(c));
        rows.push(Array.from({ length: k }, () => []));
        rows[rows.length - 1][0].push(c.text);
        continue;
      }
      // attach to the row whose start is the latest one at or above this cell
      let r = starts.length - 1;
      while (r > 0 && starts[r] > y(c) + 6) r--;
      rows[r][col].push(c.text);
    }
    rowsPerBlock.push(rows.map((r) => r.map((parts) => joinLines(parts))));
  }
  const pages = cells.map((c) => c.page);
  return {
    type: "table",
    title: nameOf(node.title),
    columns: columns.slice(0, k),
    rows: rowsPerBlock.flat(),
    pageEnd: Math.max(node.page, ...pages),
  };
}

/** Flow nodes -> content blocks (and pageEnd). Sidebars are returned separately. */
function toBlocks(nodes) {
  const blocks = [];
  let pageEnd = 0;
  const bump = (p) => {
    pageEnd = Math.max(pageEnd, p ?? 0);
  };
  for (const n of nodes) {
    if (n.t === "para") {
      blocks.push({ type: "text", text: n.text });
      bump(n.pageEnd);
    } else if (n.t === "step" || n.t === "bullet" || n.t === "term") {
      const prev = blocks[blocks.length - 1];
      if (prev?.type === "list") prev.items.push(n.text);
      else blocks.push({ type: "list", items: [n.text] });
      bump(n.pageEnd ?? n.page);
    } else if (n.t === "table") {
      const tb = tableBlock(n);
      blocks.push({
        type: "table",
        title: tb.title,
        columns: tb.columns,
        rows: tb.rows,
      });
      bump(tb.pageEnd);
    }
  }
  return { blocks, pageEnd };
}

/**
 * Build PDF-derived records for the chapter (first..last) in document order.
 * Each: { path, parent (path|null), blocks, source page, pageEnd, kind: "heading"|"sidebar" }.
 */
export function chapterRecords(layout) {
  const nodes = groupText(parseNodes(layout, CHAPTER_FIRST, CHAPTER_LAST));
  return recordsFrom(nodes, []);
}

function recordsFrom(nodes, rootPath) {
  const recs = [];
  const stack = []; // [{level, rec}]
  let cur = null;
  const ensureEnd = (r) => {
    r.pageEnd = Math.max(r.page, r.pageEnd ?? 0);
  };
  const body = new Map();
  const add = (rec) => {
    recs.push(rec);
    body.set(rec, []);
    return rec;
  };
  for (const n of nodes) {
    if (n.t === "heading") {
      while (stack.length && stack[stack.length - 1].level >= n.level)
        stack.pop();
      const parent = stack.length ? stack[stack.length - 1].rec : null;
      const rec = add({
        path: [...(parent ? parent.path : rootPath), n.text],
        parent,
        page: n.page,
        kind: "heading",
      });
      stack.push({ level: n.level, rec });
      cur = rec;
      continue;
    }
    if (!cur) continue;
    if (n.t === "sidebar") {
      const sb = add({
        path: [...cur.path, n.title],
        parent: cur,
        page: n.page,
        kind: "sidebar",
      });
      body.set(sb, groupText(n.nodes.map((x) => x)));
      continue;
    }
    body.get(cur).push(n);
  }
  for (const r of recs) {
    const { blocks, pageEnd } = toBlocks(body.get(r));
    r.blocks = blocks;
    r.pageEnd = pageEnd;
    ensureEnd(r);
  }
  return recs;
}

/** Glossary actions: records at path ["Rules Glossary", "<Name> [Action]"]. */
export function glossaryRecords(layout) {
  const nodes = groupText(parseNodes(layout, GLOSSARY_FIRST, GLOSSARY_LAST));
  const want = new Set(GLOSSARY_ACTIONS.map((a) => `${a} [Action]`));
  const picked = [];
  let on = false;
  for (const n of nodes) {
    if (n.t === "heading") {
      on = want.has(n.text);
      if (on) picked.push(n);
      continue;
    }
    if (on) picked.push(n);
  }
  const recs = recordsFrom(picked, ["Rules Glossary"]);
  for (const r of recs) r.parent = null;
  return recs;
}

/** Heading-only walk (no body assembly): [{ id, path, page }] for the chapter, its sidebars and the glossary actions. */
export function headingIndex(chapterLayout, glossaryLayout) {
  const out = [];
  const walk = (nodes, rootPath, keep, flatten = false) => {
    const stack = [];
    let cur = null;
    for (const n of nodes) {
      if (n.t === "heading") {
        while (stack.length && stack[stack.length - 1].level >= n.level)
          stack.pop();
        const base =
          stack.length && !flatten ? stack[stack.length - 1].path : rootPath;
        const path = [...base, n.text];
        stack.push({ level: n.level, path });
        cur = keep(n.text) ? path : null;
        if (cur) out.push({ id: path.map(slug).join("."), path, page: n.page });
      } else if (n.t === "sidebar" && cur) {
        const path = [...cur, n.title];
        out.push({ id: path.map(slug).join("."), path, page: n.page });
      }
    }
  };
  walk(parseNodes(chapterLayout, CHAPTER_FIRST, CHAPTER_LAST), [], () => true);
  const want = new Set(GLOSSARY_ACTIONS.map((a) => `${a} [Action]`));
  walk(
    parseNodes(glossaryLayout, GLOSSARY_FIRST, GLOSSARY_LAST),
    ["Rules Glossary"],
    (t) => want.has(t),
    true,
  );
  return out;
}
