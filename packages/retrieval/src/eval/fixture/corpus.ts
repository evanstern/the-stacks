/**
 * The synthetic fixture corpus (spec 010 US4, research R8) — the substrate
 * of the deterministic CI slice. Every passage is INVENTED for a fictional
 * homebrew system ("Emberfall") so nothing here brushes Principle I; the
 * texts exist to give FTS real terms and the paraphrase map real targets,
 * not to be good rules.
 *
 * Two kinds of gold questions, mirroring the two signals:
 *   - term questions share vocabulary with their passage (FTS carries them);
 *   - paraphrase questions share NO keywords — fixtureQueryEmbedder maps
 *     them to their target passage's seed text, so the vector channel
 *     carries them BY CONSTRUCTION (hash embeddings have no semantics; the
 *     construction is the point — the slice guards ranking math, not model
 *     quality).
 *
 * seedFixtureCorpus() is idempotent per suite database: it truncates the
 * tables it owns first (TASK-8 — the database belongs to the calling suite).
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

import { chunks, corpora, sourceArchives, sources, type Database } from "@stacks/db";

import type { QueryEmbedder } from "../../search";
import { deterministicEmbedding, FIXTURE_EMBEDDING_STAMP } from "./deterministic-embedding";

export const sha256hex = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex");

interface FixturePassage {
  id: string;
  text: string;
}

/** Source 1: combat rules. Source 2: exploration & magic. All invented. */
const COMBAT: FixturePassage[] = [
  { id: "fx-grapple", text: "Grappling in Emberfall: spend two stamina to seize a foe; the grappled creature cannot stride until it breaks free." },
  { id: "fx-riposte", text: "A riposte answers a missed melee strike: the defender may immediately counterattack with one die smaller." },
  { id: "fx-flanking", text: "Flanking grants edge on strikes when two allies threaten the same enemy from opposite sides." },
  { id: "fx-stamina", text: "Stamina fuels martial techniques and recovers by one point on a short breather, fully on a night's rest." },
  { id: "fx-wounds", text: "Wounds in Emberfall are tiered: grazed, bleeding, broken. A broken wound needs a healer's kit, not just rest." },
  { id: "fx-initiative", text: "Initiative is drawn from a shuffled deck each round; the ember suit always acts first." },
];

const EXPLORATION: FixturePassage[] = [
  { id: "fx-torchlight", text: "Torchlight reaches six squares; beyond it, ranged strikes suffer disadvantage and stealth is nearly certain." },
  { id: "fx-forage", text: "Foraging yields one ration per success on a wilds check; forests grant edge, ashlands impose burden." },
  { id: "fx-emberveil", text: "The Emberveil spell wraps the caster in warm ash: attacks against them lose edge until the veil is spent." },
  { id: "fx-glyphs", text: "Warding glyphs must be inscribed on stone or bone; a glyph on living wood fades at the next dawn." },
  { id: "fx-riverford", text: "Fording a river in armor requires a brawn check; failure sweeps the character one zone downstream." },
  { id: "fx-starcamp", text: "Camping under open stars restores one resolve to every watcher who kept a full watch without an encounter." },
];

export const FIXTURE_PASSAGES: FixturePassage[] = [...COMBAT, ...EXPLORATION];

/** Paraphrase queries → the passage seed text whose vector they inherit.
 *  Anything here is VECTOR-carried by construction. Note the entries that
 *  look like keyword queries ("grapple stamina cost"): websearch_to_tsquery
 *  has AND semantics, so one absent word ("cost") kills the FTS hit — in
 *  production the real embedding model catches these; in the fixture, this
 *  map plays that role. The engine lesson is recorded in the eval report. */
const PARAPHRASE_TARGETS: Record<string, string> = {
  "holding an enemy so it cannot move": COMBAT[0]!.text, // fx-grapple
  "striking back after a whiffed attack": COMBAT[1]!.text, // fx-riposte
  "seeing in the dark with a flame": EXPLORATION[0]!.text, // fx-torchlight
  "protective ash cloak spell": EXPLORATION[2]!.text, // fx-emberveil
  "grapple stamina cost": COMBAT[0]!.text, // fx-grapple — "cost" defeats FTS AND
  "recovering stamina and resolve": COMBAT[3]!.text, // fx-stamina — multi-expected, split vocab
};

export const fixtureQueryEmbedder: QueryEmbedder = async (text) => ({
  vector: deterministicEmbedding(PARAPHRASE_TARGETS[text] ?? text),
  ...FIXTURE_EMBEDDING_STAMP,
});

export interface FixtureGoldSeed {
  question: string;
  expectedChunkIds: string[];
  split: "tuning" | "heldout";
}

/** 12 items, 9 tuning / 3 heldout (the every-4th protocol, precomputed).
 *  Mix: FTS-carried term questions, vector-carried paraphrases, one
 *  multi-expected item, and one deliberately hard miss-ish question the
 *  floor does NOT require (floors pin reality, not perfection). */
export const FIXTURE_GOLD: FixtureGoldSeed[] = [
  { question: "grapple stamina cost", expectedChunkIds: ["fx-grapple"], split: "tuning" },
  { question: "riposte counterattack", expectedChunkIds: ["fx-riposte"], split: "tuning" },
  { question: "flanking edge", expectedChunkIds: ["fx-flanking"], split: "tuning" },
  { question: "holding an enemy so it cannot move", expectedChunkIds: ["fx-grapple"], split: "heldout" },
  { question: "how does stamina recover", expectedChunkIds: ["fx-stamina"], split: "tuning" },
  { question: "broken wound healer kit", expectedChunkIds: ["fx-wounds"], split: "tuning" },
  { question: "initiative deck ember suit", expectedChunkIds: ["fx-initiative"], split: "tuning" },
  { question: "striking back after a whiffed attack", expectedChunkIds: ["fx-riposte"], split: "heldout" },
  { question: "torchlight stealth disadvantage", expectedChunkIds: ["fx-torchlight"], split: "tuning" },
  { question: "foraging rations wilds check", expectedChunkIds: ["fx-forage"], split: "tuning" },
  { question: "seeing in the dark with a flame", expectedChunkIds: ["fx-torchlight"], split: "heldout" },
  // Multi-expected: both stamina passages answer "recovering resources".
  { question: "recovering stamina and resolve", expectedChunkIds: ["fx-stamina", "fx-starcamp"], split: "tuning" },
];

export interface SeededFixture {
  corpusId: string;
  sourceIds: { combat: string; exploration: string };
  /** chunkId → contentSha256, for gold seeding and assertions. */
  hashes: Map<string, string>;
}

export async function seedFixtureCorpus(db: Database): Promise<SeededFixture> {
  await db.execute(
    sql`TRUNCATE TABLE eval_runs, gold_items, retrieval_results, retrieval_runs, chunks, sources, source_archives, corpora CASCADE`,
  );
  const [corpus] = await db.insert(corpora).values({ name: "default" }).returning();

  const mkSource = async (fingerprintByte: string, filename: string) => {
    await db
      .insert(sourceArchives)
      .values({
        fingerprint: fingerprintByte.repeat(64),
        bytes: Buffer.from(filename),
        byteSize: filename.length,
        mediaType: "text/html",
      })
      .onConflictDoNothing();
    const [source] = await db
      .insert(sources)
      .values({
        corpusId: corpus!.id,
        fingerprint: fingerprintByte.repeat(64),
        originalFilename: filename,
        currentGeneration: 1,
        status: "ingested",
      })
      .returning();
    return source!.id;
  };
  const combatSourceId = await mkSource("e", "emberfall-combat.html");
  const explorationSourceId = await mkSource("f", "emberfall-exploration.html");

  const hashes = new Map<string, string>();
  const seedPassages = async (passages: FixturePassage[], sourceId: string) => {
    for (const [index, passage] of passages.entries()) {
      hashes.set(passage.id, sha256hex(passage.text));
      await db.insert(chunks).values({
        id: passage.id,
        sourceId,
        corpusId: corpus!.id,
        generation: 1,
        chunkIndex: index,
        content: passage.text,
        sectionIds: [`sec-${passage.id}`],
        anchor: { headingTrail: ["Emberfall", passage.id] },
        pluginName: "fixture-plugin",
        pluginVersion: "1.0.0",
        embedding: deterministicEmbedding(passage.text),
        embeddingProvider: FIXTURE_EMBEDDING_STAMP.provider,
        embeddingModel: FIXTURE_EMBEDDING_STAMP.model,
        embeddingDimensions: FIXTURE_EMBEDDING_STAMP.dimensions,
      });
    }
  };
  await seedPassages(COMBAT, combatSourceId);
  await seedPassages(EXPLORATION, explorationSourceId);

  return {
    corpusId: corpus!.id,
    sourceIds: { combat: combatSourceId, exploration: explorationSourceId },
    hashes,
  };
}
