import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ValidationError } from "../../errors.js";
import {
  EXTRACT_BUDGET_BYTES,
  MAX_ZIP_DEPTH,
  walkZip,
  type ZipBudget,
  type ZipEntryInfo,
} from "./zip.js";

/**
 * Collects the ordered, de-duplicated HTML/Markdown pages out of an upload
 * (specs/017-ingestion-pipeline research R3, contracts/ingest-modules.md).
 * A zip is walked recursively (zip-of-zips, up to `MAX_ZIP_DEPTH`); a
 * single HTML or Markdown upload is read as one page.
 */

export interface CollectedPage {
  path: string;
  format: "html" | "markdown";
  text: string;
}

export interface CollectedPages {
  pages: CollectedPage[];
  duplicatePages: number;
  ignoredEntries: number;
  skippedEntries: number;
}

const NO_PAGES_MESSAGE = "No HTML or Markdown pages found in the upload.";

function normalizeSlashes(name: string): string {
  return name.replace(/\\/g, "/");
}

/** research R3: `__MACOSX`, `.DS_Store`, `._*`, and saved-page asset folders. */
function isIgnoredEntry(name: string): boolean {
  const segments = normalizeSlashes(name).split("/").filter(Boolean);
  const base = segments.at(-1) ?? "";
  return (
    segments.includes("__MACOSX") ||
    base === ".DS_Store" ||
    base.startsWith("._") ||
    segments.some((segment) => segment.endsWith("_files"))
  );
}

interface WalkContext {
  tmpDir: string;
  budget: ZipBudget;
  depth: number;
  prefix: string;
  out: { nestedPath: string; bytes: Buffer }[];
  counts: { ignored: number; skipped: number };
}

async function walkZipForPages(
  filePath: string,
  ctx: WalkContext,
): Promise<void> {
  await walkZip(filePath, {
    tmpDir: ctx.tmpDir,
    budget: ctx.budget,
    decide(entry: ZipEntryInfo) {
      if (entry.isDirectory || isIgnoredEntry(entry.name)) {
        ctx.counts.ignored += 1;
        return "skip";
      }
      if (/\.zip$/i.test(entry.name)) return "extract";
      if (/\.html?$/i.test(entry.name)) return "read";
      ctx.counts.skipped += 1;
      return "skip";
    },
    onRead: (entry, data) => {
      ctx.out.push({ nestedPath: `${ctx.prefix}${entry.name}`, bytes: data });
    },
    onExtract: async (entry, innerZipPath) => {
      const depth = ctx.depth + 1;
      if (depth > MAX_ZIP_DEPTH) {
        throw new ValidationError([
          {
            path: "(root)",
            message: "Zip nesting exceeds the maximum depth.",
          },
        ]);
      }
      await walkZipForPages(innerZipPath, {
        ...ctx,
        depth,
        prefix: `${ctx.prefix}${entry.name}/`,
      });
    },
  });
}

/** Sorts by nested path (numeric collation) then drops sha-256 duplicates, keeping the first. */
function orderAndDedupe(
  pages: { nestedPath: string; bytes: Buffer }[],
): { path: string; bytes: Buffer }[] & { duplicates: number } {
  const collator = new Intl.Collator(undefined, { numeric: true });
  const sorted = [...pages].sort((a, b) =>
    collator.compare(a.nestedPath, b.nestedPath),
  );
  const seen = new Set<string>();
  const kept: { path: string; bytes: Buffer }[] = [];
  let duplicates = 0;
  for (const page of sorted) {
    const hash = createHash("sha256").update(page.bytes).digest("hex");
    if (seen.has(hash)) {
      duplicates += 1;
      continue;
    }
    seen.add(hash);
    kept.push({ path: page.nestedPath, bytes: page.bytes });
  }
  return Object.assign(kept, { duplicates });
}

export async function collectPages(
  filePath: string,
  format: "zip" | "html" | "markdown",
  filename: string,
  opts: { tmpDir: string },
): Promise<CollectedPages> {
  if (format !== "zip") {
    const text = await readFile(filePath, "utf8");
    return {
      pages: [{ path: filename, format, text }],
      duplicatePages: 0,
      ignoredEntries: 0,
      skippedEntries: 0,
    };
  }

  const budget: ZipBudget = { remaining: EXTRACT_BUDGET_BYTES };
  const counts = { ignored: 0, skipped: 0 };
  const out: { nestedPath: string; bytes: Buffer }[] = [];
  await walkZipForPages(filePath, {
    tmpDir: opts.tmpDir,
    budget,
    depth: 1,
    prefix: "",
    out,
    counts,
  });

  const deduped = orderAndDedupe(out);
  if (deduped.length === 0) {
    throw new ValidationError([{ path: "(root)", message: NO_PAGES_MESSAGE }]);
  }

  return {
    pages: deduped.map((p) => ({
      path: p.path,
      format: "html",
      text: p.bytes.toString("utf8"),
    })),
    duplicatePages: deduped.duplicates,
    ignoredEntries: counts.ignored,
    skippedEntries: counts.skipped,
  };
}
