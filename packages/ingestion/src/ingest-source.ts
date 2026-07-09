/**
 * The stage driver (008 FR-007, research R10): one job execution runs
 * detect → extract → transform → chunk → embed → index → commit for one
 * source, recording the append-only event per stage transition
 * (contracts/events.md is the vocabulary; ingestion_events is the table).
 *
 * Failure doctrine: any stage failure records a `failed` event with a typed
 * cause, stamps a SCRUBBED copy onto sources.last_error, and rethrows the
 * DomainError — the worker's queue machinery decides retry-vs-permanent.
 * Retry safety is structural, not careful: deterministic ids (R9) make every
 * write idempotent, embed skips already-embedded rows, and nothing becomes
 * visible to readers until commitGeneration's pointer flip (R8).
 *
 * extract/transform are ONE plugin call observed as TWO stages — the driver
 * emits extract:started before invoking and transform:completed after
 * invariant validation, keeping doc 05's stage vocabulary observable even
 * though the seam is a single function (contracts/events.md note).
 */
import type { NormalizedDocument } from "@stacks/ingestion-contract";
import {
  DETECT_HEAD_BYTES,
  PluginError,
  validateNormalizedDocument,
} from "@stacks/ingestion-contract";
import { DomainError, deriveChunkId, deriveSectionId } from "@stacks/core";
import type { Database } from "@stacks/db";
import { recordIngestionEvent, sourceArchives, sources } from "@stacks/db";
import type { IngestionStage } from "@stacks/db";
import { sql } from "drizzle-orm";

import type { ChunkingParams } from "./chunking";
import { chunkDocument } from "./chunking";
import type { EmbedClient } from "./embed";
import type { ChunkRow, SectionRow } from "./index-chunks";
import { alreadyEmbedded, commitGeneration, indexDerived } from "./index-chunks";
import type { PluginRegistry } from "./registry";

export interface IngestDeps {
  db: Database;
  registry: PluginRegistry;
  embedClient: EmbedClient;
  chunkingParams: ChunkingParams;
}

export interface IngestSourcePayload {
  sourceId: string;
  /** Same value on retry (idempotent); N+1 on re-ingest (FR-023, R8). */
  targetGeneration: number;
}

export interface IngestOutcome {
  status: "ingested" | "empty";
  sections: number;
  chunks: number;
}

export async function ingestSource(
  deps: IngestDeps,
  payload: IngestSourcePayload,
): Promise<IngestOutcome> {
  const { db } = deps;
  const { sourceId, targetGeneration } = payload;

  const [source] = await db.select().from(sources).where(sql`${sources.id} = ${sourceId}`);
  if (!source) {
    // A job pointing at a missing source is a wiring bug, not user error.
    throw new DomainError({
      class: "internal_fault",
      seam: "detect",
      message: `ingest_source job references unknown source ${sourceId}.`,
    });
  }
  const [archive] = await db
    .select()
    .from(sourceArchives)
    .where(sql`${sourceArchives.fingerprint} = ${source.fingerprint}`);
  if (!archive) {
    throw new DomainError({
      class: "internal_fault",
      seam: "detect",
      message: `source ${sourceId} has no archive ${source.fingerprint} — archives are immutable and never deleted, so this is a bug.`,
    });
  }

  await db
    .update(sources)
    .set({ status: "processing", updatedAt: new Date() })
    .where(sql`${sources.id} = ${sourceId}`);

  const event = (
    stage: IngestionStage,
    kind: "started" | "completed" | "failed",
    detail?: Record<string, unknown>,
    durationMs?: number,
  ) => recordIngestionEvent(db, { sourceId, stage, event: kind, detail, durationMs });

  /** Runs one stage: started/completed events, timing, and the failure
   * ritual (failed event + scrubbed last_error + status flip) in one place. */
  async function stage<T>(
    name: IngestionStage,
    body: () => Promise<{ result: T; detail?: Record<string, unknown> }>,
    options: { skipStarted?: boolean } = {},
  ): Promise<T> {
    if (!options.skipStarted) await event(name, "started");
    const startedAt = Date.now();
    try {
      const { result, detail } = await body();
      await event(name, "completed", detail, Date.now() - startedAt);
      return result;
    } catch (cause) {
      const error =
        cause instanceof DomainError
          ? cause
          : new DomainError({
              class: "internal_fault",
              seam: name,
              message: `Unexpected failure in ${name} stage.`,
              cause,
            });
      await event(name, "failed", { class: error.class, message: error.message }, Date.now() - startedAt);
      await db
        .update(sources)
        .set({
          status: "failed",
          lastError: { class: error.class, stage: name, message: error.message },
          updatedAt: new Date(),
        })
        .where(sql`${sources.id} = ${sourceId}`);
      throw error;
    }
  }

  const bytes = new Uint8Array(archive.bytes);

  // ---- detect ------------------------------------------------------------
  const decision = await stage("detect", async () => {
    const found = deps.registry.detect({
      mediaType: archive.mediaType,
      filename: source.originalFilename,
      head: bytes.slice(0, DETECT_HEAD_BYTES),
    });
    if (!found) {
      throw new DomainError({
        class: "unsupported_type",
        seam: "detect",
        message: `No registered ingester recognizes "${source.originalFilename}" (${archive.mediaType}).`,
      });
    }
    await db
      .update(sources)
      .set({
        pluginName: found.plugin.name,
        pluginVersion: found.plugin.version,
        detectConfidence: found.confidence,
        updatedAt: new Date(),
      })
      .where(sql`${sources.id} = ${sourceId}`);
    return {
      result: found,
      detail: {
        plugin: found.plugin.name,
        version: found.plugin.version,
        confidence: found.confidence,
        candidates: found.candidates,
      },
    };
  });

  // ---- extract + transform (one plugin call, two observed stages) ---------
  await event("extract", "started");
  let doc: NormalizedDocument;
  const extractStarted = Date.now();
  try {
    doc = await Promise.resolve().then(() =>
      decision.plugin.transform({
        mediaType: archive.mediaType,
        filename: source.originalFilename,
        bytes,
      }),
    );
    await event("extract", "completed", undefined, Date.now() - extractStarted);
  } catch (cause) {
    // PluginError categories are content problems (unsupported_type at the
    // boundary); anything else out of a plugin is a plugin BUG.
    const error =
      cause instanceof PluginError
        ? new DomainError({
            class: "unsupported_type",
            seam: "extract",
            message: cause.message,
            cause,
          })
        : new DomainError({
            class: "internal_fault",
            seam: "extract",
            message: `Plugin ${decision.plugin.name} crashed during transform.`,
            cause,
          });
    await event(
      "extract",
      "failed",
      {
        class: error.class,
        message: error.message,
        ...(cause instanceof PluginError ? { category: cause.category } : {}),
      },
      Date.now() - extractStarted,
    );
    await db
      .update(sources)
      .set({
        status: "failed",
        lastError: { class: error.class, stage: "extract", message: error.message },
        updatedAt: new Date(),
      })
      .where(sql`${sources.id} = ${sourceId}`);
    throw error;
  }

  await stage(
    "transform",
    async () => {
      const violations = validateNormalizedDocument(doc);
      if (violations.length > 0) {
        // The plugin passed conformance but produced an invalid doc at
        // runtime — a plugin bug by definition.
        throw new DomainError({
          class: "internal_fault",
          seam: "transform",
          message: `Plugin ${decision.plugin.name} produced an invalid normalized document: ${violations.join("; ")}`,
        });
      }
      return {
        result: undefined,
        detail: {
          sections: doc.sections.length,
          artifacts: doc.artifacts.length,
          warnings: doc.warnings.length,
          contractVersion: doc.contractVersion,
        },
      };
    },
    { skipStarted: true },
  );

  // ---- honest empty outcome (spec edge case, invariant 6) ------------------
  if (doc.sections.length === 0) {
    await db
      .update(sources)
      .set({ status: "empty", lastError: null, updatedAt: new Date() })
      .where(sql`${sources.id} = ${sourceId}`);
    return { status: "empty", sections: 0, chunks: 0 };
  }

  // ---- chunk ---------------------------------------------------------------
  const drafts = await stage("chunk", () => {
    const result = chunkDocument(doc, deps.chunkingParams, decision.plugin.chunkingHints);
    return Promise.resolve({
      result,
      detail: {
        chunks: result.length,
        oversized: result.filter((c) => c.oversized).length,
        targetChars: deps.chunkingParams.targetChars,
        overlapChars: deps.chunkingParams.overlapChars,
        maxChars: deps.chunkingParams.maxChars,
      },
    });
  });

  // Deterministic identities for everything we are about to write (R9).
  const idInput = {
    sourceFingerprint: source.fingerprint,
    pluginName: decision.plugin.name,
    pluginVersion: decision.plugin.version,
    generation: targetGeneration,
  };
  const sectionIdByIndex = new Map(
    doc.sections.map((section) => [
      section.index,
      deriveSectionId({ ...idInput, sectionIndex: section.index }),
    ]),
  );
  const chunkIds = drafts.map((draft) =>
    deriveChunkId({
      corpusId: source.corpusId,
      ...idInput,
      chunkIndex: draft.chunkIndex,
      content: draft.content,
    }),
  );

  // ---- embed (skip rows a previous attempt already embedded, R10) ----------
  const embeddings = await stage("embed", async () => {
    const done = await alreadyEmbedded(db, chunkIds);
    const pending = drafts.filter((_, i) => !done.has(chunkIds[i]!));
    const vectors = await deps.embedClient.embedAll(pending.map((d) => d.content));
    const byChunkIndex = new Map<number, number[]>();
    pending.forEach((draft, i) => byChunkIndex.set(draft.chunkIndex, vectors[i]!));
    return {
      result: byChunkIndex,
      detail: {
        embedded: pending.length,
        skippedExisting: done.size,
        batches: Math.ceil(pending.length / Math.max(1, deps.embedClient.maxBatch)),
        model: `${deps.embedClient.config.provider}/${deps.embedClient.config.modelId}`,
      },
    };
  });

  // ---- index ----------------------------------------------------------------
  const sectionRows: SectionRow[] = doc.sections.map((section) => ({
    id: sectionIdByIndex.get(section.index)!,
    sourceId,
    generation: targetGeneration,
    sectionIndex: section.index,
    path: section.path,
    kind: section.kind,
    heading: section.heading,
    content: section.content,
    anchor: section.anchor,
    displayArtifact:
      doc.artifacts.find((artifact) => artifact.id === section.anchor.artifactId)?.content ?? null,
  }));
  const chunkRows: ChunkRow[] = drafts.map((draft, i) => {
    const embedding = embeddings.get(draft.chunkIndex);
    return {
      id: chunkIds[i]!,
      sourceId,
      corpusId: source.corpusId,
      generation: targetGeneration,
      chunkIndex: draft.chunkIndex,
      content: draft.content,
      sectionIds: draft.sectionIndexes.map((index) => sectionIdByIndex.get(index)!),
      anchor: doc.sections[draft.anchorSectionIndex]!.anchor,
      oversized: draft.oversized,
      pluginName: decision.plugin.name,
      pluginVersion: decision.plugin.version,
      // A row can exist WITHOUT an embedding only if a prior attempt indexed
      // it before this attempt re-embedded; conflict-noop keeps the old row,
      // which already carries its vector — so missing here is fine.
      ...(embedding
        ? {
            embedding,
            embeddingProvider: deps.embedClient.config.provider,
            embeddingModel: deps.embedClient.config.modelId,
            embeddingDimensions: deps.embedClient.config.dimensions,
          }
        : {}),
    };
  });

  await stage("index", async () => {
    const result = await indexDerived(db, { sections: sectionRows, chunks: chunkRows });
    return { result: undefined, detail: { inserted: result.inserted, conflictNoops: result.conflictNoops } };
  });

  // ---- commit (the pointer flip, R8) ----------------------------------------
  await stage(
    "commit",
    async () => {
      const swept = await commitGeneration(db, {
        sourceId,
        generation: targetGeneration,
        contractVersion: doc.contractVersion,
      });
      return {
        result: undefined,
        detail: {
          generation: targetGeneration,
          sweptSections: swept.sweptSections,
          sweptChunks: swept.sweptChunks,
        },
      };
    },
    { skipStarted: true },
  );

  return { status: "ingested", sections: sectionRows.length, chunks: chunkRows.length };
}
