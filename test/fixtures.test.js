import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = (...parts) => join(root, "fixtures", ...parts);

test("fixtures load markdown metadata and text", async () => {
  const markdown = await readFile(fixture("corpus", "sample.md"), "utf8");

  assert.match(markdown, /title: Synthetic Field Notes/);
  assert.match(markdown, /# Synthetic Field Notes/);
  assert.match(markdown, /## Duplicate Heading/);
  assert.match(markdown, /public|synthetic|Fixture Author/i);
});

test("fixtures load plain text content", async () => {
  const text = await readFile(fixture("corpus", "sample.txt"), "utf8");

  assert.match(text, /^Synthetic Plain Text Fixture/);
  assert.match(text, /synthetic/i);
  assert.match(text, /protected source material/);
});

test("fixtures load simple MediaWiki page fields", async () => {
  const raw = await readFile(fixture("mediawiki", "simple-page.json"), "utf8");
  const page = JSON.parse(raw);

  assert.equal(page.title, "Sample Page");
  assert.equal(page.page_id, 1001);
  assert.equal(page.revision_id, 2002);
  assert.equal(page.timestamp, "2026-05-29T00:00:00Z");
  assert.equal(page.dump_date, "2026-05-29");
  assert.equal(page.source, "synthetic-mediawiki");
  assert.equal(page.source_tier, "fixture");
  assert.equal(page.source_url, "https://example.invalid/wiki/Sample_Page");
  assert.deepEqual(page.categories, ["Fixture pages", "Synthetic corpus"]);
  assert.deepEqual(page.links, ["Linked Fixture"]);
  assert.match(page.text, /synthetic fixture text/);
});

test("fixtures load approval manifest decisions and policy", async () => {
  const raw = await readFile(fixture("mediawiki", "approval-manifest.json"), "utf8");
  const manifest = JSON.parse(raw);

  assert.equal(manifest.policy.name, "synthetic-fixture-policy");
  assert.equal(manifest.approved.length, 2);
  assert.equal(manifest.rejected.length, 1);
  assert.equal(manifest.deferred.length, 1);
  assert.equal(manifest.approved[1].title, "Missing Approved Page");
});

test("fixtures keep malformed JSON invalid", async () => {
  const malformed = await readFile(fixture("mediawiki", "malformed.json"), "utf8");

  assert.throws(() => JSON.parse(malformed), SyntaxError);
});

test("fixtures load minimal EPUB container", async () => {
  const epub = await readFile(fixture("corpus", "sample.epub"));

  assert.equal(epub.subarray(0, 2).toString("utf8"), "PK");
  assert.ok(epub.includes(Buffer.from("mimetype")));
  assert.ok(epub.includes(Buffer.from("META-INF/container.xml")));
  assert.ok(epub.includes(Buffer.from("OEBPS/package.opf")));
  assert.ok(epub.includes(Buffer.from("OEBPS/chapter.xhtml")));
});

test("fixtures load minimal MOBI signature payload", async () => {
  const mobi = await readFile(fixture("corpus", "sample.mobi"));

  assert.ok(mobi.includes(Buffer.from("BOOKMOBI")));
  assert.ok(mobi.includes(Buffer.from("MOBI")));
  assert.ok(mobi.includes(Buffer.from("Synthetic MOBI Fixture")));
});
