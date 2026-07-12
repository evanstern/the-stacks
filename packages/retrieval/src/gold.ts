/**
 * Gold-set domain functions (spec 010 US3, research R6). Labels are
 * operator-owned rows — mutable curation, not receipts — but their passage
 * references are CONTENT HASHES resolved at labeling time, which buys two
 * behaviors for free at read time:
 *
 *   auto-heal:        a re-ingest that reproduced identical text keeps the
 *                     hash alive under a new chunk id → nothing to flag.
 *   re-confirmation:  rewritten text orphans the hash → the item flags
 *                     itself; eval runs report it `unresolvable`, never a
 *                     silent miss.
 *
 * Split discipline (FR-013): assigned at creation — every 4th item lands in
 * the holdout unless the operator says otherwise — and IMMUTABLE after.
 * Moving items between splits once tuning has begun is how choices leak
 * into the holdout; the API refuses rather than trusts.
 */
import { sql } from "drizzle-orm";

import { DomainError } from "@stacks/core";
import { goldItems, type Database } from "@stacks/db";

export interface ExpectedPassage {
  chunkId: string;
  sourceId: string;
  contentSha256: string;
}

export interface GoldItemView {
  id: string;
  corpusId: string;
  question: string;
  expected: ExpectedPassage[];
  split: "tuning" | "heldout";
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** DERIVED: any expected hash absent from its source's current generation. */
  needsReconfirmation: boolean;
}

/** Resolve bare chunk ids into durable references. Refuses chunks that are
 *  not current-generation: labeling against text a reader can't retrieve
 *  would be a lie at birth. */
export async function resolveExpectedPassages(
  db: Database,
  chunkIds: string[],
): Promise<ExpectedPassage[]> {
  if (chunkIds.length === 0) {
    throw new DomainError({ class: "invalid_input", message: "expected must name at least one chunk." });
  }
  const rows = await db.execute<{ id: string; source_id: string; hash: string }>(sql`
    SELECT c.id, c.source_id,
           encode(sha256(convert_to(c.content, 'UTF8')), 'hex') AS hash
    FROM chunks c JOIN sources s ON s.id = c.source_id
    WHERE c.id IN (${sql.join(chunkIds.map((id) => sql`${id}`), sql`, `)})
      AND c.generation = s.current_generation
  `);
  const byId = new Map(rows.rows.map((r) => [r.id, r]));
  return chunkIds.map((chunkId) => {
    const row = byId.get(chunkId);
    if (!row) {
      throw new DomainError({
        class: "invalid_input",
        message: `Chunk ${chunkId} is not a current-generation passage — expected passages must be retrievable as labeled.`,
      });
    }
    return { chunkId, sourceId: row.source_id, contentSha256: row.hash };
  });
}

/** Deterministic default split: every 4th item (by existing count) is
 *  heldout — ~25% holdout with zero randomness to argue about. */
export async function defaultSplit(db: Database, corpusId: string): Promise<"tuning" | "heldout"> {
  const count = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM gold_items WHERE corpus_id = ${corpusId}`,
  );
  return (count.rows[0]!.n + 1) % 4 === 0 ? "heldout" : "tuning";
}

const RECONFIRM_SQL = sql`
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(${goldItems.expected}) AS exp(entry)
    WHERE NOT EXISTS (
      SELECT 1 FROM chunks c
      JOIN sources s ON s.id = c.source_id
      WHERE c.source_id = (exp.entry->>'sourceId')::uuid
        AND c.generation = s.current_generation
        AND encode(sha256(convert_to(c.content, 'UTF8')), 'hex') = exp.entry->>'contentSha256'
    )
  )
`;

export async function listGoldItems(db: Database, corpusId: string): Promise<GoldItemView[]> {
  const rows = await db
    .select({
      id: goldItems.id,
      corpusId: goldItems.corpusId,
      question: goldItems.question,
      expected: goldItems.expected,
      split: goldItems.split,
      notes: goldItems.notes,
      createdAt: goldItems.createdAt,
      updatedAt: goldItems.updatedAt,
      needsReconfirmation: RECONFIRM_SQL,
    })
    .from(goldItems)
    .where(sql`${goldItems.corpusId} = ${corpusId}`)
    .orderBy(sql`${goldItems.createdAt} ASC`);
  return rows as unknown as GoldItemView[];
}

export interface CreateGoldItemInput {
  corpusId: string;
  question: string;
  chunkIds: string[];
  split?: "tuning" | "heldout";
  notes?: string;
}

export async function createGoldItem(db: Database, input: CreateGoldItemInput): Promise<GoldItemView> {
  const expected = await resolveExpectedPassages(db, input.chunkIds);
  const split = input.split ?? (await defaultSplit(db, input.corpusId));
  const [row] = await db
    .insert(goldItems)
    .values({
      corpusId: input.corpusId,
      question: input.question,
      expected,
      split,
      notes: input.notes ?? null,
    })
    .returning();
  return { ...(row as unknown as GoldItemView), expected, needsReconfirmation: false };
}

export interface RelabelGoldItemInput {
  id: string;
  question: string;
  chunkIds: string[];
  notes?: string;
  /** Present = the caller tried to move splits; always refused. */
  split?: string;
}

export async function relabelGoldItem(db: Database, input: RelabelGoldItemInput): Promise<GoldItemView> {
  const existing = await db.select().from(goldItems).where(sql`${goldItems.id} = ${input.id}`);
  const item = existing[0];
  if (!item) {
    throw new DomainError({ class: "unknown_thing", message: `No gold item ${input.id}.` });
  }
  if (input.split !== undefined && input.split !== item.split) {
    throw new DomainError({
      class: "invalid_input",
      message: `The split is immutable after creation (FR-013): moving items into or out of the holdout after tuning began would let configuration choices leak into it.`,
    });
  }
  const expected = await resolveExpectedPassages(db, input.chunkIds);
  const [row] = await db
    .update(goldItems)
    .set({
      question: input.question,
      expected,
      notes: input.notes ?? item.notes,
      updatedAt: sql`now()`,
    })
    .where(sql`${goldItems.id} = ${input.id}`)
    .returning();
  return { ...(row as unknown as GoldItemView), expected, needsReconfirmation: false };
}
