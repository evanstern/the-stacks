import { archiveUploadCopy, sourceFileAccept, validateUploadFile } from "../app/routes/upload";
import { sourceDisplayType, sourceTypeLabel } from "../app/routes/records";

declare const process: {
  exit(code?: number): never;
};

verifyUploadCopy();
verifyUploadValidation();
verifySourceLabels();

function verifyUploadCopy() {
  assertEqual(
    archiveUploadCopy,
    "Upload a ZIP containing one saved webpage HTML file and its asset folder.",
    "archive upload copy stays exact",
  );
  assertIncludes(sourceFileAccept, ".zip", "file picker accepts zip extension");
  assertIncludes(sourceFileAccept, "application/zip", "file picker accepts zip MIME type");
}

function verifyUploadValidation() {
  assertEqual(validateUploadFile({ name: "saved-page.zip" }), null, "valid ZIP archive is accepted");
  assertEqual(validateUploadFile({ name: "ddb.html" }), null, "DDB/plain HTML upload stays accepted");
  assertEqual(validateUploadFile({ name: "notes.md" }), null, "Markdown upload stays accepted");
  assertEqual(
    validateUploadFile({ name: "image.png" }),
    "Unsupported file type .png. Choose .epub, .html, .txt, .md, or .zip.",
    "unsupported extensions produce specific visible guidance",
  );
}

function verifySourceLabels() {
  assertEqual(sourceTypeLabel("archived_webpage"), "Archived webpage", "archive sources are distinguished");
  assertEqual(sourceTypeLabel("ddb_saved_html"), "DDB saved HTML", "DDB sources are distinguished");
  assertEqual(sourceTypeLabel("html"), "Plain HTML", "plain HTML sources are distinguished");
  assertEqual(sourceDisplayType({ extension: "html" }, { content_type: "application/zip", extension: ".html", original_filename: "saved-page.zip" }), "Archived webpage", "ZIP-backed served HTML sources are labeled as archived webpages");
}

function assertIncludes(value: string, needle: string, message: string) {
  if (!value.includes(needle)) {
    fail(`${message}: expected ${JSON.stringify(value)} to include ${JSON.stringify(needle)}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    fail(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
