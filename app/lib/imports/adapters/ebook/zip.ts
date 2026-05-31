import { inflateRawSync } from "node:zlib";

export type ZipEntry = {
  name: string;
  flags: number;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

export class ZipParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipParseError";
  }
}

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;

export class ZipArchive {
  readonly entries: ZipEntry[];
  private readonly bytes: Buffer;

  private constructor(bytes: Uint8Array, entries: ZipEntry[]) {
    this.bytes = Buffer.from(bytes);
    this.entries = entries;
  }

  static fromBytes(bytes: Uint8Array): ZipArchive {
    const buffer = Buffer.from(bytes);
    if (buffer.length < 22) {
      throw new ZipParseError("invalid EPUB ZIP: file is too small to contain a ZIP directory");
    }

    const eocdOffset = findEndOfCentralDirectory(buffer);
    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
    const entries: ZipEntry[] = [];
    let offset = centralDirectoryOffset;

    for (let index = 0; index < entryCount; index += 1) {
      if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
        throw new ZipParseError("invalid EPUB ZIP: central directory is malformed");
      }

      const flags = buffer.readUInt16LE(offset + 8);
      const compressionMethod = buffer.readUInt16LE(offset + 10);
      const compressedSize = buffer.readUInt32LE(offset + 20);
      const uncompressedSize = buffer.readUInt32LE(offset + 24);
      const nameLength = buffer.readUInt16LE(offset + 28);
      const extraLength = buffer.readUInt16LE(offset + 30);
      const commentLength = buffer.readUInt16LE(offset + 32);
      const localHeaderOffset = buffer.readUInt32LE(offset + 42);
      const nameStart = offset + 46;
      const nameEnd = nameStart + nameLength;

      if (nameEnd > buffer.length) {
        throw new ZipParseError("invalid EPUB ZIP: entry name extends past file end");
      }

      entries.push({
        name: buffer.subarray(nameStart, nameEnd).toString("utf8"),
        flags,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      });
      offset = nameEnd + extraLength + commentLength;
    }

    return new ZipArchive(bytes, entries);
  }

  has(name: string): boolean {
    return this.entries.some((entry) => entry.name === name);
  }

  readText(name: string): string {
    return this.read(name).toString("utf8").replace(/^\uFEFF/, "");
  }

  read(name: string): Buffer {
    const entry = this.entries.find((candidate) => candidate.name === name);
    if (!entry) {
      throw new ZipParseError(`invalid EPUB ZIP: missing entry ${name}`);
    }
    if ((entry.flags & 0x1) === 0x1) {
      throw new ZipParseError(`encrypted EPUB entries are not supported: ${name}`);
    }

    const offset = entry.localHeaderOffset;
    if (offset + 30 > this.bytes.length || this.bytes.readUInt32LE(offset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new ZipParseError(`invalid EPUB ZIP: local header is malformed for ${name}`);
    }

    const nameLength = this.bytes.readUInt16LE(offset + 26);
    const extraLength = this.bytes.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + nameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > this.bytes.length) {
      throw new ZipParseError(`invalid EPUB ZIP: entry data extends past file end for ${name}`);
    }

    const compressed = this.bytes.subarray(dataStart, dataEnd);
    if (entry.compressionMethod === 0) {
      return compressed;
    }
    if (entry.compressionMethod === 8) {
      const inflated = inflateRawSync(compressed);
      if (entry.uncompressedSize !== 0 && inflated.length !== entry.uncompressedSize) {
        throw new ZipParseError(`invalid EPUB ZIP: inflated size mismatch for ${name}`);
      }
      return inflated;
    }

    throw new ZipParseError(`unsupported EPUB ZIP compression method ${entry.compressionMethod} for ${name}`);
  }
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }
  throw new ZipParseError("invalid EPUB ZIP: end of central directory was not found");
}
