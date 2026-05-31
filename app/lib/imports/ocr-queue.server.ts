import { Socket } from "node:net";

import { closeDatabase, openDatabase } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import { createCorpusRepository } from "~/lib/corpus/repository";

export type OcrQueuePayload = {
  jobId: string;
  sourceId: string;
  attempts: number;
  enqueuedAt: string;
};

export type OcrQueueTransport = {
  enqueue(payload: OcrQueuePayload): Promise<void>;
  dequeue(timeoutSeconds?: number): Promise<OcrQueuePayload | null>;
  close?(): Promise<void> | void;
};

export type EnqueueOcrJobResult = {
  enqueued: boolean;
  skippedReason?: string;
};

const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379/0";
const DEFAULT_QUEUE_NAME = "ikis:ocr:jobs";

function queueName(env: NodeJS.ProcessEnv = process.env): string {
  return env.IKIS_OCR_QUEUE_NAME?.trim() || DEFAULT_QUEUE_NAME;
}

function redisUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.REDIS_URL?.trim() || DEFAULT_REDIS_URL;
}

function encodeCommand(parts: string[]): string {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join("")}`;
}

function parseSimpleResp(buffer: string): unknown {
  if (buffer.startsWith("-")) {
    throw new Error(buffer.slice(1).split("\r\n")[0] || "Redis command failed.");
  }

  if (buffer.startsWith("+")) {
    return buffer.slice(1).split("\r\n")[0] ?? "";
  }

  if (buffer.startsWith(":")) {
    return Number(buffer.slice(1).split("\r\n")[0] ?? "0");
  }

  if (buffer.startsWith("$-1")) {
    return null;
  }

  if (buffer.startsWith("$")) {
    const lineEnd = buffer.indexOf("\r\n");
    const length = Number(buffer.slice(1, lineEnd));
    return buffer.slice(lineEnd + 2, lineEnd + 2 + length);
  }

  if (buffer.startsWith("*-1")) {
    return null;
  }

  if (buffer.startsWith("*")) {
    const lines = buffer.split("\r\n");
    const values: string[] = [];

    for (let index = 1; index < lines.length - 1; index += 2) {
      if (lines[index]?.startsWith("$")) {
        values.push(lines[index + 1] ?? "");
      }
    }

    return values;
  }

  throw new Error("Unsupported Redis response.");
}

function parsePayload(value: string): OcrQueuePayload {
  const parsed = JSON.parse(value) as Partial<OcrQueuePayload>;

  if (!parsed.jobId || !parsed.sourceId) {
    throw new Error("Redis OCR queue payload is missing jobId or sourceId.");
  }

  return {
    jobId: parsed.jobId,
    sourceId: parsed.sourceId,
    attempts: Number.isInteger(parsed.attempts) ? parsed.attempts! : 0,
    enqueuedAt: parsed.enqueuedAt ?? new Date().toISOString(),
  };
}

export class RedisOcrQueueTransport implements OcrQueueTransport {
  private readonly url: URL;
  private readonly key: string;

  constructor(input: { url?: string; key?: string } = {}) {
    this.url = new URL(input.url ?? redisUrl());
    this.key = input.key ?? queueName();
  }

  async enqueue(payload: OcrQueuePayload): Promise<void> {
    await this.command(["LPUSH", this.key, JSON.stringify(payload)]);
  }

  async dequeue(timeoutSeconds = 5): Promise<OcrQueuePayload | null> {
    const response = await this.command(["BRPOP", this.key, String(timeoutSeconds)]);

    if (!Array.isArray(response) || typeof response[1] !== "string") {
      return null;
    }

    return parsePayload(response[1]);
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }

  private command(parts: string[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const chunks: Buffer[] = [];
      const port = this.url.port ? Number(this.url.port) : 6379;
      const host = this.url.hostname || "127.0.0.1";
      let settled = false;

      const finish = (callback: () => void) => {
        if (!settled) {
          settled = true;
          socket.destroy();
          callback();
        }
      };

      socket.setTimeout(30_000);
      socket.on("error", (error) => finish(() => reject(error)));
      socket.on("timeout", () => finish(() => reject(new Error("Redis OCR queue command timed out."))));
      socket.on("data", (chunk) => {
        chunks.push(chunk);
        const text = Buffer.concat(chunks).toString("utf8");

        try {
          const parsed = parseSimpleResp(text);
          finish(() => resolve(parsed));
        } catch (error) {
          if (error instanceof Error && error.message === "Unsupported Redis response.") {
            return;
          }

          finish(() => reject(error));
        }
      });
      socket.connect(port, host, () => {
        socket.write(encodeCommand(parts));
      });
    });
  }
}

export function createOcrQueueTransport(): OcrQueueTransport {
  return new RedisOcrQueueTransport();
}

export async function enqueueOcrJob(importJobId: string, transport: OcrQueueTransport = createOcrQueueTransport()): Promise<EnqueueOcrJobResult> {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const importJob = corpusRepo.getImportJob(importJobId);

    if (!importJob?.sourceId) {
      return { enqueued: false, skippedReason: "missing-import-job" };
    }

    if (importJob.adapter !== "pdf-ocr" && importJob.adapter !== "pdf-docling") {
      corpusRepo.createImportJobEvent({
        importJobId: importJob.id,
        eventType: "background_enqueue_skipped",
        message: "Background enqueue skipped because this is not a background PDF job.",
        payload: { sourceId: importJob.sourceId, adapter: importJob.adapter, status: importJob.status },
      });
      return { enqueued: false, skippedReason: "not-background-pdf-job" };
    }

    const expectedStatus = importJob.adapter === "pdf-ocr" ? "ocr_queued" : "queued";

    if (importJob.status !== expectedStatus) {
      corpusRepo.createImportJobEvent({
        importJobId: importJob.id,
        eventType: "background_enqueue_skipped",
        message: `Background enqueue skipped because status is ${importJob.status}.`,
        payload: { sourceId: importJob.sourceId, adapter: importJob.adapter, status: importJob.status, expectedStatus },
      });
      return { enqueued: false, skippedReason: `status-${importJob.status}` };
    }

    await transport.enqueue({ jobId: importJob.id, sourceId: importJob.sourceId, attempts: 0, enqueuedAt: new Date().toISOString() });
    corpusRepo.createImportJobEvent({
      importJobId: importJob.id,
      eventType: "background_enqueued",
      message: `${importJob.adapter} job enqueued for background processing.`,
      progressPct: importJob.adapter === "pdf-ocr" ? 25 : 15,
      payload: { sourceId: importJob.sourceId, status: importJob.status, adapter: importJob.adapter },
    });
    console.info("[ocr-queue] enqueued", { jobId: importJob.id, sourceId: importJob.sourceId, status: importJob.status });
    return { enqueued: true };
  } finally {
    closeDatabase(db);
  }
}

export async function enqueueOcrJobs(importJobIds: string[], transport?: OcrQueueTransport): Promise<EnqueueOcrJobResult[]> {
  if (importJobIds.length === 0) {
    return [];
  }

  const queue = transport ?? createOcrQueueTransport();

  try {
    return await Promise.all(importJobIds.map((importJobId) => enqueueOcrJob(importJobId, queue)));
  } finally {
    await queue.close?.();
  }
}
