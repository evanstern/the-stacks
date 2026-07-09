# Module 5: The Honest Front Door

Write to: `modules/05-honest-front-door.html` — `<section class="module" id="module-5">` only.

## AUDIENCE OVERRIDE (course-wide)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use here:
`zero residue` ("a refusal that leaves NO trace — no row, no job, no partial state, SC-005"),
`content fingerprint` ("sha256 of the uploaded bytes — dedupe by WHAT was uploaded, never by
filename, FR-003"), `DomainError class` ("one of four typed failure categories —
`unknown_thing`/`unsupported_type`/`dependency_down`/`internal_fault` — mapped to HTTP only
at the API boundary, never chosen by the code that throws it"), `scrubbed` ("the
operator-visible copy of an error strips internals; full diagnostics stay in the append-only
event trail, Principle IV").

## Teaching Arc
- **Metaphor:** A bouncer with a clipboard, not a shredder. Refused guests leave exactly as
  they arrived — nothing torn up, nothing left on the floor. Every refusal is also WRITTEN
  DOWN (why, precisely) before the door closes.
- **Opening hook:** "Upload a PDF. Upload a 30MB file. Upload the same file twice. All three
  get an honest, typed answer in milliseconds — and after all three, `SELECT count(*) FROM
  sources` reads exactly the same as before you tried."
- **Key insight:** Refusing something and reporting it honestly are the SAME code path, not
  two features. Every 415 in this system fires before a single row is written; duplicate
  detection isn't a separate check bolted on — it falls out of a UNIQUE constraint on
  `(corpus_id, fingerprint)` doing an optimistic insert, so there's no separate
  check-then-insert race to get wrong.
- **Why should I care?:** "Refuse cleanly" and "detect duplicates" are two of the most
  commonly half-built features in real intake systems (residue on 415s, filename-based
  dedupe that misses renamed re-uploads). This module is the reference shape for both, with
  real proof it holds.

## Canonical vocabulary (use identically everywhere in this module)
`sniff (magic bytes)` → `size-cap (in-stream)` → `fingerprint (sha256)` → `optimistic
insert` → `conflict = duplicate` (never a separate lookup)

## Screens (5)
1. Hook + the three real refusals (HERO: three side-by-side "receipt" cards showing the
   REAL responses from this cycle's live validation — PDF 415, oversized 415, duplicate 200
   — each stamped "residue: zero rows changed").
2. Code↔English on Snippet A (`sniffMediaType`) — magic bytes over declared type. Callout
   ("aha!"): *a `.html` file that's really a PNG isn't "trusted and then caught later" — it
   fails detection at the very first byte check, before the client's own Content-Type header
   is ever consulted.*
3. Code↔English on Snippet B (the dedupe insert) — no check-then-insert. Callout: *"does
   this already exist?" and "create it" are the SAME statement here — `ON CONFLICT` turns a
   race condition that would need its own bug report into a database guarantee.*
4. The real error taxonomy, using Scenario 2's REAL scrubbed error (Snippet C) — walk what's
   IN the scrubbed copy (class, stage, message) vs. what stays operator-side (full
   diagnostics in the event detail). Callout: *the operator sees "why," never a stack trace.*
5. Quiz + handoff to Module 6: "Every rule in this module was proven correct by tests before
   it ever ran for real. Module 6 is what slipped through anyway."

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `packages/ingestion/src/sniff.ts` (lines 52-78, the sniff function)
```ts
export function sniffMediaType(filename: string, bytes: Uint8Array): SniffResult | null {
  const extension = extensionOf(filename);

  if (hasMagic(bytes, ZIP_MAGIC)) {
    // A ZIP is a ZIP whatever it is named — but only the .zip extension is an
    // intended batch; a renamed one is a mismatch the caller refuses.
    return extension === "zip" ? { mediaType: "application/zip" } : null;
  }

  const binary = looksBinary(bytes);
  if (binary) return null; // renamed binary or genuinely unsupported (e.g. PDF)

  switch (extension) {
    case "html":
    case "htm":
      return { mediaType: "text/html" };
    case "md":
    case "markdown":
      return { mediaType: "text/markdown" };
    case "txt":
      return { mediaType: "text/plain" };
    case "zip":
      return null; // .zip extension without ZIP magic: a renamed non-zip
    default:
      return null;
  }
}
```

**Snippet B** — File: `packages/ingestion/src/admit.ts` (lines 33-68, dedupe via optimistic
insert — quote through the conflict-branch return)
```ts
export async function admitSource(db: Database, input: AdmitSourceInput): Promise<AdmitSourceResult> {
  const fingerprint = deriveArchiveFingerprint(input.bytes);

  return db.transaction(async (tx) => {
    // Content-addressed: same bytes, same row — re-insert is a no-op (R1).
    await tx
      .insert(sourceArchives)
      .values({
        fingerprint,
        bytes: input.bytes,
        byteSize: input.bytes.length,
        mediaType: input.mediaType,
      })
      .onConflictDoNothing();

    const inserted = await tx
      .insert(sources)
      .values({
        corpusId: input.corpusId,
        batchId: input.batchId,
        fingerprint,
        originalFilename: input.filename,
      })
      .onConflictDoNothing({ target: [sources.corpusId, sources.fingerprint] })
      .returning();

    const source = inserted[0];
    if (!source) {
      // Conflict = this corpus already has this CONTENT (filename is never
      // identity). Answer with the existing source's ticket (FR-003).
      const [existing] = await tx
        .select()
        .from(sources)
        .where(and(sql`${sources.corpusId} = ${input.corpusId}`, sql`${sources.fingerprint} = ${fingerprint}`));
      return { source: existing!, duplicate: true };
    }
```

**Snippet C** — the REAL scrubbed failure, verbatim from this cycle's live validation
(Scenario 2, ticket `5cffc3a1-29ef-4d0e-9e0f-aacb8493dc4a`, uploading `truncated.html`):
```json
{
  "class": "unsupported_type",
  "stage": "detect",
  "message": "No registered ingester recognizes \"truncated.html\" (text/html)."
}
```

## Interactive Elements
- [x] **Three-card refusal HERO (screen 1)** — PDF (415, `unsupported_type`), oversized
  (415, size-limit message), duplicate (200, `duplicate:true`, same ticket id) — each card
  stamped with the REAL residue-check result: row counts unchanged.
- [x] **Code↔English translations** — Snippets A and B.
- [x] **Callout boxes** — as scripted in Screens #2, #3, #4.
- [x] **Quiz** — 3 questions:
  1. "A file is named `report.html` but its first four bytes are PNG magic bytes. What does
     `sniffMediaType` return, and why does that matter more than checking the extension
     alone?" (`null` — `looksBinary` catches it before the extension switch ever runs; this
     is exactly the renamed-binary edge case, caught at the byte level, not the filename
     level.)
  2. "Two requests upload the identical file at the exact same instant. Is there a race
     where both could create a new source row?" (No — `onConflictDoNothing` with the
     `(corpus_id, fingerprint)` target makes the DB itself the arbiter; whichever commits
     first wins the insert, the second's `inserted[0]` is undefined and it takes the
     duplicate branch.)
  3. "Snippet C's `message` says exactly which file and media type failed. Is that safe to
     show an operator?" (Yes — it's already the SCRUBBED copy; nothing here is a stack
     trace, a file path, or a secret. Full diagnostics, if any existed, would live in the
     event trail's `detail`, operator-side only.)
- [x] **Glossary tooltips** — the four domain terms from the AUDIENCE OVERRIDE.

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/interactive-elements.md` → "Code ↔ English Translation", "Multiple-Choice
  Quiz", "Callout Boxes", "Glossary Tooltips", "Pattern/Feature Cards" (for the three-card
  HERO).

## Connections
- **Previous:** Module 4 "Generation-Flip" — the same DomainError vocabulary this module's
  refusals are expressed in.
- **Next:** Module 6 "The Bug Ledger" — this closes the course.
- **Tone/style:** amber/warm accent (a "front door" module gets a distinct warning-adjacent
  color from the blue/violet of Modules 1-4); the real ticket ids and the exact JSON in
  Snippet C are from this cycle's live validation — use them verbatim.
