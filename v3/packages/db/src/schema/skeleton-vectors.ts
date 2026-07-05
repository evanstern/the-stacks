import { customType } from "drizzle-orm/pg-core";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// pgvector's `vector` type, deliberately un-dimensioned (research R8): dimension
// is a property of the configured embedding model, not the schema.
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(",")
      .filter((v) => v.length > 0)
      .map(Number);
  },
});

export const skeletonVectors = pgTable("skeleton_vectors", {
  // deterministic: sha256(input_text + '\n' + provider + '/' + model + '/' + dimensions)
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  embedding: vector("embedding").notNull(),
  embeddingProvider: text("embedding_provider").notNull(),
  embeddingModel: text("embedding_model").notNull(),
  embeddingDimensions: integer("embedding_dimensions").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
