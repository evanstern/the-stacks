# Module 5: Versions & Vaults

Write file: `modules/05-versions-and-vaults.html` containing ONLY `<section class="module" id="module-5">…</section>`. No `<html>`, `<head>`, `<body>`, `<style>`, or `<script>` tags.

## Course-wide context (applies to every module)

**The app being taught:** "The Stacks" is a self-hosted web app for tabletop RPG (TTRPG) game masters. The operator uploads rulebooks and notes, then asks questions in chat; answers cite exact uploaded passages. Tech: React web app, Python FastAPI backend, background worker, Postgres, Qdrant (vector database), OpenAI.

**Learner:** a "vibe coder" — zero CS background. Tooltip every technical term aggressively. Tone: smart friend.

**Consistent actor set:** Web app 🖥️, API 🚪, Worker 🛠️, Postgres 🗃️, Qdrant 🧭, OpenAI 🤖.

**Course title:** "Inside The Stacks". Accent: amber/gold (pre-configured).

## Teaching Arc

- **Metaphor:** A museum that never renovates the open gallery. A new exhibition is built in a **sealed wing** with its own storage rooms and its own catalog. Every arriving crate is checked against the **shipping manifest** — wax-seal fingerprints (SHA-256 hashes) and exact piece counts. Only when the wing passes inspection does staff move the "Now Showing →" sign. Demolition? First a walkthrough with a printed checklist (dry run), then a signed work order where you must *write the wing's name* — and the open gallery can never, ever be demolished.
- **Opening hook:** "How do you replace an app's entire knowledge base while people are using it — and be certain you can't destroy the one that's live? This codebase's answer is its most professional habit."
- **Key insight:** Isolation + verification + refusal. Each "runtime version" is a complete sealed world (own database, own Qdrant collection, own folders); a hash-locked manifest proves the right bytes went in and the right counts came out; and one tiny pointer decides what's live. Destructive operations are dry-run first, demand explicit confirmation, and flatly refuse to touch the active version.
- **Why should I care:** These are the exact patterns to *demand* from an AI assistant for anything scary: "make it dry-run first," "require typing the name to confirm," "refuse if it's the live one." You now know their names.

## Screens (suggested, 5)

1. **The sealed wing.** Metaphor + the isolation idea. Visual: two side-by-side "wings" (live vs. under construction), each containing its own mini Postgres 🗃️ + Qdrant 🧭 + folder icons, with a "Now Showing →" pointer aimed at the live one.
2. **One world, derived from one name.** Code↔English: snippet A (namespace derivation). Aha: names aren't invented ad hoc — database name, collection name, and folders are all *calculated* from the version's ID, so two versions can never collide by accident.
3. **The shipping manifest.** The 5-step ritual as numbered step cards: **preflight** (rehearse all the safety guards on a throwaway in-memory database) → **lock** (record every book's SHA-256 fingerprint + exact expected counts of chunks/rows) → **seed** (ingest for real) → **verify** (recount everything against the manifest) → **activate** (move the sign). Code↔English: snippet B (the hash check). Callout: one changed byte in an archive = a different fingerprint = the whole operation stops *before* anything mutates.
4. **The refusals.** Code↔English: snippet C (activation guard) + snippet D (never demolish the open gallery) + snippet E (the dry-run gate). Optional bonus in prose: corpus reset even requires `--confirm-version <name>` — you must literally type the name of the thing you're destroying, and it re-checks the vault copy's fingerprint mid-operation (aborts if the immutable archive changed).
5. **Drag-and-drop + quiz.** Match each guardrail to the disaster it prevents (see below), then the quiz.

## Code Snippets (pre-extracted — use verbatim, never edit)

### Snippet A — a whole isolated world, derived from one ID
File: `apps/api/app/version_lifecycle.py` (lines 136–148) — Python

```python
    token = _namespace_token(version_id)
    database_name = f"{VERSION_NAMESPACE_PREFIX}_{token}"[:63]
    base_database_url = database_url or settings.database_url
    return VersionNamespaces(
        version_id=version_id,
        database_name=database_name,
        database_url=_replace_database_name(base_database_url, database_name),
        qdrant_collection=f"{settings.qdrant_collection}_{token}",
        upload_prefix=f"versions/{token}/uploads",
        static_prefix=f"versions/{token}/static",
        runtime_prefix=f"versions/{token}/runtime",
        storage_prefix=f"versions/{token}",
    )
```

Teaching notes: one `token` → its own database, its own Qdrant collection, its own three folders. Nothing shared with any other version.

### Snippet B — checking wax seals on every crate
File: `apps/api/app/corpus_manifest.py` (lines 131–139) — Python

```python
def validate_manifest_archives(manifest: CorpusManifest, archive_root: Path) -> None:
    for source in manifest.sources:
        archive_path = archive_root / source.filename
        if not archive_path.is_file():
            raise CorpusManifestError(f"Archive for source {source.source_id} is missing: {source.filename}")
        if source.sha256 is not None:
            actual_sha256 = hashlib.sha256(archive_path.read_bytes()).hexdigest()
            if actual_sha256 != source.sha256:
                raise CorpusManifestError(f"Archive hash mismatch for source {source.source_id}")
```

Teaching notes: `hashlib.sha256(...)` recomputes the file's fingerprint from its actual bytes and compares it to the manifest. Missing file or mismatched seal → stop everything.

### Snippet C — the velvet rope at activation
File: `apps/api/app/version_lifecycle.py` (lines 274–280) — Python

```python
    version = db.get(RuntimeVersion, runtime_version_id)
    if version is None:
        raise ValueError("Runtime version does not exist")
    if version.status != VERSION_STATUS_READY:
        raise ValueError("Only ready runtime versions can be activated")
    if _is_teardown_locked(db, runtime_version_id):
        raise ValueError("Runtime version is teardown-locked and cannot be activated")
```

Teaching notes: three bouncer checks before the "Now Showing" sign moves: the wing exists, it passed inspection (`ready`), and it isn't scheduled for demolition.

### Snippet D — you cannot demolish the open gallery
File: `apps/api/app/version_lifecycle.py` (lines 533–536) — Python

```python
def _refuse_active_version(db: Session, runtime_version_id: str) -> None:
    pointer = db.get(ActiveVersionPointer, DEFAULT_ACTIVE_POINTER_NAME)
    if pointer is not None and pointer.runtime_version_id == runtime_version_id:
        raise ValueError("Active runtime version cannot be torn down")
```

Teaching notes: four lines that make a whole class of catastrophe impossible. The live pointer is checked; match = refusal, no exceptions.

### Snippet E — the walkthrough before the wrecking ball
File: `apps/api/app/version_lifecycle.py` (lines 426–435) — Python

```python
        if not confirm:
            _record_lifecycle_event(
                db=self.db,
                runtime_version_id=runtime_version_id,
                event_type=VERSION_EVENT_TEARDOWN_DRY_RUN,
                message="Runtime version teardown dry-run manifest generated",
                metadata={"manifest": asdict(manifest), "confirmation_required": True},
            )
            self.db.flush()
            return TeardownResult(version=version, manifest=manifest, completed_steps=[], skipped_steps=[])
```

Teaching notes: without explicit `confirm=True`, teardown produces only a *report of what it would delete* — and even the rehearsal is written into the permanent event log.

## Interactive Elements

- [x] **Code↔English translations** — snippets A–E above (C+D can share one screen).
- [x] **Drag-and-drop matching** — drag the guardrail onto the disaster it prevents:
  - "SHA-256 lock manifest" → "A book file was swapped/corrupted and would poison the index"
  - "Own database + collection per version" → "Building the new library corrupts the live one"
  - "Refuse to tear down the active version" → "Oops — deleted what users are using right now"
  - "Dry-run first, then confirm" → "A destructive command ran before anyone saw what it would do"
  - "Only `ready` versions can be activated" → "A half-built library goes live"
- [x] **Quiz** — 3 questions, safety-reasoning style:
  1. (Scenario) "`make corpus-verify` fails with a count mismatch: expected 4,812 chunks, found 4,790. What does that MEAN, and what does the system do?" → ingestion didn't finish (or the lock is stale); the version stays un-activated — a broken library can't quietly go live.
  2. (Steering) "You ask an AI to write a script that deletes old user accounts. Using this module, name two requirements you should add to the request." → dry-run mode that prints what it would delete; explicit confirmation (ideally typing a name); refuse currently-active/logged-in accounts; write an audit log. Any two.
  3. (Architecture) "Why does each version get its own Qdrant collection instead of tagging vectors with a version label inside one big collection?" → isolation is structural, not disciplinary: no query can ever accidentally cross versions, and deleting a version is dropping a collection, not a risky filtered cleanup.
- [x] **Glossary tooltips** — hash/SHA-256, manifest, dry run, provision, namespace, collection (Qdrant), pointer, immutable, audit log, lifecycle, teardown, `make` target/CLI, in-memory database, blue-green deployment (the industry name for this swap trick — worth naming!).
- [ ] Group chat / data flow — NO (covered by other modules; the drag-and-drop + step cards are this module's interactive heroes).

## Reference Files to Read

- `references/content-philosophy.md` — all
- `references/gotchas.md` — all
- `references/interactive-elements.md` → sections: "Code ↔ English Translation Blocks", "Multiple-Choice Quizzes", "Drag-and-Drop Matching", "Numbered Step Cards", "Callout Boxes", "Glossary Tooltips"
- `references/design-system.md` → "Module Structure"

## Connections

- **Previous module:** Module 4 "Answers with Receipts" — one question, one search, strict evidence. It bridges out with "how the app swaps an entire library without anyone noticing."
- **Next module:** Module 6 "When Things Break" — the audit trails, error handling, and debugging playbook. Bridge: "Guardrails prevent disasters. But ordinary things still break daily — next, how this app makes breakage easy to diagnose."
- **Tone/style:** ≤3 sentences per text block, ≥50% visual. This module is the "professional engineering habits" high point — let the refusal snippets land with weight.
