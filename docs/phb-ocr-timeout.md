# Player's Handbook OCR Timeout

Current failed import:

- Import job: `import_f998b280-65a2-4e75-a715-4493e7d2609e`
- Source: `source_f0f658df-e161-4c51-83b8-9608a28d8cee`
- File: `Player-s-Handbook.pdf`
- Current status: `ocr_failed`
- Current error: `ocrmypdf timed out after 600000ms for local PDF OCR.`

## Cause

The file is a large scanned PDF, approximately 293 pages, with no useful text
layer. Earlier failures were environment and path issues: OCR tools missing on
the host, Docker-visible file path mismatch, and a shorter Poppler timeout. Those
were resolved by running the app and worker in Docker with the upload directory
mounted at `/app/data`.

The remaining failure is operational: whole-PDF OCR with `ocrmypdf` exceeds the
current 10 minute command timeout. This is expected for a large scanned book.
Raising the timeout may work, but it keeps the job opaque and expensive.

## Recommendation

Do not make whole-PDF `ocrmypdf` the only path for large scans. Add a page-batch
OCR mode that records progress events between batches.

Recommended shape:

1. Detect page count before OCR.
2. For large scanned PDFs, split work into page ranges.
3. OCR each range independently.
4. Persist `import_job_events` after each batch with page range, elapsed time,
   extracted page count, warnings, and progress percent.
5. Merge recognized pages into the existing normalized PDF OCR document path.
6. Allow retry from the last completed batch instead of restarting the whole
   book.

## Viable Short-Term Options

- Increase `IKIS_OCR_COMMAND_TIMEOUT_MS` beyond 600000 for a one-off manual
  retry. This is simplest but still opaque and may tie up the worker for a long
  time.
- Pre-OCR the PDF outside Ikis, then upload the OCRed/searchable version. This is
  practical for the current PHB source if immediate corpus availability matters.
- Requeue a smaller scanned PDF first to validate the new event log and worker
  visibility before retrying the 293-page file.

## Longer-Term Options

- Implement page-batched local OCR with resumable progress.
- Add Docling or another layout-aware extractor as an alternate path for scanned
  books, but keep review approval as the gate.
- Add an optional external OCR provider only behind the same import event and
  normalized document contracts.

## Operational Rule

Large OCR jobs must be observable. A worker should never spend many minutes on a
single PDF without durable progress rows that the import detail page can show.
