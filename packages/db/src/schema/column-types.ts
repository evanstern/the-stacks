/**
 * Shared Postgres column bridges drizzle lacks built-ins for. Extracted from
 * skeleton-vectors.ts when 008 needed the same `vector` type on chunks —
 * one definition, one wire-format contract, two tables.
 */
import { customType } from "drizzle-orm/pg-core";

// pgvector's `vector` type, deliberately un-dimensioned (007 research R8):
// dimension is a property of the configured embedding model, not the schema.
// pgvector's wire format is the text literal "[1,2,3]", hence toDriver joins
// a number[] into brackets and fromDriver strips/splits it back. The filter
// guards the empty-vector literal "[]", which would otherwise map to [NaN].
export const vector = customType<{ data: number[]; driverData: string }>({
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

// Raw bytes for content-addressed source archives (008 research R1). node-pg
// hands bytea back as a Buffer already; the bridge only names the type.
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// Postgres full-text search vector (008 research R5). Only ever written by
// the database itself (GENERATED ALWAYS AS on chunks.fts) — the app reads it
// never, queries against it later (retrieval spec). String bridge suffices.
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});
