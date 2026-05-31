import type { ImportAdapter, ImportAdapterResult, ImportWarning, NormalizedSection } from "./types.js";
import { decodeUtf8, normalizeLineEndings, sectionId, titleFromFilename, trimBlankLines } from "./shared.js";

type FrontmatterResult = {
  body: string;
  metadata: Record<string, string>;
  warnings: ImportWarning[];
};

type HeadingMatch = {
  level: number;
  heading: string;
  markerStart: number;
  contentStart: number;
};

function parseFrontmatter(text: string): FrontmatterResult {
  if (!text.startsWith("---\n")) {
    return { body: text, metadata: {}, warnings: [] };
  }

  const closeIndex = text.indexOf("\n---", 4);
  if (closeIndex === -1) {
    return {
      body: text,
      metadata: {},
      warnings: [{ code: "frontmatter-unclosed", message: "Markdown frontmatter opening fence was found without a closing fence." }],
    };
  }

  const rawFrontmatter = text.slice(4, closeIndex);
  const afterFenceStart = closeIndex + "\n---".length;
  const body = text.slice(text[afterFenceStart] === "\n" ? afterFenceStart + 1 : afterFenceStart);
  const metadata: Record<string, string> = {};
  const warnings: ImportWarning[] = [];

  rawFrontmatter.split("\n").forEach((line, index) => {
    if (line.trim().length === 0) {
      return;
    }

    const separator = line.indexOf(":");
    if (separator === -1) {
      warnings.push({
        code: "frontmatter-ignored-line",
        message: `Ignored unsupported frontmatter line ${index + 1}; expected key: value syntax.`,
        metadata: { line: index + 1 },
      });
      return;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key.length > 0) {
      metadata[key] = value;
    }
  });

  return { body, metadata, warnings };
}

function findHeadings(text: string): HeadingMatch[] {
  const headings: HeadingMatch[] = [];
  const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm;
  let match = headingPattern.exec(text);

  while (match !== null) {
    const markerStart = match.index;
    const lineEnd = text.indexOf("\n", markerStart);
    headings.push({
      level: match[1].length,
      heading: match[2].trim(),
      markerStart,
      contentStart: lineEnd === -1 ? text.length : lineEnd + 1,
    });
    match = headingPattern.exec(text);
  }

  return headings;
}

function sectionsFromHeadings(text: string, headings: HeadingMatch[]): NormalizedSection[] {
  if (headings.length === 0) {
    const trimmed = trimBlankLines(text);
    return trimmed.length === 0
      ? []
      : [
          {
            id: sectionId("markdown-section", 0),
            ordinal: 0,
            parentSectionId: null,
            heading: null,
            headingPath: [],
            startOffset: text.indexOf(trimmed),
            endOffset: text.indexOf(trimmed) + trimmed.length,
            text: trimmed,
            metadata: { source: "document" },
          },
        ];
  }

  const sections: NormalizedSection[] = [];
  const headingStack: HeadingMatch[] = [];

  headings.forEach((heading, ordinal) => {
    while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= heading.level) {
      headingStack.pop();
    }
    headingStack.push(heading);

    const nextHeading = headings[ordinal + 1];
    const rawSectionText = text.slice(heading.contentStart, nextHeading?.markerStart ?? text.length);
    const sectionText = trimBlankLines(rawSectionText);
    const textOffsetInSection = sectionText.length > 0 ? rawSectionText.indexOf(sectionText) : 0;
    const startOffset = heading.contentStart + Math.max(textOffsetInSection, 0);

    sections.push({
      id: sectionId("markdown-section", ordinal),
      ordinal,
      parentSectionId: null,
      heading: heading.heading,
      headingPath: headingStack.map((entry) => entry.heading),
      startOffset,
      endOffset: startOffset + sectionText.length,
      text: sectionText,
      metadata: { headingLevel: heading.level },
    });
  });

  return sections;
}

export const markdownImportAdapter: ImportAdapter = {
  name: "markdown",
  version: "markdown-v1",
  async import(input): Promise<ImportAdapterResult> {
    const sourceText = normalizeLineEndings(decodeUtf8(input.bytes));
    const frontmatter = parseFrontmatter(sourceText);
    const normalizedText = trimBlankLines(frontmatter.body);
    const headings = findHeadings(normalizedText);
    const title = frontmatter.metadata.title || headings[0]?.heading || titleFromFilename(input.filename);
    const authors = frontmatter.metadata.author ? [frontmatter.metadata.author] : [];
    const language = frontmatter.metadata.language || null;

    return {
      documents: [
        {
          id: "document-0001",
          title,
          authors,
          language,
          sourceFormat: "markdown",
          provenance: { filename: input.filename, sourceId: input.sourceId ?? null },
          rawMetadata: { frontmatter: frontmatter.metadata },
          normalizedText,
          sections: sectionsFromHeadings(normalizedText, headings),
        },
      ],
      warnings: frontmatter.warnings,
    };
  },
};
