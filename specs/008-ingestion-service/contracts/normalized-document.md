# Contract: Normalized Document (v1.0.0)

**The pivotal contract of the ingestion design (FR-017/FR-018).** Produced by plugins,
consumed by everything downstream (chunking, indexing, the future archive viewer and
citation deep-links). Lives in `@stacks/ingestion-contract` as
`NORMALIZED_DOCUMENT_VERSION = "1.0.0"` plus the types below. Whatever the source looked
like, past the transform stage the pipeline sees exactly this shape.

**Versioning**: semver. Adding an optional field or a new section `kind` = MINOR;
changing anchor semantics or removing/renaming fields = MAJOR. Every source records the
`contract_version` its current generation was produced under (data-model.md), so a MAJOR
bump can enumerate re-ingestion candidates the same way a plugin bump can (FR-016).

## Shape

```ts
interface NormalizedDocument {
  contractVersion: string;          // = NORMALIZED_DOCUMENT_VERSION at produce time
  title: string;                    // best-effort document title, never empty
  language?: string;                // BCP-47 hint when the plugin knows it
  sections: Section[];              // ordered; MAY be empty (=> honest "empty" outcome)
  artifacts: DisplayArtifact[];     // sanitized fragments for the archive viewer
  warnings: string[];               // non-fatal extraction notes, operator-readable
}

interface Section {
  index: number;                    // 0-based document order; contiguous
  path: string[];                   // heading trail from root, e.g. ["Ch. 3", "Goblin"]
  kind: SectionKind;
  heading?: string;                 // this section's own heading, if any
  content: string;                  // extracted plain text, non-empty, trimmed
  anchor: Anchor;                   // where this text lives in the display artifact
}

type SectionKind =
  | "prose"        // running text
  | "stat_block"   // ATOMIC: creature/NPC stat block — never split by chunking
  | "table"        // ATOMIC: tabular data incl. its caption
  | "spell_entry"  // ATOMIC: a complete spell description
  | "unclassified";// plugin could not classify — the honest default
// ATOMIC kinds are the chunker's do-not-split set (research R4). Growing this
// vocabulary is a MINOR bump; plugins MUST use "unclassified" over guessing.

interface Anchor {
  artifactId: string;               // which DisplayArtifact contains this section
  elementId?: string;               // stable id stamped into the sanitized HTML
  charStart: number;                // [charStart, charEnd) into Section.content's
  charEnd: number;                  //   position within the artifact's text content
}

interface DisplayArtifact {
  id: string;                       // unique within the document
  kind: "html";                     // v1: sanitized HTML only; MINOR to extend
  content: string;                  // sanitize-html output, allowlist-only (R2)
  title?: string;
}
```

## Anchor semantics (the citation deep-link foundation, Principle III)

- The **display artifact is the deep-link target**, not the raw archive bytes: raw
  saved HTML is unsafe to render, so the viewer will always render the sanitized
  artifact, and anchors must therefore point into it.
- Plugins stamp `elementId` (`data-stacks-anchor="s42"`) onto the sanitized element
  nearest the section's start during transform; `charStart/charEnd` cover the section's
  text within the artifact's text content as a fallback when element granularity is too
  coarse (e.g., several sections in one `<div>`).
- Anchors MUST remain valid for the lifetime of the generation that produced them:
  artifact content and sections are written together, replaced together (generation
  flip, research R8), and never edited in place.

## Invariants (enforced by the conformance suite — contracts/plugin-contract.md)

1. `sections[i].index === i` (contiguous, ordered).
2. Every `content` is non-empty after trimming; empty extraction ⇒ omit the section.
3. Every `anchor.artifactId` resolves to an artifact in `artifacts`.
4. `0 <= charStart < charEnd <= artifact text length`.
5. Artifacts contain only allowlisted HTML (no scripts, no event handlers, no external
   resource loads) — validated, not trusted.
6. `sections` empty ⇒ the pipeline records the source as `empty` (honest outcome), never
   as `ingested` with zero chunks.
7. The document is pure data: no functions, no lazy handles, JSON-serializable — a
   plugin's output can be persisted, diffed, and replayed.
