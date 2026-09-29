import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXTRACT_BUDGET_BYTES,
  MAX_PAGE_BYTES,
  walkZip,
  type ZipBudget,
  ZipError,
} from "../../src/library/ingest/zip.js";
import { writeZip } from "./zip-writer.js";

/**
 * Unit tests for the `yauzl` wrapper (specs/017-ingestion-pipeline T018,
 * contracts/ingest-modules.md). Fixtures are built in-memory by
 * `zip-writer.ts` — no committed binary fixtures.
 */

let dir: string;
let counter = 0;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "zip-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function zipFile(buf: Buffer): Promise<string> {
  counter += 1;
  const p = path.join(dir, `fixture-${counter}.zip`);
  await writeFile(p, buf);
  return p;
}

function budget(remaining = EXTRACT_BUDGET_BYTES): ZipBudget {
  return { remaining };
}

describe("walkZip", () => {
  it("T018: reads back stored and deflated entries", async () => {
    const zip = await zipFile(
      writeZip([
        { name: "a.html", data: "<p>stored</p>", method: "stored" },
        {
          name: "b.html",
          data: "<p>deflated</p>".repeat(50),
          method: "deflate",
        },
      ]),
    );
    const read = vi.fn();
    await walkZip(zip, {
      tmpDir: dir,
      budget: budget(),
      decide: () => "read",
      onRead: read,
      onExtract: async () => {},
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[0][1].toString()).toBe("<p>stored</p>");
    expect(read.mock.calls[1][1].toString()).toBe("<p>deflated</p>".repeat(50));
  });

  it("T018: skip opens no stream, even for a corrupt entry", async () => {
    const zip = await zipFile(
      writeZip([
        { name: "good.html", data: "<p>ok</p>" },
        {
          name: "corrupt.html",
          data: "<p>bad crc</p>",
          declaredCrc32: 0xdeadbeef,
        },
      ]),
    );
    const read = vi.fn();
    const extract = vi.fn();
    await expect(
      walkZip(zip, {
        tmpDir: dir,
        budget: budget(),
        decide: (entry) => (entry.name === "good.html" ? "read" : "skip"),
        onRead: read,
        onExtract: extract,
      }),
    ).resolves.toBeUndefined();
    expect(read).toHaveBeenCalledTimes(1);
    expect(extract).not.toHaveBeenCalled();
  });

  it("T018: extracts an inner zip, hands onExtract a path, and deletes it after", async () => {
    const inner = writeZip([{ name: "page.html", data: "<p>inner</p>" }]);
    const zip = await zipFile(
      writeZip([{ name: "nested.zip", data: inner, method: "deflate" }]),
    );
    let seenPath = "";
    await walkZip(zip, {
      tmpDir: dir,
      budget: budget(),
      decide: () => "extract",
      onRead: async () => {},
      onExtract: async (_entry, innerZipPath) => {
        seenPath = innerZipPath;
        expect(await readFile(innerZipPath)).toEqual(inner);
      },
    });
    expect(seenPath).not.toBe("");
    await expect(readFile(seenPath)).rejects.toThrow();
    expect(await readdir(dir)).not.toContain(path.basename(seenPath));
  });

  it("T018: a corrupt CRC on a read entry throws ZipError", async () => {
    const zip = await zipFile(
      writeZip([{ name: "a.html", data: "<p>x</p>", declaredCrc32: 0x1 }]),
    );
    await expect(
      walkZip(zip, {
        tmpDir: dir,
        budget: budget(),
        decide: () => "read",
        onRead: async () => {},
        onExtract: async () => {},
      }),
    ).rejects.toBeInstanceOf(ZipError);
  });

  it("T018: an encrypted entry throws ZipError", async () => {
    const zip = await zipFile(
      writeZip([{ name: "a.html", data: "<p>x</p>", encrypted: true }]),
    );
    await expect(
      walkZip(zip, {
        tmpDir: dir,
        budget: budget(),
        decide: () => "read",
        onRead: async () => {},
        onExtract: async () => {},
      }),
    ).rejects.toBeInstanceOf(ZipError);
  });

  it("T018: an unsupported compression method throws ZipError", async () => {
    const zip = await zipFile(
      writeZip([
        {
          name: "a.html",
          data: "<p>x</p>",
          method: "stored",
          methodCodeOverride: 12,
        },
      ]),
    );
    await expect(
      walkZip(zip, {
        tmpDir: dir,
        budget: budget(),
        decide: () => "read",
        onRead: async () => {},
        onExtract: async () => {},
      }),
    ).rejects.toBeInstanceOf(ZipError);
  });

  it("T018: a declared size smaller than the inflated content throws ZipError", async () => {
    const raw = "<p>deflated content</p>".repeat(20);
    const zip = await zipFile(
      writeZip([
        {
          name: "a.html",
          data: raw,
          method: "deflate",
          declaredSize: 5,
        },
      ]),
    );
    await expect(
      walkZip(zip, {
        tmpDir: dir,
        budget: budget(),
        decide: () => "read",
        onRead: async () => {},
        onExtract: async () => {},
      }),
    ).rejects.toBeInstanceOf(ZipError);
  });

  it("T018: an exhausted extraction budget throws ZipError", async () => {
    const zip = await zipFile(
      writeZip([{ name: "a.html", data: "<p>x</p>", declaredSize: 1000 }]),
    );
    await expect(
      walkZip(zip, {
        tmpDir: dir,
        budget: budget(100),
        decide: () => "read",
        onRead: async () => {},
        onExtract: async () => {},
      }),
    ).rejects.toBeInstanceOf(ZipError);
  });

  it("T018: a page over MAX_PAGE_BYTES (declared size) throws ZipError before reading", async () => {
    const zip = await zipFile(
      writeZip([
        {
          name: "a.html",
          data: "tiny",
          method: "deflate",
          declaredSize: MAX_PAGE_BYTES + 1,
        },
      ]),
    );
    const read = vi.fn();
    await expect(
      walkZip(zip, {
        tmpDir: dir,
        budget: budget(),
        decide: () => "read",
        onRead: read,
        onExtract: async () => {},
      }),
    ).rejects.toBeInstanceOf(ZipError);
    expect(read).not.toHaveBeenCalled();
  });

  it("T018: a truncated file (no EOCD) throws ZipError", async () => {
    const full = writeZip([{ name: "a.html", data: "<p>x</p>" }]);
    const truncated = full.subarray(0, full.length - 22);
    const zip = await zipFile(truncated);
    await expect(
      walkZip(zip, {
        tmpDir: dir,
        budget: budget(),
        decide: () => "read",
        onRead: async () => {},
        onExtract: async () => {},
      }),
    ).rejects.toBeInstanceOf(ZipError);
  });

  it("T018: the handle is closed after an error — a second walk of the same path succeeds", async () => {
    const zip = await zipFile(
      writeZip([
        { name: "bad.html", data: "<p>x</p>", declaredCrc32: 0x1 },
        { name: "good.html", data: "<p>ok</p>" },
      ]),
    );
    await expect(
      walkZip(zip, {
        tmpDir: dir,
        budget: budget(),
        decide: () => "read",
        onRead: async () => {},
        onExtract: async () => {},
      }),
    ).rejects.toBeInstanceOf(ZipError);

    const read = vi.fn();
    await walkZip(zip, {
      tmpDir: dir,
      budget: budget(),
      decide: (entry) => (entry.name === "good.html" ? "read" : "skip"),
      onRead: read,
      onExtract: async () => {},
    });
    expect(read).toHaveBeenCalledTimes(1);
  });
});
