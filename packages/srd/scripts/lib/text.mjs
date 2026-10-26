// Converts the upstream dataset's Markdown-flavoured strings to the plain `Text` form of
// data-model.md: paragraphs separated by a blank line, list items as "- " lines, table rows as
// " | "-joined lines, no emphasis markers. Dev-time only.

const DASH_CELL = /^:?-{2,}:?$/;

function renderInlineTables(t) {
  if (!/\|\s*:?-{3,}/.test(t) || /(^|\n)\s*\|/.test(t)) return t;
  const p0 = t.indexOf("|");
  const p1 = t.lastIndexOf("|");
  let prefix = t.slice(0, p0);
  const suffix = t.slice(p1 + 1).trim();
  const tokens = t
    .slice(p0, p1 + 1)
    .split("|")
    .map((x) => x.trim())
    .filter((x) => x !== "");
  // A "Table: Name" title sits directly before the first pipe.
  const tm = prefix.match(/(Table: [^|]*?)\s*$/);
  if (tm) {
    tokens.unshift(tm[1].trim());
    prefix = prefix.slice(0, prefix.length - tm[0].length);
  }
  const out = [];
  let buf = [];
  let n = 0;
  const flush = () => {
    if (n > 0)
      for (let i = 0; i + n <= buf.length; i += n)
        out.push(`| ${buf.slice(i, i + n).join(" | ")} |`);
    buf = [];
  };
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.startsWith("Table: ")) {
      flush();
      n = 0;
      out.push(tok);
    } else if (DASH_CELL.test(tok)) {
      let c = 0;
      while (i < tokens.length && DASH_CELL.test(tokens[i])) {
        c++;
        i++;
      }
      i--;
      n = c;
      const header = buf.slice(-n);
      buf = [];
      out.push(`| ${header.join(" | ")} |`);
    } else buf.push(tok);
  }
  flush();
  return `${prefix.trim()}\n${out.join("\n")}\n${suffix}`;
}

export function mdToText(input) {
  if (input == null) return "";
  let t = String(input).replace(/\r/g, "").replace(/ /g, " ");
  // Upstream cross-reference artefacts: "Sphere [Area of Effect]|XPHB|Sphere" -> "Sphere".
  t = t.replace(/\b[A-Z][a-z]+ \[[^\]]+\]\|XPHB\|/g, "");
  t = t.replace(/\b(Cover|Short Rest)\|XPHB\|/g, "");
  if (/\|[A-Z]{3,6}\|/.test(t))
    throw new Error(
      `unresolved cross-reference artefact: ${t.match(/.{30}\|[A-Z]{3,6}\|.{20}/)?.[0]}`,
    );
  t = renderInlineTables(t);
  const kinds = [];
  const rows = [];
  for (const raw of t.split("\n")) {
    let line = raw.trim();
    if (!line) continue;
    line = line.replace(/^#{1,6}\s+/, "");
    if (/^\|/.test(line)) {
      const cells = line
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim());
      if (cells.every((c) => DASH_CELL.test(c) || c === "")) continue;
      rows.push(cells.join(" | "));
      kinds.push("table");
      continue;
    }
    if (/^[*•-]\s+/.test(line) && !/^\*\*/.test(line)) {
      rows.push(`- ${line.replace(/^[*•-]\s+/, "")}`);
      kinds.push("list");
      continue;
    }
    rows.push(line);
    kinds.push(/^Table: /.test(line) ? "title" : "para");
  }
  let out = "";
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) {
      const joinLines =
        (kinds[i] === kinds[i - 1] &&
          (kinds[i] === "list" || kinds[i] === "table")) ||
        (kinds[i - 1] === "title" && kinds[i] === "table") ||
        (kinds[i - 1] === "table" && kinds[i] === "table");
      out += joinLines ? "\n" : "\n\n";
    }
    out += rows[i];
  }
  return out
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "$1")
    .replace(/(?<![\w])_(?!\s)(.+?)(?<!\s)_(?![\w])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}
