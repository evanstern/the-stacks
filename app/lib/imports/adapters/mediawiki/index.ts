export { importMediaWikiApprovalManifest } from "./manifest.js";
export { normalizeMediaWikiTitle, titleLookupCandidates } from "./normalize.js";
export { mediaWikiPageImportAdapter, normalizeMediaWikiPage } from "./page.js";
export type {
  MediaWikiDecision,
  MediaWikiDecisionState,
  MediaWikiImportCounts,
  MediaWikiManifestImportInput,
  MediaWikiManifestImportResult,
  MediaWikiPageArtifact,
  MediaWikiPageJson,
} from "./types.js";
