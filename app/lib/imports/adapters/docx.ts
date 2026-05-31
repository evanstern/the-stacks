import type { ImportAdapter, ImportAdapterResult, ImportWarning, NormalizedSection } from "./types.js";
import { normalizeLineEndings, sectionId, titleFromFilename, trimBlankLines } from "./shared.js";
import { decodeXmlEntities } from "./ebook/html.js";
import { ZipArchive, ZipParseError } from "./ebook/zip.js";

type DocxParagraph = {
  ordinal: number;
  text: string;
  style: string | null;
  headingLevel: number | null;
};

type CoreProperties = {
  title?: string;
  creator?: string;
  language?: string;
  subject?: string;
  description?: string;
};

const DOCUMENT_PATH = "word/document.xml";

export class DocxImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocxImportError";
  }
}

export const docxImportAdapter: ImportAdapter = {
  name: "docx",
  version: "docx-v1",
  async import(input): Promise<ImportAdapterResult> {
    let archive: ZipArchive;

    try {
      archive = ZipArchive.fromBytes(input.bytes);
    } catch (error) {
      if (error instanceof ZipParseError) {
        throw new DocxImportError(`Invalid DOCX ZIP package: ${error.message.replaceAll("EPUB ZIP", "ZIP")}`);
      }
      throw error;
    }

    if (!archive.has("[Content_Types].xml") || !archive.has(DOCUMENT_PATH)) {
      throw new DocxImportError("Invalid DOCX: expected an Office Open XML package with word/document.xml.");
    }

    if (archive.entries.some((entry) => (entry.flags & 0x1) === 0x1)) {
      throw new DocxImportError("Encrypted DOCX content is not supported.");
    }

    const documentXml = archive.readText(DOCUMENT_PATH);
    const paragraphs = parseParagraphs(documentXml);
    const normalizedText = trimBlankLines(paragraphs.map((paragraph) => paragraph.text).join("\n\n"));
    const coreProperties = archive.has("docProps/core.xml") ? parseCoreProperties(archive.readText("docProps/core.xml")) : {};
    const title = coreProperties.title || paragraphs.find((paragraph) => paragraph.headingLevel !== null)?.text || titleFromFilename(input.filename);
    const authors = coreProperties.creator ? [coreProperties.creator] : [];
    const warnings: ImportWarning[] = [];

    if (paragraphs.length === 0) {
      warnings.push({
        code: "docx-no-extractable-text",
        message: "DOCX contained no extractable text in word/document.xml.",
      });
    }

    return {
      documents: [
        {
          id: "document-0001",
          title,
          authors,
          language: coreProperties.language ?? null,
          sourceFormat: "docx",
          provenance: {
            filename: input.filename,
            sourceId: input.sourceId ?? null,
            documentPath: DOCUMENT_PATH,
            paragraphCount: paragraphs.length,
            extraction: "wordprocessingml-text",
          },
          rawMetadata: {
            coreProperties,
            entryCount: archive.entries.length,
            documentPath: DOCUMENT_PATH,
            limitations: [
              "DOCX extraction reads text from WordprocessingML document paragraphs.",
              "Legacy .doc files are intentionally not supported by this adapter.",
              "Embedded media, comments, tracked changes, and OCR/scanned-document handling are not imported.",
            ],
          },
          normalizedText,
          sections: createParagraphSections(normalizedText, paragraphs),
        },
      ],
      warnings,
    };
  },
};

function parseParagraphs(documentXml: string): DocxParagraph[] {
  const paragraphs: DocxParagraph[] = [];
  const paragraphPattern = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match = paragraphPattern.exec(documentXml);

  while (match !== null) {
    const paragraphXml = match[0];
    const text = normalizeParagraphText(extractParagraphText(paragraphXml));
    if (text.length > 0) {
      const style = extractParagraphStyle(paragraphXml);
      paragraphs.push({ ordinal: paragraphs.length, text, style, headingLevel: headingLevelForStyle(style) });
    }
    match = paragraphPattern.exec(documentXml);
  }

  return paragraphs;
}

function extractParagraphText(paragraphXml: string): string {
  const textParts: string[] = [];
  const tokenPattern = /<w:t\b[^>]*>[\s\S]*?<\/w:t>|<w:tab\b[^>]*\/?>|<w:(?:br|cr)\b[^>]*\/?>/g;
  let match = tokenPattern.exec(paragraphXml);

  while (match !== null) {
    const token = match[0];
    if (token.startsWith("<w:tab")) {
      textParts.push("\t");
    } else if (/^<w:(?:br|cr)\b/.test(token)) {
      textParts.push("\n");
    } else {
      const textMatch = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/.exec(token);
      textParts.push(decodeXmlEntities(textMatch?.[1] ?? ""));
    }
    match = tokenPattern.exec(paragraphXml);
  }

  return textParts.join("");
}

function normalizeParagraphText(text: string): string {
  return trimBlankLines(normalizeLineEndings(text).replace(/[\t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n"));
}

function extractParagraphStyle(paragraphXml: string): string | null {
  const styleMatch = /<w:pStyle\b([^>]*)\/?>/i.exec(paragraphXml);
  return styleMatch ? attributeValue(styleMatch[1], "w:val") : null;
}

function headingLevelForStyle(style: string | null): number | null {
  if (!style) {
    return null;
  }

  const match = /^Heading([1-6])$/i.exec(style.replace(/\s+/g, ""));
  return match ? Number(match[1]) : null;
}

function parseCoreProperties(coreXml: string): CoreProperties {
  return {
    title: firstTextForLocalName(coreXml, "title") ?? undefined,
    creator: firstTextForLocalName(coreXml, "creator") ?? undefined,
    language: firstTextForLocalName(coreXml, "language") ?? undefined,
    subject: firstTextForLocalName(coreXml, "subject") ?? undefined,
    description: firstTextForLocalName(coreXml, "description") ?? undefined,
  };
}

function firstTextForLocalName(xml: string, localName: string): string | null {
  const pattern = new RegExp(`<(?:[a-z]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z]+:)?${localName}>`, "i");
  const value = pattern.exec(xml)?.[1];
  const text = value ? normalizeParagraphText(decodeXmlEntities(value.replace(/<[^>]+>/g, " "))) : "";
  return text.length > 0 ? text : null;
}

function attributeValue(attributes: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attributes);
  return match ? decodeXmlEntities(match[1] ?? match[2] ?? "") : null;
}

function createParagraphSections(normalizedText: string, paragraphs: DocxParagraph[]): NormalizedSection[] {
  const sections: NormalizedSection[] = [];
  const headingStack: DocxParagraph[] = [];
  let searchOffset = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.headingLevel !== null) {
      while (headingStack.length > 0 && (headingStack[headingStack.length - 1].headingLevel ?? 0) >= paragraph.headingLevel) {
        headingStack.pop();
      }
      headingStack.push(paragraph);
    }

    const startOffset = normalizedText.indexOf(paragraph.text, searchOffset);
    const safeStartOffset = startOffset >= 0 ? startOffset : searchOffset;
    const endOffset = safeStartOffset + paragraph.text.length;
    searchOffset = endOffset;

    sections.push({
      id: sectionId("docx-paragraph", sections.length),
      ordinal: sections.length,
      parentSectionId: null,
      heading: paragraph.headingLevel !== null ? paragraph.text : null,
      headingPath: headingStack.map((heading) => heading.text),
      startOffset: safeStartOffset,
      endOffset,
      text: paragraph.text,
      metadata: {
        source: "docx-paragraph",
        paragraphOrdinal: paragraph.ordinal,
        style: paragraph.style,
        headingLevel: paragraph.headingLevel,
      },
    });
  }

  return sections;
}
