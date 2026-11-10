import { project, type StoredEvent } from "@the-stacks/session-model";
import { fixtures } from "@the-stacks/session-model/fixtures";
import { compact, getById, getByName } from "@the-stacks/srd";
import { buildFactSheet, type FactSheet } from "../../src/dm/fact-sheet.js";
import type { NarrationFacts } from "../../src/dm/facts.js";
import type { TurnCheckpoint } from "../../src/dm/jobs.js";
import type {
  NodeDeps,
  NodeOutputs,
  TurnContext,
  TurnJobRef,
} from "../../src/dm/pipeline/context.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import type { SceneSeed } from "../../src/dm/seed/schema.js";

export const SESSION_ID = "00000000-0000-4000-8000-000000000102";

export function testSeed(): SceneSeed {
  return loadSeed("greyhollow-ford");
}

export function emptyCheckpoint(): TurnCheckpoint {
  return {
    beat: null,
    npcTurn: null,
    director: null,
    interpret: null,
    adjudicate: null,
    submissions: [],
    lastSeq: 0,
    narration: null,
  };
}

export function fixtureEvents(name: string): StoredEvent[] {
  const f = fixtures.find((x) => x.name === name);
  if (!f) throw new Error(`no fixture ${name}`);
  return [...f.events];
}

/** Events of `free-mode-action` up to (and including) the first row of `type`. */
export function freeEventsThrough(type: string): StoredEvent[] {
  const events = fixtureEvents("free-mode-action");
  const idx = events.findIndex((e) => e.type === type);
  if (idx === -1) throw new Error(`no ${type} row`);
  return events.slice(0, idx + 1);
}

export function row(
  seq: number,
  actor: string,
  type: string,
  payload: unknown,
  visibility = "public",
): StoredEvent {
  return {
    sessionId: SESSION_ID,
    seq,
    actor,
    type,
    payload,
    payloadVersion: 1,
    visibility,
    ts: `2026-10-26T19:00:${String(seq % 60).padStart(2, "0")}.000Z`,
  };
}

export function declare(
  seq: number,
  actionId: string,
  characterId: string,
  text: string,
): StoredEvent {
  return row(seq, "00000000-0000-4000-8000-000000000001", "action.declared", {
    actionId,
    characterId,
    scope: "character",
    text,
  });
}

export function commit(seq: number, actionId: string): StoredEvent {
  return row(seq, "00000000-0000-4000-8000-000000000001", "action.committed", {
    actionId,
    authority: "declarer",
  });
}

export function projectDm(events: StoredEvent[]) {
  return project(events, { role: "dm" });
}

export function baseJob(over: Partial<TurnJobRef> = {}): TurnJobRef {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    sessionId: SESSION_ID,
    trigger: "commit",
    triggerSeq: null,
    forceResolve: false,
    attempt: 1,
    claimToken: "00000000-0000-4000-8000-0000000000bb",
    ...over,
  };
}

export function makeDeps(over: Partial<NodeDeps> = {}): NodeDeps {
  return {
    gateway: {
      chat: () => {
        throw new Error("no gateway in this test");
      },
    },
    gate: {
      submit: async () => {
        throw new Error("no gate in this test");
      },
    } as unknown as NodeDeps["gate"],
    retrieve: async () => {
      throw new Error("no retrieve in this test");
    },
    loadProjections: async () => projectDm([]),
    srd: { getById, getByName, compact } as NodeDeps["srd"],
    fence: async () => true,
    setStage: async () => true,
    saveCheckpoint: async () => true,
    newId: () => "id-1",
    log: () => {},
    minSimilarity: 0.3,
    ...over,
  };
}

export function makeCtx(
  over: {
    deps?: Partial<NodeDeps>;
    job?: Partial<TurnJobRef>;
    seed?: SceneSeed;
    checkpoint?: Partial<TurnCheckpoint>;
    results?: Partial<NodeOutputs>;
    signal?: AbortSignal;
  } = {},
): TurnContext {
  return {
    job: baseJob(over.job),
    deps: makeDeps(over.deps),
    signal: over.signal ?? new AbortController().signal,
    seed: over.seed ?? testSeed(),
    checkpoint: { ...emptyCheckpoint(), ...over.checkpoint },
    results: over.results ?? {},
  };
}

/** A minimal fact sheet over `facts` (no beat, free mode), for tests that build a NarrateOutput by hand. */
export function testSheet(facts: NarrationFacts): FactSheet {
  return buildFactSheet({
    settled: facts,
    beat: [],
    projections: {
      party: [],
      tableMode: { mode: "free" },
      encounter: null,
    } as never,
    nameOf: (id) => id ?? "The scene",
    submissions: [],
  });
}
