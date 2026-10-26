import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ZodIssue } from "zod";
import { toCompact } from "./compact.js";
import { RecordSchemas, type SrdKind, type SrdRecord } from "./schema/index.js";

/** Thrown when a shipped data file fails validation or has a duplicate id or name. */
export class SrdDataError extends Error {
  readonly kind: SrdKind;
  readonly recordId: string | undefined;
  readonly path: readonly (string | number)[];

  constructor(
    message: string,
    kind: SrdKind,
    recordId: string | undefined,
    path: readonly (string | number)[],
  ) {
    super(message);
    this.name = "SrdDataError";
    this.kind = kind;
    this.recordId = recordId;
    this.path = path;
  }
}

/** Lower case, trim, collapse inner whitespace, map curly apostrophes to ', NFKC. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

interface KindCache {
  records: readonly unknown[];
  byId: Map<string, unknown>;
  byName: Map<string, unknown>;
}

export interface Loader {
  list<K extends SrdKind>(kind: K): readonly SrdRecord<K>[];
  getById<K extends SrdKind>(kind: K, id: string): SrdRecord<K> | undefined;
  getByName<K extends SrdKind>(kind: K, name: string): SrdRecord<K> | undefined;
  compact(kind: SrdKind, idOrName: string): string | undefined;
}

const defaultDataDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
);

/** Internal factory. The data directory is injectable for tests; it is not exported from the package entry. */
export function createLoader(dataDir: string = defaultDataDir): Loader {
  const cache = new Map<SrdKind, KindCache>();

  function load(kind: SrdKind): KindCache {
    const hit = cache.get(kind);
    if (hit) return hit;
    const file = join(dataDir, `${kind}.json`);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      throw new SrdDataError(
        `Cannot read ${file}: ${(error as Error).message}`,
        kind,
        undefined,
        [],
      );
    }
    if (!Array.isArray(raw)) {
      throw new SrdDataError(
        `${file} is not a JSON array`,
        kind,
        undefined,
        [],
      );
    }
    const schema = RecordSchemas[kind];
    const records: unknown[] = [];
    const byId = new Map<string, unknown>();
    const byName = new Map<string, unknown>();
    for (const [index, item] of raw.entries()) {
      const parsed = schema.safeParse(item);
      if (!parsed.success) {
        const issue: ZodIssue | undefined = parsed.error.issues[0];
        const id =
          typeof (item as { id?: unknown })?.id === "string"
            ? (item as { id: string }).id
            : undefined;
        const path = [
          index,
          ...(issue?.path.map((p) => p as string | number) ?? []),
        ];
        throw new SrdDataError(
          `${kind} record ${id ?? `#${index}`} invalid at ${path.join(".")}: ${issue?.message ?? "invalid"}`,
          kind,
          id,
          path,
        );
      }
      const record = parsed.data as { id: string; name: string };
      if (byId.has(record.id)) {
        throw new SrdDataError(
          `Duplicate ${kind} id: ${record.id}`,
          kind,
          record.id,
          [index, "id"],
        );
      }
      const key = normalizeName(record.name);
      if (byName.has(key)) {
        throw new SrdDataError(
          `Duplicate ${kind} name: ${record.name}`,
          kind,
          record.id,
          [index, "name"],
        );
      }
      byId.set(record.id, record);
      byName.set(key, record);
      records.push(record);
    }
    const entry: KindCache = { records, byId, byName };
    cache.set(kind, entry);
    return entry;
  }

  function list<K extends SrdKind>(kind: K): readonly SrdRecord<K>[] {
    return load(kind).records as readonly SrdRecord<K>[];
  }
  function getById<K extends SrdKind>(
    kind: K,
    id: string,
  ): SrdRecord<K> | undefined {
    return load(kind).byId.get(id) as SrdRecord<K> | undefined;
  }
  function getByName<K extends SrdKind>(
    kind: K,
    name: string,
  ): SrdRecord<K> | undefined {
    return load(kind).byName.get(normalizeName(name)) as
      | SrdRecord<K>
      | undefined;
  }
  function compact(kind: SrdKind, idOrName: string): string | undefined {
    const record = getById(kind, idOrName) ?? getByName(kind, idOrName);
    return record ? toCompact(kind, record as never) : undefined;
  }
  return { list, getById, getByName, compact };
}

const shared = createLoader();

export const list = shared.list;
export const getById = shared.getById;
export const getByName = shared.getByName;
export const compact = shared.compact;
