import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MessageText } from "../app/routes/chat";
import type { Citation } from "../app/lib/api";

type Scenario = "table-citations" | "safety" | "wide-table" | "emphasis-citations" | "all";

declare const process: {
  argv: string[];
  exit(code?: number): never;
};

const citations: Citation[] = [
  {
    id: "citation-one",
    document_chunk_id: "chunk-one",
    label: "[1]",
    metadata: {},
  },
  {
    id: "citation-two",
    document_chunk_id: "chunk-two",
    label: "[2]",
    metadata: {},
  },
];

const scenario = process.argv[2] as Scenario | undefined;

if (scenario === "table-citations") {
  verifyTableCitations();
} else if (scenario === "safety") {
  verifySafety();
} else if (scenario === "wide-table") {
  verifyWideTable();
} else if (scenario === "emphasis-citations") {
  verifyEmphasisCitations();
} else if (scenario === "all") {
  verifyPlanFixtureMatrix();
  verifyTableCitations();
  verifySafety();
  verifyWideTable();
  verifyEmphasisCitations();
} else {
  fail(`Unknown scenario "${process.argv[2] ?? ""}". Use table-citations, safety, wide-table, emphasis-citations, or all.`);
}

function verifyPlanFixtureMatrix() {
  verifyPlainTextCitation();
  verifyAdjacentMarkers();
  verifyUnknownMarker();
  verifyMalformedMarkdown();
}

function verifyPlainTextCitation() {
  const html = renderMessage("Simple answer [1]");

  assertIncludes(html, "<p>Simple answer <button", "renders plain text citation as button");
  assertIncludes(html, "aria-label=\"Open citation [1]\"", "plain text citation opens known citation");
  assertCount(html, "class=\"citation-marker\"", 2, "renders one inline marker and appends the unused citation");
}

function verifyAdjacentMarkers() {
  const html = renderMessage("Adjacent sources [1][2] stay individually clickable.");

  assertIncludes(html, "aria-label=\"Open citation [1]\"", "renders first adjacent marker");
  assertIncludes(html, "aria-label=\"Open citation [2]\"", "renders second adjacent marker");
  assertIncludes(html, ">[1]</button><button", "renders adjacent citation buttons without literal gap text");
  assertCount(html, "class=\"citation-marker\"", 2, "renders only adjacent inline citation markers");
}

function verifyUnknownMarker() {
  const html = renderMessageWithCitations("Known source [1] and unknown source [99].", [citations[0]]);

  assertIncludes(html, "aria-label=\"Open citation [1]\"", "renders known marker in mixed known/unknown text");
  assertIncludes(html, "unknown source [99]", "leaves unknown citation marker literal");
  assertNotIncludes(html, "Open citation [99]", "does not create a citation button for unknown marker");
  assertCount(html, "class=\"citation-marker\"", 1, "renders only the available citation marker");
}

function verifyMalformedMarkdown() {
  const html = renderMessage([
    "Malformed **strong text with citation [1]",
    "",
    "| Broken | table",
    "| --- |",
    "| row [2] | extra cell |",
  ].join("\n"));

  assertIncludes(html, "aria-label=\"Open citation [1]\"", "keeps citations clickable in malformed emphasis text");
  assertIncludes(html, "aria-label=\"Open citation [2]\"", "keeps citations clickable near malformed table text");
  assertCount(html, "class=\"citation-marker\"", 2, "does not duplicate markers for malformed Markdown");
}

function verifyTableCitations() {
  const html = renderMessage([
    "Answer with a prose citation [1].",
    "",
    "| Source | Signal |",
    "| --- | --- |",
    "| Archive | Table citation [2] |",
  ].join("\n"));

  assertIncludes(html, "<table>", "renders GFM table markup");
  assertIncludes(html, "<th>Source</th>", "renders table header cells");
  assertIncludes(html, "<td>Table citation <button", "renders citation marker inside table cell text");
  assertIncludes(html, "aria-label=\"Open citation [1]\"", "renders prose citation as button");
  assertIncludes(html, "aria-label=\"Open citation [2]\"", "renders table citation as button");
  assertCount(html, "class=\"citation-marker\"", 2, "renders only the cited marker buttons");
}

function verifySafety() {
  const html = renderMessage([
    "Unsafe <script>alert('x')</script> HTML should not render.",
    "",
    "Danger link: [run](javascript:alert('x')).",
    "",
    "Inline code `[1]` and fenced code:",
    "",
    "```",
    "[2]",
    "```",
  ].join("\n"));

  assertNotIncludes(html.toLowerCase(), "<script", "does not emit script tags");
  assertNotIncludes(html.toLowerCase(), "href=\"javascript:", "does not emit javascript hrefs");
  assertIncludes(html, "<code>[1]</code>", "keeps inline-code citation label literal");
  assertIncludes(html, "<code>[2]\n</code>", "keeps fenced-code citation label literal");
  assertCount(html, "class=\"citation-marker\"", 2, "appends unresolved citations instead of converting code labels inline");
}

function verifyWideTable() {
  const html = renderMessage([
    "Wide tables stay contained while keeping citations clickable.",
    "",
    "| First very wide column | Second very wide column | Third very wide column | Fourth very wide column | Fifth very wide column |",
    "| --- | --- | --- | --- | --- |",
    "| Alpha alpha alpha alpha alpha alpha | Beta beta beta beta beta beta | Gamma gamma gamma gamma gamma gamma [1] | Delta delta delta delta delta delta | Epsilon epsilon epsilon epsilon epsilon [2] |",
  ].join("\n"));

  assertIncludes(html, "class=\"message-table-scroll\"", "wraps wide tables in overflow containment");
  assertIncludes(html, "overflow-x:auto", "sets horizontal overflow containment on table wrapper");
  assertIncludes(html, "<table>", "renders contained table markup");
  assertIncludes(html, "aria-label=\"Open citation [1]\"", "renders wide-table citation [1] as button");
  assertIncludes(html, "aria-label=\"Open citation [2]\"", "renders wide-table citation [2] as button");
  assertCount(html, "class=\"citation-marker\"", 2, "renders only table-contained citation marker buttons");
}

function verifyEmphasisCitations() {
  const html = renderMessage([
    "*Emphasized claim [1]* and **strong claim [2]**.",
    "",
    "Safe link keeps [citation text [1]](https://example.com/source) clickable inside the link label.",
    "",
    "Inline code still stays literal: `[2]`.",
  ].join("\n"));

  assertIncludes(html, "<em>Emphasized claim <button", "renders citation marker inside emphasis");
  assertIncludes(html, "<strong>strong claim <button", "renders citation marker inside strong text");
  assertIncludes(html, "<a href=\"https://example.com/source\"", "keeps safe Markdown links anchored");
  assertIncludes(html, "citation text <button", "renders citation marker inside safe link text");
  assertIncludes(html, "<code>[2]</code>", "keeps inline-code citation label literal in mixed inline formatting scenario");
  assertCount(html, "class=\"citation-marker\"", 3, "renders formatted citation marker buttons without appending code-only label");
}

function renderMessage(content: string) {
  return renderMessageWithCitations(content, citations);
}

function renderMessageWithCitations(content: string, messageCitations: Citation[]) {
  return renderToStaticMarkup(
    React.createElement(MessageText, {
      content,
      citations: messageCitations,
      onCitationMarkerClick: () => undefined,
    }),
  );
}

function assertIncludes(html: string, needle: string, message: string) {
  if (!html.includes(needle)) {
    fail(`${message}: expected to find ${JSON.stringify(needle)} in\n${html}`);
  }
}

function assertNotIncludes(html: string, needle: string, message: string) {
  if (html.includes(needle)) {
    fail(`${message}: expected not to find ${JSON.stringify(needle)} in\n${html}`);
  }
}

function assertCount(html: string, needle: string, expected: number, message: string) {
  const count = html.split(needle).length - 1;
  if (count !== expected) {
    fail(`${message}: expected ${expected}, found ${count} for ${JSON.stringify(needle)} in\n${html}`);
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
