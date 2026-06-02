import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  LargeCitationPreviewDialog,
  archiveCitationView,
  canPreviewCitationLarge,
  largeCitationPreviewLabel,
} from "../app/routes/chat";
import type { Citation } from "../app/lib/api";

declare const process: {
  exit(code?: number): never;
};

const previewableCitation = citationFixture({
  source_type: "archived_webpage",
  source_filename: "Example archived source",
  title: "Example archived source",
  section_heading: "Rules Appendix",
  viewer_url: "/records/sources/source-1/archive/viewer?target=chunk-1",
  target_chunk_id: "chunk-1",
  cited_text: "The highlighted archive sentence.",
});

const nonPreviewableCitation = citationFixture({
  source_type: "html",
  source_filename: "Plain source",
  cited_text: "Plain citation text.",
});

const archiveCitationMissingViewerUrl = citationFixture({
  source_type: "archived_webpage",
  source_filename: "Example archived source",
  title: "Example archived source",
  section_heading: "Rules Appendix",
  target_chunk_id: "chunk-1",
  cited_text: "The highlighted archive sentence.",
});

verifyEligibilityHelpers();
verifyStaticPreviewDialogContract();

console.log("citation preview verifier passed");

function verifyEligibilityHelpers() {
  assertEqual(canPreviewCitationLarge(previewableCitation), true, "previewable archive citation is previewable");
  assertEqual(canPreviewCitationLarge(nonPreviewableCitation), false, "non-previewable citation is not previewable");
  assertEqual(canPreviewCitationLarge(archiveCitationMissingViewerUrl), false, "archive citation without viewer_url is not previewable");
  assertEqual(largeCitationPreviewLabel(previewableCitation), "Large preview for citation [1]", "large preview label stays exact");

  const previewView = archiveCitationView(previewableCitation);
  assertEqual(previewView?.viewerUrl, "/records/sources/source-1/archive/viewer?target=chunk-1#source-chunk-chunk-1", "preview archive view keeps target fragment for the dialog iframe");
}

function verifyStaticPreviewDialogContract() {
  const html = renderToStaticMarkup(
    React.createElement(LargeCitationPreviewDialog, {
      preview: previewableCitation,
      onClose: () => undefined,
    }),
  );

  assertIncludes(html, 'role="dialog"', "preview dialog uses dialog role");
  assertIncludes(html, 'aria-modal="true"', "preview dialog is modal");
  assertIncludes(html, "Close citation preview", "preview dialog includes close action text");
  assertIncludes(html, "Large preview for citation [1]", "preview dialog includes visible title text");
  assertIncludes(html, "#source-chunk-chunk-1", "preview iframe keeps the archive target fragment");
  assertNotIncludes(html, "allow-scripts", "preview iframe sandbox remains restricted");
  assertNotIncludes(html, "Large preview unavailable for this citation.", "previewable citation renders iframe, not fallback");

  const missingViewerHtml = renderToStaticMarkup(
    React.createElement(LargeCitationPreviewDialog, {
      preview: archiveCitationMissingViewerUrl,
      onClose: () => undefined,
    }),
  );

  assertIncludes(missingViewerHtml, "Large preview unavailable for this citation.", "archive citation without viewer_url uses deterministic fallback");
  assertNotIncludes(missingViewerHtml, "allow-scripts", "fallback preview never loosens sandbox policy");
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
