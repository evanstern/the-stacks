# Contract: package API and server seam

## `@the-stacks/session-model` public surface (`src/index.ts`)

```ts
// Rows and identities.
export { StoredEventSchema, RefIdSchema, ActorIdSchema, VisibilitySchema, PUBLIC, DM_ONLY };
export type { StoredEvent };

// Visibility (session-events.md, "Visibility").
export type Viewer = { role: "dm" } | { role: "player"; userId: string };
export function canSee(viewer: Viewer, visibility: string): boolean;

// Catalog and decoding (session-events.md).
export type EventKind = "talk" | "lifecycle" | "state-change" | "marker" | "record";
export interface CatalogEntry {
  type: string;
  version: number;
  kind: EventKind;
  visibility: "any" | "dm-only";
  schema: z.ZodType;
  current: boolean;                               // the version the server appends today
}
export const catalog: readonly CatalogEntry[];
export function catalogEntry(type: string, version: number): CatalogEntry | undefined;
export function currentVersion(type: string): number | undefined;
export const SESSION_EVENT_TYPES: readonly string[];   // session-native types
export const MECHANICS_EVENT_TYPES: readonly string[]; // the 18 engine types
export function decodeEvent(stored: StoredEvent): DecodeResult;
export type { DecodeResult, SessionEvent };

// Payload schemas and inferred types: every *V1 schema in session-events.md, plus
// TableModeSchema, SceneSchema, PartyMemberSchema, ControllerSchema, TrackerSchema.

// Projections (projections.md).
export function emptyProjections(viewer: Viewer): SessionProjections;
export function applyEvent(p: SessionProjections, event: StoredEvent): SessionProjections;
export function project(events: Iterable<StoredEvent>, viewer: Viewer): SessionProjections;
export type {
  SessionProjections, Diagnostics, TranscriptEntry, ActionView, ActionStatus,
  PartyMemberView, EncounterView, JournalEntryView, LedgerRow,
};
```

Fixture subpath (`@the-stacks/session-model/fixtures`): see [fixtures.md](fixtures.md).

`package.json`:

```json
{
  "name": "@the-stacks/session-model",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./fixtures": { "types": "./dist/fixtures/index.d.ts", "default": "./dist/fixtures/index.js" }
  },
  "dependencies": { "@the-stacks/dnd5e-engine": "workspace:*", "zod": "^4.6.5" },
  "devDependencies": { "vitest": "^5.0.1" }
}
```

Engine event subtypes (`DiceRolledEvent` and so on) are `Extract<EngineEvent, { type: … }>`;
the engine package's exports do not change.

## Server seam (`apps/server/src/session/`)

The session plane's directory. It may import `@the-stacks/session-model`,
`@the-stacks/dnd5e-engine` and `../events/log.js`; `biome.json` already forbids it from
importing `library/` and `codex/`.

```ts
// events.ts
export class SessionEventRefused extends Error {
  readonly code: AppendRefusalCode;               // session-events.md, "Append refusal codes"
  readonly issues: string[];
}

export interface AppendSessionEventInput {
  sessionId: string;
  actor: string;
  type: string;
  payload: unknown;
  visibility?: string;                            // default "public"
}

/** Validates against the current catalog version, then calls M0 append. Throws SessionEventRefused; writes nothing on refusal. */
export function appendSessionEvent(db: DbClient, input: AppendSessionEventInput): Promise<StoredEvent>;

export interface AppendMechanicsBatchInput {
  sessionId: string;
  actor: string;
  events: readonly EngineEvent[];                 // one execute result, in order; length >= 1
  actionId: string | null;
  proposalId: string | null;
  visibility?: string;                            // applies to every row of the batch
}

/** Assigns batchId (randomUUID), wraps each event, appends in order. Not atomic (research R10). */
export function appendMechanicsBatch(
  db: DbClient, input: AppendMechanicsBatchInput,
): Promise<{ batchId: string; events: StoredEvent[] }>;

/** RecordedEvent (Drizzle row, Date ts) → StoredEvent (ISO ts). */
export function toStoredEvent(row: RecordedEvent): StoredEvent;

// projections.ts
/** Reads the whole log from seq 0 in readFrom batches of 200 and folds it for the viewer. */
export function loadProjections(db: DbClient, sessionId: string, viewer: Viewer): Promise<SessionProjections>;
```

Agent interface (constitution I): the AI DM and AI companions (TASK-0046) call these same
functions, through the gate (TASK-0045), with actors `ai:dm` and `ai:companion:<id>`.

## Not in this card

- The WebSocket `send` path, `registry.ts` and `subscribe.ts` are unchanged. TASK-0045 routes
  writes through the seam above and adopts `canSee` for live delivery of `dm` events.
  TASK-0095 (another session) owns the replay/live duplicate fix.
- No REST route and no new WebSocket frame. A client folds the events it already receives
  with `applyEvent`.
