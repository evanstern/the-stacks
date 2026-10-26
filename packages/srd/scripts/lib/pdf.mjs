// Dev-time helpers shared by the provenance scripts. Never imported by runtime code.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const PDF_SHA256 =
  "8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87";
export const PDF_URL =
  "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf";
export const PAGE_COUNT = 364;

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function assertPdf(path) {
  const got = sha256(path);
  if (got !== PDF_SHA256) {
    throw new Error(`PDF SHA-256 mismatch: expected ${PDF_SHA256}, got ${got}`);
  }
}

/** Page texts, index 1..364 (index 0 unused). mode: "default" (column order) or "raw". */
export function loadPages(pdf, mode = "default") {
  const args = mode === "raw" ? ["-raw", pdf, "-"] : [pdf, "-"];
  const out = execFileSync("pdftotext", args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const parts = out.split("\f");
  const pages = [""];
  for (let i = 0; i < PAGE_COUNT; i++) pages.push(parts[i] ?? "");
  return pages;
}

export function slug(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Comparison key: ids drop apostrophes; this also drops every other non-alphanumeric. */
export function nameKey(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeName(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Join hyphenated line breaks ("pro-\nvided" -> "provided") and unwrap lines. */
export function unwrap(text) {
  return text
    .replace(/([a-z])-\n([a-z])/g, "$1$2")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Comparison form used by the converter's repair checks and by verify-against-pdf.mjs. */
export function norm(s) {
  return s
    .replace(/([a-z])-\n([a-z])/g, "$1$2")
    .replace(/[’‘]/g, "'")
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}
