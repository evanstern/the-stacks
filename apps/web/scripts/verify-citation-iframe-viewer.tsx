import { archiveCitationView, citationIframeSandbox, isArchiveCitation } from "../app/routes/chat";
import type { Citation } from "../app/lib/api";

declare const process: {
  exit(code?: number): never;
};

verifyArchiveCitationDetection();
verifyViewerUrlTargetHandling();
verifySandboxPolicy();
verifyNonArchiveCompatibility();

function verifyArchiveCitationDetection() {
  const citation = citationFixture({
    source_type: "archived_webpage",
    viewer_url: "/records/sources/source-1/archive/viewer?target=chunk-1",
    target_chunk_id: "chunk-1",
    cited_text: "The highlighted archive sentence.",
  });
  const view = archiveCitationView(citation);

  assertEqual(isArchiveCitation(citation), true, "archive citation is detected from source_type");
  assertEqual(view?.hasTarget, true, "archive citation records target availability");
  assertEqual(view?.viewerUrl, "/records/sources/source-1/archive/viewer?target=chunk-1#source-chunk-chunk-1", "archive iframe keeps relative viewer_url same-origin with target fragment");
}

function verifyViewerUrlTargetHandling() {
  const missingTarget = citationFixture({
    source_type: "archived_webpage",
    viewer_url: "/records/sources/source-1/archive/viewer?target=missing-chunk",
    cited_text: "Fallback citation text.",
  });
  const missingViewer = citationFixture({
    source_type: "archived_webpage",
    target_chunk_id: "chunk-1",
    cited_text: "No viewer text.",
  });

  const missingTargetView = archiveCitationView(missingTarget);
  const missingViewerView = archiveCitationView(missingViewer);

  assertEqual(missingTargetView?.hasTarget, false, "missing target falls back to page top mode");
  assertEqual(missingTargetView?.viewerUrl?.includes("target="), false, "missing target strips target from iframe URL");
  assertIncludes(missingTargetView?.fallbackText ?? "", "Target chunk unavailable", "missing target explains fallback");
  assertEqual(missingViewerView?.viewerUrl, null, "missing viewer_url does not render iframe URL");
  assertIncludes(missingViewerView?.fallbackText ?? "", "Archived viewer unavailable", "missing viewer_url explains fallback");
}

function verifySandboxPolicy() {
  assertEqual(citationIframeSandbox.includes("allow-scripts"), false, "iframe sandbox omits allow-scripts");
  assertEqual(citationIframeSandbox, "", "iframe sandbox starts fully restricted");
}

function verifyNonArchiveCompatibility() {
  const citation = citationFixture({
    source_type: "html",
    cited_text: "Plain HTML citation text.",
  });

  assertEqual(isArchiveCitation(citation), false, "plain HTML citation is not treated as archive");
  assertEqual(archiveCitationView(citation), null, "plain HTML citation keeps legacy display path");
}

function citationFixture(metadata: Record<string, unknown>): Citation {
  return {
    id: "citation-1",
    document_chunk_id: "chunk-db-id",
    label: "[1]",
    metadata,
  };
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
