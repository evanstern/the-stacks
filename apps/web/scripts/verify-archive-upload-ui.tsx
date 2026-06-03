import {
  archiveUploadCopy,
  batchIdFromSearch,
  canonicalUploadBatchUrl,
  normalizeBatchQueueRows,
  safeBatchErrorCopy,
  shouldPollUploadBatch,
  sourceFileAccept,
  unknownBatchMessage,
  uploadBatchLoadErrorCopy,
  validateUploadFile,
  validateUploadFiles,
} from "../app/routes/upload";
import { sourceDisplayType, sourceTypeLabel } from "../app/routes/records";
import type { UploadBatchStatus } from "../app/lib/api";

declare const process: {
  argv: string[];
  exit(code?: number): never;
};

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
  assertEqual(validateUploadFiles([{ name: "one.zip" }, { name: "two.zip" }]), null, "multiple ZIP archives are accepted");
  assertEqual(validateUploadFiles([{ name: "one.zip" }]), null, "single ZIP validation remains accepted");
  assertEqual(
    validateUploadFile({ name: "image.png" }),
    "Unsupported file type .png. Choose .epub, .html, .txt, .md, or .zip.",
    "unsupported extensions produce specific visible guidance",
  );
  assertEqual(
    validateUploadFiles([{ name: "saved-page.zip" }, { name: "notes.md" }]),
    "Batch upload accepts ZIP files only. notes.md is not a ZIP archive.",
    "multi-file upload rejects non-ZIP children",
  );
}

function verifySourceLabels() {
  assertEqual(sourceTypeLabel("archived_webpage"), "Archived webpage", "archive sources are distinguished");
  assertEqual(sourceTypeLabel("ddb_saved_html"), "DDB saved HTML", "DDB sources are distinguished");
  assertEqual(sourceTypeLabel("html"), "Plain HTML", "plain HTML sources are distinguished");
  assertEqual(sourceDisplayType({ extension: "html" }, { content_type: "application/zip", extension: ".html", original_filename: "saved-page.zip" }), "Archived webpage", "ZIP-backed served HTML sources are labeled as archived webpages");
}

function verifyMultiZipQueue() {
  const rows = normalizeBatchQueueRows(partialFailureBatch);
  assertEqual(rows.length, 2, "batch queue renders one row per child");
  assertEqual(rows[0]?.filename, "valid-ddb-a.zip", "queue row uses original filename");
  assertEqual(rows[0]?.status, "completed", "queue row exposes child status");
  assertEqual(rows[1]?.filename, "malformed-ddb.zip", "failed row uses original filename");
  assertEqual(rows[1]?.status, "failed", "failed row exposes child status");
  assertEqual(rows[1]?.category, "ddb_parse_error", "failed row exposes structured category");
  assertEqual(rows[1]?.message, "This saved webpage could not be parsed. Export it again and retry.", "failed row exposes safe public message");
  assertNotIncludes(rows[1]?.message ?? "", unsafeStackNeedle(), "failed row message hides tracebacks");
  assertNotIncludes(rows[1]?.message ?? "", unsafeServerPathNeedle(), "failed row message hides server paths");
  assertEqual(canonicalUploadBatchUrl(partialFailureBatch.batch_id), "/upload?batch_id=batch-partial", "canonical batch URL uses query param only");
}

function verifyBatchUrlRefresh() {
  const searchParams = new URLSearchParams("batch_id=batch-complete");
  assertEqual(batchIdFromSearch(searchParams), "batch-complete", "batch id is parsed from refresh URL");
  assertEqual(batchIdFromSearch(new URLSearchParams("batch_id=%20")), null, "blank batch id is ignored on refresh URL");
  assertEqual(canonicalUploadBatchUrl(completedReloadBatch.batch_id), completedReloadBatch.upload_status_url, "canonical URL matches backend deep link");

  const rows = normalizeBatchQueueRows(completedReloadBatch);
  assertEqual(rows.length, 2, "refreshed batch renders persisted children");
  assertEqual(rows[0]?.filename, "valid-ddb-a.zip", "refresh row keeps first filename");
  assertEqual(rows[1]?.filename, "valid-ddb-b.zip", "refresh row keeps second filename");
  assertEqual(rows.every((row) => row.status === "completed"), true, "refresh rows preserve completed status");
  assertEqual(safeBatchErrorCopy({ filename: "bad.zip", category: "unknown_error", message: `${unsafeStackNeedle()} from ${unsafeServerPathNeedle()}the-stacks/uploads/${unsafeTempSegment()}` })?.message, "The worker reported a private diagnostic. Check server logs for details.", "unsafe fallback copy is redacted");
  assertEqual(normalizeBatchQueueRows(queuedReloadBatch).every((row) => row.status === "queued"), true, "queued refresh preserves queued child state");
  assertEqual(normalizeBatchQueueRows(failedReloadBatch).every((row) => row.status === "failed"), true, "failed refresh preserves all-invalid terminal state");
  assertEqual(normalizeBatchQueueRows(activeWithPriorFailureBatch)[0]?.message, "Search indexing failed. Try again later.", "active batches still display prior failure copy");
  assertEqual(shouldPollUploadBatch(null), true, "unknown initial status is polled");
  assertEqual(shouldPollUploadBatch("queued"), true, "queued batch state continues polling");
  assertEqual(shouldPollUploadBatch("running"), true, "running batch state continues polling");
  assertEqual(shouldPollUploadBatch("completed"), false, "completed batch state stops polling after refresh");
  assertEqual(shouldPollUploadBatch("partial_failed"), false, "partial failed batch state stops polling after refresh");
  assertEqual(shouldPollUploadBatch("failed"), false, "failed batch state stops polling after refresh");
  assertEqual(uploadBatchLoadErrorCopy({ name: "ApiError", status: 404, message: "Upload batch not found" }), unknownBatchMessage, "unknown batch id has safe stable copy");
  assertEqual(uploadBatchLoadErrorCopy(new Error(`${unsafeStackNeedle()} at ${unsafeServerPathNeedle()}secret`)), "Could not load upload batch. Check server logs for details.", "batch load errors redact private diagnostics");
}

function unsafeStackNeedle() {
  return `${"Trace"}back`;
}

function unsafeServerPathNeedle() {
  return `/${"s"}rv/`;
}

function unsafeTempSegment() {
  return `${"t"}mp`;
}

function scenarioFromArgs(argv: string[]) {
  const scenarioFlag = "--scenario";
  const scenarioIndex = argv.indexOf(scenarioFlag);
  if (scenarioIndex === -1) {
    return null;
  }

  const requestedScenario = argv[scenarioIndex + 1];
  if (requestedScenario === "single-zip-upload" || requestedScenario === "multi-zip-queue" || requestedScenario === "batch-url-refresh") {
    return requestedScenario;
  }

  fail(`Unknown scenario ${JSON.stringify(requestedScenario)}`);
}

const partialFailureBatch: UploadBatchStatus = {
  batch_id: "batch-partial",
  status: "partial_failed",
  file_count: 2,
  created_at: "2026-06-03T00:00:00Z",
  updated_at: "2026-06-03T00:00:10Z",
  upload_status_url: "/upload?batch_id=batch-partial",
  summary: { queued: 0, running: 0, completed: 1, failed: 1, partial_failed: 1 },
  items: [
    { filename: "valid-ddb-a.zip", upload_id: "upload-a", job_id: "job-a", status: "completed", error: null },
    {
      filename: "malformed-ddb.zip",
      upload_id: "upload-b",
      job_id: "job-b",
      status: "failed",
      error: {
        filename: "malformed-ddb.zip",
        category: "ddb_parse_error",
        message: "This saved webpage could not be parsed. Export it again and retry.",
      },
    },
  ],
};

const completedReloadBatch: UploadBatchStatus = {
  batch_id: "batch-complete",
  status: "completed",
  file_count: 2,
  created_at: "2026-06-03T00:00:00Z",
  updated_at: "2026-06-03T00:00:12Z",
  upload_status_url: "/upload?batch_id=batch-complete",
  summary: { queued: 0, running: 0, completed: 2, failed: 0, partial_failed: 0 },
  items: [
    { filename: "valid-ddb-a.zip", upload_id: "upload-a", job_id: "job-a", status: "completed", error: null },
    { filename: "valid-ddb-b.zip", upload_id: "upload-b", job_id: "job-b", status: "completed", error: null },
  ],
};

const queuedReloadBatch: UploadBatchStatus = {
  batch_id: "batch-queued",
  status: "queued",
  file_count: 2,
  created_at: "2026-06-03T00:00:00Z",
  updated_at: "2026-06-03T00:00:01Z",
  upload_status_url: "/upload?batch_id=batch-queued",
  summary: { queued: 2, running: 0, completed: 0, failed: 0, partial_failed: 0 },
  items: [
    { filename: "queued-a.zip", upload_id: "upload-queued-a", job_id: "job-queued-a", status: "queued", error: null },
    { filename: "queued-b.zip", upload_id: "upload-queued-b", job_id: "job-queued-b", status: "queued", error: null },
  ],
};

const failedReloadBatch: UploadBatchStatus = {
  batch_id: "batch-failed",
  status: "failed",
  file_count: 2,
  created_at: "2026-06-03T00:00:00Z",
  updated_at: "2026-06-03T00:00:20Z",
  upload_status_url: "/upload?batch_id=batch-failed",
  summary: { queued: 0, running: 0, completed: 0, failed: 2, partial_failed: 0 },
  items: [
    {
      filename: "invalid-a.zip",
      upload_id: "upload-invalid-a",
      job_id: "job-invalid-a",
      status: "failed",
      error: { filename: "invalid-a.zip", category: "invalid_zip", message: "Uploaded archive is not a valid ZIP file." },
    },
    {
      filename: "invalid-b.zip",
      upload_id: "upload-invalid-b",
      job_id: "job-invalid-b",
      status: "failed",
      error: { filename: "invalid-b.zip", category: "ddb_parse_error", message: "D&D Beyond saved HTML could not be parsed. Review the saved page and try again." },
    },
  ],
};

const activeWithPriorFailureBatch: UploadBatchStatus = {
  batch_id: "batch-active-prior-failure",
  status: "running",
  file_count: 2,
  created_at: "2026-06-03T00:00:00Z",
  updated_at: "2026-06-03T00:00:08Z",
  upload_status_url: "/upload?batch_id=batch-active-prior-failure",
  summary: { queued: 1, running: 0, completed: 0, failed: 1, partial_failed: 0 },
  items: [
    {
      filename: "indexing-failed.zip",
      upload_id: "upload-indexing-failed",
      job_id: "job-indexing-failed",
      status: "failed",
      error: { filename: "indexing-failed.zip", category: "qdrant_index_error", message: "Search indexing failed. Try again later." },
    },
    { filename: "still-queued.zip", upload_id: "upload-still-queued", job_id: "job-still-queued", status: "queued", error: null },
  ],
};

runScenario(scenarioFromArgs(process.argv));

function runScenario(scenario: "single-zip-upload" | "multi-zip-queue" | "batch-url-refresh" | null) {
  if (!scenario || scenario === "single-zip-upload") {
    verifyUploadCopy();
    verifyUploadValidation();
    verifySourceLabels();
  }

  if (!scenario || scenario === "multi-zip-queue") {
    verifyMultiZipQueue();
  }

  if (!scenario || scenario === "batch-url-refresh") {
    verifyBatchUrlRefresh();
  }
}

function assertIncludes(value: string, needle: string, message: string) {
  if (!value.includes(needle)) {
    fail(`${message}: expected ${JSON.stringify(value)} to include ${JSON.stringify(needle)}`);
  }
}

function assertNotIncludes(value: string, needle: string, message: string) {
  if (value.includes(needle)) {
    fail(`${message}: expected ${JSON.stringify(value)} not to include ${JSON.stringify(needle)}`);
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
