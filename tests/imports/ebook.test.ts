import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { epubImportAdapter, isCalibreFallbackEnabled, mobiImportAdapter } from "../../app/lib/imports/adapters/index.js";

const fixtureRoot = join(process.cwd(), "fixtures", "corpus");

async function fixtureBytes(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(fixtureRoot, name)));
}

describe("EPUB and MOBI import adapters", () => {
  it("imports EPUB metadata, TOC, spine order, cover metadata, and text sections", async () => {
    const result = await epubImportAdapter.import({ filename: "sample.epub", bytes: await fixtureBytes("sample.epub"), sourceId: "source_epub" });

    expect(result.warnings).toEqual([]);
    expect(result.documents).toHaveLength(1);

    const [document] = result.documents;
    expect(document).toMatchObject({
      id: "document-0001",
      title: "Synthetic EPUB Fixture",
      authors: ["Fixture Author"],
      language: "en",
      sourceFormat: "epub",
      provenance: {
        filename: "sample.epub",
        sourceId: "source_epub",
        packagePath: "OEBPS/package.opf",
        spineOrder: ["chapter"],
        toc: [{ href: "chapter.xhtml", label: "Fixture Chapter" }],
        coverPresent: false,
      },
      rawMetadata: {
        metadata: {
          identifier: "urn:uuid:synthetic-fixture-epub",
          title: "Synthetic EPUB Fixture",
          language: "en",
          creator: "Fixture Author",
          rights: "CC0-1.0 synthetic fixture",
        },
        spine: ["chapter"],
        toc: [{ href: "chapter.xhtml", label: "Fixture Chapter" }],
        coverPresent: false,
      },
    });
    expect(document.rawMetadata).toMatchObject({
      manifest: expect.arrayContaining([
        expect.objectContaining({ id: "nav", href: "nav.xhtml", properties: ["nav"], fullPath: "OEBPS/nav.xhtml" }),
        expect.objectContaining({ id: "chapter", href: "chapter.xhtml", fullPath: "OEBPS/chapter.xhtml" }),
      ]),
    });
    expect(document.normalizedText).toContain("Fixture Chapter");
    expect(document.normalizedText).toContain("This EPUB content is synthetic and safe for parser smoke tests.");
    expect(document.normalizedText).not.toContain("<h1>");
    expect(document.sections).toHaveLength(1);
    expect(document.sections[0]).toMatchObject({
      id: "epub-section-0001",
      ordinal: 0,
      heading: "Fixture Chapter",
      headingPath: ["Fixture Chapter"],
      metadata: { source: "spine", idref: "chapter", href: "chapter.xhtml", mediaType: "application/xhtml+xml" },
    });
  });

  it("imports synthetic MOBI metadata and text sections without Calibre", async () => {
    const result = await mobiImportAdapter.import({ filename: "sample.mobi", bytes: await fixtureBytes("sample.mobi") });

    expect(isCalibreFallbackEnabled({})).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.documents).toHaveLength(1);

    const [document] = result.documents;
    expect(document).toMatchObject({
      id: "document-0001",
      title: "Synthetic MOBI Fixture",
      authors: [],
      language: null,
      sourceFormat: "mobi",
      provenance: { filename: "sample.mobi", sourceId: null, coverPresent: false, calibreFallbackEnabled: false },
      rawMetadata: {
        title: "Synthetic MOBI Fixture",
        palmDatabaseName: "SyntheticFixture",
        coverPresent: false,
      },
    });
    expect(document.rawMetadata).toMatchObject({ signatures: { bookmobiOffset: 60, mobiOffset: 64 } });
    expect(document.normalizedText).toContain("Synthetic MOBI Fixture");
    expect(document.normalizedText).toContain("This synthetic payload is only for importer smoke tests.");
    expect(document.sections.map((section) => section.id)).toEqual(["mobi-section-0001", "mobi-section-0002"]);
    expect(document.sections[0]).toMatchObject({ heading: "Synthetic MOBI Fixture", headingPath: ["Synthetic MOBI Fixture"] });
  });

  it("fails corrupt EPUB and MOBI inputs clearly", async () => {
    await expect(epubImportAdapter.import({ filename: "corrupt.epub", bytes: new TextEncoder().encode("not a zip") })).rejects.toThrow(
      /invalid EPUB ZIP/i,
    );
    await expect(mobiImportAdapter.import({ filename: "corrupt.mobi", bytes: new TextEncoder().encode("not a mobi") })).rejects.toThrow(
      /invalid MOBI/i,
    );
  });

  it("rejects encrypted EPUB and MOBI inputs without attempting DRM support", async () => {
    const encryptedEpub = createStoredZip({
      "mimetype": "application/epub+zip",
      "META-INF/container.xml": "<container><rootfiles><rootfile full-path=\"OEBPS/package.opf\"/></rootfiles></container>",
      "META-INF/encryption.xml": "<encryption/>",
      "OEBPS/package.opf": "<package><metadata><dc:title>Encrypted</dc:title></metadata><manifest/><spine/></package>",
    });
    await expect(epubImportAdapter.import({ filename: "encrypted.epub", bytes: encryptedEpub })).rejects.toThrow(/encrypted EPUB\/DRM/i);

    const encryptedMobi = new TextEncoder().encode("BOOKMOBI\nDRM encrypted payload");
    await expect(mobiImportAdapter.import({ filename: "encrypted.mobi", bytes: encryptedMobi })).rejects.toThrow(/encrypted MOBI\/DRM/i);
  });

  it("keeps Calibre fallback opt-in behind the environment flag", () => {
    expect(isCalibreFallbackEnabled({ IKIS_EBOOK_CALIBRE_FALLBACK: "1" })).toBe(true);
    expect(isCalibreFallbackEnabled({ IKIS_EBOOK_CALIBRE_FALLBACK: "true" })).toBe(true);
    expect(isCalibreFallbackEnabled({ IKIS_EBOOK_CALIBRE_FALLBACK: "0" })).toBe(false);
    expect(isCalibreFallbackEnabled({})).toBe(false);
  });
});

function createStoredZip(files: Record<string, string>): Uint8Array {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(text, "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localParts.push(localHeader, nameBytes, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);
  return new Uint8Array(Buffer.concat([...localParts, centralDirectory, end]));
}

function crc32(data: Buffer): number {
  return data.length === 0 ? 0 : crcTable().reduce((crc, _entry, index) => (index === 0 ? crc32Buffer(data) : crc), 0);
}

let cachedCrcTable: number[] | null = null;

function crcTable(): number[] {
  if (cachedCrcTable) {
    return cachedCrcTable;
  }
  cachedCrcTable = Array.from({ length: 256 }, (_value, index) => {
    let current = index;
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) === 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }
    return current >>> 0;
  });
  return cachedCrcTable;
}

function crc32Buffer(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable()[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}
