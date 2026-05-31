import type { JsonValue } from "../../../db/rows.js";
import { decodeUtf8 } from "../shared.js";
import type { ImportWarning, NormalizedDocument } from "../types.js";
import { normalizeMediaWikiTitle } from "./normalize.js";
import { normalizeMediaWikiPage } from "./page.js";
import type {
  MediaWikiDecision,
  MediaWikiDecisionState,
  MediaWikiImportCounts,
  MediaWikiManifestImportInput,
  MediaWikiManifestImportResult,
} from "./types.js";

type ManifestDecisionEntry = {
  title: string;
  reason?: string;
  rationale?: string;
};

type ApprovalManifest = {
  policy?: JsonValue;
  approved: ManifestDecisionEntry[];
  rejected: ManifestDecisionEntry[];
  deferred: ManifestDecisionEntry[];
};

function parseManifest(input: MediaWikiManifestImportInput): ApprovalManifest {
  const rawText = decodeUtf8(input.manifest.bytes);

  let value: unknown;
  try {
    value = JSON.parse(rawText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Malformed MediaWiki approval manifest JSON in ${input.manifest.filename}: ${message}`);
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid MediaWiki approval manifest in ${input.manifest.filename}: expected an object.`);
  }

  const record = value as Record<string, unknown>;
  for (const state of ["approved", "rejected", "deferred"] as const) {
    if (!Array.isArray(record[state])) {
      throw new Error(`Invalid MediaWiki approval manifest in ${input.manifest.filename}: ${state} must be an array.`);
    }

    for (const [index, entry] of record[state].entries()) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry) || typeof (entry as Record<string, unknown>).title !== "string") {
        throw new Error(`Invalid MediaWiki approval manifest in ${input.manifest.filename}: ${state}[${index}] must include a title string.`);
      }
    }
  }

  return {
    policy: (record.policy as JsonValue | undefined) ?? {},
    approved: record.approved as ManifestDecisionEntry[],
    rejected: record.rejected as ManifestDecisionEntry[],
    deferred: record.deferred as ManifestDecisionEntry[],
  };
}

function decisionId(state: MediaWikiDecisionState, normalizedTitle: string): string {
  return `mediawiki-decision-${state}-${normalizedTitle.replace(/\s+/g, "-")}`;
}

function rationaleFor(entry: ManifestDecisionEntry): string | null {
  return entry.rationale ?? entry.reason ?? null;
}

function buildDecision(
  state: MediaWikiDecisionState,
  entry: ManifestDecisionEntry,
  document: NormalizedDocument | undefined,
): MediaWikiDecision {
  const normalizedTitle = normalizeMediaWikiTitle(entry.title);
  return {
    id: decisionId(state, normalizedTitle),
    state,
    title: entry.title,
    normalizedTitle,
    rationale: rationaleFor(entry),
    targetDocumentId: document?.id ?? null,
    metadata: {
      source: "mediawiki-approval-manifest",
      reason: entry.reason ?? null,
      rationale: entry.rationale ?? null,
    },
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export async function importMediaWikiApprovalManifest(input: MediaWikiManifestImportInput): Promise<MediaWikiManifestImportResult> {
  const manifest = parseManifest(input);
  const warnings: ImportWarning[] = [];
  const pageDocuments = input.pages.map((page) => normalizeMediaWikiPage({ ...page, sourceId: input.sourceId }));
  const documentsByTitle = new Map(pageDocuments.map((document) => [normalizeMediaWikiTitle(document.title), document]));
  const importedDocuments: NormalizedDocument[] = [];
  const decisions: MediaWikiDecision[] = [];
  let missing = 0;

  for (const entry of manifest.approved) {
    const document = documentsByTitle.get(normalizeMediaWikiTitle(entry.title));
    decisions.push(buildDecision("approved", entry, document));

    if (document) {
      importedDocuments.push(document);
      continue;
    }

    missing += 1;
    const message = `Missing approved page artifact for ${entry.title}.`;
    if (input.strict) {
      throw new Error(`missing approved page: ${entry.title}`);
    }

    warnings.push({
      code: "missing-approved-page",
      message,
      metadata: { title: entry.title, normalizedTitle: normalizeMediaWikiTitle(entry.title) },
    });
  }

  for (const entry of manifest.rejected) {
    decisions.push(buildDecision("rejected", entry, documentsByTitle.get(normalizeMediaWikiTitle(entry.title))));
  }

  for (const entry of manifest.deferred) {
    decisions.push(buildDecision("deferred", entry, documentsByTitle.get(normalizeMediaWikiTitle(entry.title))));
  }

  const documents = dedupeById(importedDocuments);
  const dedupedDecisions = dedupeById(decisions);
  const counts: MediaWikiImportCounts = {
    approved: manifest.approved.length,
    rejected: manifest.rejected.length,
    deferred: manifest.deferred.length,
    pages: documents.length,
    missing,
  };

  return {
    documents,
    decisions: dedupedDecisions,
    policy: manifest.policy ?? {},
    counts,
    warnings,
    upserts: {
      documentKeys: documents.map((document) => document.id),
      decisionKeys: dedupedDecisions.map((decision) => decision.id),
    },
  };
}
