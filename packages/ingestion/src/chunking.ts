/**
 * Structure-aware chunking — PIPELINE-owned policy (008 FR-019, research R4).
 * Plugins inform it through hints; they never chunk (doc 05's hard rule).
 *
 * Policy in one breath: greedily pack contiguous sections against a character
 * budget; ATOMIC kinds (stat_block, table, spell_entry) are never split — an
 * atomic section bigger than maxChars becomes ONE flagged oversized chunk
 * (SC-009: half a stat block is retrieval poison); oversized PROSE splits at
 * paragraph, then sentence boundaries, with a tail overlap between pieces.
 *
 * Budgets are CHARACTERS, not tokens, on purpose: tokenizers are
 * model-specific and D14 forbids baking a model into pipeline policy. The
 * env-tunable params (CHUNK_TARGET_CHARS et al.) are the eval program's
 * knobs (doc 06) — defaults here are starting points, not conclusions.
 */
import type { ChunkingHints, NormalizedDocument, Section } from "@stacks/ingestion-contract";
import { ATOMIC_KINDS } from "@stacks/ingestion-contract";

export interface ChunkingParams {
  targetChars: number;
  overlapChars: number;
  maxChars: number;
}

/** Section-index-based output: the caller (ingest-source.ts) maps indexes to
 * persisted section ids/anchors — chunking stays pure and storage-blind. */
export interface DraftChunk {
  chunkIndex: number;
  content: string;
  sectionIndexes: number[];
  /** First contributing section — where a citation of this chunk opens. */
  anchorSectionIndex: number;
  oversized: boolean;
}

export function resolveChunkingParams(env: NodeJS.ProcessEnv = process.env): ChunkingParams {
  const int = (name: string, fallback: number) => {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Environment variable ${name} must be a positive integer, got: ${raw}`);
    }
    return value;
  };
  return {
    targetChars: int("CHUNK_TARGET_CHARS", 4000),
    overlapChars: int("CHUNK_OVERLAP_CHARS", 400),
    maxChars: int("CHUNK_MAX_CHARS", 6000),
  };
}

export function chunkDocument(
  doc: NormalizedDocument,
  params: ChunkingParams,
  hints: ChunkingHints = {},
): DraftChunk[] {
  const breakBefore = new Set(hints.preferBreakBefore ?? []);
  // keepTogether groups: section index -> its group's total size, so packing
  // can decide "the whole group fits (<= maxChars), keep going past target".
  const groupOf = new Map<number, number[]>();
  for (const group of hints.keepTogether ?? []) {
    for (const index of group) groupOf.set(index, group);
  }

  const chunks: DraftChunk[] = [];
  let current: { pieces: string[]; sectionIndexes: number[]; size: number } | null = null;

  const flush = () => {
    if (!current || current.pieces.length === 0) return;
    chunks.push({
      chunkIndex: chunks.length,
      content: current.pieces.join("\n\n"),
      sectionIndexes: [...new Set(current.sectionIndexes)],
      anchorSectionIndex: current.sectionIndexes[0]!,
      oversized: false,
    });
    current = null;
  };

  for (const section of doc.sections) {
    const text = section.content.trim();
    if (!text) continue;
    const atomic = ATOMIC_KINDS.includes(section.kind);

    if (breakBefore.has(section.index)) flush();

    // Oversized ATOMIC section: never split — one flagged chunk, alone.
    if (atomic && text.length > params.maxChars) {
      flush();
      chunks.push({
        chunkIndex: chunks.length,
        content: text,
        sectionIndexes: [section.index],
        anchorSectionIndex: section.index,
        oversized: true,
      });
      continue;
    }

    // Oversized PROSE: split at paragraph/sentence boundaries with overlap.
    if (!atomic && text.length > params.maxChars) {
      flush();
      for (const piece of splitProse(text, params)) {
        chunks.push({
          chunkIndex: chunks.length,
          content: piece,
          sectionIndexes: [section.index],
          anchorSectionIndex: section.index,
          oversized: false,
        });
      }
      continue;
    }

    // Normal packing. A keepTogether group whose total fits maxChars is
    // allowed to blow past target (the hint is a soft constraint upward).
    const wouldBe = (current?.size ?? 0) + text.length;
    const group = groupOf.get(section.index);
    const groupFits =
      group !== undefined &&
      group.some((i) => current?.sectionIndexes.includes(i)) &&
      wouldBe <= params.maxChars;

    if (current && wouldBe > params.targetChars && !groupFits) flush();

    if (!current) current = { pieces: [], sectionIndexes: [], size: 0 };
    current.pieces.push(text);
    current.sectionIndexes.push(section.index);
    current.size += text.length;
  }
  flush();

  return chunks;
}

/** Paragraph-first, sentence-second splitting for prose that exceeds maxChars.
 * Each piece after the first opens with the previous piece's tail
 * (overlapChars) so retrieval never loses a thought at a boundary. */
function splitProse(text: string, params: ChunkingParams): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const units: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= params.targetChars) {
      units.push(paragraph);
      continue;
    }
    // Sentence boundary: period/question/exclamation followed by whitespace.
    let sentencePiece = "";
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      if (sentencePiece && sentencePiece.length + sentence.length + 1 > params.targetChars) {
        units.push(sentencePiece);
        sentencePiece = sentence;
      } else {
        sentencePiece = sentencePiece ? `${sentencePiece} ${sentence}` : sentence;
      }
    }
    if (sentencePiece) units.push(sentencePiece);
  }

  const pieces: string[] = [];
  let piece = "";
  for (const unit of units) {
    if (piece && piece.length + unit.length + 2 > params.targetChars) {
      pieces.push(piece);
      piece = piece.slice(-params.overlapChars) + "\n\n" + unit;
    } else {
      piece = piece ? `${piece}\n\n${unit}` : unit;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}
