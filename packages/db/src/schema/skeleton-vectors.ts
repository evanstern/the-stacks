/**
 * skeleton_vectors — where the walking skeleton proves the embedding path:
 * worker calls the ML sidecar, writes the vector here, then reads it back by
 * similarity search. Requires the pgvector extension (enabled in the 0001
 * migration). Identity/idempotency doctrine (FR-012, FR-014) is explained on
 * the columns below; the hash itself lives in @stacks/core deriveVectorId.
 */
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// The un-dimensioned pgvector bridge lives in column-types.ts since 008
// shares it with chunks; the wire-format doctrine is documented there.
import { vector } from "./column-types";

export const skeletonVectors = pgTable("skeleton_vectors", {
  // deterministic: sha256(input_text + '\n' + provider + '/' + model + '/' + dimensions)
  // (deriveVectorId in @stacks/core). Content-addressed id + ON CONFLICT DO
  // NOTHING at the write site makes re-embedding the same input a no-op (FR-012).
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  embedding: vector("embedding").notNull(),
  // Provenance stamp (FR-014): because the column is un-dimensioned, each row
  // must say which provider/model/dimensions produced it — vectors from
  // different models are not comparable, and readers filter on these fields.
  embeddingProvider: text("embedding_provider").notNull(),
  embeddingModel: text("embedding_model").notNull(),
  embeddingDimensions: integer("embedding_dimensions").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
