#!/usr/bin/env node
// Usage: node scripts/convert-rules.mjs <open5e-checkout> <commit> <path-to-SRD_CC_v5.2.1.pdf>
// Builds data/rule.json (SRD 5.2.1 "Playing the Game" chapter + four Rules Glossary actions) and the
// rule entries of provenance/source.json. Text comes from the pinned Open5e srd-2024 Rule.json where it
// matches the PDF word for word, and from the PDF otherwise. Dev-time only. The five other data files
// are never touched.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPdf, nameKey, slug } from "./lib/pdf.mjs";
import {
  CHAPTER_FIRST,
  CHAPTER_LAST,
  chapterRecords,
  GLOSSARY_FIRST,
  GLOSSARY_LAST,
  glossaryRecords,
  readLayout,
} from "./lib/rules.mjs";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const [checkout, commit, pdf] = process.argv.slice(2);
if (!checkout || !commit || !pdf) {
  console.error("usage: convert-rules.mjs <open5e-checkout> <commit> <pdf>");
  process.exit(2);
}
assertPdf(pdf);
const head = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const source = JSON.parse(
  readFileSync(join(pkg, "provenance", "source.json"), "utf8"),
);
if (head !== commit || head !== source.upstream.commit) {
  throw new Error(
    `Open5e checkout is at ${head}; expected ${commit} (pinned ${source.upstream.commit})`,
  );
}

// ---- PDF-derived records
const pdfRecs = [
  ...chapterRecords(readLayout(pdf, CHAPTER_FIRST, CHAPTER_LAST)),
  ...glossaryRecords(readLayout(pdf, GLOSSARY_FIRST, GLOSSARY_LAST)),
];

// ---- dataset sections, keyed two ways: full path below the chapter, and (top section, title) for sidebars
const dir = join(checkout, "data", "v2", "wizards-of-the-coast", "srd-2024");
const rulesets = JSON.parse(readFileSync(join(dir, "RuleSet.json"), "utf8"));
const rules = JSON.parse(readFileSync(join(dir, "Rule.json"), "utf8"));
const IN_SCOPE = [
  "Rhythm of Play",
  "The Six Abilities",
  "D20 Tests",
  "Proficiency",
  "Social Interaction",
  "Exploration",
  "Combat",
  "Damage and Healing",
];
const setName = new Map(rulesets.map((r) => [r.pk, r.fields.name]));

function parseMarkdown(md) {
  const blocks = [];
  let title = null;
  for (const chunk of md.split(/\n\s*\n/)) {
    const lines = chunk.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    const first = lines[0].trim();
    if (first.startsWith(">")) continue; // sidebar text lives in its own record
    const clean = (s) =>
      s
        .replace(/\*\*|\*/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const tm = first.match(/^Table:\s*(.*)$/);
    if (tm && lines.length === 1) {
      title = tm[1];
      continue;
    }
    if (first.startsWith("|")) {
      const rows = lines
        .filter((l) => !/^\|\s*-+/.test(l))
        .map((l) =>
          l
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map(clean),
        );
      const [columns, ...body] = rows;
      blocks.push({ type: "table", title, columns, rows: body });
      title = null;
      continue;
    }
    if (lines.every((l) => /^(\d+\.|-)\s/.test(l.trim()))) {
      blocks.push({
        type: "list",
        items: lines.map((l) => clean(l.trim().replace(/^(\d+\.|-)\s+/, ""))),
      });
      continue;
    }
    blocks.push({ type: "text", text: clean(lines.join(" ")) });
  }
  return blocks;
}

const byPath = new Map();
const byTitle = new Map();
for (const r of rules) {
  const set = setName.get(r.fields.ruleset);
  if (!IN_SCOPE.includes(set)) continue;
  const parts = r.fields.desc.split(/^## (.+)$/m);
  const sections = [[[set, r.fields.name], parts[0]]];
  for (let i = 1; i < parts.length; i += 2)
    sections.push([[set, r.fields.name, parts[i].trim()], parts[i + 1]]);
  for (const [path, md] of sections) {
    const entry = { path, blocks: parseMarkdown(md) };
    byPath.set(path.map(nameKey).join("|"), entry);
    const tk = `${nameKey(set)}|${nameKey(path[path.length - 1])}`;
    if (!byTitle.has(tk)) byTitle.set(tk, entry);
  }
}

function flat(blocks) {
  const parts = [];
  for (const b of blocks) {
    if (b.type === "text") parts.push(b.text);
    else if (b.type === "list") parts.push(...b.items);
    else parts.push(...b.columns, ...b.rows.flat());
  }
  return nameKey(parts.join(" "));
}

// ---- merge
const records = [];
const idOf = (path) => path.map(slug).join(".");
const fromPdf = [];
let fromDataset = 0;
const pdfOnlyNoBody = [];
for (const rec of pdfRecs) {
  const id = idOf(rec.path);
  let blocks = rec.blocks;
  if (blocks.length > 0 && rec.path[0] === "Playing the Game") {
    const rel = rec.path.slice(1);
    const hit =
      byPath.get(rel.map(nameKey).join("|")) ??
      (rec.kind === "sidebar"
        ? byTitle.get(`${nameKey(rel[0])}|${nameKey(rel[rel.length - 1])}`)
        : undefined);
    const hasList = rec.blocks.some((b) => b.type === "list");
    if (hit && !hasList && flat(hit.blocks) === flat(rec.blocks)) {
      // Dataset text equals the PDF text word for word. Keep the PDF's table titles.
      const titles = rec.blocks
        .filter((b) => b.type === "table")
        .map((b) => b.title);
      let t = 0;
      blocks = hit.blocks.map((b) =>
        b.type === "table" ? { ...b, title: titles[t++] ?? b.title } : b,
      );
      fromDataset++;
    } else {
      fromPdf.push(id);
    }
  } else if (blocks.length > 0) {
    fromPdf.push(id);
  } else {
    pdfOnlyNoBody.push(id);
  }
  records.push({
    id,
    name: rec.path.join(" › "),
    title: rec.path[rec.path.length - 1],
    path: rec.path,
    parent: rec.parent ? idOf(rec.parent.path) : null,
    children: [],
    source: {
      document: "SRD 5.2.1",
      section:
        rec.path[0] === "Rules Glossary"
          ? "Rules Glossary"
          : "Playing the Game",
      page: rec.page,
    },
    pageEnd: rec.pageEnd,
    blocks,
  });
}
const byId = new Map(records.map((r) => [r.id, r]));
if (byId.size !== records.length) throw new Error("duplicate rule ids");
for (const r of records) if (r.parent) byId.get(r.parent).children.push(r.id);

writeFileSync(
  join(pkg, "data", "rule.json"),
  `${JSON.stringify(records, null, 2)}\n`,
);

// ---- provenance/source.json (merge; other keys keep their order)
source.usedFor.rule =
  "text from the dataset where it equals the PDF word for word, PDF text otherwise; headings, ids, page ranges, sidebars and every PDF-only record come from the PDF";
source.ruleFromPdf = fromPdf;
const REPAIRS = [
  "rule: tables whose header spans two body columns (Cover) take their column names from the printed header text split by hand",
  'rule: Travel Pace column names join the spanning header ("Distance Traveled Per") with the column header',
  "rule: hyphenated line breaks are rejoined; a paragraph split by a sidebar or table is rejoined",
  "rule: sidebar boxes become child records of the heading they sit under",
  'rule: numbered steps keep the printed "N:" prefix (D20 Tests steps print as 4, 5 and 6)',
];
source.repairs = [
  ...source.repairs.filter((r) => !r.startsWith("rule: ")),
  ...REPAIRS,
];
source.absentTopics = [
  'contests and opposed checks: the SRD 5.2.1 PDF text prints no contest or opposed-check rule (searched pages 1-364 for "contest" and "opposed")',
];
source.ruleConvertedAt = new Date().toLocaleDateString("en-CA");
source.ruleConverter = "scripts/convert-rules.mjs v1";
writeFileSync(
  join(pkg, "provenance", "source.json"),
  `${JSON.stringify(source, null, 2)}\n`,
);

console.log(
  `${records.length} records; ${fromDataset} bodies from the dataset, ${fromPdf.length} from the PDF, ${pdfOnlyNoBody.length} heading-only`,
);
