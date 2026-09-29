import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "../../src/errors.js";
import { collectPages } from "../../src/library/ingest/collect.js";
import { writeZip, zipDir } from "./zip-writer.js";

/**
 * Unit tests for `collectPages` (specs/017-ingestion-pipeline T020,
 * research R3) over synthetic zips mirroring the observed export layouts
 * in research.md. Fixtures are built in-memory by `zip-writer.ts`.
 */

let dir: string;
let counter = 0;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "collect-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function upload(buf: Buffer): Promise<string> {
  counter += 1;
  const p = path.join(dir, `upload-${counter}.zip`);
  await writeFile(p, buf);
  return p;
}

describe("collectPages", () => {
  it("T020: a single HTML upload reads as one page", async () => {
    const p = path.join(dir, "book.html");
    await writeFile(p, "<p>hello</p>");
    const result = await collectPages(p, "html", "book.html", { tmpDir: dir });
    expect(result.pages).toEqual([
      { path: "book.html", format: "html", text: "<p>hello</p>" },
    ]);
  });

  it("T020: a single Markdown upload reads as one page", async () => {
    const p = path.join(dir, "book.md");
    await writeFile(p, "# Hi");
    const result = await collectPages(p, "markdown", "book.md", {
      tmpDir: dir,
    });
    expect(result.pages).toEqual([
      { path: "book.md", format: "markdown", text: "# Hi" },
    ]);
  });

  it("T020: MM shape — chapter folders, __MACOSX twins, .DS_Store, *_files assets", async () => {
    const zip = await upload(
      writeZip([
        zipDir("Chapter 1"),
        { name: "Chapter 1/page1.html", data: "<p>MM Page 1</p>" },
        zipDir("Chapter 1/page1_files"),
        { name: "Chapter 1/page1_files/background", data: "binary" },
        { name: "__MACOSX/Chapter 1/._page1.html", data: "resource fork" },
        { name: ".DS_Store", data: "ds store" },
      ]),
    );
    const result = await collectPages(zip, "zip", "mm.zip", { tmpDir: dir });
    expect(result.pages).toEqual([
      {
        path: "Chapter 1/page1.html",
        format: "html",
        text: "<p>MM Page 1</p>",
      },
    ]);
    expect(result.duplicatePages).toBe(0);
    expect(result.skippedEntries).toBe(0);
    // 2 directory entries + 2 ignored-pattern entries (_files asset, __MACOSX) + .DS_Store
    expect(result.ignoredEntries).toBe(5);
  });

  it("T020: DMG/XGtE shape — a zip of per-chapter zips, stored method", async () => {
    const zip = await upload(
      writeZip([
        {
          name: "01 - Intro.zip",
          data: writeZip([{ name: "page.html", data: "<p>Ch1</p>" }]),
          method: "stored",
        },
        {
          name: "02 - Next.zip",
          data: writeZip([{ name: "page.html", data: "<p>Ch2</p>" }]),
          method: "stored",
        },
      ]),
    );
    const result = await collectPages(zip, "zip", "dmg.zip", { tmpDir: dir });
    expect(result.pages.map((p) => p.path)).toEqual([
      "01 - Intro.zip/page.html",
      "02 - Next.zip/page.html",
    ]);
    expect(result.pages.map((p) => p.text)).toEqual([
      "<p>Ch1</p>",
      "<p>Ch2</p>",
    ]);
  });

  it("T020: LMoP directory shape — per-chapter zips plus a combined duplicate zip with a directory-only inner zip", async () => {
    const chapterOne = writeZip([{ name: "page.html", data: "<p>One</p>" }]);
    const chapterTwo = writeZip([{ name: "page.html", data: "<p>Two</p>" }]);
    const combined = writeZip([
      { name: "01 - Chapter One.zip", data: chapterOne, method: "deflate" },
      { name: "02 - Chapter Two.zip", data: chapterTwo, method: "deflate" },
      {
        name: "03 - Appendix B.zip",
        data: writeZip([zipDir("empty")]),
        method: "deflate",
      },
    ]);
    const zip = await upload(
      writeZip([
        { name: "01 - Chapter One.zip", data: chapterOne, method: "deflate" },
        { name: "02 - Chapter Two.zip", data: chapterTwo, method: "deflate" },
        { name: "combined.zip", data: combined, method: "deflate" },
      ]),
    );
    const result = await collectPages(zip, "zip", "lmop.zip", { tmpDir: dir });
    expect(result.pages).toHaveLength(2);
    expect(result.pages.map((p) => p.text).sort()).toEqual([
      "<p>One</p>",
      "<p>Two</p>",
    ]);
    expect(result.duplicatePages).toBe(2);
  });

  it("T020: PHB order — numeric collation, not lexical", async () => {
    const zip = await upload(
      writeZip([
        { name: "10 - Ten.html", data: "<p>10</p>" },
        { name: "02 - Two.html", data: "<p>02</p>" },
        { name: "3 - Three.html", data: "<p>3</p>" },
      ]),
    );
    const result = await collectPages(zip, "zip", "phb.zip", { tmpDir: dir });
    expect(result.pages.map((p) => p.path)).toEqual([
      "02 - Two.html",
      "3 - Three.html",
      "10 - Ten.html",
    ]);
  });

  it("T020: asset entries are never inflated, and tmpDir is empty after the walk", async () => {
    const zip = await upload(
      writeZip([
        { name: "page.html", data: "<p>x</p>" },
        {
          name: "page_files/huge",
          data: "should never be read",
          method: "deflate",
          declaredSize: 999,
        },
      ]),
    );
    const { mkdtemp, readdir } = await import("node:fs/promises");
    const tmpDir = await mkdtemp(path.join(dir, "walk-"));
    await collectPages(zip, "zip", "book.zip", { tmpDir });
    expect(await readdir(tmpDir)).toEqual([]);
  });

  it("T020: zero pages throws ValidationError", async () => {
    const zip = await upload(writeZip([zipDir("empty")]));
    await expect(
      collectPages(zip, "zip", "empty.zip", { tmpDir: dir }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("T020: nesting deeper than MAX_ZIP_DEPTH throws ValidationError", async () => {
    const level4 = writeZip([{ name: "page.html", data: "<p>deep</p>" }]);
    const level3 = writeZip([{ name: "l4.zip", data: level4 }]);
    const level2 = writeZip([{ name: "l3.zip", data: level3 }]);
    const level1 = writeZip([{ name: "l2.zip", data: level2 }]);
    const zip = await upload(level1);
    await expect(
      collectPages(zip, "zip", "deep.zip", { tmpDir: dir }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
