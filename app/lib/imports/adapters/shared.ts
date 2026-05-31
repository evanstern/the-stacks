import { basename, extname } from "node:path";

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
}

export function titleFromFilename(filename: string): string {
  const name = basename(filename, extname(filename)).replace(/[-_]+/g, " ").trim();
  return name.length > 0 ? name.replace(/\s+/g, " ") : "Untitled document";
}

export function sectionId(prefix: string, ordinal: number): string {
  return `${prefix}-${String(ordinal + 1).padStart(4, "0")}`;
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function trimBlankLines(text: string): string {
  return text.replace(/^\n+|\n+$/g, "");
}
