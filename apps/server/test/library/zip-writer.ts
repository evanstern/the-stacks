import zlib, { deflateRawSync } from "node:zlib";

/**
 * Minimal stdlib zip writer for tests (specs/017-ingestion-pipeline T018) —
 * `yauzl` reads zips; there is no writer dependency, so tests build their
 * own fixtures with plain buffer math against the (ZIP local file header /
 * central directory / EOCD) format. Supports exactly what the fixtures
 * need: stored and deflate methods, and deliberately-wrong crc32/size/flag
 * values for the error-path tests.
 */

export interface ZipWriterEntry {
  name: string;
  /** Directory entries pass no data. */
  data?: Buffer | string;
  method?: "stored" | "deflate";
  /** Overrides the header's compression-method field, independent of how `data` was packed (unsupported-method tests). */
  methodCodeOverride?: number;
  /** Sets the encrypted bit in the general-purpose flag, without actually encrypting. */
  encrypted?: boolean;
  /** Overrides the declared uncompressed size (size-mismatch tests). */
  declaredSize?: number;
  /** Overrides the stored CRC-32 (CRC-mismatch tests). */
  declaredCrc32?: number;
}

function dosDateTime(): { time: number; date: number } {
  // Arbitrary valid MS-DOS date/time; content doesn't depend on it.
  return { time: 0, date: 0x21 };
}

export function writeZip(entries: ZipWriterEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { time, date } = dosDateTime();

  for (const entry of entries) {
    const isDirectory = entry.data === undefined;
    const nameBuf = Buffer.from(entry.name, "utf8");
    const raw = isDirectory
      ? Buffer.alloc(0)
      : Buffer.isBuffer(entry.data)
        ? entry.data
        : Buffer.from(entry.data ?? "", "utf8");
    const method = entry.method ?? "stored";
    const methodCode =
      entry.methodCodeOverride ?? (method === "deflate" ? 8 : 0);
    const compressed = method === "deflate" ? deflateRawSync(raw) : raw;
    const crc32 = (entry.declaredCrc32 ?? zlib.crc32(raw)) >>> 0;
    const uncompressedSize = entry.declaredSize ?? raw.length;
    const gpFlag = entry.encrypted ? 0x0001 : 0x0000;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(gpFlag, 6);
    localHeader.writeUInt16LE(methodCode, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc32, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localOffset = offset;
    localParts.push(localHeader, nameBuf, compressed);
    offset += localHeader.length + nameBuf.length + compressed.length;

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(gpFlag, 8);
    centralHeader.writeUInt16LE(methodCode, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc32, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(isDirectory ? 0x10 : 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralParts.push(centralHeader, nameBuf);
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralOffset = offset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

export function zipDir(name: string): ZipWriterEntry {
  return { name: name.endsWith("/") ? name : `${name}/` };
}
