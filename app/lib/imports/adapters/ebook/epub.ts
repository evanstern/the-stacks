import { dirname, posix } from "node:path";

import { normalizeLineEndings, sectionId, titleFromFilename, trimBlankLines } from "../shared.js";
import type { ImportAdapter, ImportAdapterResult, ImportWarning, NormalizedSection } from "../types.js";
import { firstAttribute, htmlToText, textContentForTag } from "./html.js";
import { ZipArchive, ZipParseError } from "./zip.js";

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string[];
  fullPath: string;
};

type TocEntry = {
  label: string;
  href: string;
};

type EpubPackage = {
  packagePath: string;
  metadata: Record<string, string | string[]>;
  title: string | null;
  authors: string[];
  language: string | null;
  manifest: ManifestItem[];
  spine: string[];
  toc: TocEntry[];
  coverPresent: boolean;
};

export class EpubImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EpubImportError";
  }
}

export const epubImportAdapter: ImportAdapter = {
  name: "epub",
  version: "epub-v1",
  async import(input): Promise<ImportAdapterResult> {
    const warnings: ImportWarning[] = [];

    try {
      const archive = ZipArchive.fromBytes(input.bytes);
      if (archive.has("META-INF/encryption.xml") || archive.entries.some((entry) => (entry.flags & 0x1) === 0x1)) {
        throw new EpubImportError("encrypted EPUB/DRM content is not supported");
      }

      const parsedPackage = parseEpubPackage(archive, warnings);
      const chapterSections = sectionsFromSpine(archive, parsedPackage, warnings);
      const normalizedText = trimBlankLines(chapterSections.map((section) => section.text).filter(Boolean).join("\n\n"));
      const title = parsedPackage.title ?? titleFromFilename(input.filename);

      return {
        documents: [
          {
            id: "document-0001",
            title,
            authors: parsedPackage.authors,
            language: parsedPackage.language,
            sourceFormat: "epub",
            provenance: {
              filename: input.filename,
              sourceId: input.sourceId ?? null,
              packagePath: parsedPackage.packagePath,
              spineOrder: parsedPackage.spine,
              toc: parsedPackage.toc,
              coverPresent: parsedPackage.coverPresent,
            },
            rawMetadata: {
              metadata: parsedPackage.metadata,
              manifest: parsedPackage.manifest.map(({ id, href, mediaType, properties, fullPath }) => ({ id, href, mediaType, properties, fullPath })),
              spine: parsedPackage.spine,
              toc: parsedPackage.toc,
              coverPresent: parsedPackage.coverPresent,
            },
            normalizedText,
            sections: chapterSections,
          },
        ],
        warnings,
      };
    } catch (error) {
      if (error instanceof EpubImportError || error instanceof ZipParseError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new EpubImportError(`failed to import EPUB: ${message}`);
    }
  },
};

function parseEpubPackage(archive: ZipArchive, warnings: ImportWarning[]): EpubPackage {
  const container = archive.readText("META-INF/container.xml");
  const rootfileTag = container.match(/<rootfile\b[^>]*>/i)?.[0];
  const packagePath = rootfileTag ? firstAttribute(rootfileTag, "full-path") : null;
  if (!packagePath) {
    throw new EpubImportError("invalid EPUB: META-INF/container.xml does not declare a rootfile full-path");
  }

  const opf = archive.readText(packagePath);
  if (/<[^>]*(?:encrypted|encryption|rights)[^>]*drm/i.test(opf)) {
    throw new EpubImportError("encrypted EPUB/DRM content is not supported");
  }

  const metadata = parseMetadata(opf);
  const manifest = parseManifest(opf, packagePath);
  const spine = parseSpine(opf);
  if (spine.length === 0) {
    warnings.push({ code: "epub-spine-empty", message: "EPUB package has no spine itemrefs; no chapter sections were created." });
  }
  const navItem = manifest.find((item) => item.properties.includes("nav"));
  const toc = navItem ? parseToc(archive.readText(navItem.fullPath)) : [];
  if (!navItem) {
    warnings.push({ code: "epub-toc-missing", message: "EPUB package has no nav item; table of contents metadata is empty." });
  }

  return {
    packagePath,
    metadata,
    title: firstString(metadata.title),
    authors: asStrings(metadata.creator),
    language: firstString(metadata.language),
    manifest,
    spine,
    toc,
    coverPresent: manifest.some((item) => item.properties.includes("cover-image") || /cover/i.test(item.id) || /cover/i.test(item.href)),
  };
}

function parseMetadata(opf: string): Record<string, string | string[]> {
  const metadataBlock = opf.match(/<metadata\b[^>]*>([\s\S]*?)<\/metadata>/i)?.[1] ?? "";
  const metadata: Record<string, string | string[]> = {};
  const pattern = /<(?:[\w.-]+:)?([\w.-]+)\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?\1>/gi;
  let match = pattern.exec(metadataBlock);
  while (match !== null) {
    const key = match[1];
    const value = htmlToText(match[2]);
    if (value.length > 0) {
      const existing = metadata[key];
      metadata[key] = existing === undefined ? value : [...asStrings(existing), value];
    }
    match = pattern.exec(metadataBlock);
  }
  return metadata;
}

function parseManifest(opf: string, packagePath: string): ManifestItem[] {
  const packageDir = dirname(packagePath) === "." ? "" : dirname(packagePath);
  const manifestBlock = opf.match(/<manifest\b[^>]*>([\s\S]*?)<\/manifest>/i)?.[1] ?? "";
  const itemPattern = /<item\b[^>]*>/gi;
  const items: ManifestItem[] = [];
  let match = itemPattern.exec(manifestBlock);
  while (match !== null) {
    const tag = match[0];
    const id = firstAttribute(tag, "id");
    const href = firstAttribute(tag, "href");
    const mediaType = firstAttribute(tag, "media-type") ?? "";
    if (id && href) {
      items.push({
        id,
        href,
        mediaType,
        properties: (firstAttribute(tag, "properties") ?? "").split(/\s+/).filter(Boolean),
        fullPath: packageDir ? posix.normalize(posix.join(packageDir, href)) : posix.normalize(href),
      });
    }
    match = itemPattern.exec(manifestBlock);
  }
  return items;
}

function parseSpine(opf: string): string[] {
  const spineBlock = opf.match(/<spine\b[^>]*>([\s\S]*?)<\/spine>/i)?.[1] ?? "";
  const itemrefPattern = /<itemref\b[^>]*>/gi;
  const ids: string[] = [];
  let match = itemrefPattern.exec(spineBlock);
  while (match !== null) {
    const idref = firstAttribute(match[0], "idref");
    if (idref) {
      ids.push(idref);
    }
    match = itemrefPattern.exec(spineBlock);
  }
  return ids;
}

function parseToc(navHtml: string): TocEntry[] {
  const navBlock = navHtml.match(/<nav\b[^>]*(?:epub:type|type)\s*=\s*["']toc["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? navHtml;
  const links: TocEntry[] = [];
  const linkPattern = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let match = linkPattern.exec(navBlock);
  while (match !== null) {
    const tag = match[0].match(/<a\b[^>]*>/i)?.[0] ?? "";
    const href = firstAttribute(tag, "href") ?? "";
    const label = htmlToText(match[1]);
    if (href && label) {
      links.push({ href, label });
    }
    match = linkPattern.exec(navBlock);
  }
  return links;
}

function sectionsFromSpine(archive: ZipArchive, parsedPackage: EpubPackage, warnings: ImportWarning[]): NormalizedSection[] {
  const sections: NormalizedSection[] = [];
  let offset = 0;
  for (const idref of parsedPackage.spine) {
    const item = parsedPackage.manifest.find((candidate) => candidate.id === idref);
    if (!item) {
      warnings.push({ code: "epub-spine-item-missing", message: `EPUB spine references missing manifest item ${idref}.`, metadata: { idref } });
      continue;
    }
    if (!/x?html|xml/i.test(item.mediaType)) {
      warnings.push({ code: "epub-spine-item-unsupported", message: `Skipped non-HTML spine item ${idref}.`, metadata: { idref, mediaType: item.mediaType } });
      continue;
    }

    const chapterHtml = archive.readText(item.fullPath);
    const text = normalizeLineEndings(htmlToText(chapterHtml));
    const heading = firstHeading(chapterHtml) ?? parsedPackage.toc.find((entry) => entry.href.split("#")[0] === item.href)?.label ?? item.id;
    const separator = sections.length === 0 ? 0 : 2;
    offset += separator;
    sections.push({
      id: sectionId("epub-section", sections.length),
      ordinal: sections.length,
      parentSectionId: null,
      heading,
      headingPath: heading ? [heading] : [],
      startOffset: offset,
      endOffset: offset + text.length,
      text,
      metadata: { source: "spine", idref, href: item.href, mediaType: item.mediaType },
    });
    offset += text.length;
  }
  return sections;
}

function firstHeading(html: string): string | null {
  for (const tag of ["h1", "h2", "h3", "title"]) {
    const value = textContentForTag(html, tag)[0];
    if (value) {
      return value;
    }
  }
  return null;
}

function firstString(value: string | string[] | undefined): string | null {
  return asStrings(value)[0] ?? null;
}

function asStrings(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return typeof value === "string" && value.length > 0 ? [value] : [];
}
