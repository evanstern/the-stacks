import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

import { closeDatabase, openDatabase } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import { createCorpusRepository, type ImportJob, type Source } from "~/lib/corpus/repository";
import { allowedUploadExtensions, maxUploadBytes, uploadAdapterVersion, type AllowedUploadExtension } from "~/lib/imports/upload";
import { createManualReviewItemForSource, normalizeImportForReview } from "~/lib/review/queue.server";

export type UploadImportResult = {
  source: Source;
  importJob: ImportJob;
  duplicate: boolean;
  message: string;
  reviewItemIds: string[];
  suggestionErrors: string[];
  ocrJobIds: string[];
};

export type ImportDashboard = {
  sources: Source[];
  jobs: ImportJob[];
};

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function getUploadRoot(): string {
  return resolve(process.env.IKIS_UPLOAD_DIR ?? join(process.cwd(), "data", "uploads"));
}

function normalizeUploadName(name: string): string {
  const safeName = basename(name).replace(/[^a-zA-Z0-9._-]/g, "-");
  return safeName || "source-upload";
}

function extensionFor(filename: string): AllowedUploadExtension | null {
  const extension = extname(filename).toLowerCase();
  return allowedUploadExtensions.includes(extension as AllowedUploadExtension) ? (extension as AllowedUploadExtension) : null;
}

function adapterFor(extension: AllowedUploadExtension): string {
  return {
    ".json": "json",
    ".md": "markdown",
    ".txt": "text",
    ".epub": "epub",
    ".mobi": "mobi",
    ".pdf": "pdf",
    ".docx": "docx",
  }[extension];
}

function storageUriFor(path: string): string {
  return `file://${path}`;
}

function validateUpload(file: File): AllowedUploadExtension {
  if (file.name.trim() === "") {
    throw new UploadValidationError("Choose a source file before importing.");
  }

  const extension = extensionFor(file.name);

  if (!extension) {
    throw new UploadValidationError(`Unsupported file type. Upload one of: ${allowedUploadExtensions.join(", ")}.`);
  }

  if (file.size <= 0) {
    throw new UploadValidationError("Upload a non-empty source file.");
  }

  if (file.size > maxUploadBytes) {
    throw new UploadValidationError(`Upload must be ${Math.floor(maxUploadBytes / 1024 / 1024)} MB or smaller.`);
  }

  return extension;
}

export async function queueUploadImport(file: File): Promise<UploadImportResult> {
  const extension = validateUpload(file);
  const adapter = adapterFor(extension);
  const uploadRoot = getUploadRoot();
  const tempRoot = join(uploadRoot, "tmp");
  const sourceRoot = join(uploadRoot, "sources");
  const safeName = normalizeUploadName(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const temporaryPath = join(tempRoot, `${fileHash}-${safeName}.tmp`);
  const persistentPath = join(sourceRoot, fileHash.slice(0, 2), `${fileHash}-${safeName}`);

  await mkdir(tempRoot, { recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(temporaryPath, bytes, { flag: "w" });

  const db = openDatabase();
  let queuedSource: Source | null = null;
  let queuedImportJob: ImportJob | null = null;

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();
    const existing = corpusRepo.findSourceByIdempotencyKey({ corpusId: corpus.id, fileHash, parserAdapter: adapter });

    if (existing) {
      await rm(temporaryPath, { force: true });
      const importJob = corpusRepo.createImportJob({
        corpusId: corpus.id,
        sourceId: existing.id,
        status: "queued",
        adapter,
        adapterVersion: uploadAdapterVersion,
        warnings: ["Duplicate upload matched an existing SHA-256 source; reused persisted source bytes."],
        stats: { duplicate: true, fileHash },
      });

      queuedSource = existing;
      queuedImportJob = importJob;

      return await finalizeQueuedImport({
        source: existing,
        importJob,
        duplicate: true,
        message: `${existing.originalFilename} already exists. Queued a new import job against the existing source.`,
      });
    }

    await mkdir(join(sourceRoot, fileHash.slice(0, 2)), { recursive: true });
    await rename(temporaryPath, persistentPath);

    const source = corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash,
      sourceKind: "upload",
      originalFilename: safeName,
      mimeType: file.type || null,
      sizeBytes: file.size,
      parserAdapter: adapter,
      parserVersion: uploadAdapterVersion,
      importStatus: "queued",
      storageUri: storageUriFor(persistentPath),
      metadata: {
        allowedExtension: extension,
        originalUploadName: file.name,
        sha256: fileHash,
        uploadRoot,
      },
    });
    const importJob = corpusRepo.createImportJob({
      corpusId: corpus.id,
      sourceId: source.id,
      status: "queued",
      adapter,
      adapterVersion: uploadAdapterVersion,
      stats: { duplicate: false, fileHash, bytes: file.size },
    });

    queuedSource = source;
    queuedImportJob = importJob;

    return await finalizeQueuedImport({
      source,
      importJob,
      duplicate: false,
      message: `${source.originalFilename} uploaded and queued for import.`,
    });
  } catch (error) {
    await rm(temporaryPath, { force: true });
    if (queuedSource && queuedImportJob) {
      return await createFallbackManualReview({
        source: queuedSource,
        importJob: queuedImportJob,
        duplicate: false,
        message: `${queuedSource.originalFilename} uploaded and queued for import.`,
        error,
      });
    }

    throw error;
  } finally {
    closeDatabase(db);
  }
}

async function finalizeQueuedImport(input: Pick<UploadImportResult, "source" | "importJob" | "duplicate" | "message">): Promise<UploadImportResult> {
  try {
    const review = await normalizeImportForReview(input.importJob.id);

    return {
      ...input,
      importJob: review.importJob,
      message: review.suggestionErrors.length > 0
        ? `${input.message} Review item created; LLM suggestion failed and manual review remains available.`
        : `${input.message} Review item created for human approval.`,
      reviewItemIds: review.reviewItemIds,
      suggestionErrors: review.suggestionErrors,
      ocrJobIds: review.ocrJobIds,
    };
  } catch (error) {
    return createFallbackManualReview({ ...input, error });
  }
}

async function createFallbackManualReview(input: Pick<UploadImportResult, "source" | "importJob" | "duplicate" | "message"> & { error: unknown }): Promise<UploadImportResult> {
  const reviewItemId = createManualReviewItemForSource(input.source.id);
  const message = input.error instanceof Error ? input.error.message : "Import normalization failed.";

  return {
    ...input,
    message: `${input.message} Manual review item created because normalization or LLM suggestion failed.`,
    reviewItemIds: [reviewItemId],
    suggestionErrors: [message],
    ocrJobIds: [],
  };
}

export function getImportDashboard(): ImportDashboard {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();

    return {
      sources: corpusRepo.listSourcesForCorpus(corpus.id),
      jobs: corpusRepo.listImportJobsForCorpus(corpus.id),
    };
  } finally {
    closeDatabase(db);
  }
}
