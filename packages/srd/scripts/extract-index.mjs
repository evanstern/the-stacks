#!/usr/bin/env node
// Usage: node scripts/extract-index.mjs <path-to-SRD_CC_v5.2.1.pdf>
// Extracts names and pages per kind from the official SRD 5.2.1 PDF with `pdftotext` and writes
// provenance/srd-5.2.1-index.json. Dev-time only: CI never runs it, and the PDF is never committed.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEquipment } from "./lib/equipment.mjs";
import { assertPdf, loadPages, PDF_SHA256, PDF_URL } from "./lib/pdf.mjs";
import {
  CHAPTER_FIRST,
  CHAPTER_LAST,
  GLOSSARY_FIRST,
  GLOSSARY_LAST,
  headingIndex,
  readLayout,
} from "./lib/rules.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pdf = process.argv[2];
if (!pdf) {
  console.error("usage: extract-index.mjs <pdf>");
  process.exit(2);
}
assertPdf(pdf);
const pages = loadPages(pdf, "default");
const raw = loadPages(pdf, "raw");

// ---- monsters: "Index of Stat Blocks" on PDF pages 2-4 ----
function monsters() {
  const out = [];
  let on = false;
  for (let p = 2; p <= 4; p++) {
    for (const line of pages[p].split("\n")) {
      if (/^Index of Stat/.test(line)) {
        on = true;
        continue;
      }
      if (!on) continue;
      const m = line.match(/^(.*?)[.\s]*\.{3,}\s*(\d+)\s*$/);
      if (m) out.push({ name: m[1].trim(), page: Number(m[2]) });
    }
  }
  // Stat blocks printed inside other entries (not in the index).
  let fly = null;
  for (let p = 204; p <= 253; p++) {
    if (
      pages[p].split("\n").some((l) => l.trim() === "Giant Fly") &&
      /CR 0 \(XP 0; PB \+2\)/.test(pages[p])
    ) {
      fly = p;
    }
  }
  if (!fly) throw new Error("embedded Giant Fly stat block not found");
  out.push({
    name: "Giant Fly",
    page: fly,
    embedded: "Figurine of Wondrous Power",
  });
  return out;
}

// ---- spells: header line after the name, PDF pages 107-175 ----
function spells() {
  const out = [];
  const head = /^(Level \d+ [A-Z][a-z]+|[A-Z][a-z]+ Cantrip) \(/;
  for (let p = 107; p <= 175; p++) {
    // Raw (content-stream) order keeps each spell name directly above its header line.
    const ls = raw[p].split("\n");
    for (let i = 0; i < ls.length; i++) {
      if (!head.test(ls[i])) continue;
      let j = i - 1;
      while (j >= 0 && !ls[j].trim()) j--;
      out.push({ name: ls[j].trim(), page: p });
    }
  }
  return out;
}

// ---- classes: contents page (page 2) for classes; headings for subclasses ----
const CLASSES = [
  "Barbarian",
  "Bard",
  "Cleric",
  "Druid",
  "Fighter",
  "Monk",
  "Paladin",
  "Ranger",
  "Rogue",
  "Sorcerer",
  "Warlock",
  "Wizard",
];
function classes() {
  const toc = pages[2];
  const out = [];
  for (const c of CLASSES) {
    const m = toc.match(
      new RegExp(`(?:^|\\n|\\s)${c}[.\\s]*\\.{3,}\\s*(\\d+)`),
    );
    if (!m) throw new Error(`class not in contents: ${c}`);
    out.push({ name: c, page: Number(m[1]) });
  }
  for (let i = 0; i < out.length; i++) {
    const from = out[i].page;
    const to = i + 1 < out.length ? out[i + 1].page + 1 : 83;
    let found = null;
    for (let p = from; p < to && !found; p++) {
      const ls = pages[p].split("\n");
      for (let k = 0; k < ls.length && !found; k++) {
        const m = ls[k].match(new RegExp(`^${out[i].name} Subclass:\\s*(.*)$`));
        if (!m) continue;
        let name = m[1].trim();
        const next = (ls[k + 1] ?? "").trim();
        if (!name || /(of the|Draconic)$/.test(name))
          name = `${name} ${next}`.trim();
        found = { name, page: p };
      }
    }
    if (!found)
      throw new Error(`subclass heading not found for ${out[i].name}`);
    out[i].subclass = found;
  }
  return out;
}

// ---- conditions: "<Name> [Condition]" headings in the Rules Glossary ----
function conditions() {
  const out = [];
  for (let p = 176; p <= 191; p++) {
    for (const l of pages[p].split("\n")) {
      const m = l.match(/^(.+) \[Condition\]$/);
      if (m) out.push({ name: m[1].trim(), page: p });
    }
  }
  return out;
}

// ---- rules: headings (and sidebar titles) of "Playing the Game" plus four Rules Glossary actions.
// Read from font sizes with `pdftohtml -xml`; document order, no sorting.
function rules() {
  return headingIndex(
    readLayout(pdf, CHAPTER_FIRST, CHAPTER_LAST),
    readLayout(pdf, GLOSSARY_FIRST, GLOSSARY_LAST),
  );
}

const sortByName = (a) => a.sort((x, y) => x.name.localeCompare(y.name, "en"));
const equipment = parseEquipment(raw).map((e) => ({
  name: e.name,
  page: e.page,
}));

const index = {
  document: "SRD 5.2.1",
  pdfSha256: PDF_SHA256,
  pdfUrl: PDF_URL,
  extractedAt: new Date().toISOString().slice(0, 10),
  kinds: {
    monster: sortByName(monsters()),
    spell: sortByName(spells()),
    class: classes(),
    equipment: sortByName(equipment),
    condition: sortByName(conditions()),
    rule: rules(),
  },
};
const dest = join(here, "..", "provenance", "srd-5.2.1-index.json");
writeFileSync(dest, `${JSON.stringify(index, null, 2)}\n`);
for (const [k, v] of Object.entries(index.kinds)) console.log(k, v.length);
console.log("wrote", dest);
