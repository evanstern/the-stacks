import { sourceDetailPreviewChunks } from "../app/routes/records";
import type { ChunkRecord } from "../app/lib/api";

declare const process: {
  exit(code?: number): never;
};

const sourceSpecificChunks: ChunkRecord[] = [
  chunk("selected-0", "upload-selected", 0, "selected source chunk zero"),
  chunk("selected-1", "upload-selected", 1, "selected source chunk one"),
];
const globalNewestChunks = Array.from({ length: 25 }, (_, index) => chunk(`global-${index}`, "upload-other", index, `newer global chunk ${index}`));

const previewChunks = sourceDetailPreviewChunks(sourceSpecificChunks);

assertEqual(previewChunks.length, 2, "source detail uses source-specific preview count");
assertEqual(previewChunks.map((previewChunk) => previewChunk.id).join(","), "selected-0,selected-1", "source detail renders selected source previews");
assertEqual(globalNewestChunks.some((globalChunk) => previewChunks.some((previewChunk) => previewChunk.id === globalChunk.id)), false, "source detail previews are independent from global newest chunks");

function chunk(id: string, uploadId: string, chunkIndex: number, content: string): ChunkRecord {
  return {
    id,
    upload_id: uploadId,
    ingestion_job_id: `job-${uploadId}`,
    chunk_index: chunkIndex,
    content,
    metadata: {},
    created_at: "2026-06-04T00:00:00Z",
  };
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
