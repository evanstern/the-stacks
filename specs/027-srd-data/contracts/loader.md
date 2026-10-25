# Contract: the SRD loader API

Normative. Exported from `@the-stacks/srd` (entry `packages/srd/src/index.ts`). Node-only:
the loader reads `packages/srd/data/<kind>.json` with `node:fs`. The web client never
imports this entry; it imports `@the-stacks/srd/attribution` only (`attribution.md`).

```ts
export type SrdKind = "monster" | "spell" | "class" | "equipment" | "condition";
export type SrdRecord<K extends SrdKind> = /* z.infer of RecordSchemas[K] */;

/** Every record of a kind, in SRD order (page, then name). Validated on first call. */
export function list<K extends SrdKind>(kind: K): readonly SrdRecord<K>[];

/** One record by id, or undefined when no record has that id. */
export function getById<K extends SrdKind>(kind: K, id: string): SrdRecord<K> | undefined;

/** One record by name, or undefined. Matching uses normalizeName on both sides. */
export function getByName<K extends SrdKind>(kind: K, name: string): SrdRecord<K> | undefined;

/** The compact lookup form (compact.md) of the record with this id or name, or undefined. */
export function compact(kind: SrdKind, idOrName: string): string | undefined;

/** Lower case, trim, collapse inner whitespace, map ’ and ‘ to ', NFKC. */
export function normalizeName(name: string): string;

/** Thrown when a shipped data file fails validation or has a duplicate id or name. */
export class SrdDataError extends Error {
  readonly kind: SrdKind;
  readonly recordId: string | undefined;
  readonly path: readonly (string | number)[]; // Zod issue path
}
```

Also exported for reuse (TASK-0064 holds imported records to the same rules): the schemas
(`records.md`), `toCompact(kind, record)` and `estimateTokens(text)` (`compact.md`), and
`SRD_ATTRIBUTION` (`attribution.md`).

## Behavior

| Case | Result |
|---|---|
| Known id | The record, typed by kind. |
| Known name, any case, curly or straight apostrophe, extra spaces | The record. |
| Unknown id or name | `undefined`. Never throws. |
| `compact` with an id that is also another record's name | Id wins. |
| Data file fails validation | `SrdDataError` on the first call for that kind, naming kind, record id and Zod path. |
| Two records share an id or a normalized name in one kind | `SrdDataError` on first load. |
| Repeated calls | Served from the per-kind cache; files are read and validated once per process. |

The loader holds no game logic. It never rolls, computes a modifier, or derives a number the
data does not state (constitution VI). It does not import `@the-stacks/dnd5e-engine`,
`@the-stacks/shared`, or any app.

## Agent access (constitution I)

The DM runtime's tools (TASK-0046) call `getByName` / `compact` on behalf of the model. The
model sees compact forms in prompts and asks for a full record by id through the same API.
There is no human-only path: the About page reads the same `SRD_ATTRIBUTION` export an agent
can read.
