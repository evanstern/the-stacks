#!/usr/bin/env node
/**
 * Regenerates the ZIP fixtures under fixtures/zips/ from the loose fixture
 * files. Pure-Node STORE-method (no compression) ZIP writer — no dependency,
 * fully deterministic (fixed timestamps), so the committed binary is
 * reproducible: `node fixtures/build-zips.mjs && git diff --exit-code`.
 *
 * export-mixed.zip is quickstart Scenario 4's batch: two DDB pages, one
 * markdown file, one unsupported .dat — the expand handler must ingest three
 * and skip one with a reason (US1 AC-4, US3 AC-4).
 *
 * export-empty.zip (T041, US3 AC-4 edge case) is ALL-unsupported entries —
 * the expand handler must skip every one and land the batch on the honest
 * `empty` status, distinct from `failed` (nothing broke; nothing ingestible).
 */
import { crc32 } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = dirname(fileURLToPath(import.meta.url));

// DOS time/date fields pinned to 2026-01-01 00:00:00 for byte-identical output.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function storeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, "utf-8");
    const crc = crc32(data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method 0 = STORE
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // compressed size (= size, stored)
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra len
    localParts.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    // extra/comment/disk/internal-attrs all zero (30..37)
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    centralParts.push(central, nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

const read = (rel) => readFileSync(join(FIXTURES, rel));

mkdirSync(join(FIXTURES, "zips"), { recursive: true });

writeFileSync(
  join(FIXTURES, "zips", "export-mixed.zip"),
  storeZip([
    { name: "grumble.html", data: read("ddb/goblin-page.html") },
    { name: "glimmerburst.html", data: read("ddb/glimmerburst-spell.html") },
    { name: "notes.md", data: read("markdown/notes.md") },
    // Unsupported binary entry: expand must SKIP it with a reason, not fail
    // the batch (FR-004). PNG magic bytes so type-sniffing has something real.
    { name: "blob.dat", data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]) },
  ]),
);

writeFileSync(
  join(FIXTURES, "zips", "export-empty.zip"),
  storeZip([
    { name: "blob1.dat", data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]) },
    { name: "blob2.dat", data: Buffer.from([0x25, 0x50, 0x44, 0x46, 4, 5, 6]) },
  ]),
);

console.log("wrote fixtures/zips/export-mixed.zip");
console.log("wrote fixtures/zips/export-empty.zip");
