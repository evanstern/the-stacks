/**
 * The NORMALIZED DOCUMENT — the pivotal contract of the ingestion design
 * (008 FR-017/FR-018, contracts/normalized-document.md). Whatever a source
 * looked like on the way in, past the transform stage the pipeline sees
 * exactly this shape: ordered classified sections, citation anchors, and
 * sanitized display artifacts. Plugins produce it; chunking, indexing, the
 * future archive viewer, and citation deep-links (Principle III) all consume it.
 *
 * Versioning is semver and load-bearing: every source records the
 * contract_version its current generation was produced under, so a MAJOR bump
 * can enumerate re-ingestion candidates exactly like a plugin bump (FR-016).
 * Adding an optional field or SectionKind = MINOR; changing anchor semantics
 * or removing/renaming fields = MAJOR.
 */
import { isDeepStrictEqual } from "node:util";

export const NORMALIZED_DOCUMENT_VERSION = "1.0.0";

// ATOMIC kinds are the chunker's do-not-split set (research R4, SC-009):
// a stat block torn across two chunks is retrieval poison — half a monster.
// Plugins MUST prefer "unclassified" over guessing; a wrong "prose" merely
// chunks suboptimally, a wrong "stat_block" pins the chunker to a lie.
export const SECTION_KINDS = [
  "prose",
  "stat_block",
  "table",
  "spell_entry",
  "unclassified",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const ATOMIC_KINDS: readonly SectionKind[] = ["stat_block", "table", "spell_entry"];

export interface Anchor {
  /** Which DisplayArtifact contains this section — the deep-link target. */
  artifactId: string;
  /** Stable id stamped into the sanitized HTML (data-stacks-anchor="s42"). */
  elementId?: string;
  /** [charStart, charEnd) into the artifact's TEXT content (tags stripped) —
   * the fallback when element granularity is too coarse. */
  charStart: number;
  charEnd: number;
}

export interface Section {
  /** 0-based document order; MUST be contiguous (invariant 1). */
  index: number;
  /** Heading trail from document root, e.g. ["Chapter 3", "Goblin"]. */
  path: string[];
  kind: SectionKind;
  heading?: string;
  /** Extracted plain text; non-empty after trimming (invariant 2). */
  content: string;
  anchor: Anchor;
}

export interface DisplayArtifact {
  /** Unique within the document (anchors resolve against it, invariant 3). */
  id: string;
  /** v1: sanitized HTML only. Extending is a MINOR bump. */
  kind: "html";
  /** sanitize-html output, allowlist-only — VALIDATED here, never trusted. */
  content: string;
  title?: string;
}

export interface NormalizedDocument {
  /** Equals NORMALIZED_DOCUMENT_VERSION at produce time. */
  contractVersion: string;
  /** Best-effort document title; never empty. */
  title: string;
  /** BCP-47 hint when the plugin knows it. */
  language?: string;
  /** Ordered. MAY be empty — the pipeline then records the source as `empty`
   * (an honest outcome), never `ingested` with zero chunks (invariant 6). */
  sections: Section[];
  artifacts: DisplayArtifact[];
  /** Non-fatal extraction notes, operator-readable. */
  warnings: string[];
}

// The sanitization guard is deliberately lexical and blunt (same spirit as
// scripts/check-boundaries.mjs): it cannot prove HTML safe, but it FAILS the
// obvious ways sanitize-html output could have been bypassed — script/embed
// vectors, event handlers, javascript: URLs, and external resource loads.
// <a href="https://..."> is allowed: navigation is not a resource load.
const FORBIDDEN_HTML_PATTERNS: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /<\s*(script|iframe|object|embed|link|meta|form)\b/i, why: "forbidden element" },
  { pattern: /\son\w+\s*=/i, why: "inline event handler" },
  { pattern: /javascript:/i, why: "javascript: URL" },
  { pattern: /\ssrc\s*=\s*["']?(https?:)?\/\//i, why: "external resource load (src)" },
];

/** Tag-stripped text of an artifact — what Anchor char offsets index into. */
export function artifactTextContent(artifact: DisplayArtifact): string {
  return artifact.content.replace(/<[^>]*>/g, "");
}

/**
 * Validates a document against the seven contract invariants
 * (contracts/normalized-document.md). Returns violation strings; empty means
 * valid. A list (not a throw) so the conformance suite and the pipeline's
 * transform stage can both report ALL problems at once — a plugin author
 * fixing invariants one re-run at a time would hate us.
 */
export function validateNormalizedDocument(doc: NormalizedDocument): string[] {
  const violations: string[] = [];

  if (doc.contractVersion !== NORMALIZED_DOCUMENT_VERSION) {
    violations.push(
      `contractVersion "${doc.contractVersion}" != current "${NORMALIZED_DOCUMENT_VERSION}"`,
    );
  }
  if (doc.title.trim().length === 0) {
    violations.push("title must be non-empty");
  }

  const artifactsById = new Map<string, DisplayArtifact>();
  for (const artifact of doc.artifacts) {
    if (artifactsById.has(artifact.id)) {
      violations.push(`duplicate artifact id "${artifact.id}"`);
    }
    artifactsById.set(artifact.id, artifact);
    for (const { pattern, why } of FORBIDDEN_HTML_PATTERNS) {
      if (pattern.test(artifact.content)) {
        violations.push(`artifact "${artifact.id}": ${why} (invariant 5)`);
      }
    }
  }

  doc.sections.forEach((section, i) => {
    // Invariant 1: contiguous, ordered.
    if (section.index !== i) {
      violations.push(`sections[${i}].index is ${section.index}, expected ${i} (invariant 1)`);
    }
    // Invariant 2: no empty sections — omit them instead.
    if (section.content.trim().length === 0) {
      violations.push(`sections[${i}] has empty content (invariant 2)`);
    }
    if (!SECTION_KINDS.includes(section.kind)) {
      violations.push(`sections[${i}] has unknown kind "${section.kind}"`);
    }
    // Invariant 3: every anchor resolves.
    const artifact = artifactsById.get(section.anchor.artifactId);
    if (!artifact) {
      violations.push(
        `sections[${i}].anchor.artifactId "${section.anchor.artifactId}" resolves to no artifact (invariant 3)`,
      );
      return;
    }
    // Invariant 4: char range sane and inside the artifact's text content.
    const { charStart, charEnd } = section.anchor;
    const textLength = artifactTextContent(artifact).length;
    if (!(charStart >= 0 && charStart < charEnd && charEnd <= textLength)) {
      violations.push(
        `sections[${i}].anchor range [${charStart}, ${charEnd}) invalid for artifact text length ${textLength} (invariant 4)`,
      );
    }
  });

  // Invariant 7: pure data — a plugin's output must survive persist/replay.
  // JSON round-trip drops functions/undefined/class instances; deep-comparing
  // the round-trip against the original catches all of them at once.
  try {
    const roundTripped: unknown = JSON.parse(JSON.stringify(doc));
    if (!isDeepStrictEqual(roundTripped, doc)) {
      violations.push("document is not JSON-serializable data (invariant 7)");
    }
  } catch {
    violations.push("document is not JSON-serializable data (invariant 7)");
  }

  return violations;
}
